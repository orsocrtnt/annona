-- Lot 2, demandes 1 et 2 (18 novembre 2026) : boutiques de l'entreprise, comptes pâtissier et vendeuse,
-- famille « pain » ou « pâtisserie » des catégories. Les nouveaux rôles sont insérés par la migration
-- suivante : PostgreSQL refuse d'utiliser une valeur d'énumération dans la transaction qui l'ajoute.

CREATE TYPE "MerchantKind" AS ENUM ('CLIENT', 'SHOP');
CREATE TYPE "ProductFamily" AS ENUM ('BREAD', 'PASTRY');

ALTER TYPE "SystemRole" ADD VALUE 'PASTRY_CHEF';
ALTER TYPE "SystemRole" ADD VALUE 'SELLER';

ALTER TABLE "merchants" ADD COLUMN "kind" "MerchantKind" NOT NULL DEFAULT 'CLIENT';
ALTER TABLE "categories" ADD COLUMN "family" "ProductFamily" NOT NULL DEFAULT 'BREAD';

CREATE INDEX "merchants_company_id_kind_idx" ON "merchants"("company_id", "kind");

-- Décision de Théo (18 novembre) : la catégorie dit si un produit est du pain ou de la pâtisserie.
-- Les catégories existantes dont le nom évoque la pâtisserie passent côté pâtissier ; l'admin peut corriger.
UPDATE "categories" SET "family" = 'PASTRY'
WHERE "name" ILIKE ANY (ARRAY['%pâtisser%', '%patisser%', '%gâteau%', '%gateau%', '%entremets%', '%tarte%']);
