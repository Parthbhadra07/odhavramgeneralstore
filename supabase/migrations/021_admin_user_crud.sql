-- =============================================================================
-- Migration 021: Admin User CRUD & Strict Super Admin Role Enforcement
-- Safe to re-run in the Supabase SQL editor
-- =============================================================================

-- 1. Ensure only super_admin can change user roles in admin_set_user_role
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
  -- Only super_admin can change user roles
  SELECT role::text INTO actor_role FROM public.users WHERE id = auth.uid();
  IF actor_role IS NULL OR actor_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super admin can change user roles';
  END IF;

  IF new_role NOT IN ('customer', 'admin', 'super_admin', 'staff', 'cashier') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;

  IF target_id = auth.uid() AND new_role != 'super_admin' THEN
    RAISE EXCEPTION 'You cannot remove your own super admin role';
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

-- 2. Function to delete a user account (strictly super_admin only)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  target_role text;
BEGIN
  -- Only super_admin can delete users
  SELECT role::text INTO actor_role FROM public.users WHERE id = auth.uid();
  IF actor_role IS NULL OR actor_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super admin can delete user accounts';
  END IF;

  -- Cannot delete own account
  IF target_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  SELECT role::text INTO target_role FROM public.users WHERE id = target_id;

  -- Safely unlink customer record so sales & accounting history are preserved
  UPDATE public.customers
  SET user_id = NULL
  WHERE user_id = target_id;

  -- Delete from public.users
  DELETE FROM public.users WHERE id = target_id;

  -- Delete from auth.users
  BEGIN
    DELETE FROM auth.users WHERE id = target_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object('success', true, 'deleted_id', target_id);
END;
$$;

-- 3. Function to update user details (strictly super_admin only)
CREATE OR REPLACE FUNCTION public.admin_update_user_details(
  target_id uuid,
  p_name text,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_role text DEFAULT NULL
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  v_result public.users;
BEGIN
  -- Only super_admin can update user details
  SELECT role::text INTO actor_role FROM public.users WHERE id = auth.uid();
  IF actor_role IS NULL OR actor_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only super admin can edit user details';
  END IF;

  IF target_id = auth.uid() AND p_role IS NOT NULL AND p_role != 'super_admin' THEN
    RAISE EXCEPTION 'You cannot remove your own super admin role';
  END IF;

  UPDATE public.users
  SET
    name = COALESCE(NULLIF(TRIM(p_name), ''), name),
    phone = NULLIF(TRIM(p_phone), ''),
    email = COALESCE(NULLIF(TRIM(p_email), ''), email),
    role = CASE WHEN p_role IS NOT NULL THEN p_role::public.user_role ELSE role END
  WHERE id = target_id
  RETURNING * INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Sync linked customer profile
  UPDATE public.customers
  SET
    name = COALESCE(NULLIF(TRIM(p_name), ''), name),
    mobile = COALESCE(NULLIF(TRIM(p_phone), ''), mobile),
    email = COALESCE(NULLIF(TRIM(p_email), ''), email),
    updated_at = NOW()
  WHERE user_id = target_id;

  RETURN v_result;
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_user_details(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_details(uuid, text, text, text, text) TO authenticated;

-- Allow super_admin to delete from public.users directly
GRANT DELETE ON public.users TO authenticated;
DROP POLICY IF EXISTS "Users super admin delete" ON public.users;
CREATE POLICY "Users super admin delete" ON public.users
  FOR DELETE
  USING (public.is_super_admin() AND auth.uid() != id);

NOTIFY pgrst, 'reload schema';
