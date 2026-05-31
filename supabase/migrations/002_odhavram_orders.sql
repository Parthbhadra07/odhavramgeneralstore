-- Odhavram General Store: Order management upgrade
-- Run in Supabase SQL Editor after schema.sql

-- Phone on user profiles
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Order number sequence per year
CREATE TABLE IF NOT EXISTS public.order_number_seq (
  year INT PRIMARY KEY,
  last_num INT NOT NULL DEFAULT 0
);

-- Extend orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cod';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT TRUE;

-- Migrate order_status to TEXT for new workflow (safe if already text)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
    AND column_name = 'order_status' AND udt_name = 'order_status'
  ) THEN
    ALTER TABLE public.orders
      ALTER COLUMN order_status TYPE TEXT
      USING (
        CASE order_status::text
          WHEN 'pending' THEN 'received'
          WHEN 'processing' THEN 'preparing'
          WHEN 'shipped' THEN 'out_for_delivery'
          ELSE order_status::text
        END
      );
  END IF;
END $$;

ALTER TABLE public.orders ALTER COLUMN order_status SET DEFAULT 'received';

-- Tracking history
CREATE TABLE IF NOT EXISTS public.tracking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_history_order ON public.tracking_history(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at);

-- Generate OGS-YYYY-000001 style order numbers
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr INT := EXTRACT(YEAR FROM NOW())::INT;
  seq INT;
BEGIN
  INSERT INTO public.order_number_seq (year, last_num)
  VALUES (yr, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_num = public.order_number_seq.last_num + 1
  RETURNING last_num INTO seq;

  RETURN 'OGS-' || yr::TEXT || '-' || lpad(seq::TEXT, 6, '0');
END;
$$;

-- Log status changes automatically
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (OLD.order_status IS DISTINCT FROM NEW.order_status) THEN
    INSERT INTO public.tracking_history (order_id, status, note)
    VALUES (NEW.id, NEW.order_status, NEW.tracking_notes);
    IF NEW.order_status = 'delivered' AND NEW.delivered_at IS NULL THEN
      NEW.delivered_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
CREATE TRIGGER on_order_status_change
  BEFORE INSERT OR UPDATE OF order_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();

-- RLS for tracking_history
ALTER TABLE public.tracking_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tracking read own or admin" ON public.tracking_history;
CREATE POLICY "Tracking read own or admin" ON public.tracking_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin())
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Tracking admin insert" ON public.tracking_history;
CREATE POLICY "Tracking admin insert" ON public.tracking_history
  FOR INSERT WITH CHECK (public.is_admin());

-- Public track by order_number: allow anon read single order via RPC
CREATE OR REPLACE FUNCTION public.get_order_by_number(p_order_number TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'order', row_to_json(o.*),
    'items', (
      SELECT COALESCE(json_agg(row_to_json(oi.*)), '[]'::json)
      FROM (
        SELECT oi.*, p.name AS product_name
        FROM public.order_items oi
        LEFT JOIN public.products p ON p.id = oi.product_id
        WHERE oi.order_id = o.id
      ) oi
    ),
    'history', (
      SELECT COALESCE(json_agg(row_to_json(th.*) ORDER BY th.created_at), '[]'::json)
      FROM public.tracking_history th
      WHERE th.order_id = o.id
    )
  ) INTO result
  FROM public.orders o
  WHERE o.order_number = p_order_number;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_by_number(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated;

-- Realtime for admin notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Storage bucket for product images (run once)
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
CREATE POLICY "Product images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

DROP POLICY IF EXISTS "Admin upload product images" ON storage.objects;
CREATE POLICY "Admin upload product images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'products' AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admin update product images" ON storage.objects;
CREATE POLICY "Admin update product images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'products' AND public.is_admin());

DROP POLICY IF EXISTS "Admin delete product images" ON storage.objects;
CREATE POLICY "Admin delete product images" ON storage.objects
  FOR DELETE USING (bucket_id = 'products' AND public.is_admin());
