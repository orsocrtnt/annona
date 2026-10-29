# Lot G — DISPATCH-4 tranche 1 — 29 octobre 2026

Branche `agent/g-dispatch` (depuis c917cf8). Ni push ni migration.

## Feuille de route

- [x] Les 3 meilleurs livreurs, avec un score sur 100 et une phrase « pourquoi » (`src/lib/dispatch/dispatch-score.ts`). Poids : trajet 50 %, charge 30 %, zone 10 %, priorité 10 %.
- [x] Trajet OSRM `table` : un seul appel, mis en cache (2 min, 1 000 entrées, clé arrondie à environ 100 m). En cas de panne, repli « à vol d'oiseau » avec la raison affichée et pause de 30 s (`travel-time.ts`). Contrat vérifié dans la doc v5.24.
- [x] Affectation en un clic (`POST /api/dispatch/suggestions`). Le choix manuel forcé reste dans le sélecteur.
- [x] Transaction courte, sans appel réseau. Double clic sans effet (même livreur, aucune écriture). Pas de remplacement silencieux.
- [x] Mode Suggestion / Automatique, porté par `dispatchRules.enabled`, sans migration. Nouvelle stratégie « Meilleur score ». Tout est derrière l'option « Dispatch automatique » ; l'écran indique quand elle manque.
- [x] Dimensionnement pour 200 livreurs : 200 calculs vol d'oiseau et un tri, puis un appel `table` de 9 coordonnées. Une file est limitée à 20 appels et 10 s.
- [x] Aucune coordonnée en sortie. Historique client sans chiffre. Accès dispatcher et admin seulement. Requêtes filtrées par `companyId`.
- [ ] `npm run check` et test PostgreSQL : voir plus bas.

## Décisions

- Mode = `enabled` : Suggestion = faux, Automatique = vrai. Les réglages hérités ne changent pas. Écarté : un second champ, qui pouvait contredire le premier.
- « Meilleur score » est une stratégie de plus. Le défaut reste « Liste de priorité » : rien ne change pour les entreprises déjà réglées. Écarté : remplacer d'office les anciennes stratégies.
- Trajet inconnu : 0,5 si personne n'a de GPS ; 0,25 si le livreur est en service sans position ; 0 s'il est hors service.
- Positions envoyées uniquement à `DRIVE_ROUTE_OSRM_URL`. Sans ce réglage, on reste à vol d'oiseau. Écarté : le serveur public OSRM.

## Non vérifié

- Le trajet OSRM réel : seul le réseau est simulé dans les tests.
- La recette navigateur.
- Retour arrière : l'ancien code refuse `BEST_SCORE`. Avant de revenir en arrière, repasser ces entreprises sur une autre stratégie.

## À lancer sur le Mac

- `npx dotenv -e .env.local -- npm run test:dispatch-concurrency`
- `npx playwright test tests/e2e/dispatch-suggestions.spec.ts`

## Écrans à capturer (Light/Dark, 390 et 1 280 px)

Fiche livraison en attente (panneau « Livreurs suggérés »), `/dispatch?delivery=…`, Règles dispatch (mode et stratégie), offre sans l'option.

## Erreurs et leçons

- Le premier E2E aurait échoué : explications identiques, et un `.or()` qui passait toujours. La relecture adverse l'a vu.
- Le score neutre de 0,5 favorisait les livreurs hors service. Corrigé.
