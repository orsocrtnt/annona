import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaHash: string | undefined;
};

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

function appendQueryParam(url: string, key: string, value: string) {
  const separator = url.includes("?") ? "&" : "?";
  if (new RegExp(`[?&]${key}=`).test(url)) return url;
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}

function resolveDatabaseUrl(): string | undefined {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return undefined;

  // Runtime (app) : pooler transactionnel Supabase (6543) — évite la limite
  // "max clients" du mode session (5432). DIRECT_URL reste réservé à prisma db push / migrate.
  return appendQueryParam(databaseUrl, "connection_limit", "1");
}

function createPrismaClient() {
  const url = resolveDatabaseUrl();
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
    schemaHash &&
    globalForPrisma.prismaSchemaHash !== schemaHash
  ) {
    const staleClient = globalForPrisma.prisma;
    globalForPrisma.prisma = undefined;
    globalForPrisma.prismaSchemaHash = undefined;
    void staleClient.$disconnect().catch(() => undefined);
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
    if (process.env.NODE_ENV !== "production" && schemaHash) {
      globalForPrisma.prismaSchemaHash = schemaHash;
    }
  }

  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();
