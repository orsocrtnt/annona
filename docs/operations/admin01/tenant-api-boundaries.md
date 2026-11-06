# Frontières des API d'entreprise

Inventaire du 2026-10-25. Il recense les `route.ts` hors `src/app/api/admin` qui appellent `getCompanyId`. Il décrit la permission et le `requireRole` écrits dans la méthode, ou dans une fonction du même fichier appelée par cette méthode. Il n'ajoute aucune garde et ne choisit aucun rôle.

7 fichiers, 13 méthodes (compte vérifié par `tests/admin01-tenant-api-boundary-inventory.test.ts`). 6 novembre 2026 : retrait des routes de l'ancien produit (NET-1), puis des routes coursier et passage aux cinq rôles SUPER_ADMIN, ADMIN, BAKER, DRIVER, MERCHANT (SCHEMA-1).

Limite : une entreprise résolue sans `getCompanyId` dans la route n'est pas listée. C'est le cas de `requireSupportStaff`. Un refus écrit par comparaison directe du rôle, sans `requireRole`, est noté « aucun ».

<!-- TENANT_API_BOUNDARIES_START -->
| Chemin | Méthode | Permission | Rôles |
| --- | --- | --- | --- |
| src/app/api/company/billing-settings/route.ts | GET | settings:read | ADMIN |
| src/app/api/company/billing-settings/route.ts | PATCH | settings:update | ADMIN |
| src/app/api/company/einvoicing/route.ts | GET | settings:read | ADMIN |
| src/app/api/company/einvoicing/route.ts | PATCH | settings:update | ADMIN |
| src/app/api/company/location-settings/route.ts | GET | settings:read | ADMIN |
| src/app/api/company/location-settings/route.ts | PATCH | settings:update | ADMIN |
| src/app/api/company/logo/route.ts | GET | aucun | aucun |
| src/app/api/company/logo/route.ts | POST | settings:update | ADMIN |
| src/app/api/company/logo/route.ts | DELETE | settings:update | ADMIN |
| src/app/api/invoices/[id]/pdf/route.ts | GET | invoices:read | ADMIN |
| src/app/api/operations/jobs/route.ts | GET | settings:read | ADMIN |
| src/app/api/operations/jobs/route.ts | POST | settings:read | ADMIN |
| src/app/api/users/[id]/route.ts | DELETE | users:delete | ADMIN |
<!-- TENANT_API_BOUNDARIES_END -->

Logo d'entreprise (2026-10-27) : `GET /api/company/logo` n'exige qu'une session (`requireAuth`), car l'équipe et les clients affichent le logo de leur propre entreprise sur les factures. L'entreprise vient toujours de la session (`getCompanyId`), jamais d'un paramètre ; la réponse ne contient que l'image ou `{ hasLogo }`. L'envoi et le retrait restent réservés à `settings:update` et au rôle `ADMIN`.

## Frontières indirectes

Ces routes n'appellent pas `getCompanyId`. Elles passent par un garde partagé déjà en place. Cette section ne modifie aucun rôle.

`requireSupportStaff` autorise uniquement `ADMIN` avec `support:read`. `SUPER_ADMIN` est exclu, et un compte sans `support:read` reste refusé avant l'entreprise.

<!-- INDIRECT_COMPANY_BOUNDARIES_START -->
| Chemin | Méthode | Garde |
| --- | --- | --- |
| src/app/api/support/[id]/route.ts | GET | requireSupportStaff |
| src/app/api/support/[id]/route.ts | POST | requireSupportStaff |
| src/app/api/support/[id]/route.ts | PATCH | requireSupportStaff |
| src/app/api/support/route.ts | GET | requireSupportStaff |
<!-- INDIRECT_COMPANY_BOUNDARIES_END -->
