# Annona

Annona devient une application de commande et de livraison B2B pour boulangerie : les commerçants commandent au laboratoire avant l'heure limite, la boulangerie produit, prépare, puis livre par tournées. Résumé : [`PRODUCT.md`](PRODUCT.md). Référence des exigences : [`docs/cahier-des-charges/`](docs/cahier-des-charges/TRI-BASE.md).

La base de code vient d'un SaaS de coursiers ; les éléments sans rapport avec le nouveau produit ont été retirés (NET-1). Le modèle de données sera refait (SCHEMA-1). L'état et l'ordre du travail sont suivis dans [`TODO.md`](TODO.md). Les instructions destinées aux contributeurs et agents se trouvent dans [`AGENTS.md`](AGENTS.md).

## Démarrage local

Version attendue : Node.js 22.18 (`.nvmrc`, champ `engines` de `package.json`, CI GitHub Actions), npm 10.9. Avec nvm : `nvm use`. Une autre version n'est pas bloquée (`engine-strict` désactivé) mais npm affiche un avertissement. Dans Vercel, régler « Node.js Version » du projet sur 22.x (action du propriétaire).

```bash
npm ci
cp .env.example .env.local
npm run check
npm run dev -- --hostname 127.0.0.1 --port 3106
```

Ne pas écraser un fichier `.env.local` existant. Avant le premier démarrage authentifié, remplacer les valeurs d'exemple par les accès d'un environnement de développement identifié. Le site est alors disponible sur `http://127.0.0.1:3106`.

`npm run dev` régénère le client Prisma si le schéma a changé, sans modifier la base. Les commandes `db:push`, `db:sync-schema`, `db:migrate` et les seeds écrivent dans la base et ne font jamais partie d'un démarrage normal.

## Vérifications

```bash
npm run typecheck       # TypeScript
npm run lint            # ESLint sur le code applicatif, zéro avertissement admis
npm test                # règles locales sans service externe
npm run check           # typecheck + lint + tests locaux
npm run audit:prod      # vulnérabilités des dépendances livrées
npm run test:ops01      # récurrences connectées sur fixtures isolées
npm run build           # build de production, serveur dev arrêté
```

## Configuration

Les variables et procédures sont décrites dans [`docs/OPERATIONS.md`](docs/OPERATIONS.md). Les dépendances principales sont :

- Supabase Auth et Storage ;
- PostgreSQL via Prisma ;
- Resend, optionnel tant que les e-mails ne sont pas activés ;
- OpenStreetMap pour les tuiles, Géoplateforme/IGN pour le géocodage et un endpoint compatible OSRM pour les itinéraires.

Les services cartographiques publics actuellement configurés servent aux essais. Ils n'offrent pas les garanties nécessaires à un SaaS vendu. Voir [`docs/operations/map-providers.md`](docs/operations/map-providers.md).

## Architecture

- Next.js 15 App Router et TypeScript strict ;
- Tailwind CSS 4, composants Radix/shadcn ;
- TanStack Query pour les données client et Zustand pour l'état local ciblé ;
- services métier dans `src/domains/` ;
- routes HTTP dans `src/app/api/` ;
- Prisma pour tous les accès métier à PostgreSQL ;
- Supabase pour l'identité et le stockage privé des preuves.

Les données métier sont bornées par `companyId` et, selon le rôle, par le client propriétaire ou le livreur affecté. Les contrôles d'interface complètent les contrôles serveur ; ils ne les remplacent pas.

## Documentation

- [`docs/README.md`](docs/README.md) — index et statut des documents ;
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — composants, flux et limites ;
- [`docs/DATABASE.md`](docs/DATABASE.md) — modèles, sécurité et commandes de schéma ;
- [`docs/RBAC.md`](docs/RBAC.md) — rôles et contrôles d'accès ;
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — installation, configuration, dépannage et reprise ;
- [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) — conventions de contribution ;
- [`docs/cahier-des-charges/TRI-BASE.md`](docs/cahier-des-charges/TRI-BASE.md) — ce que la base garde, modifie et doit créer.

Les rapports datés dans `docs/rapports/` prouvent un état de l'ancien produit à leur date. Ils ne remplacent ni `TODO.md` ni la documentation courante.

## Branche et publication

Le travail se fait sur la branche `base`. Aucun push sans demande explicite : `preproduction` et le site en ligne portent encore l'ancien produit.
