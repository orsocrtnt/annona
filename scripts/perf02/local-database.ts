// PERF-02 — PostgreSQL local jetable. La mesure refuse toute autre base, préproduction comprise.
export const PERF02_PG_PORT = "55441";
export const PERF02_PG_DATABASE = "perf02";
export const PERF02_PG_URL = `postgresql://postgres@127.0.0.1:${PERF02_PG_PORT}/${PERF02_PG_DATABASE}`;

export function assertLocalPerf02Database(value: string | undefined) {
  if (!value) throw new Error("PERF02_DATABASE_MISSING");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("PERF02_DATABASE_INVALID");
  }
  if (
    url.hostname !== "127.0.0.1" ||
    url.port !== PERF02_PG_PORT ||
    url.pathname !== `/${PERF02_PG_DATABASE}`
  ) {
    throw new Error("PERF02_REMOTE_DATABASE_FORBIDDEN");
  }
  return url;
}

/** Concurrences mesurées : 1 (référence), 4 (plafond prudent PERF-02), puis au-delà du pool de 5. */
export const PERF02_PG_CONCURRENCY = [1, 4, 8, 16] as const;
