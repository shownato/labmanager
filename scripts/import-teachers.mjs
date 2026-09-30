import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { validateTeachers, planTeachers, applyTeachers } from './lib/teachers-import.mjs';

async function main() {
  const { values } = parseArgs({ options: {
    file: { type: 'string', default: '.private/teachers-import.json' },
    apply: { type: 'boolean', default: false },
    preflight: { type: 'boolean', default: false },
    'project-url': { type: 'string' },
  } });
  const teachers = validateTeachers(JSON.parse((await readFile(values.file, 'utf8')).replace(/^\uFEFF/, '')));
  console.log(`Lista válida: ${teachers.length} professores, sem logins duplicados.`);
  if (!values.apply && !values.preflight) {
    console.log('Simulação local: nenhuma conexão ou alteração no Supabase. Use --preflight para conferir o destino.');
    return;
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente administrativo local.');
  const target = new URL(url);
  if (target.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(target.hostname)) {
    throw new Error('Use HTTPS para enviar a chave administrativa.');
  }
  if (values.apply && values['project-url']?.replace(/\/$/, '') !== url.replace(/\/$/, '')) {
    throw new Error('Informe --project-url com a URL do projeto autorizado para aplicar a importação.');
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  console.log(`Projeto: ${target.origin}`);
  const { error: schemaError } = await client.from('user_profiles').select('id, email, full_name, role').limit(1);
  if (schemaError) throw new Error('Schema de perfis indisponível. Aplique supabase-teacher-profiles.sql após revisar o banco.');
  const plan = await planTeachers(client.auth.admin, teachers);
  for (const { teacher, user } of plan.skip) {
    const { data: profile, error } = await client.from('user_profiles')
      .select('id, role, email, full_name').eq('id', user.id).single();
    if (error || profile?.email !== teacher.email || !profile?.full_name || !['user', 'admin'].includes(profile?.role)) {
      throw new Error('Uma conta já importada está sem perfil válido. Corrija o perfil antes de continuar.');
    }
  }
  console.log(`Plano: ${plan.create.length} novas contas; ${plan.skip.length} existentes preservadas.`);
  if (!values.apply) {
    console.log('Pré-verificação concluída, sem alterações.');
    return;
  }
  const result = await applyTeachers(client, plan, (done, total) => console.log(`Criadas e verificadas: ${done}/${total}`));
  console.log(`Concluído: ${result.created} contas criadas, ${result.skipped} preservadas. Nenhum e-mail enviado.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Falha na importação.');
  process.exitCode = 1;
});
