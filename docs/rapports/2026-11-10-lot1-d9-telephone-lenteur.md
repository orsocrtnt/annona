# Lot 1, demande 9 — téléphone et lenteur : compte rendu

Date : 10 novembre 2026. Branche `orso/lot1-retouches`. Base `annona-dev` (`fqzlfszgyeyfeshllqtj`), lecture seule pendant les mesures.

## En bref

- Temps médian d'affichage d'un écran sur téléphone 4G : **5,8 s → 3,2 s** à l'ouverture complète, **3,2 s → 1,8 s** en navigation dans l'application.
- Écrans sous l'objectif de 3 s : **2 sur 24 → 11 sur 24** à l'ouverture, **10 sur 20 → 17 sur 20** en navigation.
- Aucune page ne déborde sur le côté à 360 px de large (avant comme après).
- Deux vraies cibles tactiles trop petites, corrigées.
- **Écart à expliquer** : les mesures ont été faites avec un serveur local qui interroge la base à Paris en **0,52 s par aller-retour**, contre quelques millisecondes en production (Vercel `cdg1` et Supabase `eu-west-3` sont dans la même région). Les écrans qui restent au-dessus de 3 s sont ceux qui enchaînent le plus de lectures en base. Ils devraient passer sous 3 s en production, mais ce n'est pas mesuré : voir « Reste à faire ».

## Méthode

- **Profil téléphone 4G** : écran 360 × 740 tactile (densité 2), réseau 4G simulé (aller-retour 150 ms, 9 Mbit/s en réception, 1,5 Mbit/s en émission), processeur ralenti 4 fois (téléphone milieu de gamme). Chromium sans interface, Playwright.
- **Temps d'un écran** : du début de la navigation jusqu'à « prêt » (titre de la nouvelle page visible, plus aucun squelette de chargement, document chargé).
  - *Ouverture* : chargement complet de l'adresse, cache vide (session relue, tout le code reçu).
  - *Navigation* : première visite de l'écran dans la session, depuis un autre écran, sans recharger l'application. C'est le cas courant une fois l'application ouverte.
- **Avant / après sur le même code et la même base** : la version d'avant le lot 1 (`65aadfa`, seule compatible avec le schéma actuel de `annona-dev`, les migrations du lot n'étant pas appliquées) a été construite en production (`next build`, `next start`), mesurée, puis reconstruite avec les seules corrections de lenteur ci-dessous et remesurée. Les corrections sont les mêmes sur la branche du lot 1.
- Script rejouable : `tests/e2e/lot1-d9-perf.spec.ts` (résultats bruts : `outputs/perf/avant.json`, `outputs/perf/apres.json`, non versionnés).
- Comptes de démonstration : admin, boulanger, client-1, livreur-1. Les écrans du lot 1 (Promotions, Suivi livreurs) ne sont pas mesurés : ils demandent la base migrée (`E2E_PERF_SCREENS=lot1`).

## Ce qui ralentissait

1. **L'identification à chaque requête.** Chaque appel d'API et chaque page relisent le compte (utilisateur, entreprise, rôle, permissions) pour que la suspension d'un compte ou le retrait d'un droit s'appliquent tout de suite. Cette lecture coûtait en moyenne deux allers-retours et demi vers la base (environ quatre requêtes Prisma `include` successives), soit environ 1,3 s ici contre 0,5 s après.
2. **La cascade session puis données, au chargement du portail client et de l'application livreur.** `RoleGuard` attend `/api/auth/session` avant d'afficher la page et de lancer ses propres requêtes, alors que le middleware a déjà vérifié le rôle côté serveur. Cela ajoute un aller-retour complet à chaque ouverture. **Corrigé ensuite** sur décision d'Orso : voir « Décision et deuxième mesure ».
3. **Des lectures en base faites l'une après l'autre** alors qu'elles sont indépendantes : contrôle du verrouillage du jour (entreprise, puis marqueur de verrouillage) appelé par les écrans Commandes, Tournées et Production ; livreurs puis prix dans la liste des commandes de l'administrateur.

