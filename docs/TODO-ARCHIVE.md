# Archive de la TODO Annona (commande et livraison B2B)

Tâches closes et journal du nouveau produit. L'archive de l'ancien produit (coursier) reste dans l'historique git : `git show 0475b8d:docs/TODO-ARCHIVE.md`.

## Tâches closes

- [x] **CMD-1 — Commande côté commerçant.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  CLI-01 à CLI-09, RG-02, RG-08, ENF-03 : connexion, profil, catalogue par catégorie avec + / − et saisie directe, panier, date (J+1 ou plus) et créneau, modification et annulation jusqu'à l'heure limite, historique, « Recommander » à l'identique ou dans le panier, commande récurrente (jours, créneau, suspendre).

  Terminé quand : critère 1 (recopier une commande en moins d'une minute) chronométré dans le navigateur ; tests du refus serveur ; `npm run check` vert.

  7 novembre 2026, fait (commit `8f8ad1e`, sans push). Portail `/portal` pensé mobile : date (J+1 ou plus, 7 j/7) et créneau actif seulement, catalogue par catégorie avec photo, unité, prix du client (badge « Votre prix »), − / +, saisie directe, panier ; commande existante pour la date et le créneau ouverte en modification. `/portal/orders` (à venir et historique), `/portal/orders/[id]`, `/portal/recurring`, carte « Mon commerce » dans le profil. `isOrderEditable` dans `src/domains/order/order-deadline.ts` (fuseau en paramètre, Paris par défaut). Refus serveur : 409 après l'heure limite ou commande verrouillée, 400 pour aujourd'hui, une date passée, un créneau inactif ou un produit indisponible, 404 pour la commande d'un autre client. « Recommander » au prix du jour (produits retirés écartés, 409 avec lien si une commande existe déjà) ; « Reprendre dans le panier ». Commande récurrente enregistrée (lignes, jours, créneau, suspendre, modifier) ; la génération est pour LOCK-1.
  Vérifications : `tests/cmd1-merchant-orders.test.ts` (13 tests : 16h59 / 17h00, J−1 / J−2, changements d'heure du 29 mars et du 25 octobre 2026, refus serveur, unicité, recommander, droits, récurrente) ; Playwright cliqué : critère 1 chronométré à 33,3 s, client connecté sur `/portal` (28,8 s au passage précédent, compilation du serveur dev comprise) ; client B → 404 sur la commande du client A ; données d'essai `E2E-CAT1` supprimées et vérifiées ; captures mobile 390 px `outputs/recette-cmd1/cmd1-*` relues (défilement horizontal, barre du panier et noms de catégories coupés corrigés ; capture du catalogue relue par l'orchestrateur) ; `npm run check` 645/645 ; `npm run build` vert.
  Reste : confirmation de commande (NOT-02, NOTIF-1) ; menu mobile encore en liste déroulante (pas de barre d'onglets) ; puce « Autre date » pâle une fois choisie ; mode sombre non relu.

- [x] **CAT-1 — Catalogue et prix.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  ADM-02, ADM-03, RG-05, PLA-04 : catégories ordonnées, produits (nom, photo, unité, prix de base, actif), prix spécifique par commerçant ; un seul calcul du prix appliqué, utilisé partout.

  Terminé quand : tests du prix appliqué (critère 3) ; écrans d'administration cliqués dans le navigateur.

  7 novembre 2026, fait (commit `7352aba`, sans push). `/dashboard/catalog` : catégories (créer, renommer, ordonner, désactiver ; migration additive `20261107090000_category_active` appliquée sur annona-dev, `migrate diff` vide), produits (nom, photo dans le bucket privé `product-photos` servie par `/api/catalog/products/[id]/photo` à la même entreprise seulement, unité libre, prix de base, TVA, actif, catégorie), prix spécifiques depuis la fiche produit. Seul point de choix du prix : `src/domains/catalog/pricing.ts` (`resolveUnitPrice`, `loadAppliedPrices`, `computeTotals`), utilisé par le catalogue client, le panier, les totaux et « Recommander ». Écriture réservée à ADMIN (`catalog:manage`), entreprise prise dans la session, identifiant d'une autre entreprise → 404.
  Vérifications : `tests/cat1-catalog-prices.test.ts` (9 tests : critère 3, validation, isolation, garde de chaque route) ; Playwright `tests/e2e/cat1-cmd1-recette.spec.ts` cliqué sur un serveur local (client A voit 1,90 €, client B le prix de base 2,40 €) ; `npm run check` relancé par l'orchestrateur : 645 tests, 645 réussis ; `npm run build` vert ; captures `outputs/recette-cmd1/cat1-*`.
  Reste : prix spécifiques depuis la fiche client (ADM-1).

- [x] **SCHEMA-1 — Nouveau schéma de données et base de démonstration.**

  **Modèle conseillé : Claude Opus · effort élevé (schéma, isolation).**

  Schéma Prisma propre selon la section 7 du cahier des charges et `TRI-BASE.md` §3 et §4 : Entreprise (heure limite, fuseau, délai du rappel), Utilisateur (rôles SUPER_ADMIN, ADMIN, BAKER, DRIVER, MERCHANT), Commerçant, Catégorie, Produit, Prix spécifique, Créneau, Commande (DRAFT → VALIDATED → LOCKED → PREPARED → DELIVERED, origine MANUAL ou RECURRING, unique par commerçant, date et créneau), Ligne, Commande récurrente et ses lignes, Tournée, Arrêt, Facture, Règlement, Journal ; tous avec `companyId`. Une seule migration initiale appliquée sur `annona-dev`. Données de démonstration : une boulangerie, 100 produits, 20 commerçants, 5 livreurs.

  Terminé quand : `prisma validate` et `npm run check` verts ; migration appliquée sur `annona-dev` ; démo chargée et relue.

  6 novembre 2026, fait (commit `c550335`, sans push). 29 modèles : Company (`cutoffTime` 17:00, `timezone` Europe/Paris, `reminderLeadMinutes` 120, position du laboratoire), Merchant, Category, Product, MerchantPrice, Slot, Order (unique commerçant × date × créneau), OrderLine, RecurringOrder et lignes, Round, Stop, Invoice de période avec InvoiceLine et Payment, AuditLog ; gardés : InvoiceCounter, InvoiceReminder, SupportTicket, ClientNotification, DriverLocation, DriverPushSubscription, OperationJob, AuthLoginFailure. Exceptions à `companyId`, écrites en tête du schéma et testées : Role, Permission, RolePermission (référence plateforme), AuthLoginFailure, `User.companyId` vide pour le super-admin seulement. Montants en centimes ; TVA par ligne (5,5 % par défaut), Factur-X ventilé par taux. Migration unique `20261106200000_init` : 14 contraintes CHECK (quantité livrée entre 0 et la quantité commandée, format HH:MM, jours 1 à 7…), RLS sur les 30 tables. Super-admin sans permission sur les opérations courantes. Écrans de l'ancien modèle supprimés ; pages « à venir » à la place pour le portail, `/bakery`, `/driver` et le back-office (tableau de bord, commandes, tournées, clients, catalogue, factures). Données de démo (`prisma/seed.ts`, idempotent, environ 4 min) : 1 boulangerie, 7 catégories, 100 produits, 20 commerçants, 10 prix spécifiques, 3 créneaux, 11 comptes (1 super-admin, 1 admin, 1 boulanger, 5 livreurs, 3 clients), 135 commandes, 702 lignes, 47 tournées, 117 arrêts, 1 commande récurrente. Identifiants : `outputs/comptes-demo.md` (non versionné, droits 600).
  Vérifications : `prisma validate` ; `migrate deploy` sur annona-dev et `migrate diff` vide ; doublon de commande et quantité 0 refusés par la base ; seed lancé deux fois, résultat identique ; connexion réelle sur un serveur local : ADMIN → /dashboard, MERCHANT → /portal, BAKER → /bakery, DRIVER → /driver, SUPER_ADMIN → /admin, et les rôles hors administrateur sont renvoyés vers leur espace depuis le back-office ; `npm run check` relancé par l'orchestrateur : 623 tests, 623 réussis ; `npm run build` vert ; `ci:secrets` sans trouvaille ; conseiller Supabase : aucune table lisible par anon (seulement « RLS sans politique », voulu, et la protection des mots de passe divulgués, réservée à l'offre Pro).
  Reste : specs E2E non lancées (anciennes pages) ; un compte MERCHANT créé depuis /users n'est pas encore rattaché à un commerçant (ADM-1) ; libellé « livraisons » de l'admin plateforme qui compte des commandes (ADM-1) ; moniteur OPS-03B non appliqué (`docs/operations/ops03b/`).


- [x] **NET-1 — Nettoyer la base de l'ancien produit.**

  **Modèle conseillé : Claude Opus · effort élevé (suppression large).**

  Supprimer tout ce que liste `TRI-BASE.md` §2 : abonnements SaaS, prospection et vente, site public commercial et démo, inscription autonome, commandes par message (e-mail, WhatsApp, IA) en gardant les fonctions d'heure de Paris, lien de commande et suivi publics, messagerie de commande, affectation automatique mission par mission, signature et PDF de preuve, zones tarifaires, atelier de design, journal des accès plateforme, fichiers de l'ancien produit. Remettre `AGENTS.md`, `README.md`, `PRODUCT.md` et `docs/README.md` au nouveau produit (sans Drive, Notion ni `preproduction`).

  Terminé quand : plus aucun écran, route, domaine ni test de ces éléments ; `npm run check` vert ; `npm run build` vert.

  6 novembre 2026, fait (commit `f2b5cce`, sur `base`, sans push) : 482 fichiers supprimés, 757 touchés, environ 69 000 lignes retirées (SaaS, inscription, démo, site public, prospection, ventes, pilotes, liste d'attente, contact, commande par message et IA, liens publics, messagerie de commande, affectation automatique, PDF de preuve, zones tarifaires, atelier de design, `.impeccable`, `.playwright-cli`, `DESIGN.md`). `PRODUCT.md`, `AGENTS.md`, `README.md` et `docs/README.md` réécrits pour le nouveau produit. Déplacés : heure de Paris dans `src/lib/time/paris.ts` (test `tests/paris-time.test.ts`) ; contrôle d'accès aux commandes dans `src/domains/order/order-access.ts` et `src/lib/api/order-actor-auth.ts`. Gardés malgré TRI-BASE §2, car le calcul de tournées s'en sert : `driver-eligibility.ts` (sans les zones) et les pages `/dispatch` (sans l'affectation automatique). Supprimées avec la messagerie : alertes opérationnelles et `/admin/incidents`. `/` redirige vers `/login`. Prisma : 23 modèles restants.
  Vérifications : `npx prisma validate` et `generate` verts ; `npm run check` relancé par l'orchestrateur : 1 082 tests, 1 080 réussis, 0 échec, 2 désactivés (`db1-migration-security`, `fiabilite-fk-indexes` : comparent le schéma aux anciennes migrations, à réactiver en SCHEMA-1) ; `npm run build` vert sans connexion à la base ; `node scripts/docs/verify-docs.mjs` vert.
  Laissé pour SCHEMA-1 : `podSignature*`, enlèvement et arrêts multiples, missions spéciales, statuts INVOICED et PAID, rôles DISPATCHER et MINI_ADMIN, ligne de facture ZONE/FEE. Non vérifié : tests E2E (nettoyés, non lancés : plusieurs dépendent de la connexion démo supprimée, à reprendre après SCHEMA-1). À revoir plus tard : scripts d'exploitation qui visent `.env.preproduction.local`, `docs/legal/` qui décrit encore l'ancien produit.


## Journal

- 6 novembre 2026 : nouvelle TODO écrite à partir du cahier des charges développeur et de `docs/cahier-des-charges/TRI-BASE.md` ; projet Supabase `annona-dev` créé (Paris) après mise en pause de `tutelliv-dev`.
- 6 novembre 2026 : NET-1 close (`f2b5cce`) ; `.env.local` rempli par le propriétaire (connexion directe et clé `service_role` vérifiées).
- 6 novembre 2026 : SCHEMA-1 close (`c550335`) ; base annona-dev migrée et chargée.
- 7 novembre 2026 : CAT-1 (`7352aba`) et CMD-1 (`8f8ad1e`) closes.
