# Audit infrastructure et préparation préproduction

Date : 19 octobre 2026. Audit sans suppression, sans modification distante, sans dépense et sans affichage de secret.

## Résultat

### GitHub

Le dépôt local pointe vers `orsocrtnt/tutelliv-v2`. Le `main` distant et le dernier commit local partagé sont identiques (`af614947…`, 7 septembre 2026). Le code actuel n'est donc pas sur GitHub : il comprend 214 fichiers suivis modifiés et 498 fichiers non suivis, dont le code, les tests, la documentation et les preuves produits depuis ce commit. Le scanner de secrets ne détectait aucun secret avant la préparation ; il est relancé dans la validation finale.

La branche locale `preproduction` a été créée depuis ce commit sans modifier `main`. Le travail courant est figé dans le commit local `34ba118` ; aucun push, demande de fusion ou déploiement n'a été effectué. Les preuves générées sous `outputs/` restent locales et ignorées. L'historique Git existant et les 51 démonstrations restent préservés.

### Vercel

Le dossier local est relié au projet `tutelliv-v2`. La connexion Git et la branche Production ne peuvent pas encore être vérifiées côté serveur : le tableau de bord demande une connexion et le jeton CLI local répond `403 Not authorized`.

Le manifeste contenait un cron chaque minute incompatible avec Vercel Hobby. La branche locale de préproduction conserve le cron quotidien et retire uniquement cette planification minute ; la route opérationnelle reste présente. Le workflow et la procédure exigent une confirmation de la branche Production avant le premier push.

### Supabase

La configuration locale cible bien le projet `wlomrzilflbouzyhzwxm` donné par le propriétaire. Il s'agit de la cible de développement/test déjà autorisée, avec PostgreSQL 17.6, vingt tables publiques sous RLS, un bucket privé et 51 démonstrations historiques. Rien n'a été écrit pendant cet audit.

La création d'un second projet gratuit paraît possible en principe, car Supabase accorde deux projets gratuits actifs, mais le quota réel du compte et la région restent invisibles tant que le tableau de bord n'est pas reconnecté. Aucun projet n'a été créé.

### CI et isolation

Le workflow local exécute scanner de secrets, installation reproductible, types, lint, tests, documentation, audit des dépendances et build. Il est maintenant préparé pour la branche `preproduction`. Le job connecté reste manuel et protégé par l'environnement GitHub `preproduction`.

Une nouvelle garde refuse la recette si l'URL Vercel n'est pas l'hôte attendu, si les connexions ne ciblent pas le même nouveau projet Supabase, si la référence actuelle est réutilisée, si les secrets opérationnels sont faibles/identiques, ou si les e-mails et le nettoyage des démos sont activés. Quatre tests ciblés couvrent les principaux refus.

## Validation locale

- 279 tests sur 279 réussis, types valides et lint sans avertissement ;
- build Next.js de production réussi, 102 pages générées ;
- 58 documents contrôlés, sans lien local cassé, commande absente ni variable oubliée ;
- audit npm des dépendances de production : zéro vulnérabilité connue ;
- scanner de secrets : 871 fichiers contrôlés, zéro détection ;
- adresse de réception de test conservée uniquement dans `.env.local`, ignoré par Git ;
- `git diff --check` réussi.

## Décision d'architecture

- conserver le dépôt GitHub, son historique, le projet Vercel et le projet Supabase actuel ;
- garder le Supabase actuel comme développement/test fictif afin de préserver les 51 démonstrations ;
- utiliser une branche `preproduction`, une Vercel Preview et un deuxième Supabase gratuit distinct ;
- créer la production plus tard, après validation V1 et choix de l'offre payante adaptée ;
- ne pas utiliser Vercel Hobby pour une exploitation commerciale ;
- ne pas activer Resend/Supabase SMTP avant achat et validation du domaine.

## Blocages actuels

1. Connexion humaine à GitHub, Vercel et Supabase.
2. Confirmation du réglage Vercel Production et de la connexion Git.
3. Confirmation qu'un deuxième emplacement Supabase Free est disponible et choix de région.
4. Validation de la migration initiale DB-1 sur une base vide.
5. Offre Vercel commerciale avant pilotes ou vente ; aucune dépense n'est nécessaire pour finir la préparation locale.

Procédure : `docs/operations/preproduction/README.md`.
