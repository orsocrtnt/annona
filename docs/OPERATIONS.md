# Exploitation locale et dépannage

État de référence : 16 octobre 2026.

## Prérequis

- Node.js 22.18 (fixé par `.nvmrc`, `engines` de `package.json` et la CI ; `nvm use`). Une autre version provoque seulement un avertissement npm (`engine-strict` désactivé). Régler aussi « Node.js Version » sur 22.x dans les réglages du projet Vercel ;
- npm 10 ;
- Git ;
- Chrome ou Chromium pour Playwright ;
- accès à un projet Supabase/PostgreSQL de développement pour les parcours authentifiés.

## Installation

```bash
npm ci
cp .env.example .env.local
npm run check
```

Créer `.env.local` seulement s'il n'existe pas. `npm ci` utilise le lockfile et le script `postinstall` génère le client Prisma. `npm run check` ne doit appeler ni la base ni les fournisseurs externes.

## Variables

### Obligatoires pour l'application authentifiée

- `NEXT_PUBLIC_APP_URL` : origine exacte utilisée par les liens ;
- `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` : client Auth ;
- `SUPABASE_SERVICE_ROLE_KEY` : opérations administratives serveur ;
- `DATABASE_URL` : runtime Prisma ;
- `DIRECT_URL` : opérations directes de schéma ;
- `CRON_SECRET` : secret partagé pour les deux routes cron.
- `OPS_HEALTH_SECRET` : accès distinct au diagnostic profond `/api/health?deep=1`.
- `CONTACT_HMAC_SECRET` : secret des empreintes anti-abus (échecs de connexion) ; repli sur `SUPABASE_SERVICE_ROLE_KEY` s'il est absent. Le changer remet seulement les compteurs à zéro.

### Optionnelles

- `AUTH_EMAIL_LINKS_ENABLED=true` seulement après configuration complète décrite dans `AUTH_EMAIL_SETUP.md` ;
- `RESEND_API_KEY`, `MAIL_FROM` ou `EMAIL_FROM` pour les notifications e-mail ;
- `OPS_ALERT_RECIPIENT` pour recevoir les alertes par e-mail, une fois par jour et par type de panne (vide : `EMAIL_TEST_RECIPIENT`, sinon aucun e-mail) ;
- `OPS_ALERT_WEBHOOK_URL` et `OPS_ALERT_WEBHOOK_TOKEN` pour le canal d'incident générique ;
- variables `NEXT_PUBLIC_MAP_*` et `GEOCODING_URL` pour remplacer les fournisseurs d'essai ; `DRIVE_ROUTE_IGN_URL` (recommandé : `https://data.geopf.fr/navigation/itineraire`) ou `DRIVE_ROUTE_OSRM_URL` (OSRM privé) pour les itinéraires, calculés par le serveur seulement ;
- `DATABASE_CONNECTION_LIMIT` et `DATABASE_CONNECTION_MODE` pour le pool ;
- `E2E_BASE_URL`, `E2E_SKIP_WEB_SERVER` et `PLAYWRIGHT_CHANNEL` pour Playwright.

Les valeurs publiques `NEXT_PUBLIC_*` sont intégrées au build. Changer une de ces valeurs exige un nouveau build.

La cible locale actuelle est réservée aux données fictives. Elle ne vaut ni préproduction ni production. La matrice des trois cibles, les variables à rendre distinctes et les vérifications avant activation se trouvent dans `operations/env1/README.md`. L'inventaire sans valeur sensible se relance avec `npm run audit:env1`.

## Lancer et vérifier

```bash
npm run dev -- --hostname 127.0.0.1 --port 3106
```

Ouvrir `http://127.0.0.1:3106/login`. Pour la production locale : arrêter le serveur de développement, puis lancer `npm run build` et `npm start`.

```bash
npm run check
```

Pour les parcours navigateur (`npm run test:e2e`), installer Chromium avec `npx playwright install chromium` si aucun navigateur compatible n'est disponible.

## Mise à jour de la TODO partagée

`npm run todo:progress` recalcule la jauge depuis les cases principales de `TODO.md` et synchronise `outputs/TODO-Annona-vente.md`. Ce calcul s'exécute aussi avant `npm run docs:verify`. Le pourcentage compte les tâches terminées sans pondérer leur taille ; il ne mesure pas la préparation commerciale du produit.

Les anciens chemins de partage externes sont obsolètes. La commande de progression et les contrôles de documentation ne lisent ni n'écrivent hors du dépôt.

