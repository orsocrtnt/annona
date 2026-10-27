# Architecture TutelLiv

État de référence : 16 octobre 2026.

## Vue d'ensemble

```text
Navigateur
├── Back-office : administration, commandes, dispatch, support
├── Portail client : commandes, suivi, factures, support
└── Espace chauffeur : missions, navigation, preuve, mode réseau faible
        │
        ▼
Next.js 15 App Router
├── middleware : session et protection des espaces
├── pages/layouts : rendu et navigation
├── routes API : validation, authentification et codes HTTP
├── features : écrans, hooks TanStack Query et types d'interface
└── domains : règles métier et transactions Prisma
        │
        ├── Supabase Auth : identité et cookies
        ├── Supabase Storage privé : preuves de livraison
        ├── PostgreSQL/Prisma : données métier
        ├── Resend : e-mails optionnels
        └── OSM / IGN / OSRM compatible : carte, géocodage, itinéraires
```

## Organisation du code

- `src/app/` contient les pages et routes HTTP. Les groupes `(back-office)`, `(client-portal)` et `(driver-app)` portent les trois espaces.
- `src/features/` contient les composants et hooks propres à un parcours. Les appels HTTP du navigateur passent principalement par TanStack Query.
- `src/domains/` contient les règles métier : commandes, livraisons, factures, support, suivi, alertes, conversations, comptes et tâches opérationnelles.
- `src/lib/` contient validations Zod, permissions, cartographie et utilitaires transversaux.
- `src/services/` contient les clients Prisma et Supabase.
- `prisma/schema.prisma` est la définition ORM actuelle. Le dépôt ne possède pas encore de baseline de migrations complète ; DB-1 reste ouverte.
- `tests/*.test.ts` couvre les règles sans services externes. `tests/e2e/` et `scripts/test-v1/` couvrent les parcours connectés.

## Flux d'une requête protégée

1. Le middleware actualise ou lit la session Supabase et protège le préfixe de route.
2. La route API résout l'utilisateur courant depuis l'identité Supabase.
3. Le serveur relit le compte, l'entreprise, le rôle et les permissions dans PostgreSQL. Un compte ou une entreprise suspendus sont refusés.
4. La garde vérifie le rôle et les permissions nécessaires.
5. Le service de domaine ajoute les frontières `companyId`, propriétaire client ou chauffeur courant avant toute lecture ou écriture.
6. Prisma exécute l'opération, souvent dans une transaction pour les chaînes métier.

Le contrôle du menu ou de la page n'est jamais considéré comme une autorisation. Les routes et services restent responsables du refus.

## Parcours métier principal

```text
Commande client
  → création atomique commande/livraison
  → tâche durable d'auto-dispatch
  → affectation d'un chauffeur
  → prise en charge explicite
  → départ et suivi daté
  → échanges et incidents liés à la commande
  → preuve de livraison ou échec motivé
  → historique et facturation séparée
```

Les écritures sensibles utilisent des clés d'idempotence ou des versions attendues lorsque le rejeu ou la concurrence sont possibles. Les tâches `operation_jobs` conservent l'auto-dispatch et les notifications différées avec bail, tentatives bornées et reprise.

## Multi-tenant

`Company` est l'unité d'isolation. Les utilisateurs ordinaires possèdent un `companyId`; le super-administrateur peut ne pas en avoir. Les commandes, livraisons, factures, tickets, récurrences et tâches opérationnelles portent ou héritent de cette frontière.

La défense comporte plusieurs niveaux :

- statut du compte et de l'entreprise ;
- rôle système et permissions ;
- filtres Prisma par entreprise et ressource ;
- vérification du propriétaire client ou du chauffeur affecté ;
- bucket Storage privé et liens signés après autorisation ;
- RLS et droits publics verrouillés sur la base de test contrôlée.

Une future table doit recevoir ces contrôles et une recette A/B avant d'être considérée prête.

## Données fraîches et performance

Le contexte d'autorisation n'est pas conservé entre requêtes : une suspension ou révocation prend effet à la requête suivante. TanStack Query met en cache les données d'interface, avec invalidation après mutation et rafraîchissement ciblé pour les informations opérationnelles. Le pool Prisma est borné par instance.

Les pages de carte chargent Leaflet côté navigateur. Les listes importantes utilisent pagination et filtres serveur. Les résultats mesurés et leurs limites figurent dans `docs/rapports/2026-10-15/perf01.md`.

## Déploiement et limites

La V1 exporte les documents de prestation `Invoice` par `/api/invoices/export` avec permission `invoices:read`, période UTC et statut explicites. Le contrat CSV versionné distingue total du document et détail enregistré, sous instantané PostgreSQL cohérent et limites de volume. Il prépare un rapprochement externe et reste séparé des futurs contrats/revenus d'abonnement. Les PDF sont des relevés opérationnels ; ni émission électronique réglementaire, ni avoir automatique, ni instantané légal complet ne sont promis. Contrat et limites : [BILL-01B](operations/bill01b/README.md).

Le dépôt contient une configuration Vercel, mais aucune publication n'est implicite :

- `/api/cron/recurring-orders` chaque jour à 06:00 ;
- `/api/cron/billing` chaque jour à 06:10 (rapprochement de la facturation sandbox ; les webhooks restent la voie principale). L'offre Hobby refuse tout déploiement dont un cron tourne plus d'une fois par jour : la cadence horaire initiale avait fait échouer les déploiements de préproduction du 27 octobre 2026. Vercel n'exécute de toute façon les crons que sur la production. `tests/billing.test.ts` garde cette limite ;
- `/api/cron/operations` reste protégée et appelable, sans planification Vercel intégrée sur l'offre Hobby. La cadence minute exige une offre ou un planificateur compatible avant les pilotes.

La préproduction prévue utilise la branche `preproduction`, une Preview Vercel et un projet Supabase distinct. La procédure et les garde-fous sont décrits dans [`operations/preproduction/README.md`](operations/preproduction/README.md).

Une cible séparée, des secrets distincts, une baseline de migrations, une restauration essayée et une procédure de retour arrière sont encore nécessaires. Le build réussi localement ne valide pas ces éléments.
