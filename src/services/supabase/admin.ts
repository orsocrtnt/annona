import { createClient } from "@supabase/supabase-js";

// Serveur uniquement (clé service_role). Pas d'`import "server-only"` : le paquet n'existe
// que via l'alias interne de Next, les tests node et scripts tsx échoueraient. La garde est
// tests/sec-server-only-admin.test.ts, qui refuse tout chemin d'import depuis "use client".
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
