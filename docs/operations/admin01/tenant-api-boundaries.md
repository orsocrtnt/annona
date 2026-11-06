# Frontières des API d'entreprise

Inventaire du 2026-10-25. Il recense les `route.ts` hors `src/app/api/admin` qui appellent `getCompanyId`. Il décrit la permission et le `requireRole` écrits dans la méthode, ou dans une fonction du même fichier appelée par cette méthode. Il n'ajoute aucune garde et ne choisit aucun rôle.

44 fichiers, 63 méthodes (compte vérifié par `tests/admin01-tenant-api-boundary-inventory.test.ts` ; 6 novembre 2026, retrait des routes de l'ancien produit : abonnements, tarifs, commande par message, liens publics).

Limite : une entreprise résolue sans `getCompanyId` dans la route n'est pas listée. C'est le cas de `orderActorAuth` et de `requireSupportStaff`. Un refus écrit par comparaison directe du rôle, sans `requireRole`, est noté « aucun ».

<!-- TENANT_API_BOUNDARIES_START -->
| Chemin | Méthode | Permission | Rôles |
| --- | --- | --- | --- |
| src/app/api/back-office/analytics/route.ts | GET | analytics:read | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/back-office/courier-statements/route.ts | GET | drivers:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/back-office/dashboard/route.ts | GET | orders:read | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/clients/[id]/route.ts | GET | orders:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/clients/route.ts | GET | orders:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/company/billing-settings/route.ts | GET | settings:read | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/billing-settings/route.ts | PATCH | settings:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/clients/[id]/invoice-identity/route.ts | GET | settings:read | COMPANY_ADMIN |
| src/app/api/company/clients/[id]/invoice-identity/route.ts | PUT | settings:update | COMPANY_ADMIN |
| src/app/api/company/delivery-slots/route.ts | GET | settings:read | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/delivery-slots/route.ts | PATCH | settings:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/dispatch/route.ts | GET | settings:read ou deliveries:dispatch | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/company/dispatch/route.ts | PATCH | settings:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/einvoicing/route.ts | GET | settings:read | COMPANY_ADMIN |
| src/app/api/company/einvoicing/route.ts | PATCH | settings:update | COMPANY_ADMIN |
| src/app/api/company/location-settings/route.ts | GET | settings:read ou deliveries:dispatch | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/company/location-settings/route.ts | PATCH | settings:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/logo/route.ts | GET | aucun | aucun |
| src/app/api/company/logo/route.ts | POST | settings:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/logo/route.ts | DELETE | settings:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/portal-settings/route.ts | GET | settings:read | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/portal-settings/route.ts | PATCH | settings:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/proof-rules/route.ts | GET | settings:read | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/proof-rules/route.ts | PATCH | settings:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/settings/route.ts | GET | settings:read | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/company/settings/route.ts | PATCH | settings:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/deliveries/[id]/assign/route.ts | PATCH | deliveries:dispatch | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/deliveries/[id]/proof/[kind]/route.ts | GET | deliveries:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/deliveries/[id]/route.ts | GET | deliveries:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/deliveries/[id]/route.ts | PATCH | deliveries:update | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/deliveries/route.ts | GET | deliveries:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/dispatch/drivers-locations/route.ts | GET | deliveries:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/dispatch/drivers-map/route.ts | GET | deliveries:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/dispatch/drivers-workload/route.ts | GET | deliveries:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/dispatch/incidents/route.ts | GET | deliveries:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/dispatch/map/route.ts | GET | deliveries:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/dispatch/overview/route.ts | GET | deliveries:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/dispatch/rounds/route.ts | GET | deliveries:dispatch | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/dispatch/rounds/route.ts | POST | deliveries:dispatch | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/drivers/[id]/route.ts | GET | drivers:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/drivers/route.ts | GET | drivers:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/invoices/[id]/pdf/route.ts | GET | invoices:read | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/invoices/[id]/reminders/route.ts | POST | invoices:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/invoices/export/route.ts | GET | invoices:read | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/invoices/route.ts | GET | invoices:read | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/invoices/unissued/route.ts | GET | invoices:read | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/onboarding/route.ts | GET | settings:read | COMPANY_ADMIN |
| src/app/api/onboarding/route.ts | PATCH | settings:update | COMPANY_ADMIN |
| src/app/api/operations/jobs/route.ts | GET | deliveries:dispatch | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/operations/jobs/route.ts | POST | deliveries:dispatch | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/orders/[id]/invoice/route.ts | POST | invoices:create | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/orders/[id]/invoice/route.ts | PATCH | invoices:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/orders/[id]/route.ts | GET | orders:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/orders/[id]/route.ts | PATCH | orders:update | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/orders/[id]/route.ts | DELETE | orders:update | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/orders/create-options/route.ts | GET | orders:create | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/orders/create/route.ts | POST | orders:create | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/orders/dashboard/route.ts | GET | orders:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/orders/export/route.ts | GET | orders:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/orders/route.ts | GET | orders:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/orders/stats/route.ts | GET | orders:read | COMPANY_ADMIN, MINI_ADMIN, DISPATCHER |
| src/app/api/users/[id]/route.ts | PATCH | users:update | COMPANY_ADMIN, MINI_ADMIN |
| src/app/api/users/[id]/route.ts | DELETE | users:delete | COMPANY_ADMIN, MINI_ADMIN |
<!-- TENANT_API_BOUNDARIES_END -->

Logo d'entreprise (2026-10-27) : `GET /api/company/logo` n'exige qu'une session (`requireAuth`), car l'équipe et les clients affichent le logo de leur propre entreprise sur les factures. L'entreprise vient toujours de la session (`getCompanyId`), jamais d'un paramètre ; la réponse ne contient que l'image ou `{ hasLogo }`. L'envoi et le retrait restent réservés à `settings:update` et aux rôles `COMPANY_ADMIN`, `MINI_ADMIN`.

## Frontières indirectes

Ces routes n'appellent pas `getCompanyId`. Elles passent par un garde partagé déjà en place. Cette section ne modifie aucun rôle.

`orderActorAuth` autorise uniquement `COMPANY_ADMIN`, `MINI_ADMIN`, `DISPATCHER`, `DRIVER` et `CLIENT`. `SUPER_ADMIN` est exclu.

`requireSupportStaff` autorise uniquement `COMPANY_ADMIN`, `MINI_ADMIN` et `DISPATCHER`. `SUPER_ADMIN` est exclu. Un `MINI_ADMIN` sans `support:read` reste refusé avant l'entreprise.

`requireDispatchSettingsReader` (DISPATCHER-403, 29 octobre 2026) protège la lecture des réglages d'assignation (`company/dispatch`, `company/tariffs`, `company/location-settings`) : `COMPANY_ADMIN` et `MINI_ADMIN` avec `settings:read`, ou `DISPATCHER` avec `deliveries:dispatch`. `SUPER_ADMIN` est exclu ; un `MINI_ADMIN` sans `settings:read` reste refusé. L'écriture de ces réglages reste `settings:update` pour `COMPANY_ADMIN` et `MINI_ADMIN`.

<!-- INDIRECT_COMPANY_BOUNDARIES_START -->
| Chemin | Méthode | Garde |
| --- | --- | --- |
| src/app/api/support/[id]/route.ts | GET | requireSupportStaff |
| src/app/api/support/[id]/route.ts | POST | requireSupportStaff |
| src/app/api/support/[id]/route.ts | PATCH | requireSupportStaff |
| src/app/api/support/route.ts | GET | requireSupportStaff |
| src/app/api/tracking/[id]/route.ts | GET | orderActorAuth |
<!-- INDIRECT_COMPANY_BOUNDARIES_END -->
