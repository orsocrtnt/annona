import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const nextDir = ".next";
const prismaHashFile = ".prisma-schema-hash";

function prismaSchemaHash() {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  return createHash("sha256").update(schema).digest("hex");
}

function isPortInUse(port) {
  try {
    const out = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: "utf8" }).trim();
    return Boolean(out);
  } catch {
    return false;
  }
}

const currentPrismaHash = prismaSchemaHash();
const previousPrismaHash = existsSync(prismaHashFile)
  ? readFileSync(prismaHashFile, "utf8").trim()
  : null;
const schemaChanged = previousPrismaHash !== currentPrismaHash;

if (schemaChanged) {
  try {
    execSync("npx prisma generate", { stdio: "inherit" });
  } catch {
    console.warn("[tutelliv] prisma generate a échoué — vérifiez DATABASE_URL / DIRECT_URL.");
  }

  try {
    execSync("npm run db:sync-schema", { stdio: "inherit" });
  } catch {
    console.warn(
      "[tutelliv] db:sync-schema a échoué — lancez `npm run db:sync-schema` si des colonnes manquent."
    );
  }

  if (previousPrismaHash && existsSync(nextDir)) {
    console.log("[tutelliv] Schéma Prisma modifié — nettoyage du cache Next.js...");
    rmSync(nextDir, { recursive: true, force: true });
  }

  writeFileSync(prismaHashFile, currentPrismaHash);
}

if (existsSync(nextDir)) {
  const hasProductionBuild = existsSync(`${nextDir}/BUILD_ID`);
  if (hasProductionBuild) {
    console.log("[tutelliv] Cache production détecté — nettoyage avant dev...");
    rmSync(nextDir, { recursive: true, force: true });
  }
}

if (isPortInUse(3000)) {
  console.warn(
    "[tutelliv] Attention : le port 3000 est déjà utilisé. Arrêtez l'autre serveur (Ctrl+C) avant de relancer."
  );
}
