# Contrôle d'accès Annona

État de référence : 16 octobre 2026.

## Rôles système

| Rôle | Espace principal | Périmètre |
|---|---|---|
| `SUPER_ADMIN` | `/admin` | plateforme ; peut être sans entreprise |
| `COMPANY_ADMIN` | `/dashboard` | administration complète de son entreprise |
| `MINI_ADMIN` | `/dashboard` | modules explicitement délégués dans son entreprise |
| `DISPATCHER` | `/dispatch` | exploitation et affectation dans son entreprise |
| `DRIVER` | `/driver` | missions auxquelles il est actuellement autorisé |
| `CLIENT` | `/portal` | ses commandes, livraisons, factures et tickets |

La hiérarchie facilite certains affichages, mais une valeur plus élevée n'accorde pas automatiquement toutes les permissions. Les gardes utilisent les rôles admis et les permissions requises.

## Permissions

Le format est `{ressource}:{action}`. Les ressources déclarées sont : `users`, `companies`, `deliveries`, `orders`, `drivers`, `vehicles`, `analytics`, `settings`, `dashboard`, `invoices` et `support`.

Les permissions exactes et leurs affectations initiales se trouvent dans `prisma/seed.ts`. Un mini-administrateur reçoit seulement les modules choisis par l'administrateur principal ; l'absence de réglage n'accorde rien.

## Défenses appliquées

1. `src/middleware.ts` (runtime Node) maintient la session Supabase et, avant tout rendu de page (RSC et préchargements compris), relit en base rôle, permissions, modules mini-admin, compte et entreprise : mauvais espace → 307 vers l'accueil du rôle, aucun écran ouvert → 403, compte indisponible → connexion (AUTH-ROLE).
2. `src/lib/permissions/page-access.ts` est la table unique des pages protégées (segments → rôles, permissions, modules mini-admin) et des accueils par rôle.
3. Les gardes API résolvent l'utilisateur courant et refusent compte/entreprise suspendus.
4. Chaque service ajoute les frontières d'entreprise et de ressource.
5. Les composants masquent les actions indisponibles pour éviter une fausse affordance.

Le niveau 5 améliore l'expérience ; seuls les niveaux serveur protègent les données.

## Règles particulières

- Le super-administrateur est le seul rôle de plateforme.
- Seul un administrateur principal ou super-administrateur gère la délégation mini-admin ; un mini-admin ne peut pas augmenter ses propres droits.
- Le support interne accepte `COMPANY_ADMIN`, `DISPATCHER` et `MINI_ADMIN`; ce dernier doit avoir `support:read`.
- Les factures utilisent `invoices:read/create/update`, séparées des permissions de commande.
- Un client doit appartenir à la commande et à l'entreprise ; une correspondance d'e-mail seule n'autorise rien.
- Un chauffeur est réévalué après réaffectation. Une ancienne affectation ne conserve pas l'accès aux messages, au suivi ou à la preuve.
- Les fichiers de preuve restent privés ; une URL signée n'est créée qu'après autorisation.

## Ajouter ou modifier un accès

1. Définir la permission dans `prisma/seed.ts` et, si nécessaire, la ressource/action dans `src/lib/permissions/rbac.ts`.
2. Mettre à jour la garde de route et la garde API.
3. Ajouter les filtres `companyId` et ressource dans le service, avant toute lecture ou écriture.
4. Adapter la navigation et l'interface.
5. Tester autorisation légitime, rôle voisin, entreprise B, ressource réaffectée et compte suspendu.
6. Si la base change, suivre `DATABASE.md` et vérifier RLS/droits publics.

Les recettes de référence sont les tests `account-access`, `mini-admin`, `permissions`, `tenant-boundaries` et la suite connectée TEST-2.
