-- =============================================================================
-- Migration 028: Product Offers Validity Periods & Deals Banners
-- =============================================================================

-- 1. Add Offer Validity Period Columns to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS offer_start_date TIMESTAMPTZ;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS offer_end_date TIMESTAMPTZ;

-- 2. Create index on offer_end_date for fast active deals querying
CREATE INDEX IF NOT EXISTS idx_products_offer_end_date ON public.products(offer_end_date) WHERE offer_end_date IS NOT NULL;

-- 3. Create table for customizable Home Page Deals Advertisement Banners
CREATE TABLE IF NOT EXISTS public.deal_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '⚡ Mega Savings & Flash Grocery Deals!',
  subtitle TEXT NOT NULL DEFAULT 'Stock up on daily groceries, snacks and pantry essentials with special limited-time prices.',
  badge_text TEXT NOT NULL DEFAULT 'LIMITED TIME DEALS',
  discount_highlight TEXT NOT NULL DEFAULT 'UP TO 50% OFF',
  end_date TIMESTAMPTZ,
  button_text TEXT NOT NULL DEFAULT 'Shop Deals Now',
  button_link TEXT NOT NULL DEFAULT '/products?deals=true',
  theme TEXT NOT NULL DEFAULT 'flame',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.deal_banners ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active deal banners
DROP POLICY IF EXISTS "Public can view deal banners" ON public.deal_banners;
CREATE POLICY "Public can view deal banners"
  ON public.deal_banners FOR SELECT
  USING (true);

-- Allow authenticated admins to manage deal banners
DROP POLICY IF EXISTS "Admins can manage deal banners" ON public.deal_banners;
CREATE POLICY "Admins can manage deal banners"
  ON public.deal_banners FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
