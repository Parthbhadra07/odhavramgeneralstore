-- Odhavram General Store — Purchase Returns, Sales Returns, Refunds
-- Run after 009_settings_and_lots.sql

-- =============================================================================
-- ENUMS
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE purchase_return_reason AS ENUM (
    'damage', 'expired', 'wrong_item', 'excess_stock', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sales_return_reason AS ENUM (
    'damaged', 'wrong_product', 'expired', 'customer_return', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sales_return_type AS ENUM ('refund', 'replacement', 'store_credit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE refund_status AS ENUM ('pending', 'approved', 'rejected', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE refund_method AS ENUM ('cash', 'upi', 'bank_transfer', 'store_credit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Extend stock movement types if needed
DO $$ BEGIN
  ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'sales_return';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'opening_stock';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'transfer';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- NUMBER SEQUENCES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.return_number_seq (
  prefix TEXT NOT NULL,
  year INT NOT NULL,
  last_num INT NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, year)
);

CREATE OR REPLACE FUNCTION public.generate_return_number(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr INT := EXTRACT(YEAR FROM NOW())::INT;
  seq INT;
BEGIN
  INSERT INTO public.return_number_seq (prefix, year, last_num)
  VALUES (p_prefix, yr, 1)
  ON CONFLICT (prefix, year) DO UPDATE
    SET last_num = public.return_number_seq.last_num + 1
  RETURNING last_num INTO seq;
  RETURN p_prefix || '-' || yr::TEXT || '-' || lpad(seq::TEXT, 6, '0');
END;
$$;

-- =============================================================================
-- PURCHASE RETURNS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  purchase_bill_id UUID REFERENCES public.purchase_bills(id) ON DELETE SET NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason purchase_return_reason NOT NULL DEFAULT 'other',
  reason_notes TEXT,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_return_id UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  lot_id UUID REFERENCES public.product_lots(id) ON DELETE SET NULL,
  purchase_item_id UUID REFERENCES public.purchase_items(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  barcode TEXT,
  lot_number TEXT,
  batch_number TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  purchase_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier ON public.purchase_returns(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_date ON public.purchase_returns(return_date DESC);

-- =============================================================================
-- SALES RETURNS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_mobile TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  pos_sale_id UUID REFERENCES public.pos_sales(id) ON DELETE SET NULL,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason sales_return_reason NOT NULL DEFAULT 'other',
  return_type sales_return_type NOT NULL DEFAULT 'refund',
  reason_notes TEXT,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_return_id UUID NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  lot_id UUID REFERENCES public.product_lots(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  barcode TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sales_returns_customer ON public.sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_date ON public.sales_returns(return_date DESC);

-- =============================================================================
-- REFUNDS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_return_id UUID REFERENCES public.sales_returns(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  pos_sale_id UUID REFERENCES public.pos_sales(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  refund_method refund_method NOT NULL DEFAULT 'cash',
  status refund_status NOT NULL DEFAULT 'pending',
  reference_number TEXT,
  notes TEXT,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created ON public.refunds(created_at DESC);

-- =============================================================================
-- STOCK MOVEMENTS: lot_id column
-- =============================================================================
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES public.product_lots(id) ON DELETE SET NULL;

-- =============================================================================
-- APPLY PURCHASE RETURN (reduce stock)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.on_purchase_return_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_stock_movement(
    NEW.product_id,
    -NEW.quantity,
    'purchase_return',
    'purchase_return',
    NEW.purchase_return_id,
    'Purchase return to supplier'
  );

  IF NEW.lot_id IS NOT NULL THEN
    PERFORM public.apply_lot_stock_movement(
      NEW.lot_id,
      -NEW.quantity,
      'purchase_return',
      'purchase_return',
      NEW.purchase_return_id,
      'Purchase return lot deduction'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_return_stock ON public.purchase_return_items;
CREATE TRIGGER trg_purchase_return_stock
  AFTER INSERT ON public.purchase_return_items
  FOR EACH ROW EXECUTE FUNCTION public.on_purchase_return_item_insert();

-- =============================================================================
-- APPLY SALES RETURN (increase stock)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.on_sales_return_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_stock_movement(
    NEW.product_id,
    NEW.quantity,
    'sales_return',
    'sales_return',
    NEW.sales_return_id,
    'Sales return — stock restored'
  );

  IF NEW.lot_id IS NOT NULL THEN
    PERFORM public.apply_lot_stock_movement(
      NEW.lot_id,
      NEW.quantity,
      'sales_return',
      'sales_return',
      NEW.sales_return_id,
      'Sales return lot restore'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_return_stock ON public.sales_return_items;
CREATE TRIGGER trg_sales_return_stock
  AFTER INSERT ON public.sales_return_items
  FOR EACH ROW EXECUTE FUNCTION public.on_sales_return_item_insert();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_staff_purchase_returns" ON public.purchase_returns
  FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_purchase_return_items" ON public.purchase_return_items
  FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_sales_returns" ON public.sales_returns
  FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_sales_return_items" ON public.sales_return_items
  FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_refunds" ON public.refunds
  FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());

GRANT EXECUTE ON FUNCTION public.generate_return_number TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_returns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_returns;
