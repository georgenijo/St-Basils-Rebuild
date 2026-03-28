-- Migration: Create admin_audit_log table
-- Issue: #134
--
-- Append-only audit trail for admin user-management actions.
-- Depends on #133 (is_admin() checks is_active = true).

-- ─── Table ────────────────────────────────────────────────────────────

CREATE TABLE public.admin_audit_log (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id       UUID NOT NULL REFERENCES auth.users(id),
  action         TEXT NOT NULL CHECK (action IN (
                   'user.invite', 'user.role_change', 'user.deactivate',
                   'user.reactivate', 'user.password_reset'
                 )),
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ─── Indexes ──────────────────────────────────────────────────────────

CREATE INDEX idx_admin_audit_log_target_user_id ON public.admin_audit_log(target_user_id);
CREATE INDEX idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: admins can read the log
CREATE POLICY "Admins can read audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- INSERT: admins can write new entries
CREATE POLICY "Admins can insert audit log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- No UPDATE or DELETE policies — audit log is append-only.
