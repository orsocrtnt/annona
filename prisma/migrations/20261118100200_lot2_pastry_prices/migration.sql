-- Lot 2, demandes 3 et 4 (18 novembre 2026) : pâtisseries (petite pièce ou gros gâteau et ses tailles), recette,
-- durée de vente, prix restaurant facultatif (vide = « Produits sans prix »), prix boutique par boutique et code
-- responsable de la tablette (empreinte seulement). Permissions des fiches du laboratoire.

-- CreateEnum
CREATE TYPE "PastryFormat" AS ENUM ('SMALL', 'LARGE');

-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "manager_code_failures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "manager_code_hash" TEXT,
ADD COLUMN     "manager_code_locked_until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "pastry_format" "PastryFormat",
ADD COLUMN     "recipe" TEXT,
ADD COLUMN     "shelf_life_days" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "base_price_cents" DROP NOT NULL;

-- CreateTable
CREATE TABLE "product_sizes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "restaurant_price_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_sizes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_prices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "size_id" TEXT,
    "size_key" TEXT NOT NULL DEFAULT '',
    "sold" BOOLEAN NOT NULL DEFAULT true,
    "price_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_sizes_company_id_idx" ON "product_sizes"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_sizes_product_id_servings_key" ON "product_sizes"("product_id", "servings");

-- CreateIndex
CREATE INDEX "shop_prices_company_id_idx" ON "shop_prices"("company_id");

-- CreateIndex
CREATE INDEX "shop_prices_product_id_idx" ON "shop_prices"("product_id");

-- CreateIndex
CREATE INDEX "shop_prices_size_id_idx" ON "shop_prices"("size_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_prices_shop_id_product_id_size_key_key" ON "shop_prices"("shop_id", "product_id", "size_key");

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_sizes" ADD CONSTRAINT "product_sizes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_prices" ADD CONSTRAINT "shop_prices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_prices" ADD CONSTRAINT "shop_prices_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_prices" ADD CONSTRAINT "shop_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_prices" ADD CONSTRAINT "shop_prices_size_id_fkey" FOREIGN KEY ("size_id") REFERENCES "product_sizes"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Sécurité (DB-1) : tables fermées aux rôles de l'API Supabase ; seul le serveur (Prisma) y accède.
ALTER TABLE "product_sizes" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "product_sizes" FROM PUBLIC, anon, authenticated;
ALTER TABLE "shop_prices" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "shop_prices" FROM PUBLIC, anon, authenticated;

-- Données de référence (identiques à prisma/reference-data.ts).
INSERT INTO "permissions" ("id", "slug", "name", "resource", "action", "created_at")
VALUES
  ('rbac_permission_catalog_pastry', 'catalog:pastry', 'Créer et modifier les pâtisseries', 'catalog', 'pastry', CURRENT_TIMESTAMP),
  ('rbac_permission_catalog_bread', 'catalog:bread', 'Régler la durée de vente du pain', 'catalog', 'bread', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM (VALUES
  ('rbac_role_pastry_chef', 'catalog:pastry'),
  ('rbac_role_baker', 'catalog:bread')
) AS grant_list(role_id, permission_slug)
JOIN "roles" r ON r."id" = grant_list.role_id
JOIN "permissions" p ON p."slug" = grant_list.permission_slug
ON CONFLICT DO NOTHING;
