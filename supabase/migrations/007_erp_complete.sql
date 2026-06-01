-- Odhavram General Store — Complete Retail ERP Schema
-- Run in Supabase SQL Editor after migrations 002–006

-- =============================================================================
-- ROLES
-- New enum labels: run 007_00_user_role_enums.sql first (or apply it in a
-- separate SQL Editor run). role::text avoids 55P04 when both run in one txn.
-- =============================================================================
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'staff';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cashier';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.is_erp_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role::text IN ('super_admin', 'admin', 'staff', 'cashier')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_erp_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role::text IN ('super_admin', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_erp_cashier()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role::text IN ('super_admin', 'admin', 'cashier')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Backward compat: is_admin includes all staff roles for RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.is_erp_staff();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- PRODUCT MASTER EXTENSIONS
-- =============================================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'pcs';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS selling_price DECIMAL(12,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mrp DECIMAL(12,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gst_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT 10;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS max_stock_level INTEGER;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS opening_stock INTEGER DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

UPDATE public.products SET selling_price = price WHERE selling_price IS NULL;
UPDATE public.products SET mrp = price WHERE mrp IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_expiry ON public.products(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON public.products(stock) WHERE stock <= COALESCE(min_stock_level, 5);

-- =============================================================================
-- BRANDS (optional master)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CUSTOMERS (store CRM — walk-in & registered)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  address TEXT,
  gst_number TEXT,
  credit_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_mobile ON public.customers(mobile);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_mobile_unique ON public.customers(mobile);

-- =============================================================================
-- SUPPLIERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mobile TEXT,
  gst_number TEXT,
  address TEXT,
  email TEXT,
  outstanding_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- STOCK MOVEMENTS (ledger)
-- =============================================================================
CREATE TYPE stock_movement_type AS ENUM (
  'opening',
  'purchase',
  'purchase_return',
  'pos_sale',
  'online_order',
  'return',
  'damaged',
  'adjustment',
  'cancel'
);

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  movement_type stock_movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);

-- Inventory view (alias for reporting)
CREATE OR REPLACE VIEW public.inventory AS
SELECT
  p.id AS product_id,
  p.name AS product_name,
  p.sku,
  p.barcode,
  p.stock AS current_stock,
  p.opening_stock,
  p.min_stock_level,
  p.max_stock_level,
  p.reorder_level,
  p.purchase_price,
  COALESCE(p.selling_price, p.price) AS selling_price,
  p.expiry_date,
  p.batch_number,
  p.category_id
FROM public.products p
WHERE p.is_active IS NOT FALSE;

-- =============================================================================
-- PURCHASE MANAGEMENT
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.purchase_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL,
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  cgst DECIMAL(12,2) NOT NULL DEFAULT 0,
  sgst DECIMAL(12,2) NOT NULL DEFAULT 0,
  igst DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  invoice_pdf_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_bill_id UUID NOT NULL REFERENCES public.purchase_bills(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  barcode TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  purchase_rate DECIMAL(12,2) NOT NULL,
  gst_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL,
  batch_number TEXT,
  expiry_date DATE
);

CREATE INDEX IF NOT EXISTS idx_purchase_bills_supplier ON public.purchase_bills(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_bill ON public.purchase_items(purchase_bill_id);

-- =============================================================================
-- POS SALES
-- =============================================================================
CREATE TYPE pos_payment_method AS ENUM ('cash', 'upi', 'card', 'credit');
CREATE TYPE pos_sale_status AS ENUM ('completed', 'held', 'suspended', 'cancelled', 'returned');

CREATE TABLE IF NOT EXISTS public.pos_number_seq (
  year INT PRIMARY KEY,
  last_num INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.pos_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_mobile TEXT,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  cgst DECIMAL(12,2) NOT NULL DEFAULT 0,
  sgst DECIMAL(12,2) NOT NULL DEFAULT 0,
  igst DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  loyalty_points_redeemed INTEGER NOT NULL DEFAULT 0,
  loyalty_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method pos_payment_method NOT NULL DEFAULT 'cash',
  payment_status payment_status NOT NULL DEFAULT 'paid',
  sale_status pos_sale_status NOT NULL DEFAULT 'completed',
  held_at TIMESTAMPTZ,
  notes TEXT,
  cashier_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.pos_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id UUID NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  barcode TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  rate DECIMAL(12,2) NOT NULL,
  gst_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pos_sales_created ON public.pos_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_sales_status ON public.pos_sales(sale_status);

-- Online orders alias view
CREATE OR REPLACE VIEW public.online_orders AS
SELECT o.* FROM public.orders o;

-- =============================================================================
-- EXPENSES & ACCOUNTING
-- =============================================================================
CREATE TYPE expense_category AS ENUM (
  'rent', 'electricity', 'salaries', 'transport', 'repairs', 'miscellaneous'
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category expense_category NOT NULL DEFAULT 'miscellaneous',
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  notes TEXT,
  receipt_url TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- LOYALTY & CREDIT
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'adjust')),
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_credit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('credit', 'payment', 'adjust')),
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SUPPLIER PAYMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'cash',
  reference_number TEXT,
  notes TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CASH CLOSING
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.cash_closing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_date DATE NOT NULL UNIQUE,
  opening_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  cash_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  upi_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  card_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  credit_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  online_cash_sales DECIMAL(12,2) NOT NULL DEFAULT 0,
  expenses DECIMAL(12,2) NOT NULL DEFAULT 0,
  closing_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  closed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- BARCODE LABELS & NOTIFICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.barcode_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  label_format TEXT DEFAULT 'EAN13',
  printed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  reference_type TEXT,
  reference_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(is_read) WHERE is_read = FALSE;

-- =============================================================================
-- STOCK MOVEMENT FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_stock_movement(
  p_product_id UUID,
  p_quantity INTEGER,
  p_movement_type stock_movement_type,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before INTEGER;
  v_after INTEGER;
BEGIN
  SELECT stock INTO v_before FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  v_after := v_before + p_quantity;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient stock. Available: %', v_before;
  END IF;

  UPDATE public.products SET stock = v_after WHERE id = p_product_id;

  INSERT INTO public.stock_movements (
    product_id, movement_type, quantity, stock_before, stock_after,
    reference_type, reference_id, notes, created_by
  ) VALUES (
    p_product_id, p_movement_type, p_quantity, v_before, v_after,
    p_reference_type, p_reference_id, p_notes, auth.uid()
  );

  RETURN v_after;
END;
$$;

-- =============================================================================
-- POS BILL NUMBER: POS-YYYY-000001
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_pos_bill_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr INT := EXTRACT(YEAR FROM NOW())::INT;
  seq INT;
BEGIN
  INSERT INTO public.pos_number_seq (year, last_num)
  VALUES (yr, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_num = public.pos_number_seq.last_num + 1
  RETURNING last_num INTO seq;
  RETURN 'POS-' || yr::TEXT || '-' || lpad(seq::TEXT, 6, '0');
END;
$$;

-- =============================================================================
-- PURCHASE: auto stock-in on items
-- =============================================================================
CREATE OR REPLACE FUNCTION public.on_purchase_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_stock_movement(
    NEW.product_id,
    NEW.quantity,
    'purchase',
    'purchase_bill',
    NEW.purchase_bill_id,
    'Purchase bill item'
  );
  IF NEW.expiry_date IS NOT NULL THEN
    UPDATE public.products SET expiry_date = NEW.expiry_date WHERE id = NEW.product_id;
  END IF;
  IF NEW.batch_number IS NOT NULL THEN
    UPDATE public.products SET batch_number = NEW.batch_number WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_item_stock ON public.purchase_items;
CREATE TRIGGER trg_purchase_item_stock
  AFTER INSERT ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.on_purchase_item_insert();

CREATE OR REPLACE FUNCTION public.on_purchase_item_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.apply_stock_movement(
    OLD.product_id,
    -OLD.quantity,
    'purchase_return',
    'purchase_bill',
    OLD.purchase_bill_id,
    'Purchase item removed'
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_item_stock_del ON public.purchase_items;
CREATE TRIGGER trg_purchase_item_stock_del
  AFTER DELETE ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.on_purchase_item_delete();

-- =============================================================================
-- POS: auto stock-out on completed sale items
-- =============================================================================
CREATE OR REPLACE FUNCTION public.on_pos_sale_item_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status pos_sale_status;
BEGIN
  SELECT sale_status INTO v_status FROM public.pos_sales WHERE id = NEW.pos_sale_id;
  IF v_status = 'completed' THEN
    PERFORM public.apply_stock_movement(
      NEW.product_id,
      -NEW.quantity,
      'pos_sale',
      'pos_sale',
      NEW.pos_sale_id,
      'POS sale'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pos_sale_item_stock ON public.pos_sale_items;
CREATE TRIGGER trg_pos_sale_item_stock
  AFTER INSERT ON public.pos_sale_items
  FOR EACH ROW EXECUTE FUNCTION public.on_pos_sale_item_insert();

-- =============================================================================
-- LOW STOCK / EXPIRY NOTIFICATIONS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.check_low_stock_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min INT;
BEGIN
  v_min := COALESCE(NEW.min_stock_level, NEW.reorder_level, 5);
  IF NEW.stock <= 0 THEN
    INSERT INTO public.notifications (type, title, message, reference_type, reference_id)
    VALUES ('out_of_stock', 'Out of Stock', NEW.name || ' is out of stock', 'product', NEW.id);
  ELSIF NEW.stock <= v_min THEN
    INSERT INTO public.notifications (type, title, message, reference_type, reference_id)
    VALUES ('low_stock', 'Low Stock Alert', NEW.name || ' — only ' || NEW.stock || ' left', 'product', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_low_stock_notify ON public.products;
CREATE TRIGGER trg_low_stock_notify
  AFTER UPDATE OF stock ON public.products
  FOR EACH ROW
  WHEN (OLD.stock IS DISTINCT FROM NEW.stock)
  EXECUTE FUNCTION public.check_low_stock_notification();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_closing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barcode_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Public read products (storefront)
-- Staff policies
CREATE POLICY "erp_staff_all" ON public.customers FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_suppliers" ON public.suppliers FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_stock_mov" ON public.stock_movements FOR SELECT USING (public.is_erp_staff());
CREATE POLICY "erp_staff_stock_mov_ins" ON public.stock_movements FOR INSERT WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_purchase_bills" ON public.purchase_bills FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_purchase_items" ON public.purchase_items FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_pos" ON public.pos_sales FOR ALL USING (public.is_erp_cashier()) WITH CHECK (public.is_erp_cashier());
CREATE POLICY "erp_staff_pos_items" ON public.pos_sale_items FOR ALL USING (public.is_erp_cashier()) WITH CHECK (public.is_erp_cashier());
CREATE POLICY "erp_staff_expenses" ON public.expenses FOR ALL USING (public.is_erp_admin()) WITH CHECK (public.is_erp_admin());
CREATE POLICY "erp_staff_loyalty" ON public.customer_loyalty FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_credit" ON public.customer_credit FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_supplier_pay" ON public.supplier_payments FOR ALL USING (public.is_erp_admin()) WITH CHECK (public.is_erp_admin());
CREATE POLICY "erp_staff_cash_close" ON public.cash_closing FOR ALL USING (public.is_erp_admin()) WITH CHECK (public.is_erp_admin());
CREATE POLICY "erp_staff_barcode" ON public.barcode_labels FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_notifications" ON public.notifications FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_brands" ON public.brands FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());

-- Storage bucket for purchase invoices & expense receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('erp-documents', 'erp-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "erp_docs_upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'erp-documents' AND public.is_erp_staff());
CREATE POLICY "erp_docs_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'erp-documents' AND public.is_erp_staff());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_bills;

GRANT EXECUTE ON FUNCTION public.apply_stock_movement TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_pos_bill_number TO authenticated;
