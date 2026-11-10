# Base de données Annona

État de référence : 6 novembre 2026 (SCHEMA-1). La définition actuelle est `prisma/schema.prisma`; ce document décrit les groupes fonctionnels et les règles de modification sans recopier chaque colonne.

## Modèles actuels

> 6 novembre 2026 (SCHEMA-1) : schéma propre du produit de commande et livraison B2B pour boulangerie (cahier des charges section 7, `docs/cahier-des-charges/TRI-BASE.md` §3 et §4), créé par une **migration initiale unique** `prisma/migrations/20261106200000_init` (RLS et révocation des droits `PUBLIC`, `anon`, `authenticated` sur toutes les tables, contraintes CHECK, rôles et permissions de référence). Les migrations historiques ont été supprimées (l'historique git les conserve). Le moniteur OPS-03B est conservé hors migrations dans `docs/operations/ops03b/`.

Conventions : toute table porte `company_id` indexé sauf `companies`, les données de référence globales (`roles`, `permissions`, `role_permissions`) et `auth_login_failures` ; `users.company_id` est vide pour le seul super-administrateur et `operation_jobs.company_id` pour une tâche de plateforme. Montants en centimes entiers (`*_cents`), TVA en points de base (550 = 5,5 %), heures « HH:MM » dans le fuseau de l'entreprise, dates de livraison et de période en `date`.

### Entreprise, comptes, rôles

- `Company` : nom, logo, heure limite `cutoffTime` (17:00), fuseau `Europe/Paris`, délai du rappel, laboratoire (départ des tournées), `settings` JSON pour le reste (PLA-04) ;
- `User` : identité liée à Supabase Auth, rôle (SUPER_ADMIN, ADMIN, BAKER, DRIVER, MERCHANT), commerçant représenté (`merchantId`) ;
- `Role`, `Permission`, `RolePermission` : RBAC (`prisma/reference-data.ts`).

### Commerçants, catalogue, créneaux

- `Merchant` : raison sociale, adresse et coordonnées GPS, consignes d'accès, contact, facturation (périodicité DAILY/WEEKLY/MONTHLY/YEARLY, mode de règlement) ;
- `Category`, `Product` (unité libre, prix de base, TVA, actif, allergènes et `allergensDeclared`, lot 1 D3), `MerchantPrice` (unique commerçant × produit) ;
- `DeliveryZone` (lot 1 D1) : tournée nommée avec une plage du matin et une plage du soir ; `Merchant.zoneId` ;
- `Slot` : créneaux de livraison, deux par tournée (MORNING, EVENING), tenus à jour depuis `DeliveryZone` ;
- `Promotion`, `PromotionMerchant` (lot 1 D2) : prix promo ou réduction en %, dernier jour, quantité limitée facultative, tous les clients ou certains ; arrêt par `stoppedAt`, jamais supprimée.

### Commandes et tournées

- `Order` : une par commerçant, date de livraison et créneau ; statut DRAFT → VALIDATED → LOCKED → PREPARED → DELIVERED (ou CANCELLED), origine MANUAL/RECURRING ;
- `OrderLine` : quantité commandée, quantité livrée (manquant), prix unitaire figé au verrouillage ; part promo retenue à la validation (`promotionId`, `promoQuantity`, `promoUnitPriceCents`) ;
- `RecurringOrder`, `RecurringOrderLine` : commande type par jours de la semaine (1 = lundi … 7 = dimanche) ;
- `Round`, `Stop` : tournée d'un livreur pour un jour et un créneau, arrêts ordonnés (un par commande), incident et photo.

### Factures et règlements

- `Invoice` : facture d'un commerçant par période, numéro continu (`InvoiceCounter`), montants HT/TVA/TTC, statut et mode de règlement ; regroupe des commandes (`Order.invoiceId`) ;
- `InvoiceLine`, `Payment`, `InvoiceReminder`.

### Exploitation

- `AuditLog` : journal avant/après des corrections (RG-10) ;
- `SupportTicket`, `SupportTicketMessage` : réclamations ;
- `ClientNotification`, `DriverLocation`, `DriverPushSubscription`, `OperationJob`, `AuthLoginFailure`.

Le schéma comprend 32 modèles Prisma. Données de démonstration : `npm run db:seed` (identifiants `demo_`, comptes dans `outputs/comptes-demo.md`, non versionné).

## Relations essentielles

```text
Company
├── User ── Role ── RolePermission ── Permission
├── Merchant ── MerchantPrice ── Product ── Category
├── Slot
├── Order ── OrderLine ── Product
│     ├── Stop ── Round ── (User livreur)
│     └── Invoice ── InvoiceLine / Payment / InvoiceReminder
├── RecurringOrder ── RecurringOrderLine
├── SupportTicket ── SupportTicketMessage
├── AuditLog
└── OperationJob
```

Les liens vers un commerçant, un livreur, une commande ou une tournée ne suffisent jamais seuls : l'entreprise doit aussi correspondre.

## Connexions

- `DATABASE_URL` est utilisée par l'application, y compris en développement. Avec Supabase serverless, elle vise normalement le pooler transactionnel.
- `DIRECT_URL` est réservée aux opérations Prisma qui exigent une connexion directe.
- `DATABASE_CONNECTION_LIMIT` borne le pool par instance entre 1 et 10, valeur par défaut 5.
- `DATABASE_CONNECTION_MODE=session` est une option pour un serveur local permanent ; le mode transactionnel reste le défaut documenté.

Ne jamais afficher ni archiver ces URL. Les sorties de tests ne doivent contenir ni hôte, ni utilisateur, ni mot de passe.

## Commandes et niveau de risque

```bash
npm run db:generate       # local : régénère le client Prisma
npm run db:studio         # lecture/édition manuelle selon les accès fournis
npm run db:push           # écrit le schéma sur la base
npm run db:sync-schema    # synchronisation spécifique au projet
npm run db:migrate        # crée/applique une migration de développement
npm run db:seed           # écrit rôles et permissions
```

Seule `db:generate` fait partie du travail local courant. Toutes les autres commandes exigent l'identification de la cible, une sauvegarde adaptée, une inspection du diff et une autorisation correspondant à l'opération.

## État des migrations et de la sécurité

Le dépôt contient dix-neuf migrations reproductibles, de la baseline initiale aux codes commerciaux (`prisma/migrations/`). Toutes sont appliquées uniquement à la préproduction autorisée. Les deux dernières, `20261027090000_contact_messages` puis `20261027120000_sales_codes`, l'ont été le 27 octobre 2026 par `prisma migrate deploy`, sur instruction du propriétaire, **avant** la fusion du code qui les lit. Contrôle après application : `prisma migrate diff` sans aucun écart, `migrate status` à jour, 39 tables applicatives, RLS active sur les 4 nouvelles, aucun droit public ni politique, et données existantes inchangées (3 brouillons d'inscription, 16 entreprises, 94 événements d'accès). Le contrôle en lecture seule du 26 octobre 2026 y avait retrouvé dix-sept migrations terminées, 35 tables applicatives, RLS active sur chacune et aucun droit direct public.

Retour arrière : une fois que le nouveau code a journalisé des accès `CONTACT_MESSAGES`, `SALES_CODES` ou `SALES_COMMISSIONS`, l'ancien code ne sait plus lire la liste des événements d'accès, car son client Prisma ignore ces valeurs d'énumération. Avant tout retour à une version antérieure, filtrer ces ressources ou attendre la purge à 90 jours ; les autres écrans ne sont pas concernés.

Les 39 tables ont RLS active et aucun droit direct pour `anon`, `authenticated` ou `PUBLIC` (toutes présentes en préproduction depuis le 27 octobre 2026). Prisma utilise une connexion serveur privilégiée ; l'isolation applicative reste donc obligatoire. `tests/db1-migration-security.test.ts` vérifie à chaque `npm run check` que toute table créée par migration a un modèle, active la RLS, retire tous les droits à `PUBLIC`, `anon` et `authenticated`, et qu'aucune politique ni aucun `GRANT` ne la rouvre. Ce test lit les fichiers de migration : l'état réel d'une base reste à auditer après application. Le catalogue SaaS actif et les entreprises historiques migrées en compatibilité `LEGACY` ne créent aucun abonnement payant implicite. Les brouillons d'inscription et événements de paiement restent eux aussi exclusivement accessibles par le serveur.

## Procédure d'évolution

1. Identifier l'environnement et vérifier qu'il ne contient pas de données réelles non autorisées.
2. Comparer `schema.prisma` à la cible sans appliquer de changement.
3. Préparer une migration additive et un retour arrière ou une stratégie de restauration.
4. Tester sur une cible isolée avec fixtures A/B.
5. Vérifier RLS, droits publics, index, contraintes et compatibilité des lignes existantes.
6. Exécuter les tests locaux, connectés et le build.
7. Consigner l'empreinte avant/après et le nettoyage ciblé.

Le contrôle en lecture seule se relance avec `npm run audit:db1`. La procédure de baseline, les écarts couverts et la stratégie de retour arrière sont détaillés dans `operations/db1/README.md`.

La préproduction, la baseline et la restauration fournisseur sont terminées. La sauvegarde récurrente hors site, les alertes et l'exercice périodique de restauration restent suivis dans OPS-03B.

## Export de sortie d'une entreprise

Le socle DATA-02 ajoute un export JSON versionné du graphe d'une entreprise dans `src/domains/data-lifecycle/company-export.service.ts`. Il exclut les identifiants Auth et les clés internes, et produit un manifeste des preuves privées à extraire séparément. La procédure et ses limites sont dans `operations/data02/README.md` ; aucune suppression générique d'entreprise existante n'est exposée.

### Photo d'incident (SCHEMA-1)

La signature et le PDF de preuve de l'ancien produit sont retirés. Seule reste la photo d'incident d'un arrêt (`stops.incident_photo_path`), dans le bucket privé `delivery-pods` sous `companyId/stopId-<horodatage>.jpg|png`. L'export (version 2) la liste dans `externalAssets.proofObjects` (`stopId`, `orderId`, `objectKey`) et l'archive la télécharge avec son empreinte SHA256. Aucune durée de conservation n'est encore validée.
