-- Role changes for store owners + readable user list for admins
-- Safe to re-run in the Supabase SQL editor

DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'staff';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cashier';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role::text = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_erp_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role::text IN ('super_admin', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_erp_admin() TO authenticated;

GRANT SELECT, UPDATE ON public.users TO authenticated;

DROP POLICY IF EXISTS "Users admin read all" ON public.users;
CREATE POLICY "Users admin read all" ON public.users
  FOR SELECT
  USING (auth.uid() = id OR public.is_erp_admin() OR public.is_admin());

DROP POLICY IF EXISTS "Users super admin update" ON public.users;
CREATE POLICY "Users super admin update" ON public.users
  FOR UPDATE
  USING (public.is_erp_admin())
  WITH CHECK (public.is_erp_admin());

CREATE OR REPLACE FUNCTION public.admin_set_user_role(target_id uuid, new_role text)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  target_role text;
  result public.users;
BEGIN
  SELECT role::text INTO actor_role FROM public.users WHERE id = auth.uid();
  SELECT role::text INTO target_role FROM public.users WHERE id = target_id;

  IF actor_role IS NULL OR actor_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Only admin or super admin can change user roles';
  END IF;

  IF new_role NOT IN ('customer', 'admin', 'super_admin', 'staff', 'cashier') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF target_id = auth.uid() AND actor_role = 'super_admin' AND new_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'You cannot remove your own super admin role';
  END IF;

  IF actor_role IS DISTINCT FROM 'super_admin' THEN
    IF new_role = 'super_admin' THEN
      RAISE EXCEPTION 'Only super admin can assign the super admin role';
    END IF;
    IF target_role = 'super_admin' THEN
      RAISE EXCEPTION 'Only super admin can change a super admin account';
    END IF;
  END IF;

  UPDATE public.users
  SET role = new_role::public.user_role
  WHERE id = target_id
  RETURNING * INTO result;

  IF result IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
