# Lot E2 — Fiabilité (RECETTE-2810, points 16, 17 relances, 10, 9, 14)

Branche `agent/e2-fiabilite`, base `preproduction` (c917cf8).

## Terminé quand
- [ ] 16 — réglages : réclamation sur `updatedAt` généralisée ; conflit clair 409 ; inventaire des appelants ; test sur PostgreSQL réel
- [ ] 17 — relance refusée avec certitude (403, 422…) : ni « Envoi non confirmé » ni blocage 24 h ; jamais de double envoi ; données héritées
- [ ] 10 — cron : tâche ignorée (service désactivé) ≠ échec ; erreur seulement sur échec réel ; détail par tâche sans donnée personnelle
- [ ] 9 — premier job « Prise en charge » resté `PENDING` : cause et classe corrigée
- [x] 14 — 403 `/api/portal/dashboard` : cause plausible documentée (non corrigée, non prouvée)
- [ ] `npm run check` vert, `git diff --check` propre, pré-vol adverse

## Journal
- Code écrit pour 16, 17, 10, 9 ; tests ciblés en attente du verrou `lourd.sh`.
- 14 (lecture du code) : les API ne passent pas par le cache de 5 s d'AUTH-ROLE (`src/middleware.ts:111`, réservé aux pages) ; `requireClientRole` relit la base à chaque appel. Les 403 possibles : rôle effectif ≠ CLIENT, permission `dashboard:client` absente, entreprise absente. Cause plausible : une page du portail encore montée refait sa requête (`refetchOnWindowFocus: true`, `src/lib/query/defaults.ts:8`) après un changement de session ou de persona de démo (cookie partagé entre onglets, `resolveDemoActiveUser`) : la requête part avec le nouveau rôle. Non prouvé par un test, rien corrigé (côté client, hors lot).
