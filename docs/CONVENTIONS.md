# Conventions de développement

## Nommage

### Fichiers

| Type | Convention | Exemple |
|------|-----------|---------|
| Composants | kebab-case.tsx | `stat-card.tsx` |
| Pages | page.tsx (App Router) | `app/dashboard/page.tsx` |
| Hooks | use-{name}.ts | `use-permissions.ts` |
| Services | {name}.service.ts | `user.service.ts` |
| Stores | {name}.store.ts | `auth.store.ts` |
| Types | index.ts ou {name}.types.ts | `types/index.ts` |
| Validations | {domain}.ts | `validations/auth.ts` |

### Code

| Élément | Convention | Exemple |
|---------|-----------|---------|
| Composants | PascalCase | `StatCard` |
| Hooks | camelCase, préfixe `use` | `usePermissions` |
| Constantes | UPPER_SNAKE_CASE | `APP_NAME` |
| Types/Interfaces | PascalCase | `UserWithRole` |
| Enums Prisma | UPPER_SNAKE_CASE | `SUPER_ADMIN` |
| Fonctions | camelCase | `getUserByAuthId` |

## Structure d'un module feature

```
features/{module}/
├── components/         # Composants spécifiques au module
├── hooks/              # Hooks du module
├── {module}-content.tsx # Composant principal
├── mock-data.ts        # Données de test (temporaire)
└── types.ts            # Types du module (si nécessaire)
```

## Structure d'un domain

```
domains/{entity}/
├── {entity}.service.ts  # Logique métier
├── {entity}.types.ts    # Types du domaine (optionnel)
└── {entity}.repository.ts # Accès données (futur)
```

## Imports

Ordre des imports :
1. React / Next.js
2. Bibliothèques externes
3. `@/components`
4. `@/features`
5. `@/domains`
6. `@/hooks`
7. `@/lib`
8. `@/services`
9. `@/stores`
10. `@/types`

Utiliser les alias `@/` — jamais de chemins relatifs profonds (`../../../`).

## Composants

- Un composant par fichier
- Props typées avec interface
- `"use client"` uniquement si nécessaire (hooks, events, browser APIs)
- Préférer les Server Components par défaut
- Extraire la logique dans des hooks

## API Routes

```
app/api/{resource}/route.ts
app/api/{resource}/[id]/route.ts
```

- Validation Zod sur les inputs
- Vérification permissions serveur
- Réponses typées `ApiResponse<T>`
- Codes HTTP appropriés

## Base de données

- Toujours via Prisma (jamais de SQL brut sauf migrations)
- Relations explicites dans le schéma
- `cuid()` pour les IDs
- `@@map` pour les noms de tables snake_case
- Index sur les colonnes de recherche fréquente

## Git

### Branches

```
main                    # Production
develop                 # Intégration
feature/{module}-{desc} # Nouvelles fonctionnalités
fix/{desc}              # Corrections
```

### Commits

Format : `type(scope): description`

Types : `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

Exemples :
- `feat(deliveries): add dispatch queue view`
- `fix(auth): handle expired session redirect`
- `refactor(ui): extract stat card component`

## Tests (Phase 2)

- Unit tests : Vitest
- Integration : Testing Library
- E2E : Playwright
- Coverage minimum : 80% sur les domains

## Performance

- Server Components par défaut
- React Query pour le cache client
- Lazy loading des modules lourds
- Images via `next/image`
- Pagination côté serveur pour les listes

## Sécurité

- Jamais de secrets dans le code
- Validation Zod sur toutes les entrées
- RBAC vérifié middleware + API + composants
- Sanitization des outputs utilisateur
- HTTPS obligatoire en production
