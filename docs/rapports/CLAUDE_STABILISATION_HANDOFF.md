# Stabilisation après refonte — passation Claude

Mis à jour : 26 octobre 2026. Plan validé : `~/.claude/plans/sprightly-petting-beaver.md`.

## Git au démarrage
- Dossier d'origine : `~/Desktop/03 — Projets/TutelLiv/TutelLiv GPT` (Bureau synchronisé iCloud), **non modifié**.
- Copie de travail : `~/Developer/TutelLiv-GPT`, branche `preproduction` à `dc99755`.
- 80 fichiers modifiés et 116 non suivis au démarrage, jamais commités (ADMIN-01, SaaS, Growth, migration `platform_access_events`…).
- `origin/preproduction` a 8 commits de documentation en plus (conflit possible uniquement sur `docs/README.md`). Rien n'a été poussé.
- Sauvegarde : `~/Developer/TutelLiv-backups/2026-10-26/` (`repo.bundle`, `worktree.patch`, `untracked.tgz`, `changed.sha256` avec 248 fichiers, `refonte-restore.patch`, `refonte-tests.tgz`).

## Causes confirmées
| ID | Cause | État |
|---|---|---|
| E1 | iCloud a créé 340 doublons « … 2 » dans `node_modules` et `.next`, qui ont cassé les types de react-hook-form et pdf-lib (135 erreurs TS) | Corrigé : copie hors iCloud et `npm ci`, typecheck à 0 |
| E2 | `.env.local` vise l'ancien Supabase `wlomrzil…`, en pause (DNS introuvable), donc aucune connexion locale possible | Contourné : serveur lancé avec `.env.preproduction.local` ; `.env.local` inchangé |
| E3 | Travail non commité et non sauvegardé | Sauvegardé hors iCloud |
| R1 | Codex a réécrit 12 fichiers de la refonte avec la version HEAD, supprimé `tests/dashboard-glass-v2.test.ts` et amputé les tests navbar | Reconstitué depuis le journal Codex (36 opérations rejouées). Diffstat identique à la référence d'avant l'écrasement, à 1 ligne vide près dans `globals.css` |
| C1 | `src/app/api/auth/login/route.ts:68` affiche toute erreur Supabase comme « mot de passe incorrect » | Corrigé (groupe 1) |

## Tests exécutés
- Copie avec la refonte restaurée : `npm run check` vert (typecheck 0, lint 0, 488/488 tests).
- Serveur `127.0.0.1:3106` avec `.env.preproduction.local`. Pool démo porté à 6 avec `DEMO_POOL_SIZE=6 npm run demo2:prepare` (accord du propriétaire) : les 3 espaces existants étaient réservés pour 8 h.
- `navbar.spec.ts` : 2/2. `v1-roles.spec.ts` : admin (dashboard, dispatch) et client (commandes, suivi, factures) validés au moins une fois. Le livreur et un second passage sur le dispatch échouent **par délai d'attente** : les API mettent de 3 à 29 s depuis le poste local vers la base eu-west-3, avec une limite Prisma de 5 connexions.
- Tests modifiés : déconnexion `afterEach` dans les deux specs (libère le pool) ; titre du dashboard aligné sur « Bonjour … » (refonte) ; ordre des imports de `navbar.spec.ts` réparé.

## Constats de l'étape 3
| ID | Constat | Prio | Nature |
|---|---|---|---|
| P1 | Latence de 3 à 29 s par API en local sur la préproduction, avec timeouts du pool Prisma et des 500 sur `/api/auth/login` | P1 | Environnement et perf (lié à PERF-02), pas la refonte |
| C1 | Panne Supabase affichée comme « mot de passe incorrect » (`login/route.ts:68`) ; erreur DB renvoyée en 500 brut | P1 | Code |
| D1 | Refonte V2 du back-office activée seulement sur `pathname === "/dashboard"` (`src/app/(back-office)/layout.tsx:27`) : les autres pages gardent l'ancienne barre latérale blanche et bleue sous la nouvelle barre Apple noire | P1 | Cohérence de la refonte |
| D2 | Le mode Dark n'existe pas dans le code (aucun thème ni `prefers-color-scheme`) | P2 | Fonction non construite (DESIGN-1), pas une régression |
| D3 | 53 fichiers utilisent encore les jetons de l'ancienne palette, contre 5 qui utilisent `#00d46a` | P2 | Refonte partielle |
| A1 | Le dashboard n'a plus de titre « Tableau de bord » (h1 « Bonjour X. ») | P2 | Accessibilité et repère |

