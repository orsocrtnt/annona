-- Créneau (clé « 09:00-12:00 ») et poids repris à chaque occurrence, facultatifs.
ALTER TABLE "recurring_orders"
  ADD COLUMN "delivery_slot" TEXT,
  ADD COLUMN "weight_kg" DECIMAL(7,2);
