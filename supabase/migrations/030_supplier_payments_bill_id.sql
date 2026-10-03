-- =============================================================================
-- Migration 030: Add purchase_bill_id to supplier_payments
-- =============================================================================

ALTER TABLE public.supplier_payments
ADD COLUMN IF NOT EXISTS purchase_bill_id UUID REFERENCES public.purchase_bills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_payments_bill ON public.supplier_payments(purchase_bill_id);
