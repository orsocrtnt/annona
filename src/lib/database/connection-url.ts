interface DatabaseEnvironment {
  DATABASE_URL?: string;
  DATABASE_CONNECTION_LIMIT?: string;
  DATABASE_CONNECTION_MODE?: string;
  NODE_ENV?: string;
}

/** Pool applicatif borné ; conserver le mode transactionnel sauf choix explicite. */
export function resolveDatabaseUrl(env: DatabaseEnvironment): string | undefined {
  if (!env.DATABASE_URL) return undefined;
  const url = new URL(env.DATABASE_URL);
  if (env.DATABASE_CONNECTION_MODE === "session") {
    // Ne pas transformer silencieusement un autre fournisseur/point d'accès.
    if (!url.hostname.endsWith(".pooler.supabase.com") || !["5432", "6543"].includes(url.port)) {
      throw new Error("DATABASE_SESSION_REQUIRES_SUPABASE_POOLER");
    }
    url.port = "5432";
    url.searchParams.delete("pgbouncer");
  }
  const limit = env.DATABASE_CONNECTION_LIMIT ?? url.searchParams.get("connection_limit") ?? "5";
  if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 10) {
    throw new Error("DATABASE_CONNECTION_LIMIT_MUST_BE_1_TO_10");
  }
  // Cinq lectures simultanées mesurées au montage ; surcharge explicite bornée.
  url.searchParams.set("connection_limit", limit);
  return url.toString();
}
