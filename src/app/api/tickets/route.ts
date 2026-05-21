import { NextResponse } from 'next/server';
import { createTicket } from '@/lib/glpi';
import { createClient } from '@/lib/supabase/server';
import { isEmailAuthorized } from '@/lib/auth/authorization';

const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 4000;
const GLPI_DELIVERY_MODE = process.env.GLPI_DELIVERY_MODE || 'queue';

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isEmailAuthorized(user.email)) {
      return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const title = normalizeText(body.title, MAX_TITLE_LENGTH);
    const description = normalizeText(body.description, MAX_DESCRIPTION_LENGTH);

    if (!title || !description) {
      return NextResponse.json({ error: 'Titulo e descricao sao obrigatorios' }, { status: 400 });
    }

    if (GLPI_DELIVERY_MODE === 'queue') {
      const { error } = await supabase.from('glpi_ticket_queue').insert({
        title,
        description,
        requested_by: user.user_metadata?.full_name || user.email,
        requested_by_email: user.email,
      });

      if (error) {
        return NextResponse.json(
          {
            error: 'Falha ao enfileirar chamado para o GLPI',
            stage: 'queue',
            details: error.message,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        queued: true,
        message: 'Chamado enfileirado para envio ao GLPI',
      });
    }

    const result = await createTicket({
      name: title,
      content: description,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          stage: result.stage,
          status: result.status ?? null,
          endpoint: result.endpoint ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