## Corrections faites

| Correction | Fichier | Effet |
|---|---|---|
| Compte, entreprise, rôle et permissions en **une** requête SQL (même objet qu'avant, vérifié sur les 11 comptes de démonstration) | `src/domains/user/user.service.ts` (`getUserByAuthId`) | Chaque appel d'API et chaque page : environ 2 allers-retours en moins |
| Entreprise et marqueur de verrouillage lus en parallèle | `src/domains/order/order-lock.service.ts` (`ensureDateLocked`) | Commandes, Tournées, Production : 1 aller-retour en moins |
| Livreurs et prix lus en parallèle | `src/domains/order/admin-order.service.ts` (`listAdminOrders`) | Commandes de l'administrateur : 1 aller-retour en moins |
| Nom du client (liste des clients) et liens des mentions légales manquantes (Factures) : cible tactile de 44 px sur téléphone | `src/features/merchants/merchants-content.tsx`, `src/features/invoices/admin-invoices-content.tsx` | Boutons trop petits |

## Temps d'affichage par écran (téléphone 4G)

| Espace | Écran | Ouverture avant | Ouverture après | Navigation avant | Navigation après |
|---|---|---:|---:|---:|---:|
| Administrateur | Tableau de bord | 6,1 s | 5,8 s | — | — |
| Administrateur | Commandes | 7,8 s | 4,5 s | 5,7 s | 3,7 s |
| Administrateur | Commandes : détail | 7,3 s | 6,2 s | 5,0 s | 5,8 s |
| Administrateur | Tournées | 8,1 s | 5,6 s | 5,2 s | 3,7 s |
| Administrateur | Clients | 5,1 s | 2,7 s | 2,8 s | 1,8 s |
| Administrateur | Clients : détail | 4,0 s | 2,9 s | 3,7 s | 1,8 s |
| Administrateur | Catalogue | 5,2 s | 2,8 s | 2,7 s | 1,6 s |
| Administrateur | Factures | 3,3 s | 2,3 s | 3,6 s | 1,6 s |
| Administrateur | Support | 4,5 s | 2,2 s | 2,3 s | 1,3 s |
| Administrateur | Gestion des comptes | 4,4 s | 3,2 s | 4,3 s | 2,2 s |
| Administrateur | Facturation | 4,4 s | 2,3 s | 2,3 s | 1,3 s |
| Administrateur | Paramètres | 1,4 s | 1,4 s | 1,0 s | 0,5 s |
| Boulanger | Production | 6,9 s | 4,6 s | — | — |
| Client | Commander | 5,7 s | 3,2 s | — | — |
| Client | Mes commandes | 7,3 s | 3,9 s | 3,9 s | 2,7 s |
| Client | Mes commandes : détail | 7,7 s | 4,6 s | 4,1 s | 2,8 s |
| Client | Historique | 7,8 s | 4,3 s | 3,7 s | 2,8 s |
| Client | Commande récurrente | 6,4 s | 3,5 s | 2,9 s | 2,3 s |
| Client | Factures | 7,6 s | 3,4 s | 2,9 s | 1,9 s |
| Client | Support | 5,8 s | 2,7 s | 2,5 s | 1,6 s |
| Client | Paramètres | 4,7 s | 2,7 s | 3,6 s | 1,6 s |
| Client | Profil | 5,9 s | 2,7 s | 2,4 s | 1,6 s |
| Livreur | Ma tournée | 6,7 s | 3,7 s | — | — |
| Livreur | Profil | 1,5 s | 0,6 s | 1,6 s | 0,7 s |

Médianes : ouverture 5,8 s → 3,2 s ; navigation 3,2 s → 1,8 s.
Écrans sous 3 s : ouverture 2/24 → 11/24 ; navigation 10/20 → 17/20.

Une mesure isolée peut varier de quelques centaines de millisecondes d'une exécution à l'autre (par exemple « Commandes : détail » en navigation, plus lent après qu'avant sur cette exécution, pour la même quantité de requêtes).

## Affichage

- **Débordement horizontal** : aucun, sur les 24 écrans mesurés, à 360 px.
- **Cibles tactiles de moins de 44 px** : deux vrais cas, corrigés (voir ci-dessus). Les autres signalements étaient faux : les interrupteurs ont déjà une zone tactile de 44 px (pseudo-élément), et les cases à cocher des paramètres du client sont dans une ligne cliquable de 44 px. Le contrôle en tient compte désormais.
- **Éléments coupés, textes illisibles** : pas contrôlés à l'œil dans cette mesure (aucune capture d'écran examinée). À faire pendant la recette navigateur du lot (LOT1-RECETTE), en largeur téléphone, et sur de vrais téléphones (ci-dessous).

## Décision et deuxième mesure (10 novembre, soir)

**Décision d'Orso** : le portail client et l'application livreur s'affichent et lancent leurs requêtes sans attendre la session du navigateur ; une fois la session connue, un autre rôle ou une session absente redirige comme avant (`src/components/auth/role-guard.tsx`, commit `cb442e1`).

**Deuxième mesure**, base migrée, même protocole (téléphone 360 px, 4G simulée, processeur ×4), version de production sur `da2b732` + retouches, avec les écrans du lot 1 (`E2E_PERF_SCREENS=lot1`, résultat brut `outputs/perf/apres-lot1.json`) :

| Espace | Écran | Ouverture (1ʳᵉ mesure après → 2ᵉ) | Navigation (1ʳᵉ → 2ᵉ) |
|---|---|---|---|
| Administrateur | Tableau de bord | 5,8 s → **3,3 s** | — |
| Administrateur | Commandes | 4,5 → 2,4 s | 3,7 → 1,8 s |
| Administrateur | Commandes : détail | 6,2 → 2,5 s | 5,8 → 1,6 s |
| Administrateur | Tournées | 5,6 → 2,8 s | 3,7 → 1,5 s |
| Administrateur | Promotions (lot 1) | 2,3 s | 1,3 s |
| Administrateur | Suivi livreurs (lot 1) | 1,7 s | 0,8 s |
| Boulanger | Production | 4,6 → 2,5 s | — |
| Client | Commander | 3,2 → 2,5 s | — |
| Client | Mes commandes | 3,9 → 2,4 s | 2,7 → 1,5 s |
| Livreur | Ma tournée | 3,7 → 2,2 s | — |

Sur les 26 écrans : médianes 2,1 s à l'ouverture et 1,0 s en navigation ; 25 sur 26 sous 3 s à l'ouverture (seul le tableau de bord de l'administrateur reste à 3,3 s), 22 sur 22 en navigation ; aucun débordement horizontal, aucune cible tactile trop petite.

**Prudence sur la comparaison** : les écrans de l'administrateur, que la décision ne touche pas, gagnent aussi beaucoup. Une partie de l'écart vient donc de la base, plus rapide au moment de la deuxième mesure ; les deux mesures n'ont pas été faites en même temps. Le gain propre à la décision n'est pas isolé. En production (serveur et base à Paris), les temps devraient être plus bas encore, sans que ce soit mesuré.

## Reste à faire

- **Mesure en conditions de production** : refaire la mesure contre un déploiement Vercel (`cdg1`) branché sur `annona-dev` ou une base de recette, pour confirmer l'objectif des 3 s sans la latence de ce poste.
- **Vrais téléphones** (vérification 3 du document) : commander, recopier une commande, livrer un arrêt, consulter les tournées sur un iPhone et un Android. Non fait : aucun appareil disponible pour l'agent ; les parcours ont été rejoués en émulation tactile 360 px.
