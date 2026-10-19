# DOC-1 — Documentation et prise en main

Date : 16 octobre 2026. Périmètre : démarrage, architecture, base, permissions, configuration, commandes, limites, dépannage, reprise et distinction entre documentation courante et rapports historiques.

## Situation initiale

Le README permettait déjà un lancement, mais plusieurs références courantes décrivaient encore commandes, livraisons, facturation, notifications et suivi comme des modules futurs. Le document base ne présentait que quatre modèles alors que le schéma en contient vingt. Le guide RBAC omettait le mini-administrateur, les factures et le support. Les fournisseurs cartographiques cités n'étaient plus ceux du code actuel et aucun index ne distinguait état courant, hypothèses et preuves datées.

## Réalisation

- Le README donne un démarrage court, les commandes sûres, les dépendances actuelles et les limites avant vente.
- `docs/README.md` indexe les références courantes, la documentation produit et les archives datées.
- Architecture, base et RBAC ont été réconciliés avec les routes, domaines, vingt modèles Prisma, six rôles et onze ressources de permission actuels.
- `docs/OPERATIONS.md` regroupe prérequis, variables, lancement, tests, crons, erreurs Prisma/auth/carte, nettoyage ciblé et limites de publication.
- L'ancien document de modules futurs indique désormais clairement que ses éléments sont des hypothèses non engagées et que les modules principaux existent déjà.
- `.env.example` couvre les alias e-mail et réglages Playwright documentés.
- `npm run docs:verify` contrôle les liens Markdown actifs, les scripts npm cités, les variables documentées et le nombre de modèles Prisma.

## Validation

- contrôle documentaire réussi sur **29 fichiers Markdown** : zéro lien local cassé, script absent ou variable manquante ;
- copie isolée créée sans `.env.local`, `.git`, dépendances, cache ni outputs ;
- `npm ci` réussi sur cette copie et client Prisma généré par `postinstall` ;
- `npm run docs:verify` puis `npm run check` réussis dans la copie : types, lint sans erreur bloquante et **217/217 tests** ;
- serveur de développement démarré depuis la copie avec configuration factice syntaxiquement valide ; `/login` a répondu **200** ;
- aucune base, authentification distante, migration, seed, e-mail ou donnée métier utilisés.

Les preuves partageables sont `outputs/doc1/verification.json` et `outputs/doc1/fresh-install.json`.

## Limites et constat connexe

Le lancement authentifié exige toujours de vrais accès à un environnement de développement identifié ; la copie neuve valide l'installation et l'écran public, pas une nouvelle cible distante. La restauration du service, les migrations et le déploiement restent dans OPS-03A, DB-1 et CI-1.

L'installation neuve a signalé des dépendances vulnérables. `npm audit --omit=dev` rapporte 28 entrées de packages affectés, dont Next.js en critique. Aucun correctif automatique n'a été appliqué : l'exploitabilité, les chemins transitifs et la mise à niveau compatible doivent être traités explicitement dans CI-1. Résumé sans secret : `outputs/doc1/dependency-audit-summary.json`.
