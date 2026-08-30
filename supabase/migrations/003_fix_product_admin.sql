-- Fix product insert for admin + storage (run if adding products fails)

-- Ensure is_admin works for authenticated users
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Products: allow admin full access (idempotent)
DROP POLICY IF EXISTS "Products admin insert" ON public.products;
DROP POLICY IF EXISTS "Products admin update" ON public.products;
DROP POLICY IF EXISTS "Products admin delete" ON public.products;

CREATE POLICY "Products admin insert" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Products admin update" ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Products admin delete" ON public.products
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies (work with authenticated admin)
DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin update product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete product images" ON storage.objects;

CREATE POLICY "Product images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

CREATE POLICY "Admin upload product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'products' AND public.is_admin());

CREATE POLICY "Admin update product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'products' AND public.is_admin());

CREATE POLICY "Admin delete product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'products' AND public.is_admin());
