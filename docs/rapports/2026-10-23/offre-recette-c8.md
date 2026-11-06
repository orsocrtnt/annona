# Handoff DEV — gating des offres, recette par formule, catalogue C8

Date : 23 octobre 2026.
Auteur : second agent (hors TODO, demande propriétaire).
Commit poussé : `4f973c7` sur `preproduction` (`origin/orsocrtnt/annona`).
Tâche TODO officielle suivante : **OPS-03B** (inchangée). Ne pas relancer ce chantier.

## Consigne pour l’agent DEV principal

Ceci n’est **pas** OPS-03B, SAAS-01B, ni OFFER-1. Le propriétaire a demandé un écart ciblé : une offre Starter ne doit voir que ce qu’elle paie ; les fonctions non payées sont grisées ; un environnement de recette existe par formule ; les prix du Drive C8 sont la source.

Ne pas :

- recommencer le gating, le seed recette, ni le catalogue C8 ;
- casser DEMO-2 (LogiExpress / démo publique reste **entièrement déverrouillée**) ;
- implémenter Stripe, un achat d’extra sièges, ni un paiement réel ;
- pousser, migrer la production, ni dépenser ;
- cocher SAAS-01A / SIGNUP-1 / OFFER-1 : ces cases étaient déjà fermées ; ce travail les complète sans les rouvrir.

Reprendre **OPS-03B** sauf nouvelle consigne propriétaire.

## Résultat

Une entreprise commerciale (inscription ou recette) reçoit désormais les **droits de son offre** aussi dans l’interface, pas seulement sur les routes serveur. Starter sans option ne lance pas le dispatch automatique, n’ouvre pas les cartes GPS ni les analytics. Pro/Business voient leurs inclusions. Un Starter avec l’option dispatcher a le siège dispatcher, sans débloquer les options logicielles.

Quatre entreprises de recette stables existent sur la préproduction isolée. Après un paiement fictif d’inscription, l’utilisateur atterrit sur le tableau de bord de **sa** nouvelle entreprise, avec les droits de la formule choisie.

Le dialogue **Inviter un utilisateur** affiche le restant de postes par rôle. À restant 0, il affiche le prix HT/mois du poste supplémentaire. L’invitation reste refusée tant que l’extra n’est pas acheté (SAAS-01B / SAAS-03).

Le catalogue actif est **C8-2026-10-23**. C7 est retiré et historisé. Les souscriptions déjà instantanées sur C7 ne sont pas réécrites.

## Catalogue C8 (Drive du 23/10/2026)

Source : `Annona — Catalogue des offres et tarifs` (`Annona_Catalogue_Offres_Tarifs_2026-10-23.docx`, id Drive `1z_iSH5edy-Q5Ex-RHJFuoMi_6wD0Lt6s`). Relu le 23/10 après modification propriétaire.

| | Starter | Pro | Business |
|---|---:|---:|---:|
| Mensuel HT | 79 € | 179 € | 349 € |
| Annuel HT (10 mois payés / 12 d’accès, hors extras) | 790 € | 1 790 € | 3 490 € |
| Livreurs inclus / max | 5 / 10 | 10 / 30 | usage raisonnable / pas de plafond chiffré |
| Admins inclus | 1 | 1 | 2 |
| Dispatchers inclus | 0 | 1 | 1 |
| Commandes / mois | 1 000 | 3 000 | 6 000 |
| Dépassement commande | 0,10 € | 0,08 € | 0,06 € |
| Features incluses | aucune | `auto_dispatch`, `admin_gps` | les cinq |

Extras mensuels HT (annuel = ×12, sans remise 10/12) :

| Extra | Starter | Pro | Business |
|---|---:|---:|---:|
| Dispatcher | 8 € | 8 € | 8 € |
| Admin supplémentaire | 12 € | 12 € | 12 € |
| Livreur supplémentaire | 12 € | 10 € | inclus |
| Dispatch automatique | **29 €** (seul achat possible) | inclus (liste 39 €, non refacturé) | inclus (liste 49 €, non refacturé) |
| GPS admin | 39 € | inclus | inclus |
| GPS client | 49 € | 49 € | inclus |
| Analytics / support prioritaire | 29 € | 29 € | inclus |

Changement C7 → C8 : auto-dispatch Starter **49 → 29 €** ; admin extra **étendu aux trois offres** (plus seulement Business) ; `maxAdminSeats` Starter/Pro passé à `NULL` pour autoriser l’extra.

Migration : `prisma/migrations/20261023180000_catalog_c8_prices/migration.sql`. Appliquée sur la préproduction isolée. Recette re-seedée sur C8.

## Environnements de recette

Script : `npm run db:seed-offer-environments` (pointe `.env.preproduction.local`).
Définition : `src/domains/saas/offer-environments.ts`.
Mot de passe commun : `Test1234!`.

