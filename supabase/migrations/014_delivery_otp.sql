-- OTP confirmation when an online order is handed over
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_otp TEXT,
  ADD COLUMN IF NOT EXISTS delivery_otp_verified BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.delivery_otp IS '6-digit code the customer shares at delivery';
COMMENT ON COLUMN public.orders.delivery_otp_verified IS 'True after delivery person enters the customer OTP';
