# Archive de la TODO Annona (commande et livraison B2B)

Tâches closes et journal du nouveau produit. L'archive de l'ancien produit (coursier) reste dans l'historique git : `git show 0475b8d:docs/TODO-ARCHIVE.md`.

## Tâches closes

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
