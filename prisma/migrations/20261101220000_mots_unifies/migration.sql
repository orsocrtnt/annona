-- MOTS-UNIFIES : un seul mot par notion à l'écran. Les abonnements déjà pris gardent leur instantané.
UPDATE "roles" SET "name" = 'Livreur' WHERE "slug" = 'driver' AND "name" = 'Chauffeur';
UPDATE "saas_options" SET "name" = 'Statistiques avancées' WHERE "code" = 'ADVANCED_ANALYTICS' AND "name" = 'Analytics avancés';
UPDATE "saas_options" SET "name" = 'Assistance prioritaire' WHERE "code" = 'PRIORITY_SUPPORT' AND "name" = 'Support prioritaire';
UPDATE "saas_options" SET "name" = 'Dispatch intelligent' WHERE "code" = 'AUTO_DISPATCH' AND "name" = 'Dispatch automatique';
