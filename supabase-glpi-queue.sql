-- ============================================
-- LabManager - GLPI Queue Bridge
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

CREATE TABLE IF NOT EXISTS glpi_ticket_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  requested_by TEXT,
  requested_by_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  glpi_ticket_id TEXT,
  locked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_glpi_ticket_queue_status_created
  ON glpi_ticket_queue(status, created_at);

CREATE INDEX IF NOT EXISTS idx_glpi_ticket_queue_requested_email
  ON glpi_ticket_queue(requested_by_email);

ALTER TABLE glpi_ticket_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can enqueue GLPI tickets"
  ON glpi_ticket_queue FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read own GLPI ticket queue"
  ON glpi_ticket_queue FOR SELECT
  TO authenticated
  USING (requested_by_email = auth.jwt() ->> 'email');

CREATE OR REPLACE FUNCTION claim_next_glpi_ticket(p_max_attempts INTEGER DEFAULT 5)
RETURNS SETOF glpi_ticket_queue AS $$
BEGIN
  RETURN QUERY
  WITH next_ticket AS (
    SELECT id
    FROM glpi_ticket_queue
    WHERE status IN ('pending', 'failed')
      AND attempts < p_max_attempts
      AND (locked_at IS NULL OR locked_at < NOW() - INTERVAL '5 minutes')
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE glpi_ticket_queue queue
  SET
    status = 'processing',
    attempts = queue.attempts + 1,
    locked_at = NOW(),
    updated_at = NOW()
  FROM next_ticket
  WHERE queue.id = next_ticket.id
  RETURNING queue.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION claim_next_glpi_ticket(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_next_glpi_ticket(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION claim_next_glpi_ticket(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_next_glpi_ticket(INTEGER) TO service_role;

-- O worker do Ubuntu deve usar SUPABASE_SERVICE_ROLE_KEY.
-- Nao coloque a service role key na Vercel nem no frontend.
