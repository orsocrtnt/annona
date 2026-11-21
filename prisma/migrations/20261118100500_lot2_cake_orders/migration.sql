-- Lot 2, demande 9 (18 novembre 2026) : commandes de gâteaux des particuliers, prises en boutique. Une ligne de
-- commande peut porter une taille et une inscription ; l'unicité par commande passe à (commande, produit, variante)
-- pour que deux gâteaux du même produit fassent deux lignes (demandes 9 et 10).

-- CreateEnum
CREATE TYPE "CakePayment" AS ENUM ('FULL', 'DEPOSIT');

-- CreateEnum
CREATE TYPE "CakeOrderStatus" AS ENUM ('ORDERED', 'SETTLED', 'CANCELLED');

-- DropIndex
DROP INDEX "order_lines_order_id_product_id_key";

-- AlterTable
ALTER TABLE "order_lines" ADD COLUMN     "cake_order_id" TEXT,
ADD COLUMN     "inscription" TEXT,
ADD COLUMN     "size_id" TEXT,
ADD COLUMN     "variant_key" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "cake_orders" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "size_id" TEXT NOT NULL,
    "inscription" TEXT,
    "servings" INTEGER NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "payment" "CakePayment" NOT NULL,
    "paid_cents" INTEGER NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "pickup_at" TIMESTAMP(3) NOT NULL,
    "pickup_date" DATE NOT NULL,
    "status" "CakeOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "settled_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cake_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cake_orders_company_id_pickup_date_idx" ON "cake_orders"("company_id", "pickup_date");

-- CreateIndex
CREATE INDEX "cake_orders_shop_id_pickup_date_idx" ON "cake_orders"("shop_id", "pickup_date");

-- CreateIndex
CREATE INDEX "cake_orders_product_id_idx" ON "cake_orders"("product_id");

-- CreateIndex
CREATE INDEX "cake_orders_size_id_idx" ON "cake_orders"("size_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_lines_cake_order_id_key" ON "order_lines"("cake_order_id");

-- CreateIndex
CREATE INDEX "order_lines_size_id_idx" ON "order_lines"("size_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_lines_order_id_product_id_variant_key_key" ON "order_lines"("order_id", "product_id", "variant_key");

-- AddForeignKey
ALTER TABLE "cake_orders" ADD CONSTRAINT "cake_orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cake_orders" ADD CONSTRAINT "cake_orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cake_orders" ADD CONSTRAINT "cake_orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cake_orders" ADD CONSTRAINT "cake_orders_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "product_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "product_sizes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_cake_order_id_fkey" FOREIGN KEY ("cake_order_id") REFERENCES "cake_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Paiement : acompte d'au moins la moitié du prix, ou prix complet ; inscription et nom bornés.
ALTER TABLE "cake_orders" ADD CONSTRAINT "cake_orders_payment_range" CHECK (
  "price_cents" > 0 AND "paid_cents" <= "price_cents" AND 2 * "paid_cents" >= "price_cents" AND
  ("payment" <> 'FULL' OR "paid_cents" = "price_cents")
);
ALTER TABLE "cake_orders" ADD CONSTRAINT "cake_orders_servings_range" CHECK ("servings" BETWEEN 1 AND 200);

-- Sécurité (DB-1) : table fermée aux rôles de l'API Supabase.
ALTER TABLE "cake_orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "cake_orders" FROM PUBLIC, anon, authenticated;
