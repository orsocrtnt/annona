# Contrôle d'accès Annona

État de référence : 16 octobre 2026.

## Rôles système

Mise à jour ADM-1 (7 novembre 2026) : les cinq rôles du cahier des charges (section 3).

| Rôle | Espace principal | Périmètre |
|---|---|---|
| `SUPER_ADMIN` | `/admin`, `/companies` | plateforme : créer, configurer, suspendre une entreprise (PLA-02) ; sans entreprise ; ne voit ni commandes ni clients |
| `ADMIN` | `/dashboard`, `/users`, `/settings` | administration complète de son entreprise (clients, comptes, catalogue, commandes, tournées, factures, paramètres) |
| `BAKER` | `/bakery` | production de son entreprise |
| `DRIVER` | `/driver` | ses tournées validées |
| `MERCHANT` (« client ») | `/portal` | les commandes, factures et réclamations du client auquel le compte est rattaché (`User.merchantId`) |

Un compte désactivé (`INACTIVE`) ou une entreprise suspendue (`SUSPENDED`) n'a plus de session : connexion refusée, chaque page et chaque appel d'API refusés dès la requête suivante (`isAccountActive`, relu en base). Un compte client est toujours rattaché à un client de la même entreprise. L'entreprise garde au moins un administrateur actif. Le critère de recette 10 (aucune donnée de B visible depuis A) est vérifié pour toutes les routes API par `tests/adm1-criterion10-isolation.test.ts`.

## Permissions

Le format est `{ressource}:{action}`. Les ressources déclarées sont : `users`, `companies`, `deliveries`, `orders`, `drivers`, `vehicles`, `analytics`, `settings`, `dashboard`, `invoices` et `support`.

Les permissions exactes et leurs affectations se trouvent dans `prisma/reference-data.ts` (`ROLE_PERMISSIONS`).

## Défenses appliquées

1. `src/middleware.ts` (runtime Node) maintient la session Supabase et, avant tout rendu de page (RSC et préchargements compris), relit en base rôle, permissions, compte et entreprise : mauvais espace → 307 vers l'accueil du rôle, aucun écran ouvert → 403, compte indisponible → connexion (AUTH-ROLE).
2. `src/lib/permissions/page-access.ts` est la table unique des pages protégées (segments → rôles, permissions) et des accueils par rôle.
3. Les gardes API résolvent l'utilisateur courant et refusent compte/entreprise suspendus.
4. Chaque service ajoute les frontières d'entreprise et de ressource.
5. Les composants masquent les actions indisponibles pour éviter une fausse affordance.

Le niveau 5 améliore l'expérience ; seuls les niveaux serveur protègent les données.

## Règles particulières

- Le super-administrateur est le seul rôle de plateforme.
- Un administrateur ne change pas son propre rôle et ne désactive pas son propre compte.
- Le support interne (réclamations) accepte `ADMIN` avec `support:read`.
- Les factures utilisent `invoices:read/create/update`, séparées des permissions de commande.
- Un client doit appartenir à la commande et à l'entreprise ; une correspondance d'e-mail seule n'autorise rien.
- Un livreur est réévalué après réattribution : une tournée retirée n'est plus visible, ses arrêts renvoient 404.
- Les fichiers de preuve restent privés ; une URL signée n'est créée qu'après autorisation.

## Ajouter ou modifier un accès

1. Définir la permission dans `prisma/seed.ts` et, si nécessaire, la ressource/action dans `src/lib/permissions/rbac.ts`.
2. Mettre à jour la garde de route et la garde API.
3. Ajouter les filtres `companyId` et ressource dans le service, avant toute lecture ou écriture.
4. Adapter la navigation et l'interface.
5. Tester autorisation légitime, rôle voisin, entreprise B, ressource réaffectée et compte suspendu.
6. Si la base change, suivre `DATABASE.md` et vérifier RLS/droits publics.

Les recettes de référence sont les tests `account-access`, `permissions`, `adm1-admin`, `adm1-criterion10-isolation` et la recette navigateur `tests/e2e/adm1-recette.spec.ts`.
