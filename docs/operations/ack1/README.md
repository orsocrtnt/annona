# Migration ACK-1 — 2026-10-09

Migration SQL explicite et versionnée `apply.sql`, indépendante de `prisma db push` et du démarrage. Ne pas utiliser `migrate dev` tant que la baseline globale DB-1 n'est pas établie. La colonne est `timestamp(3)` nullable sans défaut : aucun backfill. Une seconde application échoue volontairement si la colonne existe.

Avant application : relever cible/version, colonnes, RLS, comptages ; vérifier l'absence de `mission_accepted_at`. Comparer le seul ajout au schéma Prisma. Tester le SQL sur copie isolée, puis appliquer uniquement ce fichier sur la cible de test autorisée. Vérifier type/nullabilité, RLS inchangée et aucune confirmation fabriquée.

Validation du 9 octobre : cible PostgreSQL 17.6 ; copie locale PostgreSQL 15.14 des 32 livraisons, types de colonnes et enums. Application et export/restauration de cette copie réussis ; valeurs préexistantes strictement identiques. Les relations, politiques et autres tables ne sont pas clonées : cette preuve couvre l'ajout ACK-1, pas une restauration intégrale du service ni DB-1 entière. Preuves dans `outputs/ack1/db-preflight.json` et `db-isolated.json` du dossier de travail Codex.

Retour arrière applicatif (non exécuté sur la cible distante) : revenir au code précédent et conserver la colonne et ses valeurs. L'ancien client Prisma ignore la colonne nullable ; aucun retrait de schéma requis. `rollback.sql` documente cette procédure sans suppression. Sur copie isolée, la lecture de toutes les colonnes historiques après migration a donné exactement les mêmes valeurs ; export puis restauration ont été vérifiés. Ne jamais supprimer les confirmations pour un retour applicatif.

DB-1 reste ouverte pour baseline globale, droits par défaut des futures tables, environnements dédiés et restauration complète (base + fichiers). Aucune synchronisation, seed, reset ou publication implicite.
