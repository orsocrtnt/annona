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
  // La génération est locale ; aucune commande de schéma/seed n'est lancée ici.
  // Ne pas enregistrer le hash si la génération échoue : réessayer au prochain lancement.
  execSync("npm run db:generate", { stdio: "inherit" });
  console.warn(
    "[annona] Client Prisma régénéré. La base n'a pas été modifiée ; vérifiez sa compatibilité séparément sur un environnement de développement."
  );

  if (previousPrismaHash && existsSync(nextDir)) {
    console.log("[annona] Schéma Prisma modifié — nettoyage du cache Next.js...");
    rmSync(nextDir, { recursive: true, force: true });
  }

  writeFileSync(prismaHashFile, currentPrismaHash);
}

if (existsSync(nextDir)) {
  const hasProductionBuild = existsSync(`${nextDir}/BUILD_ID`);
  if (hasProductionBuild) {
    console.log("[annona] Cache production détecté — nettoyage avant dev...");
    rmSync(nextDir, { recursive: true, force: true });
  }
}

if (isPortInUse(3000)) {
  console.warn(
    "[annona] Attention : le port 3000 est déjà utilisé. Arrêtez l'autre serveur (Ctrl+C) avant de relancer."
  );
}
