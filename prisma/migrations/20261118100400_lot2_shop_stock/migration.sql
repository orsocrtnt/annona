-- Lot 2, demandes 6, 7 et 8 (18 novembre 2026) : réception de l'envoi du matin en boutique (reçu, abîmé pendant la
-- livraison), stock par lots datés (les plus anciens vendus en premier, dernier jour de vente), clôture du soir
-- (reste, vendus calculés, jetés en fin de vente ou abîmés en boutique) et écran « Stock boutiques ».

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "received_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "order_lines" ADD COLUMN     "quantity_damaged" INTEGER,
ADD COLUMN     "quantity_received" INTEGER;

-- CreateTable
CREATE TABLE "shop_stock_lots" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "received_on" DATE NOT NULL,
    "last_sale_day" DATE NOT NULL,
    "initial_quantity" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_day_closes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "morning_stock" INTEGER NOT NULL,
    "received_good" INTEGER NOT NULL,
    "received_damaged" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "sold" INTEGER NOT NULL,
    "discarded_expired" INTEGER NOT NULL,
    "discarded_damaged" INTEGER NOT NULL,
    "closed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_day_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shop_stock_lots_company_id_idx" ON "shop_stock_lots"("company_id");

-- CreateIndex
CREATE INDEX "shop_stock_lots_shop_id_product_id_received_on_idx" ON "shop_stock_lots"("shop_id", "product_id", "received_on");

-- CreateIndex
CREATE INDEX "shop_stock_lots_product_id_idx" ON "shop_stock_lots"("product_id");

-- CreateIndex
CREATE INDEX "shop_day_closes_company_id_date_idx" ON "shop_day_closes"("company_id", "date");

-- CreateIndex
CREATE INDEX "shop_day_closes_product_id_idx" ON "shop_day_closes"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_day_closes_shop_id_product_id_date_key" ON "shop_day_closes"("shop_id", "product_id", "date");

-- AddForeignKey
ALTER TABLE "shop_stock_lots" ADD CONSTRAINT "shop_stock_lots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_stock_lots" ADD CONSTRAINT "shop_stock_lots_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_stock_lots" ADD CONSTRAINT "shop_stock_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_day_closes" ADD CONSTRAINT "shop_day_closes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_day_closes" ADD CONSTRAINT "shop_day_closes_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_day_closes" ADD CONSTRAINT "shop_day_closes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Une quantité reçue ne dépasse jamais l'envoi de plus que ce qui a été réellement compté, et l'abîmé fait partie du reçu.
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_reception_range" CHECK (
  ("quantity_received" IS NULL AND "quantity_damaged" IS NULL) OR
  ("quantity_received" >= 0 AND "quantity_damaged" >= 0 AND "quantity_damaged" <= "quantity_received")
);
ALTER TABLE "shop_stock_lots" ADD CONSTRAINT "shop_stock_lots_quantity_range" CHECK ("quantity" >= 0 AND "quantity" <= "initial_quantity");

-- Sécurité (DB-1) : tables fermées aux rôles de l'API Supabase.
ALTER TABLE "shop_stock_lots" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "shop_stock_lots" FROM PUBLIC, anon, authenticated;
ALTER TABLE "shop_day_closes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "shop_day_closes" FROM PUBLIC, anon, authenticated;
