-- Normaliza nomes e status financeiros legados para a auditoria operacional.

UPDATE public.subscription_plans
SET name = 'advanced',
    updated_at = now()
WHERE slug = 'advanced'
  AND name IS DISTINCT FROM 'advanced';

UPDATE public.teacher_custom_plans
SET name = 'advanced',
    updated_at = now()
WHERE lower(trim(name)) IN ('advanced', 'advenced')
  AND name IS DISTINCT FROM 'advanced';

UPDATE public.student_subscriptions
SET validapay_payment_status = CASE
      WHEN validapay_payment_id IS NULL AND validapay_checkout_session_id IS NOT NULL
        THEN 'manual_paid_legacy'
      ELSE 'payment.success'
    END,
    validapay_payment_id = COALESCE(
      validapay_payment_id,
      'manual-legacy-' || id::text
    ),
    updated_at = now()
WHERE status = 'ativa'
  AND (
    validapay_payment_status IS NULL
    OR validapay_payment_status = 'checkout.created'
  );
