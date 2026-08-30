-- Admin/staff must read customer delivery addresses linked to orders
DROP POLICY IF EXISTS "Addresses admin read" ON public.addresses;
CREATE POLICY "Addresses admin read" ON public.addresses
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
