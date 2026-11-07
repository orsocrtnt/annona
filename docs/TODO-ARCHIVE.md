# Archive de la TODO Annona (commande et livraison B2B)

Tâches closes et journal du nouveau produit. L'archive de l'ancien produit (coursier) reste dans l'historique git : `git show 0475b8d:docs/TODO-ARCHIVE.md`.

## Tâches closes

- [x] **FACT-1 — Factures par période.**

  **Modèle conseillé : Claude Opus · effort élevé (montants, numérotation).**

  CLI-10, ADM-10, RG-06, RG-07, ENF-05 : une facture par commerçant et par période (jour, semaine, mois, année) sur les quantités livrées, numérotation continue, PDF et Factur-X conservés, envoi, règlements saisis (virement, prélèvement, espèces), téléchargement côté commerçant.

  Terminé quand : critère 9 testé ; PDF relu ; `npm run check` vert.

  7 novembre 2026, fait (commit `95984de`, sans push, sans migration). Une facture par client et par période (jour, semaine ISO, mois, année ; date lue à Paris) sur les commandes livrées non facturées, au prix figé et à la quantité livrée, TVA par taux, centimes ; numérotation continue réservée dans la transaction ; idempotent, une commande sur une seule facture. Cron `/api/cron/billing` (périodes terminées, retards compris) ; `cron-daily.yml` n'appelle plus que lui ; bouton « Générer les factures » (périodicité, client facultatif). Mentions légales lues dans les paramètres de l'entreprise, jamais inventées : celles qui manquent sont listées à l'admin avec un lien vers le champ ; échéance 30 jours et indemnité de 40 € produites par l'application. PDF de facture, relevé PDF côté client, Factur-X conservé (règlements partiels pris en compte), export CSV comptable. Envoi par e-mail avec PDF par la file existante ; sans clé Resend : « Non envoyée », bouton « Renvoyer ». Règlements (montant, date, mode, référence rangée dans `Payment.note`), statut calculé, trop-perçu refusé, suppression journalisée. Portail : factures filtrées par jour, semaine, mois, année, PDF et relevé (390 px). Choix : commande facturée non corrigeable (409, renvoi vers un avoir, pas d'écran d'avoir) ; livraison tardive → facture complémentaire ; TVA lue sur le produit au moment de la facture (non figée sur la ligne de commande).
  Vérifications : `tests/fact1-invoices.test.ts` (17 tests : critère 9, bornes et changements d'heure, numérotation concurrente, idempotence, règlements, droits, isolation, Factur-X) ; Playwright `tests/e2e/fact1-recette.spec.ts` cliqué 6/6 : critère 9 (61,00 € HT → 55,90 € HT, 58,97 € TTC après 6 croissants manquants), deux générations simultanées → une facture ; PDF `outputs/recette-fact1/` relus (signe « − » et mentions en page 2 corrigés ; facture réglée relue par l'orchestrateur : calculs justes) ; données E2E-FACT1 supprimées, compteur de factures remis à zéro (aucune facture avant l'essai : la prochaine portera le n° 1) ; `npm run check` relancé par l'orchestrateur : 705/705 ; `npm run build` vert.
  Reste : envoi réel non testé (clé Resend) ; pas d'écran d'avoir ; TVA non figée sur la ligne ; cron de facturation testé en unitaire seulement (pas lancé sur la démo pour ne pas facturer ses 117 commandes livrées) ; sections anciennes de `docs/FACTURX.md` à reprendre.

- [x] **TOUR-1 — Tournées : administrateur et livreur.**

  **Modèle conseillé : Claude Opus · effort élevé (hors réseau, ordre des arrêts).**

  ADM-04, ADM-06 à ADM-08, LIV-01 à LIV-06 : tournée par créneau calculée avec le calcul existant, réordonner, déplacer un arrêt, changer de livreur, attribution ; suivi en direct ; côté livreur : arrêts dans l'ordre (colis, consignes), liste de chargement, « Livré » en un appui, arrêt suivant puis « Ouvrir dans Plans », « Ouvrir dans Waze », « Y aller seul » ; problème avec commentaire et photo ; hors réseau avec la file existante.

  Terminé quand : critères 6, 7 et 8 vérifiés (dont un « livré » hors réseau resynchronisé, cliqué dans le navigateur).

  7 novembre 2026, fait (commit `9854b6c`, sans push, sans migration). Admin : `/dashboard/rounds` (tournées par créneau, carte avec une couleur par tournée, glisser-déposer avec repli haut/bas, déplacement d'un arrêt vers une tournée du même créneau, tournée vide créée après l'heure limite ou supprimée, « Recalculer l'ordre », attribution d'un livreur, « Valider les tournées » qui les rend visibles au livreur et lui envoie un push par la file DRIVER_NOTIFICATION, journal « RoundDay » affiché) ; `/dashboard` (commandes du jour, livrés, restants, incidents avec photo, carte, rafraîchi toutes les 15 s ; position du livreur seulement pendant une tournée démarrée, effacée à la fin). Livreur `/driver` : tournées validées seulement, arrêts dans l'ordre (un colis par ligne de commande, articles à part), consignes, liste de chargement dans l'ordre inverse de la livraison, « Démarrer » le jour même seulement, « Livré » en un appui (heure du téléphone, ramenée à celle du serveur si incohérente ; quantités livrées figées), arrêt suivant puis Plans / Waze / « Y aller seul », problème avec motif, commentaire et photo JPEG ; démarrer, livré et problème passent par la file hors réseau, rejeu sans doublon côté serveur, bannière et badge « en attente ». `/api/cron/lock-orders?date=` force un reverrouillage (recette locale, refusé en production). `src/lib/pod/codes.ts` supprimé.
  Vérifications : `tests/tour1-rounds.test.ts` (16 tests : numérotation sans trou, attribution, droits, isolation, « Livré » idempotent, rejeu avec réponse perdue, incident, journal, liens Plans/Waze, position) ; Playwright `tests/e2e/tour1-recette.spec.ts` cliqué 5/5 sans erreur de console : critère 6 (le livreur voit le nouvel ordre au rechargement), critère 7 (2 appuis depuis « Livré » jusqu'à Plans), critère 8 (hors réseau : « 1 action en attente », puis l'admin voit « 2 / 3 livrés » et l'incident avec photo) ; données E2E-TOUR1 supprimées et vérifiées, stockage compris ; captures `outputs/recette-tour1/` (menu de navigation relu par l'orchestrateur) ; `npm run check` relancé par l'orchestrateur : 688/688 ; `npm run build` vert.
  Reste : environ 520 ms par requête depuis New York vers la base à Paris (écrans en 1 à 7 s en local ; à mesurer une fois hébergé en Europe) ; le service worker ne met rien en cache (recharger la page hors réseau échoue, la file tient) : MOBILE-1 ; push non vérifié sur un vrai téléphone ; mode sombre et glisser-déposer au doigt non relus.

- [x] **BOU-1 — Espace boulanger.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  BOU-01 à BOU-06 : total à produire par produit, détail par commerçant, groupement par tournée dans l'ordre de chargement, impression des bons et étiquettes, case « préparée », manquant ou quantité réduite reporté sur la quantité livrée.

  Terminé quand : critère 5 testé ; impression vérifiée dans le navigateur (format tablette).

  7 novembre 2026, fait (commit `f652f6a`, sans push). `/bakery` (tablette, demain par défaut) : total à produire par produit et catégorie (commandes verrouillées ; total provisoire marqué avant l'heure limite), bons par client, vue par tournée dans l'ordre de chargement (inverse de la livraison, expliqué à l'écran), impression A4 des bons et des étiquettes (nombre de colis saisi à l'impression, non enregistré), « préparée » annulable, manquant qui réduit la quantité livrée sans jamais dépasser la commande, journalisé et visible par l'admin. Routes `/api/production` réservées au boulanger.
  Vérifications : 8 tests (critère 5, manquant, droits, isolation) ; Playwright cliqué : total à 10, « préparée », 8 livrés sur 10, impression, manquant vu par l'admin ; aucune erreur de console ; captures tablette 1024 px et PDF A4 dans `outputs/recette-lock1-bou1/` (capture des totaux relue par l'orchestrateur) ; `npm run check` 672/672 ; `npm run build` vert. Code de « préparée » relu par l'orchestrateur : état voulu envoyé (pas une bascule), sans effet si déjà dans cet état.
  Reste : au premier passage du test, une commande « préparée » est restée « verrouillée » côté admin (lecture trop tôt du test probablement ; deux passages suivants verts) ; mode sombre et impression papier réelle non relus.

- [x] **LOCK-1 — Heure limite, verrouillage et consolidation.**

  **Modèle conseillé : Claude Opus · effort élevé (heures de Paris, tâche planifiée).**

  RG-01, RG-04, RG-09, RG-10, ADM-05 : refus côté serveur à partir de 17h00:00 heure de Paris (paramétrable) ; tâche planifiée qui verrouille, fige les prix, génère les récurrentes seulement sans commande manuelle, calcule les totaux et les tournées du lendemain ; correction administrateur après l'heure limite journalisée (qui, quand, avant, après).

  Terminé quand : tests des critères 2 (16h59 modifiable, 17h00 verrouillée, changements d'heure compris) et 4 ; tâche idempotente testée.

  7 novembre 2026, fait (commit `c68f6fd`, sans push, sans migration). `lockDeliveryDate` (`src/domains/order/order-lock.service.ts`) : rien avant J−1 à l'heure limite ; ensuite génère les récurrentes, passe les commandes validées en verrouillées, fige les prix (`resolveUnitPrice`), crée les tournées brouillon par créneau sans livreur depuis le laboratoire (`round-generation.ts`). Idempotent : verrou PostgreSQL par entreprise et par date, ligne de journal « date traitée ». Déclenchement : `/api/cron/lock-orders` (secret des crons ; aujourd'hui et demain pour chaque entreprise ; `?now=` pour la recette, refusé en production), `.github/workflows/cron-lock-orders.yml` toutes les 10 min, cron Vercel quotidien 16 h 05 UTC, et appel paresseux `ensureDateLocked` à l'ouverture des écrans commandes et boulanger. `/dashboard/orders` : commandes par jour, filtres client et tournée, correction (quantités, lignes, annulation) journalisée avec motif, historique affiché. Choix : toute commande manuelle du jour (tout créneau, annulée ou brouillon comprise) bloque la récurrente, pour éviter une double livraison ; une tournée existante n'est jamais recalculée (commande verrouillée tardive ajoutée en fin de tournée brouillon sans livreur, sinon tournée « complément ») ; corrections avant l'heure limite journalisées aussi.
  Vérifications : 19 tests (critère 2 dont le 25 octobre, critère 4, idempotence, prix figés, tournées par créneau, journal, droits, isolation) ; Playwright `tests/e2e/lock1-bou1-recette.spec.ts` cliqué : commande pour demain → cron avec heure simulée → « Verrouillée » → correction admin 12 → 10 avec journal ; données E2E-LOCK1 supprimées et vérifiées ; `npm run check` relancé par l'orchestrateur : 672/672 ; `npm run build` vert. Garde `?now=` relue par l'orchestrateur.
  À savoir : les commandes de démo du 7 novembre ont été réellement verrouillées sur annona-dev, avec leurs tournées brouillon. `cron-daily.yml` appelle encore deux routes supprimées par NET-1 (repris dans FACT-1).

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
- 7 novembre 2026 : LOCK-1 (`c68f6fd`) et BOU-1 (`f652f6a`) closes.
- 7 novembre 2026 : TOUR-1 close (`9854b6c`).
- 7 novembre 2026 : FACT-1 close (`95984de`).
