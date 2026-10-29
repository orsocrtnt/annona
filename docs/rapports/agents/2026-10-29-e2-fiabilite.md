# Lot E2 — Fiabilité (RECETTE-2810 : 16, 17 relances, 10, 9, 14)

## Terminé quand
- [x] 16 — réglages réclamés sur `updatedAt`, 409, inventaire, PostgreSQL réel
- [x] 17 — refus certain : ni « non confirmé » ni blocage 24 h, pas de double envoi
- [x] 10 — tâche ignorée ≠ échec ; détail par tâche sans donnée personnelle
- [x] 9 — classe corrigée (traitement immédiat réessayé)
- [x] 14 — documenté, non corrigé
- [x] `npm run check` vert (1 217 tests), `git diff --check` propre, pré-vol opus puis Sonnet

## Livré
- **16** : `src/lib/database/settings-claims.ts`, option `section` (conflit si la même partie change pendant l'écriture). Convertis : dispatch, localisation, tarifs, catégories, portail, facturation, Factur-X, tableaux de bord, préférences client, mini-admin, démo. SQL brut (preuves, commande par message) : `updated_at` avance. Exceptions : provisionnement démo et offres de test.
- **17** : refus d'une première tentative → QUEUED avec `completedAt` (marqueur inédit dans l'historique) ; rejeu = première tentative ; tâche épuisée = « Échec d'envoi ».
- **10** : cause constatée (bienvenue `SIGNUP_WELCOME_EMAIL_DISABLED`). `skippedJobError` ; cron 503 sur échec réel seulement, `data.jobs` en codes ; alertes en compteurs.
- **9** : `kickOperationJob` réessaie (1, 4, 10 s) si la base échoue avant la prise (pool saturé au redémarrage).

## Décisions
- Conflit côté serveur, sans jeton de version (écarté : 7 formulaires). Successifs : le dernier gagne.
- Bienvenue ignorée seulement si `EMAIL_DELIVERY_MODE=disabled` ; variable absente (`unset`) = échec.
- Relance marquée relancée tard à la main : envoyée (contrôle `superseding`).
- 14 : API hors cache de 5 s ; cause plausible : page portail montée qui refait sa requête (`refetchOnWindowFocus`) après changement de session ou de persona.

## PostgreSQL réel (lancé)
`npm run test:pg-settings` réussi : réglages différents 5 enregistrés/5 en 409, dispatch 1/9, compte 7/3, aucune perte ; témoin ancien code : 9 clés sur 10 perdues. Nettoyé.

## Non vérifié
Lignes héritées SENDING après refus : restent « non confirmées » 24 h. Point 9 : cause sans journal. Forte contention : 409 sur réglages différents (rien de perdu).

## Écrans à capturer
Paiements, relance refusée (« Échec d'envoi », bouton actif), Light/Dark, 390 et 1 280 px, si un refus Resend est simulable.

## Erreurs et leçons
- Imports ajoutés sans vérifier les dépendances fermées des tests `runInNewContext` : `grep -l <fichier> tests/` avant.
- Inventaire limité à Prisma : le SQL brut l'avait contourné.
