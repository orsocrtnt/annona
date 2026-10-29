# Lot E2 — Fiabilité (RECETTE-2810 : 16, 17 relances, 10, 9, 14)

## Terminé quand
- [x] 16 — réglages réclamés sur `updatedAt`, 409, inventaire, PostgreSQL réel
- [x] 17 — refus certain : ni « non confirmé » ni blocage 24 h, pas de double envoi
- [x] 10 — tâche ignorée ≠ échec ; détail par tâche sans donnée personnelle
- [x] 9 — classe corrigée (traitement immédiat réessayé)
- [x] 14 — documenté, non corrigé
- [x] `npm run check` vert (1 316 tests après fusion d'`integration/2026-10-29`), `git diff --check` propre, pré-vol opus puis Sonnet

## Livré
- **16** : `src/lib/database/settings-claims.ts`, option `section` (conflit si la même partie change pendant l'écriture). Convertis : dispatch, localisation, tarifs, catégories, portail, facturation, Factur-X, tableaux de bord, préférences client, mini-admin, onboarding, démo. SQL brut (preuves, commande par message) : `updated_at` avance. Hors réclamation, par choix : provisionnement démo et offres de test (écrasement complet, sans concurrence, commenté), créations de lignes.
- **17** : refus d'une première tentative → QUEUED avec `completedAt` (marqueur inédit dans l'historique) ; rejeu = première tentative ; tâche épuisée = « Échec d'envoi ».
- **10** : cause constatée (bienvenue `SIGNUP_WELCOME_EMAIL_DISABLED`). `skippedJobError` ; cron 503 sur échec réel seulement, `data.jobs` en codes ; alertes en compteurs.
- **9** : `kickOperationJob` réessaie (1, 4, 10 s) si la base échoue avant la prise (pool saturé au redémarrage).

## Décisions
- Conflit côté serveur, sans jeton de version ; deux enregistrements successifs : le dernier gagne.
- Bienvenue ignorée seulement si `EMAIL_DELIVERY_MODE=disabled` ; variable absente (`unset`) = échec.
- Relance marquée relancée tard à la main : envoyée (contrôle `superseding`).
- 14 : API hors cache de 5 s ; cause plausible : page portail montée qui refait sa requête (`refetchOnWindowFocus`) après changement de session ou de persona.

## PostgreSQL réel (lancé)
`npm run test:pg-settings` réussi, aucune perte. Clés disjointes, avant → après 10 essais espacés de 10 à 50 ms : entreprise 5 → 0 conflit sur 10, compte 3 → 0 ; même réglage : 1 enregistré, 9 en 409. Ancien code : 9 clés sur 10 perdues. Nettoyé.

- Corrections de relecture : réclamation espacée, onboarding réclamé (clé modifiée seulement), écrasements voulus commentés, fusion d'`integration/2026-10-29` (`package.json` : deux scripts gardés).

## Non vérifié
Lignes héritées SENDING après refus : restent « non confirmées » 24 h. Point 9 : cause sans journal.

## Écrans à capturer
Paiements après un refus Resend simulé : Light/Dark, 390 et 1 280 px.

## Erreurs et leçons
- Imports ajoutés sans vérifier les dépendances fermées des tests `runInNewContext` : `grep -l <fichier> tests/` avant.
- Inventaire limité à Prisma : le SQL brut l'avait contourné.
