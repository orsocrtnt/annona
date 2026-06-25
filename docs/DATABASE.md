# Base de données — Schéma Tutelliv

## Diagramme ER

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│   Company    │       │     User     │       │      Role        │
├──────────────┤       ├──────────────┤       ├──────────────────┤
│ id           │◄──┐   │ id           │   ┌──►│ id               │
│ name         │   │   │ authId (UK)  │   │   │ name             │
│ slug (UK)    │   └───│ companyId(FK)│   │   │ slug (UK)        │
│ logoUrl      │       │ roleId (FK)  │───┘   │ systemRole       │
│ email        │       │ email (UK)   │       │ isSystem         │
│ phone        │       │ firstName    │       └────────┬─────────┘
│ address      │       │ lastName     │                │
│ city         │       │ phone        │                │
│ country      │       │ avatarUrl    │                │
│ status       │       │ status       │       ┌────────▼─────────┐
│ settings     │       │ lastLoginAt  │       │ RolePermission   │
│ createdAt    │       │ createdAt    │       ├──────────────────┤
│ updatedAt    │       │ updatedAt    │       │ roleId (FK, PK)  │
└──────────────┘       └──────────────┘       │ permissionId(FK) │
                                              └────────┬─────────┘
                                                       │
                                              ┌────────▼─────────┐
                                              │   Permission     │
                                              ├──────────────────┤
                                              │ id               │
                                              │ name             │
                                              │ slug (UK)        │
                                              │ resource         │
                                              │ action           │
                                              │ (resource,action)│
                                              │     (UK)         │
                                              └──────────────────┘
```

## Tables

### User

| Colonne | Type | Description |
|---------|------|-------------|
| id | cuid | Identifiant unique |
| authId | string (UK) | ID Supabase Auth |
| email | string (UK) | Email |
| firstName | string | Prénom |
| lastName | string | Nom |
| phone | string? | Téléphone |
| avatarUrl | string? | Avatar |
| status | UserStatus | ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION |
| companyId | FK → Company | Entreprise (nullable pour Super Admin) |
| roleId | FK → Role | Rôle |
| lastLoginAt | datetime? | Dernière connexion |

### Company

| Colonne | Type | Description |
|---------|------|-------------|
| id | cuid | Identifiant unique |
| name | string | Nom entreprise |
| slug | string (UK) | Slug URL |
| logoUrl | string? | Logo |
| status | CompanyStatus | ACTIVE, INACTIVE, SUSPENDED, TRIAL |
| settings | json? | Configuration |

### Role

| Colonne | Type | Description |
|---------|------|-------------|
| id | cuid | Identifiant |
| name | string | Nom affiché |
| slug | string (UK) | Identifiant technique |
| systemRole | SystemRole | Enum système |
| isSystem | boolean | Rôle système (non supprimable) |

### Permission

| Colonne | Type | Description |
|---------|------|-------------|
| id | cuid | Identifiant |
| slug | string (UK) | ex: `deliveries:read` |
| resource | string | Ressource cible |
| action | string | Action autorisée |

## Relations futures (Phase 2)

```
Company ──┬── Delivery ──── Order
          │       │
          │       └── TrackingEvent
          ├── Driver (User)
          ├── Vehicle
          ├── Customer (User)
          ├── Invoice
          └── Notification
```

## Index

- `users.companyId`, `users.roleId`, `users.email`
- `companies.slug`, `companies.status`
- `roles.systemRole`
- `permissions.resource`
- `permissions.(resource, action)` — unique

## Commandes

```bash
npm run db:generate   # Générer le client Prisma
npm run db:push       # Appliquer le schéma
npm run db:migrate    # Créer une migration
npm run db:seed       # Peupler rôles/permissions
npm run db:studio     # Interface visuelle
```
