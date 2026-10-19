# DEMO-1 — Isolation des démonstrations

Date : 16 octobre 2026. Implémentation et recette sur l'environnement de test autorisé, sans migration ni déploiement.

## Résultat

Le compte de connexion de démonstration reste unique, mais chaque navigateur obtient désormais une entreprise fictive distincte grâce à un cookie HTTP-only aléatoire. Les vues administrateur, client et chauffeur sont résolues dans cette entreprise. Se reconnecter avec le même cookie reprend les modifications ; aucun seed ni reset n'est rejoué.

La remise à zéro agit uniquement sur l'entreprise de session. Le code de scénario utilise maintenant la clé de configuration courante `dispatchRules` au lieu de l'ancien champ `dispatch`, et les catégories sont alignées sur les réglages actuels. La création du roster, des huit livraisons, des récurrences, des adresses et des positions est parallélisée par groupes indépendants afin de limiter l'attente initiale.

## Preuve connectée

Deux sessions ont été créées simultanément. Chacune contenait une entreprise, trois personas et huit commandes/livraisons. Un marqueur a été ajouté dans A et B. Après reset de A, son marqueur avait disparu et ses huit livraisons étaient restaurées ; B conservait neuf commandes et son marqueur. Réutiliser le même identifiant B a rendu la même entreprise avec `created: false`, sans reset.

La première version séquentielle de cette recette prenait 85,7 s. Après parallélisation, deux créations de session, un reset et toutes les assertions ont pris 36,7 s. Le nettoyage final compte zéro entreprise, utilisateur, commande ou livraison de test. Preuve : `outputs/demo1/connected.json`.

La validation globale réussit avec 230/230 tests, types et lint stricts, contrôle de 33 documents, `git diff --check` et build Next.js de 100 pages.

## Limites

Cette recette mesure le travail serveur complet de deux sessions et d'un reset, pas le temps précis d'un seul clic de connexion. Aucun test de charge publique n'est réalisé. Les entreprises de session expirées ne sont pas supprimées automatiquement ; une politique de rétention et le nettoyage Storage doivent être définis avant diffusion à fort trafic. Aucun compte Supabase, schéma, migration ou entreprise réelle n'a été modifié.