## Corrections de l'étape 4 (rien n'est commité)
| Groupe | Correction | Fichiers | Preuve |
|---|---|---|---|
| 1 — C1 | Panne Supabase Auth (status 0/5xx) et base injoignable ou pool saturé (P1001/P1002/P2024) : réponse 503 « service momentanément indisponible » au lieu de 401 ou 500 | `src/app/api/auth/login/route.ts`, `tests/login-service-unavailable.test.ts` | 4 nouveaux tests ; `performance.test.ts` (harnais de la route) toujours vert |
| 2 — D1 | Coque V2 (barre latérale, menu mobile, en-tête, fond, police, largeur 1480) sur tout le back-office ; seul le placement des alertes reste propre à `/dashboard` ; décalage de la carte plein écran recalé (104/292) | `src/components/layouts/back-office-layout.tsx`, `tests/dashboard-glass-v2.test.ts` | Captures : dashboard, dispatch, commandes, carte, paramètres, clients |
| 2 — mobile | Tiroir de navigation mobile caché sous le bandeau démo (défaut antérieur à la refonte) | `src/components/layouts/mobile-nav.tsx` | Capture 390 px |
| 3 — perf locale | Aucun changement de code. Mesures : `SELECT 1` à 550 ms via le pooler transactionnel 6543 (`pgbouncer=true`), contre 100 ms en session 5432 (RTT réseau 100 ms). Lancement local recommandé ci-dessous | — | Pages : de 11-21 s à 5,5-8 s |
| 4 — formulaire | Date minimale de livraison calculée en UTC au rendu : décalage d'hydratation, et la veille autorisée en France après minuit. Désormais calculée en date locale après montage | `src/features/client-portal/create-order-form.tsx`, `tests/order-form-min-date.test.ts` | Navigateur : `min` à la date locale, 0 avertissement |

Lancement local conseillé contre la préproduction :
`npx dotenv -e .env.preproduction.local -- env DATABASE_CONNECTION_MODE=session DATABASE_CONNECTION_LIMIT=10 npx next dev --turbopack -H 127.0.0.1 -p 3106`

## Recette finale
- `npm run check` : 0 erreur TS, lint 0, **493/493**.
- `next build` : OK (165 routes). `npm run build` est bloqué par son garde-fou, qui ne regarde que le port 3000, occupé par l'ancien serveur du dossier Bureau (autre `.next`). Seule l'étape `next build` a donc été lancée.
- E2E sur 3106 (délai `expect` porté à 20 s par une config temporaire hors dépôt) : `v1-roles.spec.ts` (3 rôles, suivi, facture, refus 403, panne simulée) et `navbar.spec.ts`, **3/3**, `pageErrors: []`.
- Captures desktop et 390 px : back-office, portail client, espace livreur.

## Ouvert
- Changer le mot de passe de la base `wlomrzil` : il a été exposé dans un journal d'outil pendant l'audit.
- Le pool démo de la préproduction compte désormais 6 espaces (au lieu de 3).
- **Hypothèse non vérifiée** : les fonctions Vercel de préproduction tourneraient en `iad1` (aucune `regions` dans `vercel.json`) alors que la base est à Paris. Si c'est le cas, la lenteur locale se retrouve en ligne. À confirmer dans Vercel → Settings → Functions avant tout changement (`"regions": ["cdg1"]` demanderait un déploiement).
- D2 (mode Dark inexistant), D3 (ancienne palette dans 53 fichiers), A1 (titre de page du dashboard), favicon absent (404) : chantiers design, pas des régressions.
- Avertissement d'hydratation sur `/dispatch`, vu une fois : bundle de dev périmé, disparu après redémarrage du serveur.
- Aucun E2E sur Light/Dark (pas de thème) ni sur GPS physique ou e-mails réels.
- graphify : aucun graphe construit, donc `graphify update` est sans objet.

