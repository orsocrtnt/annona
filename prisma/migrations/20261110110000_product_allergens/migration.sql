-- Lot 1, demande 3 (10 novembre 2026) : allergènes réglementaires de chaque produit.
-- Additive : par défaut, aucun produit n'est renseigné (« Allergènes non renseignés »).

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allergens_declared" BOOLEAN NOT NULL DEFAULT false;


-- Les 14 allergènes du règlement (UE) n° 1169/2011, annexe II ; aucun allergène sans déclaration.
ALTER TABLE "products" ADD CONSTRAINT "products_allergens_known" CHECK (
  "allergens" <@ ARRAY['GLUTEN', 'CRUSTACEANS', 'EGGS', 'FISH', 'PEANUTS', 'SOY', 'MILK', 'NUTS', 'CELERY', 'MUSTARD', 'SESAME', 'SULPHITES', 'LUPIN', 'MOLLUSCS']::TEXT[]
);
ALTER TABLE "products" ADD CONSTRAINT "products_allergens_declared" CHECK ("allergens_declared" OR cardinality("allergens") = 0);
