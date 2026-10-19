# Exploitation locale et dépannage

État de référence : 16 octobre 2026.

## Prérequis

- Node.js 20.19 ou 22 ; validation courante avec 22.18 ;
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

### Optionnelles

- `AUTH_EMAIL_LINKS_ENABLED=true` seulement après configuration complète décrite dans `AUTH_EMAIL_SETUP.md` ;
- `RESEND_API_KEY`, `MAIL_FROM` ou `EMAIL_FROM` pour les notifications e-mail ;
- `OPS_ALERT_WEBHOOK_URL` et `OPS_ALERT_WEBHOOK_TOKEN` pour le canal d'incident générique ;
- variables `NEXT_PUBLIC_MAP_*`, `NEXT_PUBLIC_OSRM_URL` et `GEOCODING_URL` pour remplacer les fournisseurs d'essai ;
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
npm run test:v1
```

`test:v1` écrit sur la base de test uniquement avec des fixtures temporaires et exige leur nettoyage. Ne pas l'exécuter contre une future production. Installer Chromium avec `npx playwright install chromium` si aucun navigateur compatible n'est disponible.

## Mise à jour de la TODO partagée

`npm run todo:progress` recalcule la jauge depuis les cases principales de `TODO.md` et synchronise `outputs/TODO-TutelLiv-vente.md`. Ce calcul s'exécute aussi avant `npm run docs:verify`. Le pourcentage compte les tâches terminées sans pondérer leur taille ; il ne mesure pas la préparation commerciale du produit.

Pour les copies externes consultées sur cet ordinateur, `.todo-share-paths.local.json` contient une liste JSON de chemins absolus vers des fichiers nommés `TODO-TutelLiv-vente.md`. Ce réglage local est ignoré par Git et absent en CI. Les copies enregistrées sont synchronisées par les mêmes commandes ; une erreur d'écriture interrompt le contrôle pour éviter un statut périmé silencieux. Toujours modifier la source `TODO.md`, car une copie est remplacée par la source lors de la synchronisation.

## Démonstration

Le compte de démonstration authentifie l'entrée, puis chaque navigateur travaille dans une entreprise fictive isolée pendant huit heures. Changer de persona ou se reconnecter conserve cette même session. Le bouton de remise à zéro recrée uniquement ses huit livraisons et n'agit pas sur une autre démonstration. Vérifier ce comportement avec `npm run test:demo1` et consulter `operations/demo1/README.md`.

Les sessions expirées sont actuellement conservées. Avant une diffusion publique importante, définir leur rétention et le nettoyage associé, notamment pour Storage ; ne jamais supprimer une entreprise dont le slug n'utilise pas le préfixe de session de démonstration.

## Tâches planifiées

- `/api/cron/recurring-orders` génère les occurrences récurrentes ; plan actuel à 06:00 chaque jour.
- `/api/cron/operations` reprend auto-dispatch et notifications ; plan actuel chaque minute.

Les deux routes attendent `Authorization: Bearer <CRON_SECRET>`. Vérifier que l'hébergement choisi autorise cette cadence. Une tâche opérationnelle en échec est visible dans le dispatch et peut être relancée par un utilisateur autorisé.

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
