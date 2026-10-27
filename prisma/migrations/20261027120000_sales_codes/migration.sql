-- SALES-1 / décision C10 : codes commerciaux permanents, attribution figée à l'activation
-- et commissions théoriques. Additive ; aucun versement automatisé.

-- CreateEnum
CREATE TYPE "SalesCommissionLevel" AS ENUM ('REFERRER', 'ASSISTED', 'AUTONOMOUS');

-- AlterEnum
ALTER TYPE "PlatformAccessResource" ADD VALUE 'SALES_CODES';
ALTER TYPE "PlatformAccessResource" ADD VALUE 'SALES_COMMISSIONS';

-- AlterTable
ALTER TABLE "signup_journeys" ADD COLUMN     "sales_code_id" TEXT;

-- CreateTable
CREATE TABLE "sales_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "seller_name" TEXT NOT NULL,
    "seller_email" TEXT NOT NULL,
    "level" "SalesCommissionLevel" NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "disabled_at" TIMESTAMP(3),
    "disabled_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_attributions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sales_code_id" TEXT NOT NULL,
    "signup_id" TEXT NOT NULL,
    "level" "SalesCommissionLevel" NOT NULL,
    "rate_bps" INTEGER NOT NULL,
    "attributed_at" TIMESTAMP(3) NOT NULL,
    "eligible_until" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_commission_entries" (
    "id" TEXT NOT NULL,
    "attribution_id" TEXT NOT NULL,
    "settlement_key" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "eligible_ht_cents" INTEGER NOT NULL,
    "rate_bps" INTEGER NOT NULL,
    "commission_cents" INTEGER NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_commission_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_codes_code_key" ON "sales_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sales_codes_seller_email_key" ON "sales_codes"("seller_email");

-- CreateIndex
CREATE UNIQUE INDEX "sales_attributions_company_id_key" ON "sales_attributions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_attributions_signup_id_key" ON "sales_attributions"("signup_id");

-- CreateIndex
CREATE INDEX "sales_attributions_sales_code_id_attributed_at_idx" ON "sales_attributions"("sales_code_id", "attributed_at");

-- CreateIndex
CREATE INDEX "sales_commission_entries_received_at_idx" ON "sales_commission_entries"("received_at");

-- CreateIndex
CREATE UNIQUE INDEX "sales_commission_entries_attribution_id_settlement_key_key" ON "sales_commission_entries"("attribution_id", "settlement_key");

-- CreateIndex
CREATE INDEX "signup_journeys_sales_code_id_idx" ON "signup_journeys"("sales_code_id");

-- AddForeignKey
ALTER TABLE "signup_journeys" ADD CONSTRAINT "signup_journeys_sales_code_id_fkey" FOREIGN KEY ("sales_code_id") REFERENCES "sales_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_attributions" ADD CONSTRAINT "sales_attributions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_attributions" ADD CONSTRAINT "sales_attributions_sales_code_id_fkey" FOREIGN KEY ("sales_code_id") REFERENCES "sales_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_commission_entries" ADD CONSTRAINT "sales_commission_entries_attribution_id_fkey" FOREIGN KEY ("attribution_id") REFERENCES "sales_attributions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tables internes : exclusivement accessibles via le serveur Prisma.
ALTER TABLE "sales_codes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "sales_codes" FROM PUBLIC, anon, authenticated;
ALTER TABLE "sales_attributions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "sales_attributions" FROM PUBLIC, anon, authenticated;
ALTER TABLE "sales_commission_entries" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "sales_commission_entries" FROM PUBLIC, anon, authenticated;
