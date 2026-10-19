import { createClient } from "@supabase/supabase-js";

/** Client isolé par tentative : aucun cookie, stockage navigateur ou session partagée. */
export function createPasswordLinkClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );
}
