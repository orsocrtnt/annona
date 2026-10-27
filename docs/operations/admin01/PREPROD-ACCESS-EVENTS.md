# Préproduction — journal des accès ADMIN-1

Lecture du catalogue le 2026-10-25, par la connexion directe déjà autorisée. Cette lecture de catalogue n'a ouvert aucune ligne. Le passage navigateur plus bas a affiché les lignes du compte temporaire, puis ces lignes ont été supprimées avec le compte. Aucun secret n'est recopié ici. Aucune autre migration n'a été exécutée.

## Migration enregistrée

`20261025220000_platform_access_events` est présente dans `_prisma_migrations`, terminée, et non annulée.

## Table `platform_access_events`

| Colonne | Type | Null |
| --- | --- | --- |
| `id` | `text` | non |
| `occurred_at` | `timestamp` | non |
| `expires_at` | `timestamp` | non |
| `actor_id` | `text` | non |
| `role` | `SystemRole` | non |
| `method` | `text` | non |
| `resource` | `PlatformAccessResource` | non |
| `decision` | `PlatformAccessDecision` | non |

Aucune de ces colonnes n'a de valeur par défaut. La seule contrainte est la clé primaire sur `id`. Il n'y a pas de clé étrangère.

Index : `occurred_at`, `expires_at`, `actor_id`, et l'index unique de la clé primaire.

`expires_at` est obligatoire. Cette lecture ne mesure pas une durée stockée, puisqu'aucune ligne n'a été ouverte. La règle de 90 jours reste celle de l'application.

## Valeurs autorisées

`PlatformAccessDecision` : `ALLOWED`, `DENIED`.

`PlatformAccessResource` : `OVERVIEW`, `SAAS_HEALTH`, `SERVICE_HEALTH`, `COMPANIES`, `COMPANY_DETAIL`, `USERS`, `SUBSCRIPTIONS`, `SUPPORT_TICKETS`, `OPERATION_JOBS`, `INCIDENTS`, `ACCESS_EVENTS`.

## Protection

RLS est actif. Il n'est pas forcé. `PUBLIC`, `anon` et `authenticated` n'ont aucun droit direct sur la table.

## Migrations encore en attente

Le statut global n'est pas propre. Ces cinq migrations restent non appliquées :

- `20261023190000_ops03b_monitor_extensions`
- `20261023191000_ops03b_monitor`
- `20261023192000_ops03b_monitor_fix`
- `20261024010000_saas_billing_sandbox`
- `20261024011000_catalog_c9_business`

## Navigation connectée

Prouvée le 2026-10-25 sur l'application locale branchée à la préproduction autorisée. Un `SUPER_ADMIN` temporaire, sans entreprise, a ouvert une session. `POST /api/auth/login` a répondu 200. `GET /admin/access-events` et `GET /api/admin/access-events` ont répondu 200. L'écran montrait « Journal d'accès » et des décisions `ALLOWED` pour `OVERVIEW`, `SAAS_HEALTH`, `COMPANIES`, `COMPANY_DETAIL` et `ACCESS_EVENTS`. Le nom d'une entreprise dans `/companies` a ouvert son détail. `GET /api/admin/companies/[id]` a répondu 200. L'écran montrait le nom, le statut, la création, les utilisateurs et les livraisons. Le compte d'authentification, l'utilisateur et les lignes de journal de cet acteur ont été supprimés ensuite. Il ne reste aucun `SUPER_ADMIN`.
