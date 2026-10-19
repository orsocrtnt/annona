# CI-1 — Durcissement des dépendances

Date : 16 octobre 2026. Jalonnement partiel de CI-1 consacré aux dépendances ; aucun déploiement ni retour arrière d'environnement n'a été réalisé.

## Risque constaté

L'installation neuve de DOC-1 avait signalé 28 entrées vulnérables. Le nouvel audit précis a ensuite trouvé 12 packages affectés, dont Next.js 15.5.19 en criticité critique. Les avis critiques concernaient notamment le traitement d'images et certains environnements d'hébergement.

## Correction

- Next.js et `eslint-config-next` passent de 15.5.19 à 15.5.28, dans la même branche mineure.
- PostCSS passe à 8.5.30 dans tout l'arbre grâce à une substitution explicite ; Sharp 0.35.5 est installé directement pour garantir la version corrigée utilisée par Next.js.
- Les outils de compilation, types et lint sont classés en dépendances de développement. Ils restent installés pendant la construction et ne sont pas embarqués comme dépendances d'exécution.
- `tsx` passe à 4.23.15 et son `esbuild` transitif à 0.28.1.
- `npm run audit:prod` fournit désormais le contrôle reproductible destiné à la future CI.

Aucun `npm audit fix --force`, changement majeur de framework ou mise à niveau Prisma n'a été appliqué.

## Résultat de sécurité

`npm audit --omit=dev` passe avec **0 vulnérabilité de production** : aucune critique, élevée, modérée ou faible parmi 128 dépendances de production.

L'audit complet conserve six entrées de criticité élevée dans la chaîne de développement d'ESLint. Elles remontent toutes à `braces` via `micromatch`, `fast-glob` et le plugin Next. Le registre ne propose pas de version corrigée compatible ; sa suggestion rétrograde `eslint-config-next` vers une branche Next 14, ce qui n'est pas compatible avec le projet. Cette chaîne traite le code du dépôt pendant le lint, pas des entrées des utilisateurs en production. Elle reste suivie sans masquer l'audit.

## Non-régression

- installation reproductible `npm ci` et génération Prisma réussies ;
- types, lint strict et **217/217 tests locaux** réussis ;
- **2/2 parcours E2E** réussis sur la base de test, avec nettoyage des fixtures ;
- build Next.js 15.5.28 réussi avec **98 pages statiques** ;
- contrôle documentaire réussi.

Preuve synthétique sans secrets : `outputs/ci1/dependency-audit.json`.

CI-1 reste ouverte : le workflow automatisé, la cible de préproduction et l'essai réel de déploiement/retour arrière dépendent encore de ENV-1 et DB-1.
