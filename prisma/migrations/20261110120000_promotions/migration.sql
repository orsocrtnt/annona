-- Lot 1, demande 2 (10 novembre 2026) : promotions (fins de série et autres).
-- Additive : aucune donnée existante n'est modifiée ; les lignes de commande existantes n'ont pas de promotion.
-- Une ligne de commande garde la part « promo » retenue à la validation (quantité et prix) : une
-- promotion qui se termine ne change pas une commande déjà validée.

-- AlterTable
ALTER TABLE "order_lines" ADD COLUMN     "promo_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "promo_unit_price_cents" INTEGER,
ADD COLUMN     "promotion_id" TEXT;

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "promo_price_cents" INTEGER,
    "discount_percent" INTEGER,
    "ends_on" DATE NOT NULL,
    "quantity_limit" INTEGER,
    "all_merchants" BOOLEAN NOT NULL DEFAULT true,
    "stopped_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_merchants" (
    "promotion_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,

    CONSTRAINT "promotion_merchants_pkey" PRIMARY KEY ("promotion_id","merchant_id")
);

-- CreateIndex
CREATE INDEX "promotions_company_id_ends_on_idx" ON "promotions"("company_id", "ends_on");

-- CreateIndex
CREATE INDEX "promotions_product_id_idx" ON "promotions"("product_id");

-- CreateIndex
CREATE INDEX "promotions_created_by_id_idx" ON "promotions"("created_by_id");

-- CreateIndex
CREATE INDEX "promotion_merchants_merchant_id_idx" ON "promotion_merchants"("merchant_id");

-- CreateIndex
CREATE INDEX "promotion_merchants_company_id_idx" ON "promotion_merchants"("company_id");

-- CreateIndex
CREATE INDEX "order_lines_promotion_id_idx" ON "order_lines"("promotion_id");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_merchants" ADD CONSTRAINT "promotion_merchants_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_merchants" ADD CONSTRAINT "promotion_merchants_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_merchants" ADD CONSTRAINT "promotion_merchants_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Contraintes métier.
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_price_or_percent" CHECK (
  ("promo_price_cents" IS NULL) <> ("discount_percent" IS NULL)
);
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_price_positive" CHECK ("promo_price_cents" IS NULL OR "promo_price_cents" >= 0);
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_percent_range" CHECK ("discount_percent" IS NULL OR "discount_percent" BETWEEN 1 AND 99);
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_quantity_limit_positive" CHECK ("quantity_limit" IS NULL OR "quantity_limit" > 0);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_promo_quantity_range" CHECK (
  "promo_quantity" >= 0 AND "promo_quantity" <= "quantity_ordered"
);
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_promo_price_set" CHECK (
  "promo_quantity" = 0 OR ("promo_unit_price_cents" IS NOT NULL AND "promo_unit_price_cents" >= 0)
);

-- Aucune lecture directe depuis le navigateur (même règle que les autres tables).
ALTER TABLE "promotions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "promotions" FROM PUBLIC, anon, authenticated;
ALTER TABLE "promotion_merchants" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "promotion_merchants" FROM PUBLIC, anon, authenticated;
