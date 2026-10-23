-- L'event trigger conserve son fonctionnement interne, mais ne doit jamais être
-- exposé comme RPC aux rôles Data API (advisor Supabase 0028/0029).
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated;
