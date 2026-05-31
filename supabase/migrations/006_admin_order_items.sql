-- Allow admins to edit order line items from /admin/orders/[id]
DROP POLICY IF EXISTS "Order items admin delete" ON public.order_items;
CREATE POLICY "Order items admin delete" ON public.order_items
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id)
  );

DROP POLICY IF EXISTS "Order items admin insert" ON public.order_items;
CREATE POLICY "Order items admin insert" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id)
  );

DROP POLICY IF EXISTS "Order items admin update" ON public.order_items;
CREATE POLICY "Order items admin update" ON public.order_items
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (
    public.is_admin()
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id)
  );
