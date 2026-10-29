# Lot E2 — Fiabilité (RECETTE-2810, points 16, 17 relances, 10, 9, 14)

Branche `agent/e2-fiabilite`, base `preproduction` (c917cf8).

## Terminé quand
- [x] 16 — réglages : réclamation sur `updatedAt` généralisée ; conflit 409 ; inventaire ; PostgreSQL réel
- [x] 17 — relance refusée avec certitude : ni « Envoi non confirmé » ni blocage 24 h ; pas de double envoi
- [x] 10 — cron : tâche ignorée ≠ échec ; erreur sur échec réel seulement ; détail par tâche sans donnée personnelle
- [x] 9 — premier job « Prise en charge » resté `PENDING` : cause et classe corrigée
- [x] 14 — 403 `/api/portal/dashboard` : cause plausible documentée (non prouvée, non corrigée)
- [x] `npm run check` vert (1 217 tests), `git diff --check` propre, pré-vol adverse

## Livré
- **16** : `src/lib/database/settings-claims.ts` (Company/User) et option `section` de `updateSettingsWithClaim` (5 tentatives). Appelants convertis : dispatch, localisation, tarifs, catégories, portail, facturation, Factur-X (2), tableaux de bord back-office et portail (mise à jour et réinitialisation), préférences client, mini-admin (borné à l'entreprise), démo (règles de dispatch, retards de signal, version du scénario, service de suivi simulé). Déjà conformes : `tracking.service`, `onboarding.service` (égalité JSON). SQL brut (`proof-settings`, `order-intake.settings`) : `updated_at` avance strictement. Exception volontaire : `demo-provision` (remplacement complet). 409 « Rechargez puis réessayez » (`KNOWN_ERROR_CODES` et routes sans `withApiHandler`). Inventaire statique : `tests/settings-claim-generalized.test.ts`.
- **17** : refus certain d'une première tentative → QUEUED avec `completedAt` = instant du refus (aucun ancien code n'a écrit QUEUED avec `completedAt`, vérifié dans l'historique). Rejeu = première tentative ; tâche épuisée = « Échec d'envoi », « Relancer » libre. Reprise réelle (issue inconnue) inchangée.
- **10** : cause constatée sur tutelliv-dev (5 tâches `SIGNUP_WELCOME_EMAIL_DISABLED`). `skippedJobError` : tâche close SUCCEEDED, `lastError` `SKIPPED:<code>`. Cron : 503 seulement si tâche épuisée, bloquée > 15 min ou passage des factures impossible ; `data.jobs` (identifiant, type, nature, code) ; alertes : compteurs seuls, message de plantage fixe.
- **9** : `kickOperationJob` réessaie (1 s, 4 s, 10 s) quand `processOperationJob` lève avant d'exécuter la tâche (pool saturé au redémarrage, cf. point 15). Prisma fixe `next_attempt_at` côté application (requête vérifiée) : pas de décalage d'horloge.

## Décisions
- Conflit par section côté serveur, sans jeton de version client (écarté : 7 formulaires à modifier, lots UI en parallèle). Limite : deux enregistrements successifs restent « le dernier gagne ».
- Bienvenue ignorée seulement si `EMAIL_DELIVERY_MODE=disabled` explicite ; variable absente = nouvelle raison `unset`, vrai échec (oubli possible en production).
- Relance marquée relancée tard par « Relancer les tâches en échec » : envoyée (geste explicite, pas de doublon grâce au contrôle `superseding`) ; écarté : la classer non envoyée.
- 14 : les API ne passent pas par le cache de 5 s (`src/middleware.ts:111`). Cause plausible : page du portail encore montée qui refait sa requête (`refetchOnWindowFocus`) après un changement de session ou de persona de démo (cookie partagé). Côté client, hors lot.

## Non vérifié
- Lignes héritées SENDING + tâche FAILED après un refus (ancien code) : restent « non confirmées » (indiscernables d'une issue inconnue) ; débloquées 24 h après la réservation.
- Point 9 : cause non prouvée par un journal (aucune trace conservée).

## PostgreSQL réel (tutelliv-dev, lancé)
- `npm run test:pg-settings` : réussi, 10 écritures concurrentes, pool de 5. (a) 10 réglages différents : 5 enregistrés, 5 en 409, aucune clé perdue ; (b) 10 enregistrements du dispatch : 1 enregistré, 9 en 409 ; (c) compte : 7 enregistrés, 3 en 409, aucune perte ; (d) témoin, ancien code : 9 clés sur 10 perdues en silence. Données E2E nettoyées (0 restante).
- Limite : sous forte contention, des réglages différents peuvent recevoir un 409 (clair, rien de perdu).
- Pré-vol : opus (1 bloquant, 2 importants corrigés), puis Sonnet sur les corrections : rien de bloquant.

## Écrans à capturer
- Aucun écran modifié. Paiements (relance refusée → « Échec d'envoi », bouton actif) : Light/Dark, 390 et 1 280 px, si un refus Resend est simulable.

## Erreurs et leçons
- Imports ajoutés sans vérifier les listes de dépendances fermées des tests `runInNewContext` : trouvé par le pré-vol. Leçon : `grep -l "<fichier modifié>" tests/` avant d'ajouter un import.
- Inventaire initial limité aux appels Prisma : le SQL brut (`jsonb_set`) l'avait contourné.
