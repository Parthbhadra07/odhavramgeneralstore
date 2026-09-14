-- 022_phone_loyalty_ai_purchases.sql
-- 1. Fix trigger to store customer mobile from signup into public.users and public.customers
-- 2. Add loyalty program settings (enable/disable, point value in ₹, points per 100 spent, min points)
-- 3. Add gemini_api_key setting for AI bill scanner
-- 4. Provide RPC function to synchronize user mobile if missed by trigger

-- 1. EXTEND SETTINGS TABLE
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS enable_loyalty_points boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS loyalty_point_value numeric(10,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS loyalty_points_per_100 numeric(10,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS loyalty_min_points_redeem integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gemini_api_key text;

-- 2. FIX USER SIGNUP TRIGGER (guarantee phone is captured and synced to CRM)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_email text;
  v_phone text;
  v_clean_phone text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'Customer');
  v_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');
  v_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'mobile',
    NEW.raw_user_meta_data->>'phone_number',
    NEW.phone,
    ''
  );
  
  -- Clean to 10 digits if formatted with +91 or spaces
  v_clean_phone := regexp_replace(v_phone, '[^0-9]', '', 'g');
  IF length(v_clean_phone) > 10 THEN
    v_clean_phone := right(v_clean_phone, 10);
  END IF;
  IF length(v_clean_phone) < 10 THEN
    v_clean_phone := NULL;
  END IF;

  -- Upsert into public.users
  INSERT INTO public.users (id, name, email, phone, role)
  VALUES (
    NEW.id,
    v_name,
    v_email,
    v_clean_phone,
    'customer'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = CASE WHEN EXCLUDED.name <> '' AND EXCLUDED.name <> 'Customer' THEN EXCLUDED.name ELSE public.users.name END,
    email = CASE WHEN EXCLUDED.email <> '' THEN EXCLUDED.email ELSE public.users.email END,
    phone = COALESCE(EXCLUDED.phone, public.users.phone);

  -- Auto-link or create CRM customer record if phone is valid
  IF v_clean_phone IS NOT NULL AND length(v_clean_phone) = 10 THEN
    INSERT INTO public.customers (
      user_id,
      name,
      mobile,
      email,
      loyalty_points,
      credit_balance,
      updated_at
    )
    VALUES (
      NEW.id,
      v_name,
      v_clean_phone,
      NULLIF(v_email, ''),
      0,
      0,
      NOW()
    )
    ON CONFLICT (mobile) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      email = COALESCE(EXCLUDED.email, public.customers.email),
      name = CASE WHEN public.customers.name = 'Customer' AND EXCLUDED.name <> 'Customer' THEN EXCLUDED.name ELSE public.customers.name END,
      updated_at = NOW();
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user error: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. RPC FUNCTION: sync_user_signup_phone
-- Fallback RPC that client can invoke right after signup/login to ensure phone is persisted
CREATE OR REPLACE FUNCTION public.sync_user_signup_phone(
  p_user_id uuid,
  p_phone text,
  p_name text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_phone text;
BEGIN
  v_clean_phone := regexp_replace(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
  IF length(v_clean_phone) > 10 THEN
    v_clean_phone := right(v_clean_phone, 10);
  END IF;

  IF length(v_clean_phone) <> 10 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid 10-digit mobile');
  END IF;

  -- Update users table
  UPDATE public.users
  SET
    phone = v_clean_phone,
    name = COALESCE(NULLIF(p_name, ''), name)
  WHERE id = p_user_id;

  -- Upsert / Link customer record
  INSERT INTO public.customers (
    user_id,
    name,
    mobile,
    loyalty_points,
    credit_balance,
    updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(NULLIF(p_name, ''), 'Customer'),
    v_clean_phone,
    0,
    0,
    NOW()
  )
  ON CONFLICT (mobile) DO UPDATE SET
    user_id = p_user_id,
    name = CASE WHEN public.customers.name = 'Customer' AND p_name IS NOT NULL AND p_name <> '' THEN p_name ELSE public.customers.name END,
    updated_at = NOW();

  RETURN json_build_object('success', true, 'mobile', v_clean_phone);
END;
$$;
