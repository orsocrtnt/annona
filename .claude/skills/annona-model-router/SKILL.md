---
name: annona-model-router
description: Choisit, pour chaque sous-tâche Annona, entre la traiter soi-même ou la déléguer à un agent sur un modèle moins coûteux (explorateur sur Haiku, verificateur sur Sonnet). À utiliser avant toute tâche de plusieurs étapes sur Annona — audit, réparation, implémentation, recette — pour réduire la consommation sans perdre en qualité.
---

# Routeur de modèles Annona

Le modèle de la conversation est fixe : il réfléchit, décide et écrit le code sensible. Seules les sous-tâches délimitées peuvent partir vers un modèle moins coûteux, par délégation à un agent du projet.

## Règle de décision

Avant chaque sous-tâche, poser trois questions :

1. **Faut-il du jugement ?** Diagnostic de cause racine, arbitrage produit ou design, sécurité, données, schéma Prisma, permissions, concurrence → **garder** (modèle principal). Toujours.
2. **La tâche est-elle grosse et bien délimitée ?** Plusieurs fichiers à parcourir, plusieurs commandes à lancer, un résultat qui tient en un résumé → **déléguer** (voir le tableau).
3. **Est-ce rapide à faire soi-même ?** Moins de 3 appels d'outils ou une cible déjà connue → **garder**. Une délégation coûte un brief et une relecture ; elle ne vaut le coup que si elle évite davantage.

| Sous-tâche | Agent | Modèle |
|---|---|---|
| Localiser du code, cartographier un module, lire et résumer des logs, inventorier des fichiers | `explorateur` | Haiku |
| Lancer `npm run check`, des tests ciblés, des E2E Playwright, des relevés navigateur, et rendre un bilan chiffré | `verificateur` | Sonnet |
| Corriger, refactorer, décider, écrire une migration, toucher à l'auth ou aux permissions | — | modèle principal |

## Escalade

- Un agent délégué ne modifie jamais le code ni la base. S'il trouve un problème, il le rapporte ; le modèle principal corrige.
- Si le résultat d'un agent est ambigu, incomplet ou contredit une observation, refaire la vérification soi-même au lieu de redéléguer.
- Un résultat d'agent n'est pas une preuve : les décisions s'appuient sur les commandes et sorties qu'il cite, revérifiées si elles conditionnent un commit.

## Brief d'un agent

Chaque délégation précise : l'objectif en une phrase, les fichiers ou routes visés, la commande exacte à lancer (pour `verificateur`), ce qui est déjà établi, et le format de réponse attendu (court, chiffré, avec chemins `fichier:ligne`). Rappeler la règle graphify du `CLAUDE.md` du projet si l'agent explore du code.

## Contraintes Annona toujours valables

- Un seul agent d'exécution actif à la fois ; pas de travail parallèle qui modifie des fichiers.
- Aucune migration, seed, push, déploiement ou écriture en préproduction sans accord explicite du propriétaire.
- Serveur local contre la préproduction : `npx dotenv -e .env.preproduction.local -- env DATABASE_CONNECTION_MODE=session DATABASE_CONNECTION_LIMIT=10 npx next dev --turbopack -H 127.0.0.1 -p 3106`. Un seul serveur à la fois (limite de 15 connexions en mode session).
- Les tests E2E se déconnectent à la fin pour libérer le pool démo.
