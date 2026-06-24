-- Fix order placement for Odhavram General Store
-- Run this in Supabase SQL Editor if checkout fails

-- 1. Order number sequence + generator
CREATE TABLE IF NOT EXISTS public.order_number_seq (
  year INT PRIMARY KEY,
  last_num INT NOT NULL DEFAULT 0
);

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

GRANT EXECUTE ON FUNCTION public.generate_order_number() TO authenticated, anon;

-- 2. Extra order columns (safe if already exist)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cod';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT TRUE;

-- 3. Allow text order_status (fixes 'received' vs enum 'pending')
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    JOIN pg_type t ON c.udt_name = t.typname
    WHERE c.table_schema = 'public' AND c.table_name = 'orders'
    AND c.column_name = 'order_status' AND t.typtype = 'e'
  ) THEN
    ALTER TABLE public.orders
      ALTER COLUMN order_status TYPE TEXT
      USING order_status::TEXT;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE public.orders ALTER COLUMN order_status SET DEFAULT 'received';

-- 4. Tracking history (optional — won't block orders if insert fails)
CREATE TABLE IF NOT EXISTS public.tracking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tracking_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tracking read own or admin" ON public.tracking_history;
CREATE POLICY "Tracking read own or admin" ON public.tracking_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "Tracking system insert" ON public.tracking_history;
CREATE POLICY "Tracking system insert" ON public.tracking_history
  FOR INSERT WITH CHECK (true);

-- 5. Safe trigger — never block order insert
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' OR (OLD.order_status IS DISTINCT FROM NEW.order_status) THEN
      INSERT INTO public.tracking_history (order_id, status, note)
      VALUES (NEW.id, NEW.order_status, NEW.tracking_notes);
    END IF;
    IF NEW.order_status = 'delivered' AND NEW.delivered_at IS NULL THEN
      NEW.delivered_at := NOW();
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_status_change ON public.orders;
CREATE TRIGGER on_order_status_change
  AFTER INSERT OR UPDATE OF order_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();

-- 6. RLS: customers can place orders
DROP POLICY IF EXISTS "Orders own insert" ON public.orders;
CREATE POLICY "Orders own insert" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Order items insert" ON public.order_items;
CREATE POLICY "Order items insert" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Order items read" ON public.order_items;
CREATE POLICY "Order items read" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin())
    )
  );

-- Admin can edit order line items (confirm / save from admin panel)
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