| Compte | Offre | Particularité |
|---|---|---|
| `offre-starter@annona.fr` | Starter nu | 0 dispatcher, aucune option logicielle |
| `offre-starter-dispatcher@annona.fr` | Starter + `DISPATCHER_ALL` | siège dispatcher, options logicielles toujours verrouillées |
| `offre-pro@annona.fr` | Pro | auto-dispatch + GPS admin inclus |
| `offre-business@annona.fr` | Business | toutes les features, livreurs sans plafond chiffré |

Ne pas détruire le pool DEMO-2 LogiExpress. Le seed recette cible uniquement les slugs `offre-*`.

## Comportement produit à conserver

- **Fail-open hors offre commerciale.** `hasSaasFeature(null)` reste `true` : LEGACY, démo publique et sessions encore en chargement ne doivent pas se griser. Pendant le chargement d’une session offre, `isOfferAccessPending` affiche un skeleton pour éviter le flash « tout ouvert » puis un 403 (régression analytics déjà corrigée : poser `saas` avant `user`).
- **Gating UI.** Nav grisée via `applyOfferNavLocks` ; pages via `OfferFeatureGate` (`auto_dispatch`, `admin_gps`, `client_gps`, `advanced_analytics`). Les routes serveur SAAS-01A restaient déjà fermées.
- **Sièges invitation.** Compteurs session `saas.seats` (used / limit / remaining / extraMonthlyPriceCents / canAddExtra). Dispatcher **et Mini-admin** partagent le quota dispatcher (8 €). Le Client n’est pas compté. À restant 0 + `canAddExtra`, libellé du prix ; l’option reste désactivée (le serveur refuserait). À plafond dur : « Plafond atteint ». Business livreurs : « Sans plafond chiffré ».
- **Paiement fictif.** `SIGNUP_PAYMENT_ADAPTER=fake` dans `.env.example`. Autorisé local + Preview. **Refusé si `VERCEL_ENV=production`.** Après clic Payer, session ouverte sur `/dashboard` de la société activée.
- **Support public.** Lien `Support` (mailto) sur accueil, login, inscription. `NEXT_PUBLIC_SUPPORT_EMAIL` ou défaut `support@annona.fr`. La boîte n’est pas encore configurée.
- **Inscription recette.** Cookie `annona-signup-resume` périmé : GET le purge, POST `create` relance un brouillon. Quota e-mail Supabase 429 : en non-prod / adaptateur fake, bypass admin `email_confirm: true` puis réconciliation `EMAIL_VERIFIED`. Ne pas porter ce bypass en production.

## Fichiers d’entrée

- Droits session : `src/domains/saas/saas-access.ts`, `saas-session.ts`, `saas.service.ts`
- UI verrouillée : `src/features/saas/*`, sidebar / mobile-nav / pages dispatch, analytics, portail
- Recette : `src/domains/saas/offer-environments.ts`, `offer-environment.service.ts`, `scripts/seed-offer-environments.ts`
- Invitation : `src/features/users/create-user-dialog.tsx`
- Inscription : `src/domains/signup/signup.service.ts`, `src/app/api/signup/route.ts`, `src/app/api/signup/payment/route.ts`
- Support : `src/features/support/public-support-link.tsx`
- Nettoyage comptes de test : `scripts/cleanup-signup-test-accounts.ts` (déjà exécuté sur préprod ; a conservé `offre-*` et LogiExpress)

## Preuves

- Recette navigateur localhost:3000 : Starter (4 livreurs restants, dispatcher 0 → 8,00 € HT/mois), Pro (10 livreurs, 1 dispatcher), Business (livreurs sans plafond, 1 dispatcher).
- Tests locaux visés : `tests/offer-access.test.ts`, C8 dans `tests/saas-core.test.ts`, 429 / cookie / 29 € dans `tests/signup.test.ts`.
- `npm run check` n’a pas été relancé en entier après le commit ; les suites ciblées offres/signup passaient avant push.

## Limites à ne pas « corriger » sans consigne

- Achat d’un siège extra depuis l’invitation : non branché, volontaire. Relève de SAAS-01B / SAAS-03.
- Mini-admin tarifé comme dispatcher (8 €), pas comme `ADMIN_EXTRA` (12 €). Le catalogue Drive distingue les rôles ; le code historique compte `DISPATCHER` + `MINI_ADMIN` sur le même quota. Changer cela est une décision produit.
- Prix catalogue 39 € / 49 € auto-dispatch Pro/Business : prix de liste seulement, jamais revendus (feature déjà incluse).
- `.env.local` peut encore pointer l’ancien projet Supabase pause `wlomrzilflbouzyhzwxm` (ENOTFOUND). La recette réelle tourne sur la préproduction `zwwyalsslyydubtetagj`.
- Overlay Next « 1 Issue » (hydratation DropdownMenu) préexistant, non traité.
- Aucun paiement réel, aucune variable Production, aucun déploiement Production.

## Suite attendue

1. OPS-03B (P0 TODO), sauf override propriétaire.
2. SAAS-01B quand on remplacera l’adaptateur fake : conserver le refus production, l’idempotence, et brancher alors l’achat d’extras affiché dans l’invitation.
3. OFFER-1 reste la confrontation marché ; C8 n’est que la grille cible synchronisée, pas une validation de rentabilité.
