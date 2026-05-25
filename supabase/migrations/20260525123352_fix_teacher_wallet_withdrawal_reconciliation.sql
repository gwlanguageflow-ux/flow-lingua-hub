-- Prevent failed Pix payout attempts from leaving stale holds or duplicate reversals.
-- The ledger remains the source of truth: credits increase balance, withdrawal holds
-- reserve balance, and reversals release failed/cancelled holds.

WITH duplicate_reversals AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY withdrawal_request_id
      ORDER BY created_at ASC, id ASC
    ) AS reversal_order
  FROM public.teacher_wallet_transactions
  WHERE transaction_type = 'withdrawal_reversal'
    AND withdrawal_request_id IS NOT NULL
)
DELETE FROM public.teacher_wallet_transactions t
USING duplicate_reversals d
WHERE t.id = d.id
  AND d.reversal_order > 1;

WITH stale_withdrawals AS (
  SELECT DISTINCT w.id
  FROM public.teacher_withdrawal_requests w
  JOIN public.teacher_wallet_transactions hold
    ON hold.withdrawal_request_id = w.id
   AND hold.transaction_type = 'withdrawal_hold'
  LEFT JOIN public.teacher_wallet_transactions reversal
    ON reversal.withdrawal_request_id = w.id
   AND reversal.transaction_type = 'withdrawal_reversal'
  WHERE w.status IN ('pendente', 'em_processamento')
    AND w.payout_external_id IS NULL
    AND reversal.id IS NULL
    AND coalesce(w.payout_requested_at, w.created_at) < now() - interval '5 minutes'
)
UPDATE public.teacher_withdrawal_requests w
SET
  status = 'falhou',
  payout_error = coalesce(
    nullif(w.payout_error, ''),
    'Saque Pix nao enviado ao provedor; saldo liberado automaticamente.'
  ),
  processed_at = coalesce(w.processed_at, now()),
  updated_at = now()
FROM stale_withdrawals s
WHERE w.id = s.id;

WITH withdrawals_to_release AS (
  SELECT DISTINCT
    w.id,
    w.teacher_id,
    w.amount
  FROM public.teacher_withdrawal_requests w
  JOIN public.teacher_wallet_transactions hold
    ON hold.withdrawal_request_id = w.id
   AND hold.transaction_type = 'withdrawal_hold'
  LEFT JOIN public.teacher_wallet_transactions reversal
    ON reversal.withdrawal_request_id = w.id
   AND reversal.transaction_type = 'withdrawal_reversal'
  WHERE w.status IN ('falhou', 'cancelado')
    AND reversal.id IS NULL
)
INSERT INTO public.teacher_wallet_transactions (
  teacher_id,
  withdrawal_request_id,
  transaction_type,
  amount,
  description,
  created_by
)
SELECT
  teacher_id,
  id,
  'withdrawal_reversal',
  amount,
  'Liberacao automatica de saque Pix nao enviado',
  teacher_id
FROM withdrawals_to_release;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_wallet_withdrawal_reversal_once
  ON public.teacher_wallet_transactions (withdrawal_request_id)
  WHERE transaction_type = 'withdrawal_reversal'
    AND withdrawal_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_teacher_wallet_summary()
RETURNS TABLE (
  available_balance numeric,
  total_received numeric,
  total_withdrawn numeric,
  pending_withdrawals numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce(sum(t.amount), 0)::numeric(12,2) AS available_balance,
    coalesce(sum(t.amount) FILTER (
      WHERE t.amount > 0
        AND t.transaction_type IN ('lesson_credit', 'manual_adjustment')
    ), 0)::numeric(12,2) AS total_received,
    coalesce(sum(abs(t.amount)) FILTER (
      WHERE t.transaction_type = 'withdrawal_hold'
        AND w.status = 'pago'
    ), 0)::numeric(12,2) AS total_withdrawn,
    coalesce(sum(abs(t.amount)) FILTER (
      WHERE t.transaction_type = 'withdrawal_hold'
        AND w.status IN ('pendente', 'em_processamento')
        AND NOT EXISTS (
          SELECT 1
          FROM public.teacher_wallet_transactions reversal
          WHERE reversal.withdrawal_request_id = t.withdrawal_request_id
            AND reversal.transaction_type = 'withdrawal_reversal'
        )
    ), 0)::numeric(12,2) AS pending_withdrawals
  FROM public.teacher_wallet_transactions t
  LEFT JOIN public.teacher_withdrawal_requests w ON w.id = t.withdrawal_request_id
  WHERE t.teacher_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_teacher_wallet_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_wallet_summary() TO authenticated;
