import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GLPI_API_URL,
  GLPI_APP_TOKEN,
  GLPI_USER_TOKEN,
  GLPI_WORKER_INTERVAL_MS = '10000',
  GLPI_WORKER_MAX_ATTEMPTS = '5',
} = process.env;

const requiredEnv = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GLPI_API_URL,
  GLPI_APP_TOKEN,
  GLPI_USER_TOKEN,
};

for (const [key, value] of Object.entries(requiredEnv)) {
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const intervalMs = Number(GLPI_WORKER_INTERVAL_MS);
const maxAttempts = Number(GLPI_WORKER_MAX_ATTEMPTS);

function glpiUrl(path) {
  return `${GLPI_API_URL}${path}`;
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function initSession() {
  const response = await fetch(glpiUrl('/initSession'), {
    method: 'GET',
    headers: {
      'App-Token': GLPI_APP_TOKEN,
      Authorization: `user_token ${GLPI_USER_TOKEN}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GLPI initSession failed: HTTP ${response.status} ${body}`);
  }

  const data = await response.json();
  return data.session_token;
}

async function killSession(sessionToken) {
  await fetch(glpiUrl('/killSession'), {
    method: 'GET',
    headers: {
      'App-Token': GLPI_APP_TOKEN,
      'Session-Token': sessionToken,
    },
  }).catch((error) => {
    console.error('Failed to close GLPI session:', toErrorMessage(error));
  });
}

async function createGlpiTicket(ticket) {
  let sessionToken = null;

  try {
    sessionToken = await initSession();

    const response = await fetch(glpiUrl('/Ticket'), {
      method: 'POST',
      headers: {
        'App-Token': GLPI_APP_TOKEN,
        'Session-Token': sessionToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          name: ticket.title,
          content: ticket.description,
          urgency: 3,
          impact: 3,
          priority: 3,
          type: 1,
          requesttypes_id: 1,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GLPI create ticket failed: HTTP ${response.status} ${body}`);
    }

    return await response.json();
  } finally {
    if (sessionToken) {
      await killSession(sessionToken);
    }
  }
}

async function claimTicket() {
  const { data, error } = await supabase.rpc('claim_next_glpi_ticket', {
    p_max_attempts: maxAttempts,
  });

  if (error) {
    throw new Error(`Supabase claim failed: ${error.message}`);
  }

  return data?.[0] ?? null;
}

async function markSent(ticket, glpiResponse) {
  const { error } = await supabase
    .from('glpi_ticket_queue')
    .update({
      status: 'sent',
      glpi_ticket_id: glpiResponse?.id ? String(glpiResponse.id) : null,
      last_error: null,
      sent_at: new Date().toISOString(),
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticket.id);

  if (error) {
    throw new Error(`Supabase sent update failed: ${error.message}`);
  }
}

async function markFailed(ticket, errorMessage) {
  const nextStatus = ticket.attempts >= maxAttempts ? 'failed' : 'pending';

  const { error } = await supabase
    .from('glpi_ticket_queue')
    .update({
      status: nextStatus,
      last_error: errorMessage.slice(0, 1000),
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticket.id);

  if (error) {
    console.error(`Supabase failed update failed: ${error.message}`);
  }
}

async function workOnce() {
  const ticket = await claimTicket();

  if (!ticket) {
    return;
  }

  console.log(`Sending queued ticket ${ticket.id}: ${ticket.title}`);

  try {
    const glpiResponse = await createGlpiTicket(ticket);
    await markSent(ticket, glpiResponse);
    console.log(`Ticket ${ticket.id} sent to GLPI as ${glpiResponse?.id ?? 'unknown id'}`);
  } catch (error) {
    const message = toErrorMessage(error);
    await markFailed(ticket, message);
    console.error(`Ticket ${ticket.id} failed: ${message}`);
  }
}

console.log('LabManager GLPI worker started');

setInterval(() => {
  workOnce().catch((error) => {
    console.error(toErrorMessage(error));
  });
}, intervalMs);

workOnce().catch((error) => {
  console.error(toErrorMessage(error));
});