La lecture courante se fait exclusivement dans ce Markdown du dépôt. Après modification, le fichier est committé sur `base`, sans push sauf demande explicite (`AGENTS.md`). Règle : `.cursor/rules/contexte-markdown.mdc`.

## Tâches planifiées

- `/api/cron/lock-orders` (LOCK-1) verrouille chaque date dont l'heure limite est passée et pas encore traitée (aujourd'hui et demain, fuseau de l'entreprise) : commandes récurrentes générées (RG-04), commandes validées verrouillées, prix figés (RG-05), tournées brouillon par créneau (RG-09). Idempotente. Appelée toutes les 10 minutes par `.github/workflows/cron-lock-orders.yml` et une fois par jour à 16 h 05 UTC par `vercel.json` (filet). Les écrans boulanger (`/bakery`) et commandes (`/dashboard/orders`) verrouillent aussi la date à l'ouverture si l'heure limite est passée : un cron en retard ne bloque pas la production. Hors production, `?now=<ISO>` simule l'heure pour la recette locale.
- `/api/cron/recurring-orders` et `/api/cron/billing` n'existent plus depuis NET-1 (la génération des récurrentes est faite par `/api/cron/lock-orders`) ; `cron-daily.yml` les appelle encore, à retirer.
- `/api/cron/operations` reprend les notifications et factures différées ; appelée toutes les 5 minutes par GitHub Actions (voir ci-dessous), non déclarée dans `vercel.json` car l'offre Vercel Hobby n'autorise qu'un cron par jour.

Les effets différés (notifications, factures) sont lancés après la réponse HTTP par `after()` de Next.js (`src/lib/operations/after-response.ts`) pour que Vercel ne gèle pas la fonction avant la fin ; hors requête (tests, scripts) la tâche est lancée directement. Le filet cron reprend ce qui resterait en `PENDING`.

Les routes cron attendent `Authorization: Bearer <CRON_SECRET>`. Vérifier que l'hébergement choisi autorise cette cadence. Une tâche opérationnelle en échec est visible dans le dispatch et peut être relancée par un utilisateur autorisé.

### Relais des tâches de fond (Supabase, depuis le 2 novembre 2026)

GitHub espace ses lancements planifiés (4 à 7 heures constatées). Le rythme de 5 minutes est donc porté par la tâche pg_cron `annona-operations-relay` de `annona-preproduction` : elle appelle `/api/cron/operations` avec `pg_net` (fire-and-forget, 70 s au plus), l'URL `ops03b_app_url` et le secret `relay_cron_secret` du coffre Supabase, égal au `CRON_SECRET` du déploiement. Tant que ce secret manque, la tâche ne fait rien. Il est à remettre à jour si `CRON_SECRET` change. Réponses : `net._http_response` (conservées peu de temps). Le workflow GitHub ci-dessous reste un filet de secours.

Pour copier le secret sans l'afficher (depuis la racine du dépôt) :

```bash
sh scripts/ops03b/copy-relay-secret.sh
```

La source est `.env.preproduction.local` : `vercel env pull` ne rend pas les variables « sensibles » de Vercel (il écrit `[SENSITIVE]`), l'ancienne commande ne pouvait donc pas fonctionner. Si `CRON_SECRET` change sur Vercel, mettre la même valeur dans ce fichier puis relancer la commande. Fait le 3 novembre 2026.

Le script refuse toute autre base que la préproduction et affiche seulement un bilan, qui doit contenir `"stored":true`.

### Planificateur des tâches de fond (GitHub Actions)

Workflow : `.github/workflows/cron-operations.yml` (`*/5 * * * *`, lancement manuel possible via « Run workflow »). Il appelle `GET <PREPROD_BASE_URL>/api/cron/operations` avec `Authorization: Bearer <PREPROD_CRON_SECRET>`.

Actions du propriétaire (aucune valeur n'est versionnée) :

1. Créer l'environnement GitHub `preproduction` (Settings > Environments).
2. Y ajouter les secrets :
   - `PREPROD_BASE_URL` : origine HTTPS de la préproduction, sans chemin ;
   - `PREPROD_CRON_SECRET` : la valeur de `CRON_SECRET` du déploiement de préproduction ;
   - `VERCEL_AUTOMATION_BYPASS_SECRET` : requis si la Protection des déploiements Vercel est active sur la préproduction. Le créer dans Vercel (Settings > Deployment Protection > Protection Bypass for Automation) ; il est envoyé dans l'en-tête `x-vercel-protection-bypass`. Laisser vide si la protection est désactivée.
3. GitHub n'exécute les workflows planifiés que depuis la branche par défaut du dépôt (aujourd'hui `main`). Pour que le calendrier tourne, soit faire figurer ce fichier sur la branche par défaut, soit passer `preproduction` en branche par défaut. Le workflow ne cible que la préproduction, car il n'utilise que les secrets de l'environnement `preproduction`.

