import { assertLocalPerf02Target, percentile } from "./run-local";
import { PERF02_PG_CONCURRENCY, PERF02_PG_URL } from "./local-database";

// PERF-02 — serveur Next de production local, routes publiques seulement (décision C10 du 27 octobre 2026).
// Les routes connectées attendent une cible Supabase joignable (ENV-2).
export const PERF02_NEXT_PORT = "55451";
export const PERF02_NEXT_URL = `http://127.0.0.1:${PERF02_NEXT_PORT}`;
export const PERF02_NEXT_REQUESTS_PER_LEVEL = 48;

export const PERF02_NEXT_PAGES = [
  { name: "Accueil", path: "/" },
  { name: "Fonctionnalités", path: "/fonctionnalites" },
  { name: "Tarifs (catalogue en base)", path: "/tarifs" },
  { name: "Démonstration", path: "/demonstration" },
  { name: "Contact", path: "/contact" },
  { name: "Inscription", path: "/register" },
  { name: "API inscription : catalogue", path: "/api/signup" },
] as const;

/** Environnement complet du serveur mesuré : rien n'est hérité, donc aucun secret ni service réel. */
export function nextLocalEnv(inherited: Record<string, string | undefined> = process.env): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    PATH: inherited.PATH,
    HOME: inherited.HOME,
    TMPDIR: inherited.TMPDIR,
    CI: "true",
    NEXT_TELEMETRY_DISABLED: "1",
    DATABASE_URL: PERF02_PG_URL,
    DIRECT_URL: PERF02_PG_URL,
    DATABASE_CONNECTION_LIMIT: "5",
    NEXT_PUBLIC_APP_URL: PERF02_NEXT_URL,
    NEXT_PUBLIC_SUPABASE_URL: "https://perf02.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "perf02-public-placeholder",
    // Sert uniquement de clé HMAC à l'empreinte de source du formulaire Contact.
    SUPABASE_SERVICE_ROLE_KEY: "perf02-local-only",
    GEOCODING_URL: "http://127.0.0.1:9/perf02-no-network",
    EMAIL_DELIVERY_MODE: "disabled",
  };
}

type Request = (index: number) => Promise<Response>;

export async function measureHttpLevel(concurrency: number, total: number, request: Request) {
  const durations: number[] = [];
  const statuses: Record<string, number> = {};
  let next = 0;
  const startedAt = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < total) {
        const index = next;
        next += 1;
        const opStartedAt = performance.now();
        let status: string;
        try {
          const response = await request(index);
          await response.arrayBuffer();
          status = String(response.status);
        } catch {
          status = "network_error";
        }
        durations.push(performance.now() - opStartedAt);
        statuses[status] = (statuses[status] ?? 0) + 1;
      }
    })
  );
  const elapsedMs = performance.now() - startedAt;
  const rounded = (value: number) => Number(value.toFixed(1));
  return {
    concurrency,
    requests: total,
    statuses,
    p50Ms: rounded(percentile(durations, 0.5)),
    p95Ms: rounded(percentile(durations, 0.95)),
    maxMs: rounded(Math.max(0, ...durations)),
    throughputPerSecond: rounded((total / elapsedMs) * 1000),
  };
}

const contactBody = (index: number) => JSON.stringify({
  name: "Mesure Perf",
  email: `perf02-${index}@example.invalid`,
  message: "Message fictif de mesure locale PERF-02, jamais envoyé.",
});

/** Une source distincte par envoi : la limite globale de 50 par heure est la seule en jeu. */
function postContact(base: string, offset: number): Request {
  return (index) => fetch(`${base}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": `198.51.100.1, 10.${Math.floor((offset + index) / 250)}.${(offset + index) % 250}.1` },
    body: contactBody(offset + index),
  });
}

export async function runNextMeasure(rawBase: string) {
  const base = assertLocalPerf02Target(rawBase).replace(/\/$/, "");
  const pages = [];
  for (const page of PERF02_NEXT_PAGES) {
    for (let warm = 0; warm < 3; warm += 1) await (await fetch(`${base}${page.path}`)).arrayBuffer();
    const levels = [];
    for (const concurrency of PERF02_PG_CONCURRENCY) {
      levels.push(await measureHttpLevel(concurrency, PERF02_NEXT_REQUESTS_PER_LEVEL, () => fetch(`${base}${page.path}`)));
    }
    pages.push({ ...page, levels });
  }
  // Rafale de 60 envois simultanés par 8 : combien passent la limite globale de 50 ?
  const burst = await measureHttpLevel(8, 60, postContact(base, 0));
  const limited = [];
  for (const concurrency of PERF02_PG_CONCURRENCY) {
    limited.push(await measureHttpLevel(concurrency, PERF02_NEXT_REQUESTS_PER_LEVEL, postContact(base, 1000 + concurrency * 100)));
  }
  return { pages, contact: { burst, limited } };
}
