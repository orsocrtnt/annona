# Grille de vérification — chantiers parallèles du 28 octobre 2026

Cette grille sert à la conversation de vérification du propriétaire. Elle liste ce qui a été **promis** pour chaque branche, comment le **contrôler**, et les **pièges connus**. Vérifier chaque point sur la branche d'intégration `integration/2026-10-28` (ou sur la branche `agent/*` si l'intégration n'est pas encore faite), jamais en se fiant au seul rapport d'un agent.

## Règles de vérification

- Base de développement uniquement : `npm run -s env2:verify-dev` doit renvoyer `{"passed":true}`. Aucune écriture sur la préproduction (`zwwyalsslyydubtetagj`) ni sur la production.
- Un seul serveur à la fois sur `annona-dev`. Recette navigateur : skill `annona-recette`.
- Pour chaque branche :
  - `git log --oneline preproduction..<branche>` ;
  - `git diff --stat preproduction...<branche>` ;
  - `npm run check`, qui doit être vert (typecheck, lint sans avertissement, tous les tests) ;
  - lire le rapport de l'agent `docs/rapports/agents/2026-10-28-<chantier>.md` et confronter chaque affirmation au code.
- Une affirmation « vérifié » sans commande ni sortie à l'appui compte comme **non vérifiée**.
- Chaque rapport d'agent doit contenir sa checklist de preuves : skills invoqués, test rouge puis vert par point, états voisins, `npm run check` final après le dernier commit, SHA des commits, `diff --stat`, liste du non vérifié, auto-relecture. Un rapport sans cette checklist est renvoyé à l'agent.
- Contrôles communs à toutes les branches :
  - aucun fichier `.env*` versionné ;
  - aucun secret dans le diff (`npm run ci:secrets`) ;
  - aucune modification de `TODO.md` ni d'`AGENTS.md` par un agent ;
  - pas de reformatage hors sujet.

## 1. `agent/fiabilite` — tâches de fond et exploitation

| Promis | Comment vérifier | Piège connu |
|---|---|---|
| `kickOperationJob` passe par `after()`, avec un repli hors requête qui est journalisé | `src/lib/operations/after-response.ts`, `operation-job.service.ts` ; tests `fiabilite-after-response` | Le repli ne doit pas avaler en silence n'importe quelle erreur de `after()` (retour de relecture) |
| Le cron `/api/cron/operations` est appelé toutes les 5 min par GitHub Actions | `.github/workflows/cron-operations.yml` : secrets requis, aucune valeur en dur, pas de `--retry` sur erreur HTTP, `--max-time` ≥ durée d'un lot | Les exécutions planifiées partent de `main` : l'environnement GitHub ne doit pas restreindre les branches |
| Alerte sur les tâches PENDING (et PROCESSING au bail expiré) en retard de plus de 15 min | `route.ts` : l'alerte de retard est émise même quand une tâche a échoué dans le même passage ; tests `operations-health`, `operation-jobs` | L'ordre des contrôles dans la route |
| Node fixé à 22.18 | `.nvmrc`, `package.json` engines, README | Vercel doit aussi être réglé sur Node 22 (action du propriétaire) |
| 12 index de clés étrangères | `prisma/schema.prisma`, migration `20261028090000_fk_indexes` (uniquement des `CREATE INDEX IF NOT EXISTS`) | Non appliquée hors annona-dev. En production : `CONCURRENTLY` |

## 2. `agent/securite` — inscription et API

| Promis | Comment vérifier | Piège connu |
|---|---|---|
| Plus aucune entreprise ni abonnement `LEGACY` créé par l'auto-inscription | `POST /api/auth/sync` et `/api/auth/login` avec `accountType: "company"`, ou des métadonnées falsifiées → ni entreprise ni abonnement créés (test et essai réel) | Les comptes existants, la démo, les pilotes manuels et le parcours d'inscription payé doivent rester intacts |
| Limitation des tentatives de connexion | 429 en français avec `Retry-After` après N échecs, remise à zéro après un succès, aucune énumération de comptes | L'IP vue par l'application derrière Vercel |
| Erreurs internes masquées | `src/lib/api/route-handler.ts` : seul un message générique sort pour une erreur non métier | Aucun écran ne doit dépendre d'un message brut |
| Zod `.strict()` sur 6 routes | contact, portal/order-estimate, portal/notifications, auth/sync, admin/sales-codes, admin/sales-codes/[id] → 400 sur un champ inconnu | Les clients front qui envoient des champs en trop |
| En-têtes de sécurité, CSP en Report-Only | `next.config.ts` ; `curl -I` sur `/login` | Les cartes (OSM, IGN, OSRM), Stripe, Supabase et les polices ne doivent produire aucune violation bloquante |
| Contrôle de l'en-tête `Origin` sur les mutations | middleware ; tests | Le webhook Stripe et les crons sont exclus |
| `server-only`, secret HMAC dédié, fichier mort supprimé | `services/supabase/admin.ts`, `contact.service.ts`, `.env.example` (valeur fictive) | `CONTACT_HMAC_SECRET` à créer dans Vercel (propriétaire) |

