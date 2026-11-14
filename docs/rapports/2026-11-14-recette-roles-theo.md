# Recette cliquée des espaces client, boulanger, livreur et admin — 14 novembre 2026

RECETTE-V1, suite du 7 novembre : parcours connectés par rôle (non-régression), sur le poste Windows de Théo.

- Commit testé : `54b9a80` (branche `theo/collab-nom-git`, à jour de `base` au 13 novembre).
- Base : `annona-dev` (`npm run -s env2:verify-dev` → `{"passed":true}`). Aucune migration appliquée.
- Serveur : `next dev --turbopack` sur le port 3000 (lancé par Claude). Navigateur : Chromium de Playwright, vrais clics.
- Comptes : seed de démo (`outputs/comptes-demo.json`, jamais affichés) : `admin`, `client-1`, `boulanger`, `livreur-1`.
- Données : rien n'est écrit en base. Aucune commande validée, aucun réglage modifié ; le boulanger lit le 13 décembre 2026 (J+30, avant l'heure limite : aucun verrouillage LOCK-1).
- Captures : `outputs/recette-agents/theo-roles/` (dossier ignoré par git), résultats détaillés dans `resultats.json`.

## Résultats : 33 étapes sur 33, zéro erreur console

| Rôle | Parcours | Résultat |
|---|---|---|
| Admin (1280 px) | Tableau de bord puis « Commandes » aussitôt (correction `getZoom`) | OK, console vide |
| Admin | Retour au tableau de bord : carte en direct affichée, puis Suivi livreurs, Tournées, Clients, Catalogue, Promotions, Factures | OK (1,8 à 3 s par page en dev) |
| Client (390 px) | Commander, Mes commandes, Récurrente, Factures, Réclamations, Paramètres | OK |
| Client | Historique › détail de commande (11 novembre), retour arrière (onglet Historique conservé), rechargement | OK |
| Client (1280 px, sombre) | Mes commandes | OK, `data-theme="dark"` |
| Boulanger (1280 px, puis tablette 1024 px sombre) | Production à J+30, bandeau « Commandes ouvertes jusqu'à … 17:00 » | OK |
| Boulanger | Ouvre `/dashboard` → renvoyé vers `/bakery` | OK (refus de rôle) |
| Livreur (390 px) | Ma tournée (vide : aucune tournée validée), Profil | OK |
| Livreur | Ouvre `/portal/orders` → renvoyé vers `/driver` | OK (refus de rôle) |
| Livreur (tablette 1024 px, sombre) | Profil | OK, `data-theme="dark"` |

Complément : `tests/e2e/v1-roles.spec.ts` 5/5 le 13 novembre (API de chaque rôle en 200, des trois autres en 403, sans session en 401).

## Défauts

Aucun. Constat sans défaut : sur téléphone (390 px), client et livreur restent en thème clair même si le système est sombre. C'est la règle voulue (`src/lib/theme.ts:37`, décision du 30 octobre 2026) ; le sombre est vérifié sur tablette et ordinateur.

## Non testé

- Parcours qui écrivent en base (passer et modifier une commande, production du jour, tournée démarrée, « Livré ») : couverts par `tests/e2e/recette-v1.spec.ts` (entreprise d'essai créée puis supprimée), non rejoués ici.
- Vrais téléphones (critères 1, 7, 8, N2) : après l'APK Android (MOBILE-1).
- Clavier (tabulation, Échap) et build de production : non rejoués dans cette passe.

## Nettoyage

Aucune donnée créée par la recette. Script temporaire supprimé. Le serveur du port 3000 reste lancé pour Théo. Compte « Test-theo Google » (essai AUTH-GOOGLE du 13 novembre) gardé volontairement.
