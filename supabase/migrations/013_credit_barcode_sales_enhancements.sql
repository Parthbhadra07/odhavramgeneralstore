-- Credit management, barcode tracking, and sales history enhancements

-- =============================================================================
-- PRODUCTS
-- =============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hsn_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0;

-- =============================================================================
-- CUSTOMERS — credit profile
-- =============================================================================
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'blocked', 'closed')),
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ;

-- =============================================================================
-- CUSTOMER CREDIT — ledger enhancements
-- =============================================================================
ALTER TABLE public.customer_credit
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- =============================================================================
-- BARCODE LABELS — print audit trail
-- =============================================================================
ALTER TABLE public.barcode_labels
  ADD COLUMN IF NOT EXISTS printer_type TEXT DEFAULT 'generic',
  ADD COLUMN IF NOT EXISTS label_width_mm DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS label_height_mm DECIMAL(6,2),
  ADD COLUMN IF NOT EXISTS print_quantity INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS printed_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_barcode_labels_printed_at
  ON public.barcode_labels(printed_at DESC) WHERE printed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_credit_due_date
  ON public.customer_credit(due_date) WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pos_sales_customer_mobile
  ON public.pos_sales(customer_mobile);

CREATE INDEX IF NOT EXISTS idx_pos_sales_bill_number
  ON public.pos_sales(bill_number);
