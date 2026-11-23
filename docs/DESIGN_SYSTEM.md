# Design System Annona

> **Identité DA-1, mise en œuvre à la demande d'Orso le 23 novembre 2026, à affiner par itérations** (croisement « Net × Livraison », plaquette d'identité de 12 planches sur le canvas privé d'Orso, page « Plaquette »). Elle remplace la direction verte « Menthe / Soft Glass » (DESIGN-1) et la palette bleue historique, qui ne doivent plus être utilisées. Ressenti visé à l'ouverture de l'app : **simple et rapide**.

## Principes

- **Noir et blanc, un seul jaune.** Le jaune est rare, donc il se voit : la marque, le bouton principal et ce qui est en direct.
- **Peu de pièces, toujours les mêmes.** Tout ce qui se touche est rond (boutons, quantités) ; tout ce qui contient est doux (cartes 24 px, champs 14 px). Zone de toucher de 44 px minimum.
- **Une seule alerte** : le rouge Retard. Chaque statut a une forme en plus de sa couleur (lisible en noir et blanc et pour un daltonien).
- **On parle comme au comptoir** : court, poli, concret, avec les mots du métier (commande, tournée, cagette, réserve, labo).

## Couleurs

| Nom | Valeur | Rôle |
|-----|--------|------|
| Aube | `#FFD60A` | Marque, action principale (une par écran), en direct. **Jamais en texte sur fond clair** (1,4:1). |
| Encre | `#0D0D12` | Texte, actions secondaires, fond du thème sombre. |
| Brume | `#F2F2F4` | Champs, cartes secondaires, lignes de liste. |
| Gris | `#6B6B76` | Texte secondaire (5,3:1 sur blanc). |
| Retard | `#E5484D` (texte `#B42318`) | Seule couleur d'alerte. |

Proportions visées : blanc 58 %, Brume 15 %, Encre 22 %, Aube 5 %.

Les couleurs nommées existent comme utilitaires Tailwind (`bg-aube`, `text-encre`, `bg-brume`, `bg-retard`), identiques dans les deux thèmes. Pour le reste, **toujours passer par les jetons sémantiques** (`src/app/globals.css`) :

| Jeton | Clair | Sombre | Usage |
|-------|-------|--------|-------|
| `background` | `#FFFFFF` | `#0D0D12` | Fond de page |
| `card` / `surface` | `#FFFFFF` | `#1A1A22` | Cartes |
| `popover` | `#FFFFFF` | `#22222B` | Menus, fenêtres |
| `muted` / `secondary` / `accent` | `#F2F2F4` | `#22222B` | Champs, survols, aplats |
| `border` | `#E2E2E6` | `#2A2A33` | Bordures |
| `input` | `#D4D4DA` | `#74747F` | Bordure de champ (contour en sombre : 3:1) |
| `foreground` | `#0D0D12` | `#FFFFFF` | Texte |
| `muted-foreground` | `#6B6B76` | `#B4B4BE` | Texte secondaire |
| `primary` | `#FFD60A` | `#FFD60A` | Action principale (texte encre dessus) |
| `brand` | `#0D0D12` | `#FFD60A` | Texte de marque, liens, icônes |
| `brand-subtle` / `success-subtle` | `#FFF4C2` | `#2B2710` | Aplat Aube pâle |
| `success` | `#0D0D12` | `#FFD60A` | « Livrée » (la coche porte le statut) |
| `warning` | `#7A5C00` | `#FFE066` | Attention (Aube foncée, pas de seconde alerte) |
| `error` / `destructive` | `#B42318` | `#FF8589` / `#FF6B70` | Retard, erreur, suppression |
| `ring` | `#0D0D12` | `#FFD60A` | Focus clavier |

Thème sombre : pour le livreur et le labo, la nuit. Il ne s'applique qu'aux espaces migrés (`src/lib/theme.ts`) ; le téléphone reste en clair pour le moment.

### Statuts d'une commande

| Statut | Pastille | Forme |
|--------|----------|-------|
| Brouillon | Brume, texte encre | rond vide gris |
| Validée | Brume | rond plein encre |
| Verrouillée | Brume | cadenas |
| Préparée | Brume | carré encre |
| En route | Encre, texte blanc | rond Aube avec halo |
| Livrée | Aube, texte encre | coche |
| En retard | `#FDECEC`, texte `#B42318` | rond Retard |