## 3. `agent/design-portail` — portail client, direction Menthe et mode Dark

| Promis | Comment vérifier | Piège connu |
|---|---|---|
| Thème Clair / Sombre / Système limité à `/portal/**`, sans éclair | Recette : recharger `/portal` en Sombre ; naviguer `/portal` ↔ `/dashboard` sans frame au mauvais thème | Retours de relecture : hydratation, puis navigation client |
| Autres espaces inchangés en Light, même avec l'OS en sombre | Captures de `/dashboard`, `/driver/missions` et `/` avec l'OS en sombre | Redéfinition de la variante `dark:` de Tailwind |
| Contrastes AA | `tests/theme-tokens.test.ts` ; recette visuelle en Sombre de `/portal/deliveries` (panneau carte) | Le panneau carte était illisible en Sombre (retour de relecture) |
| Cibles tactiles de 44 px, barre du portail | Largeurs 390 px et 1 280 px : la barre ne déborde pas | Logo + 5 boutons à 320–375 px |
| Formulaire de commande : action principale unique, collante sur mobile | `/portal/orders/new` : validation et appel API inchangés | Alignement de la barre collante |

## 4. `agent/preuve-livraison` — preuve de livraison complète

| Promis | Comment vérifier | Piège connu |
|---|---|---|
| Signature à l'écran, nom du réceptionnaire, motif de refus | App livreur, livraison réussie et en échec ; mode hors ligne puis reprise | Migration de la colonne signature, appliquée seulement sur annona-dev |
| Photos sans EXIF, URL signées d'environ 5 min | Envoyer un JPEG avec GPS → l'objet stocké n'a plus de métadonnées | L'orientation de la photo doit être conservée |
| PDF de preuve horodaté | Téléchargement depuis le back-office et par le client propriétaire ; refus pour une autre entreprise ou un autre client | Inventaire des routes `admin01-*` mis à jour |
| Envoi automatique au donneur d'ordre | Tâche durable idempotente, sans double envoi ; rien n'est envoyé si l'e-mail n'est pas configuré | E-mail réel non configuré : à vérifier dans le journal des tâches |
| Relevés par coursier | Page ou export CSV par livreur et par période ; permission du rôle ; aucune donnée d'une autre entreprise | — |
| Conservation | L'export DATA-02 et la purge incluent les signatures ; `docs/DATABASE.md` | — |

## 5. `agent/facturx` — factures Factur-X

| Promis | Comment vérifier | Piège connu |
|---|---|---|
| XML CII embarqué dans le PDF de facture (profil justifié dans le rapport) | Extraire `factur-x.xml` du PDF ; totaux cohérents ; `AFRelationship` ; métadonnées XMP ; OutputIntent | Pas de validation officielle hors ligne : à confirmer avec Mustang ou le validateur FNFE (fichier fictif, hors agent) |
| Rendu visuel et export comptable inchangés | Comparer le PDF avant et après ; tests `accounting-export` | PDF/A-3b strict peut-être impossible avec `pdf-lib` (le rapport doit le dire) |
| Données légales manquantes : génération refusée avec un message clair | Entreprise sans SIREN ou sans TVA → message clair, la facture classique reste disponible | Migration éventuelle des champs légaux |
| Téléchargement depuis le back-office et le portail | Refus pour une autre entreprise | Ce n'est pas une émission via plateforme agréée : ne pas le présenter comme une conformité certifiée |

## 6. `agent/commande-ia` — commande par message IA (INTAKE-1)

