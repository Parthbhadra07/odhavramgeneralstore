-- Odhavram General Store — Store Settings + Product Lots (multi-barcode)
-- Run after 007_erp_complete.sql and 008_admin_addresses_read.sql

-- =============================================================================
-- STORE SETTINGS (single-row config)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL DEFAULT 'Odhavram General Store',
  store_mobile TEXT NOT NULL DEFAULT '8160373047',
  store_address TEXT,
  store_logo_url TEXT,
  upi_id TEXT,
  upi_merchant_name TEXT,
  enable_upi_qr BOOLEAN NOT NULL DEFAULT FALSE,
  receipt_header_text TEXT,
  receipt_footer_text TEXT,
  receipt_width TEXT NOT NULL DEFAULT '80mm' CHECK (receipt_width IN ('58mm', '80mm')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings row if empty
INSERT INTO public.settings (
  store_name, store_mobile, store_address,
  receipt_header_text, receipt_footer_text
)
SELECT
  'Odhavram General Store',
  '8160373047',
  'Shop no 3 swastik residency opp to fellowship school, silvassa road vapi, Gujarat',
  'Thank You! Visit Again',
  'Odhavram General Store — 8160373047'
WHERE NOT EXISTS (SELECT 1 FROM public.settings LIMIT 1);

-- =============================================================================
-- PRODUCT LOTS (multi-barcode per product)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lot_number TEXT,
  batch_number TEXT,
  barcode TEXT NOT NULL,
  purchase_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(12,2),
  mrp DECIMAL(12,2),
  quantity INTEGER NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  expiry_date DATE,
  purchase_item_id UUID REFERENCES public.purchase_items(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_lots_barcode
  ON public.product_lots(barcode) WHERE barcode IS NOT NULL AND is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_product_lots_product ON public.product_lots(product_id);
CREATE INDEX IF NOT EXISTS idx_product_lots_expiry ON public.product_lots(expiry_date)
  WHERE expiry_date IS NOT NULL;

-- Lot stock movement log
CREATE TABLE IF NOT EXISTS public.lot_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.product_lots(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  stock_before INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lot_stock_mov_lot ON public.lot_stock_movements(lot_id);
CREATE INDEX IF NOT EXISTS idx_lot_stock_mov_product ON public.lot_stock_movements(product_id);

-- Optional lot reference on sale lines
ALTER TABLE public.pos_sale_items
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES public.product_lots(id) ON DELETE SET NULL;

-- =============================================================================
-- LOT STOCK FUNCTIONS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_lot_stock_movement(
  p_lot_id UUID,
  p_quantity INTEGER,
  p_movement_type TEXT,
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
  v_product_id UUID;
  v_before INTEGER;
  v_after INTEGER;
BEGIN
  SELECT product_id, current_stock INTO v_product_id, v_before
  FROM public.product_lots WHERE id = p_lot_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lot not found';
  END IF;

  v_after := v_before + p_quantity;
  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient lot stock. Available: %', v_before;
  END IF;

  UPDATE public.product_lots
  SET current_stock = v_after, updated_at = NOW()
  WHERE id = p_lot_id;

  INSERT INTO public.lot_stock_movements (
    lot_id, product_id, movement_type, quantity,
    stock_before, stock_after, reference_type, reference_id, notes, created_by
  ) VALUES (
    p_lot_id, v_product_id, p_movement_type, p_quantity,
    v_before, v_after, p_reference_type, p_reference_id, p_notes, auth.uid()
  );

  RETURN v_after;
END;
$$;

-- Create lot on purchase item insert
CREATE OR REPLACE FUNCTION public.on_purchase_item_create_lot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_barcode TEXT;
  v_selling DECIMAL(12,2);
  v_mrp DECIMAL(12,2);
BEGIN
  v_barcode := COALESCE(
    NULLIF(TRIM(NEW.barcode), ''),
    (SELECT barcode FROM public.products WHERE id = NEW.product_id)
  );

  IF v_barcode IS NOT NULL AND TRIM(v_barcode) <> '' THEN
    SELECT COALESCE(selling_price, price), mrp
    INTO v_selling, v_mrp
    FROM public.products WHERE id = NEW.product_id;

    INSERT INTO public.product_lots (
      product_id, lot_number, batch_number, barcode,
      purchase_price, selling_price, mrp,
      quantity, current_stock, expiry_date, purchase_item_id
    ) VALUES (
      NEW.product_id,
      COALESCE(NEW.batch_number, 'LOT-' || LEFT(NEW.id::TEXT, 8)),
      NEW.batch_number,
      v_barcode,
      NEW.purchase_rate,
      v_selling,
      v_mrp,
      NEW.quantity,
      NEW.quantity,
      NEW.expiry_date,
      NEW.id
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_item_lot ON public.purchase_items;
CREATE TRIGGER trg_purchase_item_lot
  AFTER INSERT ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.on_purchase_item_create_lot();

-- Migrate existing product barcodes into lots (one-time)
INSERT INTO public.product_lots (
  product_id, lot_number, batch_number, barcode,
  purchase_price, selling_price, mrp,
  quantity, current_stock, expiry_date
)
SELECT
  p.id,
  COALESCE(p.batch_number, 'DEFAULT'),
  p.batch_number,
  p.barcode,
  COALESCE(p.purchase_price, 0),
  COALESCE(p.selling_price, p.price),
  COALESCE(p.mrp, p.price),
  GREATEST(p.stock, 0),
  GREATEST(p.stock, 0),
  p.expiry_date
FROM public.products p
WHERE p.barcode IS NOT NULL
  AND TRIM(p.barcode) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.product_lots pl
    WHERE pl.barcode = p.barcode AND pl.product_id = p.id
  );

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_read_all" ON public.settings
  FOR SELECT USING (TRUE);

CREATE POLICY "settings_admin_write" ON public.settings
  FOR ALL USING (public.is_erp_admin()) WITH CHECK (public.is_erp_admin());

CREATE POLICY "erp_staff_lots" ON public.product_lots
  FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());

CREATE POLICY "erp_staff_lot_mov" ON public.lot_stock_movements
  FOR SELECT USING (public.is_erp_staff());

CREATE POLICY "erp_staff_lot_mov_ins" ON public.lot_stock_movements
  FOR INSERT WITH CHECK (public.is_erp_staff());

GRANT EXECUTE ON FUNCTION public.apply_lot_stock_movement TO authenticated;
