-- Migration 027: Add round_off column to pos_sales
ALTER TABLE public.pos_sales
  ADD COLUMN IF NOT EXISTS round_off DECIMAL(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pos_sales.round_off IS 'Round-off difference adjustment for cash/card billing to nearest whole rupee';
