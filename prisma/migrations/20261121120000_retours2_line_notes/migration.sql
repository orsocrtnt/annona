-- RETOURS-2 (Théo, 21 novembre 2026) : allergies ou instructions facultatives, par produit d'une commande
-- et par commande de gâteau prise en boutique. Ajouts seulement (colonnes vides), aucune donnée modifiée.
ALTER TABLE "order_lines" ADD COLUMN "note" TEXT;
ALTER TABLE "cake_orders" ADD COLUMN "note" TEXT;
