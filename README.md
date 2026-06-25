# Tutelliv

Plateforme SaaS de gestion et pilotage pour entreprises de livraison.

## Stack technique

- **Framework** : Next.js 15 (App Router)
- **Langage** : TypeScript (strict)
- **Styling** : Tailwind CSS 4
- **UI** : shadcn/ui (Radix primitives)
- **Auth** : Supabase Auth
- **Database** : PostgreSQL + Prisma ORM
- **State** : Zustand + TanStack Query
- **Validation** : Zod + React Hook Form

## Démarrage rapide

```bash
# Installation
npm install

# Configuration
cp .env.example .env.local
# Renseigner les variables Supabase et DATABASE_URL

# Base de données
npm run db:generate
npm run db:push
npm run db:seed

# Développement
npm run dev
```

## Structure du projet

```
src/
├── app/                  # Routes Next.js (App Router)
│   ├── (auth)/           # Pages d'authentification
│   ├── (back-office)/    # Interface administrateur
│   ├── (client-portal)/  # Portail client
│   ├── (driver-app)/     # Application chauffeur
│   └── api/              # API Routes
├── components/
│   ├── ui/               # Design System
│   ├── layouts/          # Layouts réutilisables
│   ├── providers/        # Context providers
│   └── shared/           # Composants partagés
├── domains/              # Logique métier (DDD)
├── features/             # Modules fonctionnels
├── hooks/                # React hooks custom
├── lib/                  # Utilitaires, permissions, validations
├── services/             # Services externes (Supabase, Prisma)
├── stores/               # État global (Zustand)
└── types/                # Types TypeScript
```

## Rôles utilisateurs

| Rôle | Dashboard | Description |
|------|-----------|-------------|
| Super Admin | `/admin` | Gestion plateforme |
| Administrateur | `/dashboard` | Gestion entreprise |
| Dispatcher | `/dispatch` | Dispatch livraisons |
| Chauffeur | `/driver` | Missions mobile |
| Client | `/portal` | Suivi commandes |

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Design System](./docs/DESIGN_SYSTEM.md)
- [RBAC & Permissions](./docs/RBAC.md)
- [Base de données](./docs/DATABASE.md)
- [Conventions de développement](./docs/CONVENTIONS.md)
- [Modules futurs](./docs/FUTURE_MODULES.md)

## Scripts

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production |
| `npm run db:generate` | Générer le client Prisma |
| `npm run db:push` | Pousser le schéma en BDD |
| `npm run db:seed` | Peupler les rôles/permissions |
| `npm run db:studio` | Interface Prisma Studio |
