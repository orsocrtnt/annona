-- DEMO-3, tranche 7 (C13) : début du créneau promis et poids du colis, facultatifs.
-- La fin du créneau reste `requested_delivery_date`, qui porte déjà la règle de retard.
ALTER TABLE "orders"
  ADD COLUMN "delivery_slot_start" TIMESTAMP(3),
  ADD COLUMN "weight_kg" DECIMAL(7,2);
