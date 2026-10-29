# Lot E2 — Fiabilité (RECETTE-2810, points 16, 17 relances, 10, 9, 14)

Branche `agent/e2-fiabilite`, base `preproduction` (c917cf8).

## Terminé quand
- [ ] 16 — réglages : réclamation sur `updatedAt` généralisée (dispatch, localisation, tarifs, catégories, tableaux de bord, préférences client, mini-admin, démo) ; conflit clair 409 ; inventaire des appelants ; test sur PostgreSQL réel
- [ ] 17 — relance refusée avec certitude (403, 422…) : ni « Envoi non confirmé » ni blocage 24 h ; jamais de double envoi ; données héritées
- [ ] 10 — cron : tâche ignorée (service désactivé) ≠ échec ; erreur seulement sur échec réel ; détail par tâche sans donnée personnelle
- [ ] 9 — premier job « Prise en charge » resté `PENDING` : cause et classe corrigée
- [ ] 14 — 403 `/api/portal/dashboard` : cause plausible documentée (corrigée seulement si prouvée)
- [ ] `npm run check` vert, `git diff --check` propre, pré-vol adverse

## Journal
- Démarrage : lecture des consignes, inventaire en cours.
