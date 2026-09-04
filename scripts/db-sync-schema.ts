/**
 * Applique les colonnes / changements de schéma manquants via DATABASE_URL (pooler).
 * Utile quand `prisma db push` échoue (DIRECT_URL / port 5432 inaccessible).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PATCHES: Array<{ name: string; sql: string }> = [
  {
    name: "SystemRole.MINI_ADMIN",
    sql: `ALTER TYPE "SystemRole" ADD VALUE IF NOT EXISTS 'MINI_ADMIN'`,
  },
  {
    name: "companies.is_demo",
    sql: `ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN NOT NULL DEFAULT false`,
  },
  {
    name: "order_stops.latitude",
    sql: `ALTER TABLE "order_stops" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION`,
  },
  {
    name: "order_stops.longitude",
    sql: `ALTER TABLE "order_stops" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION`,
  },
  {
    name: "deliveries.latitude",
    sql: `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION`,
  },
  {
    name: "deliveries.longitude",
    sql: `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION`,
  },
  {
    name: "deliveries.pickup_latitude",
    sql: `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "pickup_latitude" DOUBLE PRECISION`,
  },
  {
    name: "deliveries.pickup_longitude",
    sql: `ALTER TABLE "deliveries" ADD COLUMN IF NOT EXISTS "pickup_longitude" DOUBLE PRECISION`,
  },
];

async function main() {
  console.log("🔧 Synchronisation du schéma (pooler)...\n");

  for (const patch of PATCHES) {
    try {
      await prisma.$executeRawUnsafe(patch.sql);
      console.log(`  ✅ ${patch.name}`);
    } catch (error) {
      console.error(`  ❌ ${patch.name}`, error);
      throw error;
    }
  }

  console.log("\n✅ Schéma synchronisé");
}

main()
  .catch(() => process.exit(1))
  .finally(async () => {
    await prisma.$disconnect();
  });