| Promis | Comment vérifier | Piège connu |
|---|---|---|
| Coller un message → brouillon de commande structuré, validé par un humain avant création | `src/domains/order-intake/**`, `/api/orders/intake/**` ; portail et back-office (« Depuis un message ») | Aucune commande créée sans validation explicite |
| Création côté back-office pour le compte d'un client (décision C11) | `docs/DECISIONS_PRODUIT_COMMERCIALES.md` C11, `PRODUCT.md` ; permission `orders:create`, `source = ADMIN` | Client choisi ACTIVE et de la même entreprise |
| Champs incertains signalés, jamais inventés | Date passée sans heure → « À vérifier » ; échéance justifiée par un extrait du message | Fuseau Europe/Paris |
| Protection contre l'injection de consignes | Expéditeur et message dans des cadres échappés, hors de la consigne | — |
| Quota par entreprise, pas de texte stocké | Table `order_intake_usage` (jetons et issue seulement), RLS + REVOKE ; 429 avec `Retry-After` | Requêtes SQL brutes (`jsonb_set`, `regexp_replace`) jamais exécutées sur un vrai PostgreSQL par l'agent : à tester sur annona-dev |
| Désactivée sans clé ni activation | Sans `ANTHROPIC_API_KEY` → `INTAKE_NOT_CONFIGURED` ; activation atomique de la seule clé `orderIntake` | Sous-traitant F10 à qualifier juridiquement |

## 7. `agent/dispatch-gps` — DEMO-3 tranches 3 et 5

| Promis | Comment vérifier | Piège connu |
|---|---|---|
| La distance GPS au retrait ne sert QUE de départage | Priorités, zones et charge passent toujours avant ; à égalité, le livreur en service le plus proche gagne (position < 15 min, retrait < 10 km, réglables) | Livreur sans position récente ni pénalisé ni exclu |
| Aucune coordonnée exposée | Réponse d'`auto-assign` sans `proximity` ; historique « plus proche du point de retrait » sans chiffre ; rien côté portail | Positions lues hors transaction, filtrées par entreprise |
| Notification « Prise en charge » à l'acceptation | Une seule notification même après double clic ; rien si le client a coupé les alertes | E-mail réel non testé |
| Réglages GPS dans Règles dispatch | Saisie « 7,26 » km → 7,3 au blur ; champ vidé → valeur précédente | — |

## 8. `agent/facturation` — DEMO-3 tranches 1 et 2

| Promis | Comment vérifier | Piège connu |
|---|---|---|
| Onglet « Paiements » : payées / en attente / en retard, jours de retard | Filtres, compteurs, état vide ; Dispatcher → 403 sur `/api/invoices` | Liste plafonnée à 100 |
| Passage automatique en retard | Par le cron d'opérations, sans modifier `updated_at` ; « Marquer payée » reste possible sur une facture en retard | Heure de Paris |
| « Relancer » tracé, anti-doublon 24 h | E-mail seulement si configuré, sinon « tracée, non envoyée » ; une relance en échec relancée n'envoie pas de doublon | Table `invoice_reminders` (migration) |
| Facture créée à la livraison | Réglage désactivé par défaut ; une seule facture même après plusieurs passages en Livrée ; facture annulée non bloquante | Tâche `DELIVERY_INVOICE` dédiée |
| Factur-X et PDF classique d'une facture en retard | Téléchargement OK | — |

## Branche d'intégration

- Ordre de fusion réel : Fiabilité → Sécurité → Preuve → Factur-X → Commande IA → Dispatch GPS → Facturation → Design (dernier). Vérifier que chaque conflit résolu (`prisma/schema.prisma`, inventaires `tests/admin01-*` et `docs/operations/data02/INVENTORY.md`, `package.json`, `src/app/layout.tsx`) garde les deux intentions.
- Sur `integration/2026-10-28` :
  - `npm run check` ;
  - `npm run build`, serveur dev arrêté ;
  - recette finale : non-régression des trois espaces, puis parcours de chaque chantier, puis effets croisés (CSP du chantier Sécurité × cartes et polices du chantier Design).
- Migrations à appliquer en préproduction, **sur accord du propriétaire uniquement** : `20261028090000_fk_indexes` (Fiabilité), `20261028100000_order_intake_usage` (Commande IA), `20261028120000_pod_signature` (Preuve), `20261028180000_auth_login_failures` (Sécurité), `20261028230000_invoice_reminders` (Facturation). Factur-X et Dispatch GPS n'en ont pas.
- Actions du propriétaire avant mise en ligne :
  - secrets GitHub `PREPROD_BASE_URL`, `PREPROD_CRON_SECRET` (et `VERCEL_AUTOMATION_BYPASS_SECRET` si nécessaire) ;
  - Node 22 sur Vercel ;
  - `CONTACT_HMAC_SECRET` ;
  - protection Supabase contre les mots de passe compromis ;
  - `ANTHROPIC_API_KEY` (Commande IA) et qualification juridique du sous-traitant F10 ;
  - validation Factur-X par Mustang ou le validateur FNFE, et confirmation du traitement BT-32 en franchise de TVA ;
  - promotion de la production (`main`).
