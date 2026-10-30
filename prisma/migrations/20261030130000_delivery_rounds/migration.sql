-- DISPATCH-4, piste 3 (C12) : une tournée est un groupe de livraisons d'un même livreur.
-- Colonnes facultatives : une livraison hors tournée ne change pas.
ALTER TABLE "deliveries"
  ADD COLUMN "round_id" TEXT,
  ADD COLUMN "round_sequence" INTEGER;

CREATE INDEX "deliveries_company_id_round_id_idx" ON "deliveries"("company_id", "round_id");
