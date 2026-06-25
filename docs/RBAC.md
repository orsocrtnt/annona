# RBAC — Role-Based Access Control

## Architecture

```
User → Role → RolePermission → Permission
                (many-to-many)
```

## Rôles système

| Rôle | Slug | Niveau | Dashboard |
|------|------|--------|-----------|
| Super Admin | `super-admin` | 100 | `/admin` |
| Administrateur | `company-admin` | 80 | `/dashboard` |
| Dispatcher | `dispatcher` | 60 | `/dispatch` |
| Chauffeur | `driver` | 40 | `/driver` |
| Client | `client` | 20 | `/portal` |

## Permissions

Format : `{resource}:{action}`

### Ressources

| Resource | Description |
|----------|-------------|
| `users` | Gestion utilisateurs |
| `companies` | Gestion entreprises |
| `deliveries` | Livraisons |
| `orders` | Commandes |
| `drivers` | Chauffeurs |
| `vehicles` | Véhicules |
| `analytics` | Analytics |
| `settings` | Paramètres |
| `dashboard` | Accès dashboards |

### Actions

| Action | Description |
|--------|-------------|
| `read` | Lecture |
| `create` | Création |
| `update` | Modification |
| `delete` | Suppression |
| `manage` | Gestion complète |
| `dispatch` | Dispatch |
| `admin/company/dispatcher/driver/client` | Accès dashboard |

## Matrice des permissions

| Permission | Super Admin | Company Admin | Dispatcher | Driver | Client |
|-----------|:-----------:|:-------------:|:----------:|:------:|:------:|
| users:read | ✅ | ✅ | ❌ | ❌ | ❌ |
| users:create | ✅ | ✅ | ❌ | ❌ | ❌ |
| users:update | ✅ | ✅ | ❌ | ❌ | ❌ |
| users:delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| companies:read | ✅ | ✅ | ❌ | ❌ | ❌ |
| companies:create | ✅ | ❌ | ❌ | ❌ | ❌ |
| companies:update | ✅ | ✅ | ❌ | ❌ | ❌ |
| companies:delete | ✅ | ❌ | ❌ | ❌ | ❌ |
| deliveries:read | ✅ | ✅ | ✅ | ✅ | ✅ |
| deliveries:create | ✅ | ✅ | ✅ | ❌ | ❌ |
| deliveries:update | ✅ | ✅ | ✅ | ✅ | ❌ |
| deliveries:delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| deliveries:dispatch | ✅ | ✅ | ✅ | ❌ | ❌ |
| orders:read | ✅ | ✅ | ✅ | ❌ | ✅ |
| orders:create | ✅ | ✅ | ✅ | ❌ | ❌ |
| orders:update | ✅ | ✅ | ✅ | ❌ | ❌ |
| drivers:read | ✅ | ✅ | ✅ | ❌ | ❌ |
| drivers:manage | ✅ | ✅ | ❌ | ❌ | ❌ |
| vehicles:read | ✅ | ✅ | ✅ | ❌ | ❌ |
| vehicles:manage | ✅ | ✅ | ❌ | ❌ | ❌ |
| analytics:read | ✅ | ✅ | ❌ | ❌ | ❌ |
| settings:read | ✅ | ✅ | ❌ | ❌ | ❌ |
| settings:update | ✅ | ✅ | ❌ | ❌ | ❌ |
| dashboard:admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| dashboard:company | ❌ | ✅ | ❌ | ❌ | ❌ |
| dashboard:dispatcher | ❌ | ❌ | ✅ | ❌ | ❌ |
| dashboard:driver | ❌ | ❌ | ❌ | ✅ | ❌ |
| dashboard:client | ❌ | ❌ | ❌ | ❌ | ✅ |

## Implémentation

### Middleware (`src/middleware.ts`)

- Vérifie la session Supabase
- Redirige les routes protégées vers `/login`
- Redirige les utilisateurs connectés hors des pages auth

### Route Guards (`src/lib/permissions/route-guards.ts`)

```typescript
const ROUTE_GUARDS = [
  { path: "/admin", allowedRoles: ["SUPER_ADMIN"], requiredPermissions: ["dashboard:admin"] },
  { path: "/dashboard", allowedRoles: ["SUPER_ADMIN", "COMPANY_ADMIN"], ... },
  // ...
];
```

### Client-side

```typescript
// Hook
const { can, isRole, hasMinimumRole } = usePermissions();
can("deliveries:create"); // true/false

// Composant
<PermissionGate permissions="users:read" roles={["COMPANY_ADMIN"]}>
  <UserList />
</PermissionGate>
```

### Server-side

```typescript
import { hasPermission } from "@/lib/permissions/rbac";
const permissions = await getUserPermissions(authId);
if (!hasPermission(permissions, "deliveries:create")) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

## Extension

Pour ajouter une permission :

1. Ajouter dans `prisma/seed.ts` → `PERMISSIONS`
2. Assigner aux rôles dans `ROLE_PERMISSIONS`
3. Ajouter le route guard si nécessaire
4. Utiliser `PermissionGate` ou `usePermissions` côté client
