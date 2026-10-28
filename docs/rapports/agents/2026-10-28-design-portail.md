# DESIGN-1, tranche portail client et mode Dark (agent Design, 28 octobre 2026)

Branche `agent/design-portail`, partie de `preproduction` (9234600). Aucune règle métier, API, schéma ni donnée touchés ; présentation uniquement. Recette navigateur et captures : à faire par l'orchestrateur (rien n'a été lancé dans un navigateur).

## Infrastructure Dark

- Jetons sémantiques Dark « Encre + Pastel » dans `src/app/globals.css`, sous `:root[data-theme="dark"]` et, pour le choix « Système », sous `@media (prefers-color-scheme: dark) { :root[data-theme="system"] }` (blocs identiques, vérifiés par test).
- Variante Tailwind `dark:` redéfinie (`@custom-variant`) sur ces mêmes attributs : les composants partagés peuvent porter des classes `dark:` sans effet hors des espaces migrés.
- Portée : `src/lib/theme.ts` (`THEME_SCOPED_PATH_PREFIXES = ["/portal"]`). Le script `THEME_INIT_SCRIPT` (dans `<head>` de `src/app/layout.tsx`, avant l'hydratation) pose `data-theme` seulement sur `/portal/**`. Ailleurs l'attribut est absent : le Light des autres espaces ne change pas, même si l'OS est sombre. Pour migrer un autre espace plus tard, ajouter son préfixe.
- Préférence « Système / Clair / Sombre » mémorisée dans `localStorage` (`tutelliv-theme`), `ThemeSync` (dans `AppProviders`) garde l'attribut aligné lors des navigations client, `ThemeToggle` dans la barre du portail.
- `prefers-reduced-transparency` : `.glass` retombe sur une surface opaque. `prefers-reduced-motion` était déjà couvert.
- Effet de bord assumé : les quelques classes `dark:` préexistantes (bannières ambre) ne réagissent plus à l'OS partout, seulement dans le portail.

## Jetons Dark et contrastes (ratios mesurés, WCAG AA = 4,5 texte, 3 composants)

| Usage | Valeur | Ratio |
|---|---|---|
| Texte sur fond `#141716` | `#eef1ef` | 15,9 |
| Texte sur carte `#1c1f1e` | `#eef1ef` | 14,6 |
| Texte atténué sur carte | `#a3aca6` | 7,1 |
| Texte secondaire | `#b4bcb7` | 8,6 |
| Texte tertiaire (aide, jamais seul) | `#8b948e` | 5,3 |
| Bouton principal (encre sur `#3dd68c`) | `#0e1310` | 10,0 (hover 11,2) |
| Texte marque sur carte | `#5bd99a` | 9,4 |
| Accent `#7be0ab` sur `#1f3a2c` | | 7,7 |
| Erreur `#f08a82` sur `#3d2523` | | 5,8 |
| Avertissement `#f0b45c` sur `#3a2f1c` | | 7,1 |
| Destructif `#e5736b` sur `#3d2523` | | 4,7 |
| Focus `#5bd99a` sur carte | | 9,4 |

Bordures `#333936`, popover `#212524`, fond gris jamais noir pur.

## Écrans touchés (avant, après)

- Barre du portail (`client-portal-layout.tsx`, `apple-navbar.tsx` par variantes `dark:`) : hex en dur et boutons 36 px, devenus jetons, cibles 44 px, logo version fond sombre, bascule de thème ajoutée.
- Tableau de bord, commandes, historique, récurrentes, factures, support, réglages : surfaces et textes déjà portés par jetons, désormais cohérents en Dark ; `#f5f8f6`, `#eafaf1`, `#08783f`, `#f0f0f0` remplacés par `background`, `success-subtle`, `brand`, `muted`.
- Détail livraison : puce de timeline en `foreground`.
- Composants partagés par variantes `dark:` (Light intact) : teintes d'état (`tone.ts`), `stat-card`, progression de commande, alertes opérationnelles, cellules de tableau, accusé de mission, fil de messages, grille de données (ligne sélectionnée), fonds de dialogue et tiroir.
- Cibles tactiles : nouvelles tailles `touch` (44 px) et `icon-touch` sur `Button` (ajout, `sm` et `icon-sm` inchangés), appliquées à tout le portail ; bouton « Commander à nouveau » compact, cloche, interrupteurs (zone de frappe étendue).
- Formulaire de commande : titres de section plus lisibles, bloc « Livraison » en carte, case « Enregistrer cette adresse » à 44 px, action principale unique (taille lg, pleine largeur sur mobile, barre collante sur mobile). Validation et appels API non modifiés. Pas d'aide contextuelle ajoutée : aucune notion complexe n'exigeait d'explication non inventée.
- Accessibilité : nom accessible des interrupteurs de widgets, focus visible et cible 44 px sur « Tout marquer lu », menu de thème avec `menuitemradio`.

## Limites

- Carte des livraisons (`/portal/deliveries`) : le plan et ses panneaux flottants restent clairs en Dark (verre sur plan clair) ; un plan sombre relève de MAP-3.
- Police : Inter seule reste en vigueur (le dashboard le teste) ; Sora de `DESIGN.md` n'a pas été introduite.
- Non vérifié : tout rendu réel, les états chargement/erreur en Dark, le profil (composant hors périmètre), les pages hors `src/app/(client-portal)`.

## Inventaire `dark:` hors portail (accepté par l'orchestrateur)

Avant la redéfinition de la variante `dark:`, ces classes suivaient `prefers-color-scheme` partout : bannière ambre de `(back-office)/dashboard/orders/[id]/page.tsx`, `company-order-columns.tsx`, `dispatch-settings-form.tsx`, `subscription-content.tsx` et la barre de démonstration `features/demo/demo-mode-bar.tsx`. Elles ne s'appliquent plus que dans le portail : hors portail, le rendu Light prévu est la cible.

## Passe impeccable (craft-floor, polish, critique)

Le détecteur `impeccable detect` sur le portail a donné 3 avis de taille de texte hors échelle (10 et 11 px), corrigés. Le portail est ensuite propre. La critique complète (sous-agents A et B, navigateur) n'a pas été exécutée faute de rendu : lecture du code seulement.

## Mise à jour après relecture

- « Système » est désormais résolu en `light`/`dark` par le script d'initialisation et par `ThemeSync` (matchMedia + écouteur) ; un seul bloc de jetons Dark subsiste. `ThemeSync` est l'unique écrivain de `data-theme`, appliqué en `useLayoutEffect` à chaque changement de route (le Dark ne déborde plus sur les autres espaces). Le hook de préférence ne fait plus que lire et écrire le choix.
- Typographie : Sora introduite pour les titres h1 à h3 du portail seulement (`portal-font.ts`, variable `--font-sora` posée par le layout du portail) ; les autres espaces gardent Inter seule. Les titres des fenêtres rendues dans un portail DOM (dialogues) restent en Inter.
- Barre du portail : thème et avatar passent dans le menu mobile sous 640 px.
- Les classes `dark:` préexistantes hors portail (bannières ambre du back-office, barre de démo) suivaient jusqu'ici l'OS sombre ; elles ne s'appliquent plus qu'au portail (le reste du produit est Light).
