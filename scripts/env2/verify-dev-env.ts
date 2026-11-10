import { pathToFileURL } from "node:url";

type Environment = Record<string, string | undefined>;

/** ENV-2 : seul projet Supabase autorisé pour le développement local. */
export const DEV_SUPABASE_REF = "fqzlfszgyeyfeshllqtj";
/** Préproduction, anciens projets de développement (dont `tutelliv-dev`, en pause depuis le 6 novembre 2026) et copie de répétition de restauration. */
export const FORBIDDEN_SUPABASE_REFS = ["zwwyalsslyydubtetagj", "wlomrzilflbouzyhzwxm", "tyfpfepmqibafjykldbk", "mhzdmoytxmzudhkivixh"] as const;

const REQUIRED = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
] as const;

const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

function parseUrl(name: string, value: string, protocols: string[], errors: string[]) {
  try {
    const url = new URL(value);
    if (!protocols.includes(url.protocol)) errors.push(`${name}_PROTOCOL_INVALID`);
    return url;
  } catch {
    errors.push(`${name}_URL_INVALID`);
    return null;
  }
}

function databaseTarget(url: URL | null) {
  if (!url) return "";
  return `${url.hostname} ${decodeURIComponent(url.username)}`;
}

/** Ne renvoie que des codes d'erreur : aucune valeur de l'environnement n'en sort. */
export function validateDevEnvironment(environment: Environment) {
  const errors: string[] = [];

  for (const name of REQUIRED) {
    if (!environment[name]?.trim()) errors.push(`${name}_MISSING`);
  }
  if (errors.length) return errors;

  const app = parseUrl("NEXT_PUBLIC_APP_URL", environment.NEXT_PUBLIC_APP_URL!, ["http:", "https:"], errors);
  const supabase = parseUrl("NEXT_PUBLIC_SUPABASE_URL", environment.NEXT_PUBLIC_SUPABASE_URL!, ["https:"], errors);
  const database = parseUrl("DATABASE_URL", environment.DATABASE_URL!, ["postgres:", "postgresql:"], errors);
  const direct = parseUrl("DIRECT_URL", environment.DIRECT_URL!, ["postgres:", "postgresql:"], errors);

  if (app && !LOCAL_HOSTS.includes(app.hostname)) errors.push("DEV_APP_URL_NOT_LOCAL");
  if (supabase && supabase.hostname !== `${DEV_SUPABASE_REF}.supabase.co`) errors.push("DEV_SUPABASE_REF_MISMATCH");

  for (const [name, url] of [["DATABASE_URL", database], ["DIRECT_URL", direct]] as const) {
    const target = databaseTarget(url);
    if (url && !target.includes(DEV_SUPABASE_REF)) errors.push(`${name}_TARGET_MISMATCH`);
    if (FORBIDDEN_SUPABASE_REFS.some((ref) => target.includes(ref))) errors.push(`${name}_TARGET_FORBIDDEN`);
    if (url && (!url.username || !url.password)) errors.push(`${name}_CREDENTIALS_MISSING`);
  }
  if (supabase && FORBIDDEN_SUPABASE_REFS.some((ref) => supabase.hostname.startsWith(`${ref}.`))) {
    errors.push("DEV_SUPABASE_REF_FORBIDDEN");
  }

  if (environment.NEXT_PUBLIC_SUPABASE_ANON_KEY === environment.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push("SUPABASE_KEYS_MUST_DIFFER");
  }

  return [...new Set(errors)].sort();
}

function main() {
  const errors = validateDevEnvironment(process.env);
  console.log(JSON.stringify({ passed: errors.length === 0, errors }));
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
