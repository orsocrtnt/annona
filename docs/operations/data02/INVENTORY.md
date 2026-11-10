# DATA-02 — inventaire technique

Date : 2026-10-25, mis à jour le 2026-11-06 (SCHEMA-1, modèle boulangerie, export version 2). Inventaire des modèles Prisma observés. Aucune durée de conservation n'est choisie ici. Aucune suppression n'est décidée. Auth et Storage ne sont pas lus.

Classes : directe (activité de l'entreprise), indirecte (trace rattachée), plateforme (hors entreprise cliente), partagée (à la fois entreprise et plateforme), technique (mécanisme).

L'export existant est `exportCompanyData` dans `src/domains/data-lifecycle/company-export.service.ts`. Il filtre par `companyId`.

| Modèle | Classe | Clé d'isolation observée | Export entreprise |
| --- | --- | --- | --- |
| Company | directe | id | oui |
| User | partagée | companyId nullable (super-administrateur) | oui |
| Merchant | directe | companyId | oui |
| Category | directe | companyId | oui |
| Product | directe | companyId | oui |
| MerchantPrice | directe | companyId | oui |
| DeliveryZone | directe | companyId | oui |
| Slot | directe | companyId | oui |
| Order | directe | companyId | oui |
| OrderLine | directe | companyId | oui |
| RecurringOrder | directe | companyId | oui |
| RecurringOrderLine | directe | companyId | oui |
| Round | directe | companyId | oui |
| Stop | directe | companyId | oui |
| Invoice | directe | companyId | oui |
| InvoiceLine | directe | companyId | oui |
| Payment | directe | companyId | oui |
| InvoiceCounter | directe | companyId | non |
| InvoiceReminder | indirecte | companyId | non |
| AuditLog | directe | companyId | oui |
| SupportTicket | directe | companyId | oui |
| SupportTicketMessage | directe | companyId | oui |
| ClientNotification | indirecte | companyId, userId | oui |
| DriverLocation | directe | companyId, driverId | oui |
| DriverPushSubscription | directe | companyId, userId | non |
| OperationJob | technique | companyId nullable | partiel |
| Role | plateforme | aucune, table globale | partiel |
| Permission | plateforme | aucune, table globale | non |
| RolePermission | plateforme | roleId | non |
| AuthLoginFailure | technique | aucune, empreinte HMAC transitoire (15 min) | non |

## Absents de l'export

Ces modèles ne sont pas dans `exportCompanyData` : DriverPushSubscription, Permission, RolePermission, AuthLoginFailure, InvoiceCounter, InvoiceReminder. Ils relèvent du catalogue global, de mécanismes techniques ou transitoires, ou dupliquent des données déjà exportées.

Role et OperationJob n'y sont que partiels : le rôle est recopié par son nom sur l'utilisateur, le job est recopié sans sa charge ni son erreur.


## Auth et Storage

Non lus pour cet inventaire. L'export exclut déjà les identifiants Auth. Les photos d'incident des arrêts sont des clés d'objets d'un bucket privé, listées à part, pas copiées par l'inventaire.

## Contrat d'export local

La preuve locale `npm run test:data02:export-contract` fige l'horloge et simule deux entreprises dont les références et les e-mails sont volontairement proches. Elle vérifie que chaque lecture actuelle est filtrée par `companyId`, que toutes les catégories déjà exportées restent isolées, comptées et ordonnées, et qu'une entreprise absente n'ouvre aucune lecture annexe.

Cette preuve ne change pas le contenu de l'export. Role reste limité au nom, au slug et au rôle système ; OperationJob reste sans charge ni erreur. Les modèles de plateforme, partagés ou techniques déjà absents restent absents. Auth et les objets Storage ne sont pas lus : seul le manifeste des clés de preuves déjà présent est contrôlé.

DATA-02 reste ouverte.
