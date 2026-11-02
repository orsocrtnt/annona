import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";

const root = process.cwd();
const outputPath = process.argv[2] ?? "outputs/doc1/verification.json";

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return extname(entry.name) === ".md" ? [path] : [];
  });
}

const markdownFiles = [resolve(root, "README.md"), ...walk(resolve(root, "docs"))]
  .filter((path) => !path.includes(`${join("docs", "rapports")}/`));
const brokenLinks = [];

for (const file of markdownFiles) {
  const body = readFileSync(file, "utf8");
  for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|mailto:|tel:|#)/.test(target)) continue;
    target = target.split("#", 1)[0];
    if (!target || target.startsWith("/")) continue;
    try {
      target = decodeURIComponent(target);
    } catch {
      brokenLinks.push({ file: relative(root, file), target, reason: "encodage invalide" });
      continue;
    }
    const absolute = normalize(resolve(dirname(file), target));
    if (!absolute.startsWith(root) || !existsSync(absolute)) {
      brokenLinks.push({ file: relative(root, file), target, reason: "cible absente" });
    }
  }
}

const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const commandDocs = [
  "README.md",
  "docs/README.md",
  "docs/OPERATIONS.md",
  "docs/ARCHITECTURE.md",
  "docs/DATABASE.md",
  "docs/RBAC.md",
].map((path) => resolve(root, path));
const missingScripts = [];

for (const file of commandDocs) {
  const body = readFileSync(file, "utf8");
  for (const match of body.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) {
    const script = match[1];
    if (!packageJson.scripts?.[script]) {
      missingScripts.push({ file: relative(root, file), script });
    }
  }
}

const envExample = readFileSync(resolve(root, ".env.example"), "utf8");
const documentedEnv = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "CRON_SECRET",
  "OPS_HEALTH_SECRET",
  "OPS_ALERT_RECIPIENT",
  "OPS_ALERT_WEBHOOK_URL",
  "OPS_ALERT_WEBHOOK_TOKEN",
  "AUTH_EMAIL_LINKS_ENABLED",
  "RESEND_API_KEY",
  "MAIL_FROM",
  "EMAIL_FROM",
  "NEXT_PUBLIC_MAP_TILE_URL",
  "NEXT_PUBLIC_MAP_TILE_ATTRIBUTION",
  "NEXT_PUBLIC_MAP_MAX_NATIVE_ZOOM",
  "NEXT_PUBLIC_OSRM_URL",
  "GEOCODING_URL",
  "DATABASE_CONNECTION_LIMIT",
  "DATABASE_CONNECTION_MODE",
  "E2E_BASE_URL",
  "E2E_SKIP_WEB_SERVER",
  "PLAYWRIGHT_CHANNEL",
];
const missingEnv = documentedEnv.filter(
  (name) => !new RegExp(`^(?:#\\s*)?${name}=`, "m").test(envExample)
);

const schema = readFileSync(resolve(root, "prisma/schema.prisma"), "utf8");
const prismaModelCount = [...schema.matchAll(/^model\s+\w+/gm)].length;
const databaseDoc = readFileSync(resolve(root, "docs/DATABASE.md"), "utf8");
const modelCountDocumented = databaseDoc.includes(`${prismaModelCount} modèles Prisma`);

const proof = {
  task: "DOC-1",
  passed:
    brokenLinks.length === 0 &&
    missingScripts.length === 0 &&
    missingEnv.length === 0 &&
    modelCountDocumented,
  markdownFilesChecked: markdownFiles.length,
  brokenLinks,
  missingScripts,
  missingEnv,
  prismaModelCount,
  modelCountDocumented,
};

mkdirSync(dirname(resolve(root, outputPath)), { recursive: true });
writeFileSync(resolve(root, outputPath), `${JSON.stringify(proof, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  passed: proof.passed,
  markdownFilesChecked: proof.markdownFilesChecked,
  brokenLinks: brokenLinks.length,
  missingScripts: missingScripts.length,
  missingEnv: missingEnv.length,
  prismaModelCount,
}));

if (!proof.passed) process.exitCode = 1;
