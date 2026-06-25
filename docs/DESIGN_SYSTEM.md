# Design System Tutelliv

## Philosophie

Inspiré des références premium : Uber, Tesla, Stripe, Linear, Apple.

**Principes** : Fiabilité, Performance, Modernité, Simplicité, Premium.

## Palette de couleurs

### Couleurs principales

| Token | Valeur | Usage |
|-------|--------|-------|
| `--color-background` | `#fafafa` | Fond principal |
| `--color-foreground` | `#0a0a0a` | Texte principal |
| `--color-card` | `#ffffff` | Surfaces cartes |
| `--color-primary` | `#0066ff` | Actions, liens |
| `--color-brand` | `#0066ff` | Accent principal |
| `--color-brand-hover` | `#0052cc` | Hover boutons |
| `--color-brand-subtle` | `#e6f0ff` | Fonds accentués |

### Couleurs sémantiques

| Token | Valeur | Usage |
|-------|--------|-------|
| `--color-success` | `#10b981` | Succès, actif |
| `--color-warning` | `#f59e0b` | Attention |
| `--color-error` | `#ef4444` | Erreur, danger |
| `--color-muted-foreground` | `#71717a` | Texte secondaire |

### Gris

| Token | Valeur |
|-------|--------|
| `--color-border` | `#e4e4e7` |
| `--color-muted` | `#f4f4f5` |
| `--color-surface-subtle` | `#f9fafb` |

## Typographie

- **Police** : Inter (Google Fonts)
- **Features** : `cv02`, `cv03`, `cv04`, `cv11`
- **Hiérarchie** :
  - H1 : `text-2xl font-semibold tracking-tight`
  - H2 : `text-xl font-semibold`
  - H3 : `text-lg font-semibold`
  - Body : `text-sm`
  - Caption : `text-xs text-muted-foreground`

## Espacement

- Padding cartes : `p-6`
- Gap grilles : `gap-4`
- Sections : `space-y-6` à `space-y-8`
- Marges généreuses pour aération

## Border Radius

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius-sm` | `0.375rem` | Badges |
| `--radius-md` | `0.5rem` | Inputs |
| `--radius-lg` | `0.75rem` | Boutons |
| `--radius-xl` | `1rem` | Cartes |

## Ombres

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Cartes au repos |
| `--shadow-md` | Cartes hover |
| `--shadow-lg` | Modals, dropdowns |
| `--shadow-xl` | Drawers |

## Composants

### Boutons (`Button`)

| Variant | Usage |
|---------|-------|
| `default` | Action primaire |
| `brand` | CTA principal (gradient) |
| `outline` | Action secondaire |
| `ghost` | Action tertiaire |
| `destructive` | Action destructive |
| `link` | Lien stylisé |

| Size | Hauteur |
|------|---------|
| `sm` | 32px |
| `default` | 40px |
| `lg` | 48px |
| `xl` | 56px |

### Inputs (`Input`, `FormField`, `Select`)

- Hauteur : 40px
- Border radius : `rounded-lg`
- Focus ring : `ring-2 ring-ring`
- États erreur : border destructive

### Cartes (`Card`)

- Border : `border-border`
- Radius : `rounded-xl`
- Shadow : `shadow-sm` → `shadow-md` on hover
- Padding header/content : `p-6`

### Badges (`Badge`)

| Variant | Usage |
|---------|-------|
| `default` | Neutre |
| `brand` | Information |
| `success` | Actif, terminé |
| `warning` | En attente |
| `error` | Erreur, retard |
| `secondary` | Inactif |

### Tables & DataGrid

- Header : uppercase, `text-xs`, `text-muted-foreground`
- Rows : hover `bg-muted/50`
- Pagination intégrée
- Recherche et tri

### Feedback

- **Alert** : info, success, warning, destructive
- **Loader** : sm, md, lg + PageLoader, FullPageLoader
- **EmptyState** : icon + title + description + action
- **Skeleton** : loading placeholders
- **Toast** : via Sonner (top-right)

### Modals & Drawers

- **Dialog** : centré, overlay blur, animation zoom
- **Drawer** : latéral (left/right) ou bottom (mobile)

### Charts

- **ChartPlaceholder** : line, bar, pie, area
- Prêt pour intégration Recharts/Chart.js en Phase 2

## Animations

| Classe | Effet |
|--------|-------|
| `animate-fade-in` | Apparition en fondu |
| `animate-slide-up` | Glissement vers le haut |
| `animate-slide-down` | Glissement vers le bas |

Transitions : `duration-200` sur les interactions.

## Responsive

- Mobile-first
- Breakpoints Tailwind standard
- Sidebar → Mobile nav (< lg)
- Driver app : bottom navigation fixe
- Client portal : tabs horizontales scrollables

## Règles visuelles

### À faire
- Espacement généreux
- Typographie nette et lisible
- Micro-interactions discrètes
- Hiérarchie visuelle forte
- Couleurs sobres avec accent bleu

### À éviter
- Dégradés agressifs
- Couleurs criardes
- Cartes surchargées
- Bordures excessives
- Templates génériques
