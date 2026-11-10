-- Lot 1, demande 1 (10 novembre 2026) : tournées (zones) avec une plage du matin et une plage du soir.
-- Chaque zone porte deux créneaux (matin, soir) ; le client est rattaché à une zone par l'administrateur.
-- Additive : aucune donnée existante n'est modifiée. Les anciens créneaux horaires (sans zone) restent
-- pour l'historique. L'unicité « mêmes heures » disparaît : deux zones peuvent avoir les mêmes plages.

-- CreateEnum
CREATE TYPE "DeliveryPeriod" AS ENUM ('MORNING', 'EVENING');

-- DropIndex
DROP INDEX "slots_company_id_start_time_end_time_key";

-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "zone_id" TEXT;

-- AlterTable
ALTER TABLE "slots" ADD COLUMN     "period" "DeliveryPeriod",
ADD COLUMN     "zone_id" TEXT;

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "morning_start" TEXT NOT NULL,
    "morning_end" TEXT NOT NULL,
    "evening_start" TEXT NOT NULL,
    "evening_end" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_zones_company_id_sort_order_idx" ON "delivery_zones"("company_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_company_id_name_key" ON "delivery_zones"("company_id", "name");

-- CreateIndex
CREATE INDEX "merchants_zone_id_idx" ON "merchants"("zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "slots_zone_id_period_key" ON "slots"("zone_id", "period");

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "delivery_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "delivery_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Contraintes métier (comme la migration initiale pour les créneaux).
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_time_format" CHECK (
  "morning_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "morning_end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
  "evening_start" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "evening_end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
);
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_ranges_ordered" CHECK (
  "morning_start" < "morning_end" AND "evening_start" < "evening_end"
);
ALTER TABLE "slots" ADD CONSTRAINT "slots_zone_period_together" CHECK (("zone_id" IS NULL) = ("period" IS NULL));

-- Aucune lecture directe depuis le navigateur (même règle que les autres tables).
ALTER TABLE "delivery_zones" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "delivery_zones" FROM PUBLIC, anon, authenticated;