## Typographie

- **Geist** pour tout (chargée par `next/font/google` dans `src/app/layout.tsx`, variable `--font-sans`). Chiffres de même largeur : les quantités et les heures s'alignent.
- **Geist Mono** (`font-mono`) pour ce qui se recopie : numéros de bon, de facture, de tournée, codes d'accès.
- Titres serrés : h1 −4 %, h2 −3 %, h3 −2 % (posé dans `globals.css`) ; texte normal sans interlettrage.
- Échelle : chiffre clé 72/700 ; titre 1 40/700 ; titre 2 28/700 ; titre 3 20/600 ; texte 16/400 ; libellé 14/600 ; légende 12/500.
- Jamais de capitales pour une phrase entière. Les heures s'écrivent `17:00` dans l'app et « 17 h » dans les phrases.

## Rayons et ombres

| Jeton | Valeur | Usage |
|-------|--------|-------|
| `rounded-full` | — | Boutons, quantités, filtres, pastilles |
| `rounded-sm` | 8 px | Petits éléments |
| `rounded-md` | 12 px | Messages, menus |
| `rounded-lg` | 14 px | Champs |
| `rounded-xl` | 24 px | Cartes |

Ombres très légères, teintées encre ; pas de verre ni de dégradé décoratif.

## Composants

- **Boutons** (`src/components/ui/button.tsx`, tous ronds) : `default`/`brand` = Aube, texte encre gras, **une seule action principale par écran** ; `secondary` = Encre ; `outline` = contour ; désactivé = Brume, texte gris, avec la raison écrite.
- **Champs** (`input.tsx`, `select.tsx`) : aplat Brume, 44 px de haut, rayon 14 px, bordure encre de 2 px au focus ; contour visible en sombre.
- **Carte « demain »** : la seule carte noire de l'écran, ce qui reste à faire (chiffre clé + bouton Aube).
- **En direct** : le livreur en route est le soleil qui pulse ; le commerce du client est un carré ; les arrêts suivants sont numérotés.
- **Messages** : confirmation sur encre (action d'annulation en Aube) ; alerte sur `#FDECEC` texte `#B42318` ; information sur Brume.
- **Teintes d'état** des tableaux de bord : `src/components/ui/tone.ts`.

## Logo

- Composants : `BrandMark` (symbole) et `BrandLogo` (symbole + mot) dans `src/components/brand/`. Fichiers : `public/brand/annona-symbole.svg`, `annona-symbole-sur-encre.svg` ; icônes de l'app dans `src/app/` (`icon.png`, `apple-icon.png`, `favicon.ico`).
- Construction (grille 48) : soleil de rayon 14, posé 3 au-dessus de l'horizon ; horizon 40 × 4, bouts arrondis. Le mot « annona » en minuscules, Geist 700, −6 %.
- Versions : sur blanc (horizon encre), sur encre (horizon blanc), sur Aube (soleil encre), une couleur (tampon, fax).
- Interdits : changer la couleur du soleil, étirer ou déformer. Tailles mini : symbole 16 px, logo complet 80 px de large.

## Ton

Vouvoiement pour les commerçants ; tutoiement possible dans l'app livreur. Un bouton dit ce qu'il fait (« Valider la commande », pas « OK »). Une erreur dit la cause puis la solution. Exemples : « C'est validé. Livraison demain entre 5 h 30 et 7 h. » ; « La commande est clôturée depuis 17 h. Pour un ajout, appelez le labo. » ; « Comme jeudi dernier ».

## Migration en cours (DA-1)

Fait : jetons clair et sombre, Geist, logo et icônes web, boutons, champs, teintes d'état. Reste, écran par écran avec recette navigateur clair et sombre (suivi dans `TODO.md`, tâche DA-1) : couleurs codées en dur des écrans (verts de l'ancienne direction), page d'accueil publique (`.landing`), visite guidée (`.tour-adapt`), style des cartes (`src/lib/maps/`), e-mails et PDF (logo PNG), icônes des applications natives.
