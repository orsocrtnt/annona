# Archive de la TODO Annona (commande et livraison B2B)

Tâches closes et journal du nouveau produit. L'archive de l'ancien produit (coursier) reste dans l'historique git : `git show 0475b8d:docs/TODO-ARCHIVE.md`.

## Tâches closes

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
