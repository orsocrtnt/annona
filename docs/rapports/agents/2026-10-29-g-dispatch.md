# Lot G — DISPATCH-4 tranche 1 — 29 octobre 2026

Branche `agent/g-dispatch` (depuis c917cf8). Aucun push, aucune migration.

## Livré

- [x] Les 3 meilleurs livreurs, avec un score sur 100 et une phrase qui explique le choix (`src/lib/dispatch/dispatch-score.ts`). Poids : trajet 50 %, charge 30 %, zone 10 %, priorité 10 %.
- [x] Trajet OSRM `table` (`travel-time.ts`) : un seul appel groupé, cache de 2 min et 1 000 entrées. En cas d'échec, estimation à vol d'oiseau avec la raison affichée, et pause de 30 s.
- [x] Affectation en un clic (`/api/dispatch/suggestions`), forçage manuel conservé. Transaction sans appel réseau. Double clic idempotent.
- [x] Deux modes : Suggestion ou Automatique, sans migration. Tout passe par l'option « Dispatch automatique ».
- [x] Pour 200 livreurs : vol d'oiseau, puis un appel `table` de 9 points. La file est limitée à 20 appels et 10 s.
- [x] Aucune coordonnée exposée. Accès dispatcher et admin seulement. Données filtrées par `companyId`.
- [x] Test PostgreSQL réel (`npm run test:dispatch-concurrency`, 10 requêtes en parallèle) : réussi.
- [x] Pré-vol adverse traité. `npm run check` vert, `git diff --check` propre.

## Décisions

- Le mode est porté par `enabled` : Suggestion = faux, Automatique = vrai. Écarté : un second champ, qui pourrait contredire le premier.
- Le « Meilleur score » est un champ séparé `bestScore` : en cas de retour arrière, l'ancien code l'ignore. Écarté : une valeur dans `strategy`, que l'ancien code refuserait.
- Trajet inconnu : 0,5 si le GPS est inactif pour tous, 0,25 sans position, 0 hors service.
- OSRM seulement via `DRIVE_ROUTE_OSRM_URL`, jamais le serveur public.

## Non vérifié

- OSRM réel : seul le réseau est simulé.
- Recette navigateur et E2E (pas de serveur).
- Deux points mineurs restent ouverts. Si l'auto et un clic visent le même livreur au même moment, l'auto peut compter une affectation qu'il n'a pas faite. Le verrou très bref peut aussi toucher un livreur d'une autre entreprise, sans fuite.

## À lancer sur le Mac

`npx playwright test tests/e2e/dispatch-suggestions.spec.ts`

## Écrans à capturer (Light/Dark, 390 et 1 280 px)

- Fiche livraison en attente, panneau « Livreurs suggérés »
- `/dispatch?delivery=…`
- Règles dispatch : mode et stratégie
- Offre sans l'option

## Erreurs et leçons

- Premier E2E fautif (`.or()` toujours vrai), repéré en relecture.
- Un score neutre de 0,5 favorisait les livreurs hors service.
- `BEST_SCORE` dans l'enum bloquait le retour arrière.
