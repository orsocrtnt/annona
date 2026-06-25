# Architecture Tutelliv

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
├─────────────┬──────────────┬──────────────┬───────────────────┤
│ Back Office │ Client Portal│  Driver App  │   Auth Pages      │
│  (Desktop)  │  (Desktop)   │   (Mobile)   │                   │
└──────┬──────┴──────┬───────┴──────┬───────┴─────────┬─────────┘
       │             │              │                 │
       ▼             ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js 15 App Router                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │Middleware│  │ Layouts  │  │  Pages   │  │  API Routes  │   │
│  │  (Auth)  │  │ (Shell)  │  │(Features)│  │  (REST)      │   │
│  └────┬─────┘  └──────────┘  └────┬─────┘  └──────┬───────┘   │
└───────┼───────────────────────────┼───────────────┼───────────┘
        │                           │               │
        ▼                           ▼               ▼
┌───────────────┐  ┌────────────────────────┐  ┌──────────────┐
│   Supabase    │  │    Domain Services     │  │    Prisma    │
│     Auth      │  │  (Business Logic)      │  │   (ORM)      │
└───────────────┘  └────────────────────────┘  └──────┬───────┘
                                                      │
                                                      ▼
                                              ┌──────────────┐
                                              │  PostgreSQL  │
                                              └──────────────┘
```

## Principes architecturaux

### Clean Architecture

- **Séparation des couches** : UI → Features → Domains → Services
- **Dépendances unidirectionnelles** : Les couches internes ne connaissent pas les externes
- **Domain Driven Design léger** : Logique métier isolée dans `domains/`

### Multi-tenant

- Chaque `User` est rattaché à une `Company` (sauf Super Admin)
- Isolation des données par `companyId` au niveau des requêtes
- RBAC avec permissions granulaires par ressource

### Scalabilité

- Architecture modulaire par features
- Chaque module futur suit le même pattern
- API Routes pour les opérations serveur
- React Query pour le cache et la synchronisation

## Couches de l'application

### 1. Presentation (`app/`, `components/`)

- Pages Next.js avec App Router
- Layouts par contexte (back-office, portal, driver)
- Design System dans `components/ui/`

### 2. Features (`features/`)

- Modules fonctionnels auto-suffisants
- Chaque feature contient : composants, hooks, données
- Exemples : `auth/`, `dashboard/`, `navigation/`

### 3. Domains (`domains/`)

- Logique métier pure
- Services de domaine (ex: `user.service.ts`)
- Indépendants du framework

### 4. Services (`services/`)

- Intégrations externes
- `prisma/` : Client ORM
- `supabase/` : Auth et storage

### 5. Infrastructure (`lib/`, `middleware.ts`)

- Utilitaires partagés
- Système RBAC
- Validations Zod
- Middleware de protection

## Flux d'authentification

```
Login → Supabase Auth → JWT Cookie → Middleware → Session API → Prisma User → RBAC Check → Dashboard
```

## Arborescence détaillée

```
TUTELLIV/
├── docs/                           # Documentation technique
├── prisma/
│   ├── schema.prisma               # Schéma BDD
│   └── seed.ts                     # Données initiales
├── public/                         # Assets statiques
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (back-office)/
│   │   │   ├── admin/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── dispatch/page.tsx
│   │   │   ├── companies/page.tsx
│   │   │   ├── users/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (client-portal)/
│   │   │   ├── portal/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── orders/page.tsx
│   │   │   │   ├── deliveries/page.tsx
│   │   │   │   ├── invoices/page.tsx
│   │   │   │   └── support/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (driver-app)/
│   │   │   ├── driver/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── missions/page.tsx
│   │   │   │   └── profile/page.tsx
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   └── auth/session/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                     # 20+ composants Design System
│   │   ├── layouts/                # Sidebar, Header, Layouts
│   │   ├── providers/              # Query, Session, Toast
│   │   └── shared/                 # PermissionGate, etc.
│   ├── domains/
│   │   └── user/
│   │       └── user.service.ts
│   ├── features/
│   │   ├── auth/
│   │   │   └── auth-form.tsx
│   │   ├── dashboard/
│   │   │   ├── dashboard-content.tsx
│   │   │   └── mock-data.ts
│   │   └── navigation/
│   │       └── nav-config.ts
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-permissions.ts
│   │   └── use-session.ts
│   ├── lib/
│   │   ├── permissions/
│   │   │   ├── rbac.ts
│   │   │   └── route-guards.ts
│   │   ├── validations/
│   │   │   ├── auth.ts
│   │   │   ├── user.ts
│   │   │   └── company.ts
│   │   ├── constants.ts
│   │   └── utils.ts
│   ├── services/
│   │   ├── prisma/client.ts
│   │   └── supabase/
│   │       ├── client.ts
│   │       ├── server.ts
│   │       └── middleware.ts
│   ├── stores/
│   │   ├── auth.store.ts
│   │   └── ui.store.ts
│   ├── types/
│   │   └── index.ts
│   └── middleware.ts
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```
