-- CAT-1 (ADM-02) : une catégorie peut être désactivée sans être supprimée.
-- Ajout de colonne avec valeur par défaut : aucune donnée existante n'est modifiée.
ALTER TABLE "categories" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
