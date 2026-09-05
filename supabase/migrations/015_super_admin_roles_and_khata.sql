-- Super admin can change other users' roles (own-profile RLS previously blocked this)
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

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

GRANT SELECT, UPDATE ON public.users TO authenticated;

DROP POLICY IF EXISTS "Users super admin update" ON public.users;
CREATE POLICY "Users super admin update" ON public.users
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.admin_set_user_role(target_id uuid, new_role text)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  result public.users;
BEGIN
  SELECT role::text INTO actor_role FROM public.users WHERE id = auth.uid();
  IF actor_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'Only super admin can change user roles';
  END IF;
  IF target_id = auth.uid() AND new_role IS DISTINCT FROM 'super_admin' THEN
    RAISE EXCEPTION 'You cannot remove your own super admin role';
  END IF;
  IF new_role NOT IN ('customer', 'admin', 'super_admin', 'staff', 'cashier') THEN
    RAISE EXCEPTION 'Invalid role';
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

GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;

-- Editable voucher date on khata entries (Tally-style)
ALTER TABLE public.customer_credit
  ADD COLUMN IF NOT EXISTS entry_date DATE;
