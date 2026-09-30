-- Executar uma vez no SQL Editor; contas autorizadas são cadastradas separadamente.
BEGIN;

CREATE TABLE IF NOT EXISTS public.maintenance_technicians (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.maintenance_technicians ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.maintenance_technicians FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.maintenance_technicians TO service_role;

CREATE OR REPLACE FUNCTION public.can_resolve_pc_issue()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.maintenance_technicians WHERE user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.can_resolve_pc_issue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_resolve_pc_issue() TO authenticated;

-- O cliente mantém os parâmetros antigos por compatibilidade; autoria vem da sessão.
CREATE OR REPLACE FUNCTION public.report_pc_issue(
  p_pc_name text, p_lab_id integer, p_reason text, p_notes text,
  p_user_name text, p_user_email text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name text;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE = '42501';
  END IF;
  IF p_lab_id IS NULL OR p_lab_id NOT BETWEEN 1 AND 10 OR p_pc_name IS NULL OR
    NOT EXISTS (SELECT 1 FROM generate_series(0, CASE WHEN p_lab_id IN (5,7) THEN 35 ELSE 30 END) n
                WHERE p_pc_name = 'LAB' || (p_lab_id * 100 + n)::text) THEN
    RAISE EXCEPTION 'Computador inválido' USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(nullif(p.full_name, ''), u.email), u.email INTO v_name, v_email
    FROM auth.users u LEFT JOIN public.user_profiles p ON p.id = u.id WHERE u.id = auth.uid();
  INSERT INTO public.pc_status (pc_name, lab_id, status, reason, notes, reported_by, reported_at, resolved_at, resolved_by)
    VALUES (p_pc_name, p_lab_id, 'maintenance', p_reason, p_notes, v_name, now(), NULL, NULL)
    ON CONFLICT (pc_name) DO UPDATE SET status = 'maintenance', reason = EXCLUDED.reason,
      notes = EXCLUDED.notes, reported_by = EXCLUDED.reported_by, reported_at = now(),
      resolved_at = NULL, resolved_by = NULL, updated_at = now();
  INSERT INTO public.maintenance_log (pc_name, lab_id, action, status, reason, notes, performed_by, performed_by_email)
    VALUES (p_pc_name, p_lab_id, 'reported', 'maintenance', p_reason, p_notes, v_name, v_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_pc_issue(
  p_pc_name text, p_lab_id integer, p_notes text, p_user_name text, p_user_email text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_name text;
  v_email text;
BEGIN
  IF NOT public.can_resolve_pc_issue() THEN
    RAISE EXCEPTION 'Somente a equipe autorizada pode liberar o computador' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(nullif(p.full_name, ''), u.email), u.email INTO v_name, v_email
    FROM auth.users u LEFT JOIN public.user_profiles p ON p.id = u.id WHERE u.id = auth.uid();
  UPDATE public.pc_status SET status = 'ok', reason = NULL, notes = NULL,
    reported_by = NULL, reported_at = NULL, resolved_at = now(), resolved_by = v_name, updated_at = now()
    WHERE pc_name = p_pc_name AND lab_id = p_lab_id AND status = 'maintenance';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Computador não está em manutenção. Atualize a página.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.maintenance_log (pc_name, lab_id, action, status, reason, notes, performed_by, performed_by_email)
    VALUES (p_pc_name, p_lab_id, 'resolved', 'ok', 'Problema Resolvido', p_notes, v_name, v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.report_pc_issue(text, integer, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_pc_issue(text, integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_pc_issue(text, integer, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_pc_issue(text, integer, text, text, text) TO authenticated;

-- Impede contornar as RPCs alterando status/histórico diretamente.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.pc_status, public.maintenance_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pc_status, public.maintenance_log TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
