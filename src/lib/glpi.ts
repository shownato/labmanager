/**
 * Utilitario de integracao com a API REST do GLPI.
 * Este modulo roda apenas no servidor para proteger os tokens.
 */

const GLPI_API_URL = process.env.GLPI_API_URL;
const GLPI_APP_TOKEN = process.env.GLPI_APP_TOKEN;
const GLPI_USER_TOKEN = process.env.GLPI_USER_TOKEN;

if (!GLPI_API_URL || !GLPI_APP_TOKEN || !GLPI_USER_TOKEN) {
  console.warn('Aviso: credenciais da API do GLPI ausentes. A integracao de chamados nao vai funcionar.');
}

export interface GlpiTicketInput {
  name: string;
  content: string;
  urgency?: number;
  impact?: number;
}

type GlpiFailureStage = 'config' | 'initSession' | 'createTicket' | 'network';

interface GlpiSuccessResult {
  success: true;
  ticketId: unknown;
  message: unknown;
}

interface GlpiFailureResult {
  success: false;
  error: string;
  stage: GlpiFailureStage;
  status?: number;
  endpoint?: string;
}

type GlpiResult = GlpiSuccessResult | GlpiFailureResult;

function buildGlpiUrl(path: string) {
  return `${GLPI_API_URL}${path}`;
}

function sanitizeEndpoint(url: string) {
  return url.replace(/\/\/([^/]+)/, '//***');
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Erro desconhecido ao comunicar com GLPI';
}

async function initSession(): Promise<{ sessionToken: string } | GlpiFailureResult> {
  const url = buildGlpiUrl('/initSession');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'App-Token': GLPI_APP_TOKEN!,
        Authorization: `user_token ${GLPI_USER_TOKEN!}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GLPI initSession erro:', errorText);
      return {
        success: false,
        error: `Falha ao iniciar sessao no GLPI: HTTP ${response.status}`,
        stage: 'initSession',
        status: response.status,
        endpoint: sanitizeEndpoint(url),
      };
    }

    const data = await response.json();
    return { sessionToken: data.session_token };
  } catch (error) {
    console.error('GLPI initSession falhou por rede:', error);
    return {
      success: false,
      error: toErrorMessage(error),
      stage: 'network',
      endpoint: sanitizeEndpoint(url),
    };
  }
}

function isGlpiFailureResult(
  result: { sessionToken: string } | GlpiFailureResult
): result is GlpiFailureResult {
  return 'success' in result && result.success === false;
}

async function killSession(sessionToken: string): Promise<void> {
  const url = buildGlpiUrl('/killSession');

  await fetch(url, {
    method: 'GET',
    headers: {
      'App-Token': GLPI_APP_TOKEN!,
      'Session-Token': sessionToken,
    },
  }).catch((error) => {
    console.error('Falha ao fechar sessao GLPI silenciosamente:', error);
  });
}

export async function createTicket(ticketData: GlpiTicketInput): Promise<GlpiResult> {
  if (!GLPI_API_URL || !GLPI_APP_TOKEN || !GLPI_USER_TOKEN) {
    return {
      success: false,
      error: 'Integracao com GLPI nao configurada no servidor.',
      stage: 'config',
    };
  }

  let sessionToken: string | null = null;

  try {
    const sessionResult = await initSession();

    if (isGlpiFailureResult(sessionResult)) {
      return sessionResult;
    }

    sessionToken = sessionResult.sessionToken;

    const url = buildGlpiUrl('/Ticket');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'App-Token': GLPI_APP_TOKEN!,
          'Session-Token': sessionToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: {
            name: ticketData.name,
            content: ticketData.content,
            urgency: ticketData.urgency || 3,
            impact: ticketData.impact || 3,
            priority: 3,
            type: 1,
            requesttypes_id: 1,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('GLPI createTicket erro:', errorText);
        return {
          success: false,
          error: `Falha ao criar chamado no GLPI: HTTP ${response.status}`,
          stage: 'createTicket',
          status: response.status,
          endpoint: sanitizeEndpoint(url),
        };
      }

      const data = await response.json();
      return {
        success: true,
        ticketId: data.id,
        message: data.message,
      };
    } catch (error) {
      console.error('GLPI createTicket falhou por rede:', error);
      return {
        success: false,
        error: toErrorMessage(error),
        stage: 'network',
        endpoint: sanitizeEndpoint(url),
      };
    }
  } finally {
    if (sessionToken) {
      await killSession(sessionToken);
    }
  }
}