## Passage 2 — comparaison avant/après (retour du propriétaire)
Méthode : la version d'avant la refonte (`dc99755`) a tourné en parallèle sur 3107, avec un relevé structurel de 33 pages (titres, boutons, liens, champs, lignes, texte, erreurs) puis des captures pleine page.
- **Dashboard** : la V2 avait remplacé les widgets de pilotage (alertes cliquables, Aujourd'hui, planning Commandes/Courses/Total, tableau statut × catégorie avec détail). Le contenu fonctionnel de `dc99755` est restauré dans la coque V2 : `company-dashboard-content.tsx`, `dashboard-widget-renderer.tsx`, `dashboard-customize-drawer.tsx`, `dashboard-layout.ts`. La V2 est archivée dans `backups/…/dashboard-v2-content.tgz`.
- **Palette** : cause commune, les jetons `@theme` de `globals.css` étaient restés sur le bleu `#0066ff`. Ils sont alignés sur DESIGN.md (primary encre `#0e1310`, ring `#00d46a`, brand/texte `#08783f`, fonds et bordures). 53 fichiers suivent sans modification.
- **« Mon abonnement »** (503, table `saas_billing_accounts` absente) : avec accord, `prisma migrate deploy` en préproduction de 5 migrations (3 OPS-03B idempotentes déjà présentes, `saas_billing_sandbox`, `catalog_c9_business`). Statut : « Database schema is up to date ».
- **Compte `orsocarotenuto@gmail.com`** : existait (admin « ouio uoi »), mot de passe refusé (401). Avec accord, mot de passe temporaire défini via l'API admin, enregistré dans `~/.config/tutelliv/orsocarotenuto-preprod.txt` (600). À changer dans Paramètres.
- Toutes les autres pages : structure identique à `dc99755`. Les 500 vus pendant la comparaison venaient de 2 serveurs qui saturaient les 15 connexions du mode session (`EMAXCONNSESSION`).
- Reste P2 : décalage d'id Radix (hydratation) sur le menu compte de l'en-tête, déjà présent avant la refonte, sans effet visible ; site public en tons ardoise (palette propre à la landing).
- Preuves : `npm run check` 492/492, `next build` OK, E2E 3 rôles et navbar 3/3, relevé de 14 pages admin avec le compte réel sans erreur API.

## Prochaine action
Proposer au propriétaire un découpage des commits locaux (travail Codex préexistant d'un côté, corrections de stabilisation de l'autre), puis décider de la publication.

## DA « E · Menthe » (26/10, commits locaux, rien de poussé)
- Commits : `ec9f9e2` travail préexistant · `50f9af1` refonte reconstituée · `aa62839` stabilisation · `bc5e046` coque Menthe (bouton vert #00D46A texte encre, barre latérale blanche + logo, Inter seule) · `b4e20b0` dashboard (teintes d'urgence `src/components/ui/tone.ts`, donut du jour, alertes en carte) · `d4dda1e` tendances (`src/lib/dashboard/trends.ts`).
- Tendances exactes uniquement : retards et livraisons vs hier à la même heure, livraisons par heure. Pas de tendance « sans livreur / assignées / en route » : aucune heure de passage de statut en base (il faudrait une colonne, donc une migration).
- Limites connues : jour et heures calculés sur le fuseau du serveur (préexistant, `startOfToday`) ; requête tendances plafonnée à 200 lignes comme les autres requêtes du dashboard ; avertissement d'hydratation Radix intermittent sur le menu du compte (préexistant).
- Vérifié à chaque étape : `npm run check` (498/498 à la fin), E2E 3 rôles + navbar 3/3, captures desktop et 390 px.
- Suite prévue : autres pages du back-office, portail client et espace livreur (barre Apple encore noire), puis mode Dark.
