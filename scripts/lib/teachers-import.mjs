import { matriculaEmail, getMatriculaLogin } from '../../src/lib/auth/matricula.mjs';

export function validateTeachers(document) {
  if (document?.schemaVersion !== 1 || !Array.isArray(document.teachers) || !document.teachers.length) {
    throw new Error('Arquivo de importação vazio ou formato inválido. Execute prepare-teachers.py.');
  }
  const seen = new Set();
  return document.teachers.map((row, index) => {
    const label = `Registro ${index + 1}`;
    if (typeof row?.registration !== 'string' ||
        !/^[0-9]{6}[0-9.\s-]*$/.test(row.registration.trim()) ||
        typeof row.fullName !== 'string' || !row.fullName.trim()) {
      throw new Error(`${label}: matrícula ou nome inválido.`);
    }
    const registration = row.registration.trim();
    const login = registration.slice(0, 6);
    if (seen.has(login)) throw new Error(`${label}: login duplicado; importação cancelada.`);
    seen.add(login);
    return { registration, login, email: matriculaEmail(login), fullName: row.fullName.trim() };
  });
}

export async function planTeachers(admin, teachers) {
  const existing = new Map();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Não foi possível consultar usuários (${error.code || error.status || 'Auth'}).`);
    for (const user of data.users) existing.set(user.email?.toLowerCase(), user);
    if (data.users.length < 1000) break;
  }
  const create = [], skip = [];
  for (let i = 0; i < teachers.length; i++) {
    const teacher = teachers[i];
    const user = existing.get(teacher.email);
    if (!user) {
      create.push(teacher);
    } else if (getMatriculaLogin(user) === teacher.login &&
               user.app_metadata.matricula_full === teacher.registration) {
      skip.push({ teacher, user });
    } else {
      throw new Error(`Registro ${i + 1}: identificador já ocupado por outra conta. Nenhuma conta alterada.`);
    }
  }
  return { create, skip };
}

export async function applyTeachers(client, plan, onProgress = () => {}) {
  let created = 0;
  // Deliberately sequential. Never reset passwords or change existing accounts.
  for (const teacher of plan.create) {
    const { data, error } = await client.auth.admin.createUser({
      email: teacher.email,
      password: teacher.login,
      email_confirm: true,
      app_metadata: {
        labmanager_login_type: 'matricula',
        matricula_login: teacher.login,
        matricula_full: teacher.registration,
      },
      user_metadata: { full_name: teacher.fullName },
    });
    if (error || !data?.user) {
      throw new Error(`Importação interrompida após ${created} criações (${error?.code || error?.status || 'Auth'}). Corrija a causa e execute novamente; senhas existentes serão preservadas.`);
    }
    created++;
    const { data: profile, error: profileError } = await client.from('user_profiles')
      .select('id, role, full_name, email').eq('id', data.user.id).single();
    if (profileError || profile?.role !== 'user' || profile?.full_name !== teacher.fullName ||
        profile?.email !== teacher.email) {
      throw new Error(`Importação interrompida após ${created} criações: perfil não corresponde ao cadastro. Revise o trigger antes de continuar.`);
    }
    onProgress(created, plan.create.length);
  }
  return { created, skipped: plan.skip.length };
}
