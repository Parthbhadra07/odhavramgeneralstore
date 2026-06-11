-- Odhavram General Store — ERP platform enhancements
-- Product variants/images, split payments, delivery assignment, settings extensions

-- =============================================================================
-- SETTINGS
-- =============================================================================
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS gst_number TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS default_gst_percentage DECIMAL(5,2) DEFAULT 5;

-- =============================================================================
-- PRODUCT TAGS (featured already exists on products)
-- =============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN NOT NULL DEFAULT false;

-- =============================================================================
-- PRODUCT IMAGES (gallery)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);

-- =============================================================================
-- PRODUCT VARIANTS (e.g. Rice 500g, 1kg, 5kg)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  barcode TEXT,
  stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  purchase_rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  mrp DECIMAL(12,2),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_barcode
  ON public.product_variants(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON public.product_variants(product_id);

-- =============================================================================
-- POS SPLIT PAYMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.pos_payment_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pos_sale_id UUID NOT NULL REFERENCES public.pos_sales(id) ON DELETE CASCADE,
  payment_method pos_payment_method NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_payment_splits_sale ON public.pos_payment_splits(pos_sale_id);

-- =============================================================================
-- DELIVERY ASSIGNMENT
-- =============================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_person TEXT,
  ADD COLUMN IF NOT EXISTS delivery_assigned_at TIMESTAMPTZ;

-- =============================================================================
-- STOCK ADJUSTMENT REASONS (extend movement enum)
-- =============================================================================
DO $$ BEGIN
  ALTER TYPE stock_movement_type ADD VALUE IF NOT EXISTS 'expired';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_payment_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_staff_product_images" ON public.product_images
  FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_product_variants" ON public.product_variants
  FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());
CREATE POLICY "erp_staff_pos_splits" ON public.pos_payment_splits
  FOR ALL USING (public.is_erp_staff()) WITH CHECK (public.is_erp_staff());

-- Public read for product images (storefront)
CREATE POLICY "public_read_product_images" ON public.product_images
  FOR SELECT USING (true);