Attention : dans Settings > Environments > `preproduction`, ne PAS restreindre « Deployment branches » à `preproduction` : les exécutions planifiées partent de la branche par défaut (`main`) et seraient bloquées. Laisser « All branches » (ou inclure `main`).

Durée : la route déclare `maxDuration = 60` s (un lot de 50 tâches) et le workflow utilise `curl --max-time 70`, sans `--retry` (curl relancerait sur HTTP 500/503, or 503 signale un échec réel ; le passage suivant a lieu 5 minutes plus tard). Garder `--max-time` supérieur ou égal à `maxDuration` (test `operations-health`).

Le workflow échoue avec une annotation explicite si `PREPROD_BASE_URL` ou `PREPROD_CRON_SECRET` manque ou si l'URL n'est pas en HTTPS. Il échoue aussi si la route répond autre chose que 200 : 401 = secret faux, 503 = tâches épuisées ou en retard, page de connexion Vercel = bypass manquant. Un échec envoie le courriel de notification GitHub Actions habituel : c'est l'alerte de base, sans service externe.

Alertes : en plus du journal et du webhook d'incident existant, la route signale (`operation-jobs-overdue`, 503) toute tâche `PENDING` en retard de plus de 15 minutes après son passage, et (`operation-jobs-terminal-failure`) toute tâche en échec définitif.

Procédure de vérification :

1. Déclencher le workflow à la main et vérifier « HTTP 200 » et le corps `{"data":{...},"success":true}` dans le journal.
2. Après un passage planifié, contrôler dans l'onglet Actions qu'une exécution toutes les 5 minutes environ apparaît (GitHub peut retarder les crons de quelques minutes).
3. Contrôle de bout en bout : passer une livraison en « Livrée » (notification client) et vérifier que la tâche passe à `SUCCEEDED` (page admin des tâches) ; `/api/health?deep=1` ne doit plus signaler de file `degraded`.
4. Les migrations d'index (`20261028090000_fk_indexes`) sont à appliquer séparément, après accord du propriétaire. Cette migration crée les index avec `CREATE INDEX IF NOT EXISTS` (non concurrent, verrou d'écriture le temps de la création) : acceptable sur une base de développement aux tables petites. En production avec un volume réel, créer ces index en `CREATE INDEX CONCURRENTLY IF NOT EXISTS`, hors transaction (une instruction par exécution, hors `prisma migrate deploy` en bloc).

Le retard comprend les tâches `PENDING` dont l'échéance a plus de 15 minutes et les tâches `PROCESSING` dont le bail a expiré depuis plus de 15 minutes sans reprise. Un échec terminal et un retard simultanés émettent deux incidents distincts.

## Santé et incidents

`/api/health` est une sonde publique minimale. `/api/health?deep=1` exige `OPS_HEALTH_SECRET` et contrôle base, preuves privées et files sans exposer de donnée métier. Une dépendance indisponible ou une file bloquée renvoie `503`. Le protocole d'alerte, de diagnostic et de reprise est décrit dans `operations/ops03b/README.md`.

Le webhook d'incident est facultatif en local. Avant vente, le configurer sur une préproduction distincte, simuler une panne et vérifier la réception effective ; les tests simulés du dépôt ne valident pas l'exploitation réelle.

## Dépannage

### Le démarrage s'arrête pendant Prisma

`npm run dev` vérifie l'empreinte de `schema.prisma` et régénère le client. Corriger l'erreur de génération puis relancer. Ne pas utiliser `db:push` pour résoudre automatiquement un écart de schéma.

### Erreurs Prisma P1001 ou P1017

Vérifier l'accès réseau, la validité de `DATABASE_URL`, le mode/port du pooler et la limite de connexions. P1017 signifie qu'une connexion a été fermée ; confirmer la disponibilité de Supabase avant de changer le code. Ne jamais inclure l'URL dans un rapport.

### Réponses 401 ou 403

401 indique généralement une session absente ou invalide. 403 indique un rôle ou une permission insuffisante. Vérifier le compte, son entreprise, leurs statuts et la persona démo avant de modifier les gardes.

