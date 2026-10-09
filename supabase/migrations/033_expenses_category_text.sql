-- =============================================================================
-- Migration 033: Allow Custom Expense Types / Categories (Convert Enum to TEXT)
-- =============================================================================

-- Convert public.expenses.category from expense_category enum to TEXT
-- This enables users to enter any custom expense type / description via text box
ALTER TABLE public.expenses ALTER COLUMN category TYPE TEXT;
ALTER TABLE public.expenses ALTER COLUMN category SET DEFAULT 'General';
