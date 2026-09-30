// Internal Auth identifier only. This reserved domain never receives email.
export const MATRICULA_AUTH_DOMAIN = 'matricula.labmanager.invalid';

/** @param {string} login */
export function matriculaEmail(login) {
  if (!/^[0-9]{6}$/.test(login)) {
    throw new Error('Informe exatamente os seis primeiros dígitos da matrícula.');
  }
  return `${login}@${MATRICULA_AUTH_DOMAIN}`;
}

/**
 * Trust only app_metadata written by the administrative import, never user_metadata.
 * @param {{email?: string | null, app_metadata?: Record<string, unknown>} | null | undefined} user
 */
export function getMatriculaLogin(user) {
  const login = user?.app_metadata?.matricula_login;
  if (user?.app_metadata?.labmanager_login_type !== 'matricula' ||
      typeof login !== 'string' || !/^[0-9]{6}$/.test(login)) return null;
  return user.email?.toLowerCase() === matriculaEmail(login) ? login : null;
}

/** @param {string | null | undefined} email */
export function isMatriculaEmail(email) {
  return email?.toLowerCase().endsWith(`@${MATRICULA_AUTH_DOMAIN}`) ?? false;
}