Une mutation (`POST`, `PUT`, `PATCH`, `DELETE`) dont l'en-tête `Origin` ne correspond ni à l'hôte appelé ni à `NEXT_PUBLIC_APP_URL` reçoit 403 « Origine de la requête refusée. » dès le middleware ; le webhook Stripe et les crons en sont exemptés. Un compte Supabase sans profil en base n'est jamais provisionné à la connexion : seule l'inscription vérifiée (`SignupJourney`), la démo ou le back-office créent une entreprise.

### Réponse 429 à la connexion

Sur 15 minutes glissantes, `/api/auth/login` répond 429 avec `Retry-After` au-delà de 5 échecs pour un même couple e-mail + source, de 20 pour un e-mail toutes sources confondues ou de 30 pour une source. Compromis assumé : un tiers qui connaît une adresse ne peut verrouiller la victime que depuis sa propre source, ou par une attaque distribuée sur 20 essais ; la victime garde ses essais depuis la sienne. Sans adresse IP (ni `x-forwarded-for` ni `x-real-ip`), seule la limite par e-mail s'applique, pour ne pas créer de compteur global. Une connexion réussie remet à zéro les compteurs e-mail et e-mail + source, pas celui de la source. La limite repose sur la table `auth_login_failures` (migration `20261028180000_auth_login_failures`) : tant qu'elle n'est pas appliquée, la connexion reste permise et l'échec du contrôle est journalisé.

### Invitations ou récupération indisponibles

Le comportement est volontaire tant que `AUTH_EMAIL_LINKS_ENABLED` n'est pas activé. Suivre `AUTH_EMAIL_SETUP.md`; ne pas forcer le flag avec des modèles SMTP incomplets.

### Navigation lente en développement

Le premier accès compile la route et peut être nettement plus lent. Comparer avec un build de production et les budgets de `rapports/2026-10-15/perf01.md`. Une lenteur de base distante se distingue du temps de compilation dans les logs.

### Carte vide ou itinéraire indisponible

Vérifier l'accès au fournisseur, les plafonds de zoom et les variables publiques. L'application doit afficher un état dégradé sans inventer un trajet ni une durée. Voir `operations/map-providers.md`.

## Reprise et nettoyage

- Conserver les modifications Git locales ; ne pas utiliser `git reset` comme dépannage.
- Supprimer seulement les fixtures portant le marqueur du scénario qui les a créées.
- Ne jamais réinitialiser toute la base pour réparer un test.
- Vérifier le bloc `fixtureResidue` des preuves avant de conclure.
- Les photos de preuve utilisent un bucket privé ; le nettoyage doit traiter base et objet Storage correspondant.
- L'archive locale du code ne sauvegarde ni PostgreSQL ni Storage.

La sauvegarde/restauration du service reste à valider dans OPS-03A. En incident réel, préserver les journaux sans secrets, arrêter les écritures risquées, identifier l'environnement et utiliser la procédure du domaine concerné sous `docs/operations/`.

L'inventaire local en lecture seule se lance avec `npm run audit:ops03a`. La procédure complète, y compris la copie séparée des objets Storage et la restauration sur cible isolée, se trouve dans `operations/ops03a/README.md`.

## Publication

Le workflow `.github/workflows/ci.yml` exécute automatiquement les contrôles sans secret sur les changements de `main` et les demandes de fusion. Son job local installe depuis le lockfile, recherche les secrets accidentels, vérifie types/lint/tests/documentation/dépendances puis construit l'application avec des valeurs publiques factices sous le domaine réservé `.invalid`.

La recette connectée n'est disponible que par lancement manuel dans l'environnement GitHub protégé `preproduction`. Elle exige les secrets `PREPROD_*` décrits dans `operations/ci1/README.md`, crée uniquement les fixtures temporaires de TEST-2 et conserve ses trois preuves nettoyées si toute la recette réussit. Ne jamais relier ce job à la production.

Un build local réussi n'autorise aucun déploiement. Avant publication : ENV-1, DB-1, CI-1, OPS-03A/B et les décisions de V1-GO doivent être traitées selon leurs critères. Aucun push, migration ou déploiement n'est inclus dans ces instructions.

### Tâches quotidiennes sur annona.fr (GitHub Actions)

`annona.fr` tourne en préversion Vercel : les crons de `vercel.json` ne s'y exécutent pas. Le workflow `.github/workflows/cron-daily.yml` appelle chaque jour à 6 h UTC `/api/cron/recurring-orders` et `/api/cron/billing`, avec les secrets de l'environnement GitHub `preproduction`, et peut se lancer à la main avec « Run workflow ». Une fois une vraie production en place (AUDIT-0111, E2), revoir ce workflow pour éviter les doublons de planification.
