-- Migration 032: Add delivery_charge to orders, fix deal_banners RLS for super_admin, add Realtime publications

-- 1. Ensure delivery_charge column exists on public.orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- 2. Backfill delivery_charge for existing orders based on total_amount vs line items
UPDATE public.orders o
SET delivery_charge = GREATEST(
  0,
  o.total_amount - COALESCE(
    (SELECT SUM(oi.price * oi.quantity) FROM public.order_items oi WHERE oi.order_id = o.id),
    o.total_amount
  )
)
WHERE delivery_charge = 0
  AND o.total_amount > COALESCE(
    (SELECT SUM(oi.price * oi.quantity) FROM public.order_items oi WHERE oi.order_id = o.id),
    0
  );

-- 3. Fix deal_banners RLS so both 'admin' and 'super_admin' can manage banners
DROP POLICY IF EXISTS "Admins can manage deal banners" ON public.deal_banners;
DROP POLICY IF EXISTS "Anyone can manage deal banners" ON public.deal_banners;

CREATE POLICY "Admins can manage deal banners"
  ON public.deal_banners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin')
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin')
    )
    OR auth.role() = 'service_role'
  );

-- Ensure public can view banners
DROP POLICY IF EXISTS "Public can view deal banners" ON public.deal_banners;
CREATE POLICY "Public can view deal banners"
  ON public.deal_banners FOR SELECT
  USING (true);

-- 4. Ensure Realtime publications include orders and notifications
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
