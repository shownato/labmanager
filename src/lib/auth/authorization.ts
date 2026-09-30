import type { User } from '@supabase/supabase-js';
import { getMatriculaLogin, isMatriculaEmail } from './matricula.mjs';

const authorizedEmails = new Set(
  (process.env.AUTHORIZED_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);

const authorizedDomains = new Set(
  (process.env.AUTHORIZED_EMAIL_DOMAINS || '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean)
);

export function isEmailAuthorized(email?: string | null) {
  if (!email) return false;
  // Aliases require the trusted import marker, even when the allowlist is empty.
  if (isMatriculaEmail(email)) return false;

  if (authorizedEmails.size === 0 && authorizedDomains.size === 0) {
    return true;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split('@')[1];

  return authorizedEmails.has(normalizedEmail) || Boolean(domain && authorizedDomains.has(domain));
}

export function isUserAuthorized(user: Pick<User, 'email' | 'app_metadata'> | null) {
  if (!user) return false;
  if (isMatriculaEmail(user.email)) return getMatriculaLogin(user) !== null;
  return isEmailAuthorized(user.email);
}

export function getAuthorizationHelpText() {
  if (authorizedEmails.size === 0 && authorizedDomains.size === 0) {
    return 'Acesso permitido para usuarios autenticados.';
  }

  return 'Use um e-mail autorizado pela equipe CCI.';
}
