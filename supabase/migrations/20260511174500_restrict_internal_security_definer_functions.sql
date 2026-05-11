-- Internal trigger/maintenance functions should not be exposed as RPC endpoints.
REVOKE EXECUTE ON FUNCTION public.prevent_booking_party_changes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_booking_party_changes() TO service_role;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
