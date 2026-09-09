-- Store mobile number from app signup (auth metadata + public.users.phone)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    'customer'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    phone = COALESCE(EXCLUDED.phone, public.users.phone);
  RETURN NEW;
END;
$$;
