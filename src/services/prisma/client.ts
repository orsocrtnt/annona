import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "@/lib/database/connection-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaHash: string | undefined;
  prismaClientEpoch: string | undefined;
};

/** Incrémenter après un `prisma generate` si le serveur de dev garde un client périmé. */
const PRISMA_CLIENT_EPOCH = "perf01-relation-joins";

/** Hash live du schéma — évite un singleton Prisma obsolète après db push / generate. */
function readPrismaSchemaHash() {
  try {
    const schemaPath = join(process.cwd(), "prisma/schema.prisma");
    if (!existsSync(schemaPath)) return undefined;
    const schema = readFileSync(schemaPath, "utf8");
    return createHash("sha256").update(schema).digest("hex");
  } catch {
    return undefined;
  }
}

function createPrismaClient() {
  const url = resolveDatabaseUrl(process.env);
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: url ? { db: { url } } : undefined,
  });
}

/** Recrée le client si le schéma Prisma a changé (évite un singleton obsolète en dev). */
function getPrismaClient() {
  const schemaHash = readPrismaSchemaHash();
  if (
    process.env.NODE_ENV !== "production" &&
    globalForPrisma.prisma &&
    ((schemaHash && globalForPrisma.prismaSchemaHash !== schemaHash) ||
      globalForPrisma.prismaClientEpoch !== PRISMA_CLIENT_EPOCH)
  ) {
    const staleClient = globalForPrisma.prisma;
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaSchemaHash = undefined;
    globalForPrisma.prismaClientEpoch = undefined;
    void staleClient.$disconnect().catch(() => undefined);
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    if (process.env.NODE_ENV !== "production") {
      if (schemaHash) globalForPrisma.prismaSchemaHash = schemaHash;
      globalForPrisma.prismaClientEpoch = PRISMA_CLIENT_EPOCH;
    }
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
