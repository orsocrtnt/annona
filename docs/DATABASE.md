# Base de données TutelLiv

État de référence : 22 octobre 2026. La définition actuelle est `prisma/schema.prisma`; ce document décrit les groupes fonctionnels et les règles de modification sans recopier chaque colonne.

## Modèles actuels

### Identité et isolation

- `Company` : entreprise locataire, statut et réglages ;
- `User` : identité métier liée à Supabase Auth, entreprise, rôle et statut ;
- `Role`, `Permission`, `RolePermission` : RBAC ;
- `ClientNotification` : notifications intégrées au portail.

### Commande et livraison

- `Order`, `OrderItem`, `OrderStop` : commande, articles et collectes ordonnées ;
- `Delivery` : mission logistique, chauffeur, états, horaires, preuve et idempotence ;
- `DriverLocation`, `TrackingEvent` : dernière position autorisée et chronologie ;
- `OrderMessage`, `OrderThreadRead` : conversation liée à la commande et marqueurs de lecture ;
- `OperationJob` : auto-dispatch et notifications différées avec reprise.

### Offres et souscriptions SaaS

- `SaasCatalogVersion`, `SaasPlan`, `SaasOption` : catalogue commercial versionné et prix centralisés ;
- `SaasSubscription`, `SaasPlanAssignment`, `SaasSubscriptionItem` : souscription ou pilote par entreprise, historique d'offre, options et sièges supplémentaires ;
- `SaasUsagePeriod`, `SaasUsageEvent` : consommation mensuelle, dépassements et événements idempotents ;
- `SaasSeatReservation` : réservation atomique d'une place pendant une invitation concurrente.
- `SaasBillingAccount`, `SaasBillingOperation` : journal sandbox Stripe, commandes idempotentes et rapprochement.
- `SignupJourney`, `SignupPaymentEvent` : brouillon d'inscription autonome et événements de paiement idempotents.

### Client et exploitation

- `Invoice` : facturation de livraison séparée de l'état logistique ;
- `SupportTicket`, `SupportTicketMessage` : support client et historique ;
- `CustomerAddress` : carnet d'adresses client ;
- `RecurringOrder` : modèle et planification de commandes récurrentes.
- `DemoPoolEnvironment` : stock de démonstrations préconstruites, location exclusive et recyclage durable.
- `PlatformAccessEvent` : journal minimal et expirant des lectures de la supervision plateforme, sans relation ni donnée personnelle.
- `ContactMessage` : message du formulaire Contact public, lu par le super-administrateur ; l'adresse IP n'est jamais stockée, seulement une empreinte HMAC pour limiter le débit.

Le schéma comprend 36 modèles Prisma. Les anciens enum `INVOICED` et `PAID` existent encore dans les statuts commande/livraison pour compatibilité historique ; les services courants refusent de les utiliser comme transitions logistiques.

## Relations essentielles

```text
Company
├── User ── Role ── RolePermission ── Permission
├── SaasSubscription
│     ├── SaasPlanAssignment ── SaasPlan ── SaasCatalogVersion
│     ├── SaasSubscriptionItem ── SaasOption
│     ├── SaasUsagePeriod ── SaasUsageEvent
│     └── SaasSeatReservation
├── Order ── OrderItem / OrderStop / OrderMessage
│     ├── Delivery ── DriverLocation / TrackingEvent
│     └── Invoice
├── SupportTicket ── SupportTicketMessage
├── RecurringOrder
├── OperationJob
└── DemoPoolEnvironment
```

Les liens vers un client, un chauffeur, une commande ou une livraison ne suffisent jamais seuls : l'entreprise doit aussi correspondre.

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

Le dépôt contient dix-huit migrations reproductibles, de la baseline initiale aux messages Contact (`prisma/migrations/`). Les dix-sept premières ont été appliquées uniquement à la préproduction autorisée ; `20261027090000_contact_messages` n'est appliquée nulle part tant que la branche n'est pas fusionnée (validée sur PostgreSQL local jetable : zéro écart, RLS active, aucun droit public). Le contrôle en lecture seule du 26 octobre 2026 y retrouve dix-sept migrations terminées, 35 tables applicatives, RLS active sur chacune et aucun droit direct public.

Les 35 tables ont RLS active et aucun droit direct pour `anon`, `authenticated` ou `PUBLIC`. Prisma utilise une connexion serveur privilégiée ; l'isolation applicative reste donc obligatoire. Toute nouvelle table doit être auditée de nouveau. Le catalogue SaaS actif et les entreprises historiques migrées en compatibilité `LEGACY` ne créent aucun abonnement payant implicite. Les brouillons d'inscription et événements de paiement restent eux aussi exclusivement accessibles par le serveur.

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
