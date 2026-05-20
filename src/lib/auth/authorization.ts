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

  if (authorizedEmails.size === 0 && authorizedDomains.size === 0) {
    return true;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split('@')[1];

  return authorizedEmails.has(normalizedEmail) || Boolean(domain && authorizedDomains.has(domain));
}

export function getAuthorizationHelpText() {
  if (authorizedEmails.size === 0 && authorizedDomains.size === 0) {
    return 'Acesso permitido para usuarios autenticados.';
  }

  return 'Use um e-mail autorizado pela equipe CCI.';
}
