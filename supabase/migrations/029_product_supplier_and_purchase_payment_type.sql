-- =============================================================================
-- Migration 029: Product Supplier Learning & Cash/Credit Purchases
-- =============================================================================

-- 1. Add preferred_supplier_id to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS preferred_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_preferred_supplier ON public.products(preferred_supplier_id);

-- 2. Add payment_type to purchase_bills ('credit' or 'cash')
ALTER TABLE public.purchase_bills
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'credit';

-- 3. Backfill preferred_supplier_id from past inward purchase bills
UPDATE public.products p
SET preferred_supplier_id = sub.supplier_id
FROM (
  SELECT DISTINCT ON (pi.product_id) pi.product_id, pb.supplier_id
  FROM public.purchase_items pi
  JOIN public.purchase_bills pb ON pb.id = pi.purchase_bill_id
  ORDER BY pi.product_id, pb.invoice_date DESC
) sub
WHERE p.id = sub.product_id AND p.preferred_supplier_id IS NULL;
