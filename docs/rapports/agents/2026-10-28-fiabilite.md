# Rapport agent Fiabilité et exploitation — 2026-10-28

Branche : `agent/fiabilite` (base preproduction 9234600). Aucun push, aucune migration appliquée.

## Changements
1. **after()** : `kickOperationJob` passe par `runAfterResponse` (`src/lib/operations/after-response.ts`), repli direct hors requête, jamais d'exception pour l'appelant. 12 appelants inventoriés (order, signup, delivery, client-portal/notify, invoice, operational-alerts route, retryFailedOperationJobs), signature inchangée.
2. **Filet cron** : `.github/workflows/cron-operations.yml` (toutes les 5 min, environnement GitHub `preproduction`, secrets `PREPROD_BASE_URL`, `PREPROD_CRON_SECRET`, `VERCEL_AUTOMATION_BYPASS_SECRET`). `vercel.json` intact. Authentification de la route : `Authorization: Bearer CRON_SECRET`. Test de chevauchement de deux `processDueOperationJobs`.
3. **Node** : `.nvmrc` 22.18.0, `engines` `>=22.18 <23`, README, OPERATIONS.md.
4. **Index** : 12 `@@index` + migration `20261028090000_fk_indexes` (`CREATE INDEX IF NOT EXISTS`), non appliquée.
5. **Observabilité** : `countOverduePendingJobs` ; le cron renvoie 503 et un incident `operation-jobs-overdue` si une tâche PENDING est en retard de plus de 15 min après son passage. Le santé profonde couvrait FAILED et PROCESSING bloqué, mais pas PENDING en retard.
6. **Documentation** : `docs/OPERATIONS.md`.

## Limites
- Non vérifié : exécution réelle d'`after()` sur Vercel, déclenchement du workflow GitHub, protection Vercel, application de la migration.
- Un workflow planifié ne tourne que depuis la branche par défaut (`main`).
