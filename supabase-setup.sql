-- ============================================
-- LabManager - Supabase Database Setup
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- 1. Tabela: pc_status (status atual de cada PC)
CREATE TABLE IF NOT EXISTS pc_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pc_name TEXT NOT NULL UNIQUE,
  lab_id INTEGER NOT NULL CHECK (lab_id >= 1 AND lab_id <= 10),
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'maintenance')),
  reason TEXT,
  notes TEXT,
  reported_by TEXT,
  reported_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela: maintenance_log (histórico de todas as manutenções)
CREATE TABLE IF NOT EXISTS maintenance_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pc_name TEXT NOT NULL,
  lab_id INTEGER NOT NULL CHECK (lab_id >= 1 AND lab_id <= 10),
  action TEXT NOT NULL CHECK (action IN ('reported', 'resolved')),
  status TEXT,
  reason TEXT NOT NULL,
  notes TEXT,
  performed_by TEXT NOT NULL,
  performed_by_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indices para performance
CREATE INDEX IF NOT EXISTS idx_pc_status_lab ON pc_status(lab_id);
CREATE INDEX IF NOT EXISTS idx_pc_status_status ON pc_status(status);
CREATE INDEX IF NOT EXISTS idx_pc_status_name ON pc_status(pc_name);
CREATE INDEX IF NOT EXISTS idx_maintenance_log_lab ON maintenance_log(lab_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_log_action ON maintenance_log(action);
CREATE INDEX IF NOT EXISTS idx_maintenance_log_created ON maintenance_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_log_pc ON maintenance_log(pc_name);

-- 4. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pc_status_updated_at
  BEFORE UPDATE ON pc_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 5. Enable Row Level Security (RLS)
ALTER TABLE pc_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_log ENABLE ROW LEVEL SECURITY;

-- 6. Policies: qualquer usuário autenticado pode ler e escrever
-- (todos os técnicos e professores precisam de acesso completo)
CREATE POLICY "Authenticated users can read pc_status"
  ON pc_status FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert pc_status"
  ON pc_status FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update pc_status"
  ON pc_status FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read maintenance_log"
  ON maintenance_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert maintenance_log"
  ON maintenance_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 7. Funções Atômicas (RPC) para garantir integridade (Pilar do Iceberg)
CREATE OR REPLACE FUNCTION report_pc_issue(
  p_pc_name TEXT,
  p_lab_id INTEGER,
  p_reason TEXT,
  p_notes TEXT,
  p_user_name TEXT,
  p_user_email TEXT
) RETURNS VOID AS $$
DECLARE
  v_status TEXT := 'maintenance';
BEGIN
  -- Atualiza ou Insere o Status
  INSERT INTO pc_status (pc_name, lab_id, status, reason, notes, reported_by, reported_at, resolved_at, resolved_by)
  VALUES (p_pc_name, p_lab_id, v_status, p_reason, p_notes, p_user_name, NOW(), NULL, NULL)
  ON CONFLICT (pc_name) DO UPDATE SET
    status = EXCLUDED.status,
    reason = EXCLUDED.reason,
    notes = EXCLUDED.notes,
    reported_by = EXCLUDED.reported_by,
    reported_at = EXCLUDED.reported_at,
    resolved_at = NULL,
    resolved_by = NULL,
    updated_at = NOW();

  -- Insere o Log
  INSERT INTO maintenance_log (pc_name, lab_id, action, status, reason, notes, performed_by, performed_by_email)
  VALUES (p_pc_name, p_lab_id, 'reported', v_status, p_reason, p_notes, p_user_name, p_user_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION resolve_pc_issue(
  p_pc_name TEXT,
  p_lab_id INTEGER,
  p_notes TEXT,
  p_user_name TEXT,
  p_user_email TEXT
) RETURNS VOID AS $$
BEGIN
  -- Atualiza o Status para OK
  UPDATE pc_status SET
    status = 'ok',
    reason = NULL,
    notes = NULL,
    reported_by = NULL,
    reported_at = NULL,
    resolved_at = NOW(),
    resolved_by = p_user_name,
    updated_at = NOW()
  WHERE pc_name = p_pc_name AND lab_id = p_lab_id;

  -- Insere o Log
  INSERT INTO maintenance_log (pc_name, lab_id, action, status, reason, notes, performed_by, performed_by_email)
  VALUES (p_pc_name, p_lab_id, 'resolved', 'ok', 'Problema Resolvido', p_notes, p_user_name, p_user_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. Enable Realtime para pc_status
ALTER PUBLICATION supabase_realtime ADD TABLE pc_status;


-- 9. View para Sumário dos Labs (Pilar de Performance/Eficiência)
CREATE OR REPLACE VIEW lab_summary_view AS
SELECT 
  lab_id,
  count(*) as total,
  count(*) FILTER (WHERE status = 'ok') as ok,
  count(*) FILTER (WHERE status = 'maintenance') as maintenance
FROM pc_status
GROUP BY lab_id;

-- 10. Tabela de Perfis de Usuário (Controle de Acesso)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para Perfis
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Trigger para criar perfil automaticamente no Signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Permissões para a View
ALTER VIEW lab_summary_view OWNER TO postgres;
GRANT SELECT ON lab_summary_view TO authenticated;
GRANT SELECT ON lab_summary_view TO anon;


-- ============================================
-- PRONTO! O banco de dados está configurado.
-- ============================================

