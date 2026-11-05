# DATA-02 — inventaire technique

Date : 2026-10-25. Inventaire des modèles Prisma observés. Aucune durée de conservation n'est choisie ici. Aucune suppression n'est décidée. Auth et Storage ne sont pas lus.

Classes : directe (activité de l'entreprise), indirecte (trace rattachée), plateforme (hors entreprise cliente), partagée (à la fois entreprise et plateforme), technique (mécanisme).

L'export existant est `exportCompanyData` dans `src/domains/data-lifecycle/company-export.service.ts`. Il filtre par `companyId`.

| Modèle | Classe | Clé d'isolation observée | Export entreprise |
| --- | --- | --- | --- |
| Company | directe | id | oui |
| User | partagée | companyId nullable | oui |
| ClientNotification | indirecte | userId | oui |
| CustomerAddress | directe | userId | oui |
| DriverLocation | directe | driverId | oui |
| Order | directe | companyId | oui |
| OrderItem | directe | orderId | oui |
| OrderStop | directe | orderId | oui |
| Delivery | directe | companyId | oui |
| TrackingEvent | directe | deliveryId | oui |
| RecurringOrder | directe | companyId | oui |
| OrderMessage | directe | orderId | oui |
| OrderThreadRead | indirecte | orderId | oui |
| Invoice | directe | companyId | oui |
| InvoiceCounter | directe | companyId | non |
| InvoiceReminder | indirecte | companyId | non |
| SupportTicket | directe | companyId | oui |
| SupportTicketMessage | directe | ticketId | oui |
| OperationJob | technique | companyId nullable | partiel |
| Role | plateforme | aucune, table globale | partiel |
| Permission | plateforme | aucune, table globale | non |
| RolePermission | plateforme | roleId | non |
| SignupJourney | partagée | companyId nullable | non |
| SignupPaymentEvent | plateforme | signupId | non |
| DemoPoolEnvironment | technique | companyId | non |
| SaasCatalogVersion | plateforme | aucune, catalogue global | non |
| SaasPlan | plateforme | catalogVersionId | partiel |
| SaasOption | plateforme | catalogVersionId | non |
| SaasSubscription | partagée | companyId | partiel |
| SaasPlanAssignment | partagée | subscriptionId | partiel |
| SaasSubscriptionItem | partagée | subscriptionId | partiel |
| SaasUsagePeriod | indirecte | companyId | oui |
| SaasUsageEvent | indirecte | companyId | non |
| SaasSeatReservation | indirecte | companyId | non |
| SaasBillingAccount | partagée | signupId | non |
| SaasBillingOperation | technique | accountId | non |
| PlatformAccessEvent | plateforme | actorId, sans companyId | non |
| ContactMessage | plateforme | aucune, prospect avant tout compte | non |
| WaitlistFunnelDaily | plateforme | aucune, compteurs anonymes par jour et campagne (page Tarifs) | non |
| SalesCode | plateforme | aucune, commercial de TutelLiv | non |
| SalesAttribution | plateforme | companyId | non |
| SalesCommissionEntry | plateforme | attributionId | non |
| AuthLoginFailure | technique | aucune, empreinte HMAC transitoire (15 min) | non |
| OrderIntakeUsage | indirecte | companyId | non |
| DriverPushSubscription | directe | userId, companyId | non |
| CompanyIntakeChannel | directe | companyId | non |
| OrderTrackingLink | directe | companyId, orderId | non |
| InboundOrderEmail | directe | companyId | non |
| CompanyCustomer | directe | companyId, userId | oui |

## Absents de l'export

Ces modèles ne sont pas dans `exportCompanyData` : DriverPushSubscription, CompanyIntakeChannel, OrderTrackingLink, InboundOrderEmail, SignupJourney, SignupPaymentEvent, DemoPoolEnvironment, Permission, RolePermission, SaasCatalogVersion, SaasOption, SaasUsageEvent, SaasSeatReservation, SaasBillingAccount, SaasBillingOperation, PlatformAccessEvent, ContactMessage, WaitlistFunnelDaily, SalesCode, SalesAttribution, SalesCommissionEntry, AuthLoginFailure, OrderIntakeUsage. Ils relèvent du catalogue global, de la plateforme, de mécanismes techniques ou transitoires, ou dupliquent des données déjà exportées (événements d'usage = commandes ; brouillon d'inscription = entreprise ; journal de la commande par message = compteurs d'appels et de jetons, sans texte).

Role et OperationJob n'y sont que partiels : le rôle est recopié par son nom sur l'utilisateur, le job est recopié sans sa charge ni son erreur.

Ajout du 2026-10-27, compatible avec la version 1 (`data.subscriptions`) : la souscription de l'entreprise, sans identifiants du fournisseur de paiement ni instantané interne ; l'historique des formules réduit au code et au nom de la formule ; les options et sièges sans instantané ; les périodes de consommation complètes. Compteurs `subscriptions`, `subscriptionPlans`, `subscriptionItems` et `usagePeriods`.

## Auth et Storage

Non lus pour cet inventaire. L'export exclut déjà les identifiants Auth. Les preuves photo sont des clés d'objets d'un bucket privé, listées à part, pas copiées par l'inventaire.

## Contrat d'export local

La preuve locale `npm run test:data02:export-contract` fige l'horloge et simule deux entreprises dont les références et les e-mails sont volontairement proches. Elle vérifie que chaque lecture actuelle est filtrée par `companyId`, que toutes les catégories déjà exportées restent isolées, comptées et ordonnées, et qu'une entreprise absente n'ouvre aucune lecture annexe.

Cette preuve ne change pas le contenu de l'export. Role reste limité au nom, au slug et au rôle système ; OperationJob reste sans charge ni erreur. Les modèles de plateforme, partagés ou techniques déjà absents restent absents. Auth et les objets Storage ne sont pas lus : seul le manifeste des clés de preuves déjà présent est contrôlé.

DATA-02 reste ouverte.
