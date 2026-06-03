ALTER TABLE public.discount_coupons
  DROP CONSTRAINT IF EXISTS discount_coupons_code_format;

ALTER TABLE public.discount_coupons
  ADD CONSTRAINT discount_coupons_code_format
  CHECK (code ~ '^[A-Z]{3,4}-?[0-9]{2}$');
