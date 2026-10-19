import { pathToFileURL } from "node:url";

type Environment = Record<string, string | undefined>;

const REQUIRED = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "CRON_SECRET",
  "OPS_HEALTH_SECRET",
  "PREPROD_EXPECTED_APP_HOST",
  "PREPROD_EXPECTED_SUPABASE_REF",
] as const;

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

function supabaseRef(url: URL | null) {
  if (!url) return null;
  return url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1] ?? null;
}

function databaseMatchesRef(url: URL | null, ref: string) {
  if (!url) return false;
  return url.hostname.includes(ref) || decodeURIComponent(url.username).includes(ref);
}

export function validatePreproductionEnvironment(environment: Environment) {
  const errors: string[] = [];

  for (const name of REQUIRED) {
    if (!environment[name]?.trim()) errors.push(`${name}_MISSING`);
  }
  if (errors.length) return errors;

  const app = parseUrl("NEXT_PUBLIC_APP_URL", environment.NEXT_PUBLIC_APP_URL!, ["https:"], errors);
  const supabase = parseUrl(
    "NEXT_PUBLIC_SUPABASE_URL",
    environment.NEXT_PUBLIC_SUPABASE_URL!,
    ["https:"],
    errors
  );
  const database = parseUrl("DATABASE_URL", environment.DATABASE_URL!, ["postgres:", "postgresql:"], errors);
  const direct = parseUrl("DIRECT_URL", environment.DIRECT_URL!, ["postgres:", "postgresql:"], errors);
  const expectedRef = environment.PREPROD_EXPECTED_SUPABASE_REF!.trim();
  const detectedRef = supabaseRef(supabase);

  if (app?.hostname !== environment.PREPROD_EXPECTED_APP_HOST!.trim()) {
    errors.push("PREPROD_APP_HOST_MISMATCH");
  }
  if (!detectedRef) errors.push("PREPROD_SUPABASE_REF_UNREADABLE");
  if (detectedRef && detectedRef !== expectedRef) errors.push("PREPROD_SUPABASE_REF_MISMATCH");

  const forbiddenRefs = (environment.PREPROD_FORBIDDEN_SUPABASE_REFS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (detectedRef && forbiddenRefs.includes(detectedRef)) {
    errors.push("PREPROD_SUPABASE_REF_FORBIDDEN");
  }
  if (!databaseMatchesRef(database, expectedRef)) errors.push("DATABASE_URL_TARGET_MISMATCH");
  if (!databaseMatchesRef(direct, expectedRef)) errors.push("DIRECT_URL_TARGET_MISMATCH");
  if (!database?.username || !database.password) errors.push("DATABASE_URL_CREDENTIALS_MISSING");
  if (!direct?.username || !direct.password) errors.push("DIRECT_URL_CREDENTIALS_MISSING");

  if (environment.NEXT_PUBLIC_SUPABASE_ANON_KEY === environment.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push("SUPABASE_KEYS_MUST_DIFFER");
  }
  if (environment.CRON_SECRET!.length < 32) errors.push("CRON_SECRET_TOO_SHORT");
  if (environment.OPS_HEALTH_SECRET!.length < 32) errors.push("OPS_HEALTH_SECRET_TOO_SHORT");
  if (environment.CRON_SECRET === environment.OPS_HEALTH_SECRET) {
    errors.push("OPERATIONAL_SECRETS_MUST_DIFFER");
  }

  if (environment.AUTH_EMAIL_LINKS_ENABLED !== "false") {
    errors.push("AUTH_EMAIL_LINKS_MUST_BE_FALSE");
  }
  if (!["disabled", "test"].includes(environment.EMAIL_DELIVERY_MODE ?? "")) {
    errors.push("EMAIL_DELIVERY_MODE_UNSAFE");
  }
  if (environment.EMAIL_DELIVERY_MODE === "test" && !environment.EMAIL_TEST_RECIPIENT?.trim()) {
    errors.push("EMAIL_TEST_RECIPIENT_MISSING");
  }
  if (environment.DEMO_CLEANUP_ENABLED !== "false") {
    errors.push("DEMO_CLEANUP_MUST_BE_FALSE");
  }

  return [...new Set(errors)].sort();
}

function main() {
  const errors = validatePreproductionEnvironment(process.env);
  const result = { passed: errors.length === 0, errors };
  console.log(JSON.stringify(result));
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
