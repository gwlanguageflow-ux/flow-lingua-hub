CREATE OR REPLACE FUNCTION public.request_teacher_withdrawal(
  _amount numeric,
  _pix_key_type public.pix_key_type,
  _pix_key text,
  _account_holder_name text,
  _account_holder_document text DEFAULT NULL,
  _teacher_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _teacher_id uuid := auth.uid();
  _available numeric(12,2);
  _withdrawal_id uuid;
  _normalized_amount numeric(12,2) := round(coalesce(_amount, 0), 2);
BEGIN
  IF _teacher_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = _teacher_id) THEN
    RAISE EXCEPTION 'teacher profile required' USING ERRCODE = '42501';
  END IF;

  IF _normalized_amount <= 0 THEN
    RAISE EXCEPTION 'withdrawal amount must be greater than zero' USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(_pix_key, ''))) < 3 THEN
    RAISE EXCEPTION 'pix key is required' USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(_account_holder_name, ''))) < 2 THEN
    RAISE EXCEPTION 'account holder name is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_teacher_id::text));
  _available := public.teacher_wallet_available_balance(_teacher_id);

  IF _available < _normalized_amount THEN
    RAISE EXCEPTION 'insufficient wallet balance' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.teacher_withdrawal_requests (
    teacher_id,
    amount,
    pix_key_type,
    pix_key,
    account_holder_name,
    account_holder_document,
    teacher_notes
  )
  VALUES (
    _teacher_id,
    _normalized_amount,
    _pix_key_type,
    trim(_pix_key),
    trim(_account_holder_name),
    NULLIF(regexp_replace(coalesce(_account_holder_document, ''), '\D', '', 'g'), ''),
    NULLIF(trim(coalesce(_teacher_notes, '')), '')
  )
  RETURNING id INTO _withdrawal_id;

  INSERT INTO public.teacher_wallet_transactions (
    teacher_id,
    withdrawal_request_id,
    transaction_type,
    amount,
    description,
    created_by
  )
  VALUES (
    _teacher_id,
    _withdrawal_id,
    'withdrawal_hold',
    -_normalized_amount,
    'Saque Pix solicitado pelo professor',
    _teacher_id
  );

  RETURN _withdrawal_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_teacher_withdrawal(
  numeric,
  public.pix_key_type,
  text,
  text,
  text,
  text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_teacher_withdrawal(
  numeric,
  public.pix_key_type,
  text,
  text,
  text,
  text
) TO authenticated;
