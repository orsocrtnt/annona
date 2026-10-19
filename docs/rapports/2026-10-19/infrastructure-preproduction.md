# Audit infrastructure et préparation préproduction

Date : 19 octobre 2026. Audit puis création autorisée d'une préproduction isolée, sans suppression, sans dépense et sans modification de la cible existante.

## Résultat

### GitHub

Le dépôt local pointe vers `orsocrtnt/tutelliv-v2`. Le `main` distant et le dernier commit local partagé sont identiques (`af614947…`, 7 septembre 2026). Le code actuel n'est donc pas sur GitHub : il comprend 214 fichiers suivis modifiés et 498 fichiers non suivis, dont le code, les tests, la documentation et les preuves produits depuis ce commit. Le scanner de secrets ne détectait aucun secret avant la préparation ; il est relancé dans la validation finale.

La branche locale `preproduction` a été créée depuis ce commit sans modifier `main`. Le travail courant est figé dans le commit local `34ba118` ; aucun push, demande de fusion ou déploiement n'a été effectué. Les preuves générées sous `outputs/` restent locales et ignorées. L'historique Git existant et les 51 démonstrations restent préservés.

### Vercel

Le dossier local est relié au projet `tutelliv-v2`. Le tableau de bord confirme la connexion au dépôt privé `orsocrtnt/tutelliv-v2`, le déploiement Production sur `main` au commit `af614947…` et l'offre Hobby. Les huit variables existantes sont limitées à Production ; aucune valeur n'a été lue ni affichée. La dernière Preview visible, ancienne et sans rapport avec la branche préparée, a échoué. Une Preview Git dédiée reste possible sur Hobby, mais devra recevoir des variables Preview propres à `preproduction`.

Le manifeste contenait un cron chaque minute incompatible avec Vercel Hobby. La branche locale de préproduction conserve le cron quotidien et retire uniquement cette planification minute ; la route opérationnelle reste présente. Le workflow et la procédure exigent une confirmation de la branche Production avant le premier push.

### Supabase

La configuration locale cible bien le projet `wlomrzilflbouzyhzwxm` donné par le propriétaire. Le tableau de bord confirme le projet `TutelLiv`, actif sur l'offre Free dans la région `eu-west-3` (Paris). Il s'agit de la cible de développement/test déjà autorisée, avec PostgreSQL 17.6, vingt tables publiques sous RLS, un bucket privé et 51 démonstrations historiques. Rien n'a été écrit dans ce projet pendant l'audit.

L'organisation contient ce projet actif et deux anciens projets en pause. Supabase autorise deux projets gratuits actifs et les projets en pause ne comptent pas dans cette limite. Le second emplacement a été utilisé pour créer `tutelliv-preproduction`, référence publique `zwwyalsslyydubtetagj`, dans la région Paris. L'exposition automatique des nouvelles tables est désactivée et RLS automatique est activée. Aucune donnée ni démonstration n'a été copiée.

La migration initiale versionnée a été appliquée sur cette base vide. Elle crée les vingt tables métier, active RLS sur les vingt tables et le registre Prisma, retire tous les droits directs de `PUBLIC`, `anon` et `authenticated`, et crée le bucket `delivery-pods` privé limité à 5 Mio aux JPEG/PNG. La vérification connectée confirme vingt tables métier, une migration, zéro utilisateur Auth, zéro politique publique, zéro droit direct et zéro drift Prisma.

Les paramètres sont conservés uniquement dans `.env.preproduction.local`, ignoré par Git et limité en lecture/écriture au compte local. Le premier import Vercel a été annulé avant enregistrement après qu'une vue technique a rendu des valeurs sensibles visibles. Ces identifiants doivent être remplacés avant toute publication : aucun secret de cette tentative ne doit être utilisé dans Vercel ou GitHub.

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

1. Remplacement du mot de passe PostgreSQL et de la clé serveur exposés pendant la préparation ; le formulaire Vercel est resté non enregistré.
2. Nouvelle vérification connectée avec les identifiants remplacés.
3. Configuration des variables Preview Vercel limitées à `preproduction`, puis publication de la branche.
4. Configuration de l'environnement GitHub protégé et première exécution CI connectée.
5. Offre Vercel commerciale avant pilotes ou vente ; aucune dépense n'est nécessaire pour finir la préparation technique.

Procédure : `docs/operations/preproduction/README.md`.
