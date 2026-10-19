# Préproduction TutelLiv

Cette procédure prépare une préproduction isolée sans modifier `main`, le projet Supabase existant ni ses 51 démonstrations. Elle ne contient aucune clé.

## Architecture retenue

| Environnement | Code | Application | Données |
| --- | --- | --- | --- |
| Développement | branche locale de travail | serveur local | projet Supabase existant `wlomrzilflbouzyhzwxm`, données fictives uniquement |
| Préproduction | branche `preproduction` | Vercel Preview de cette branche | nouveau projet Supabase gratuit distinct, si le compte a encore un emplacement gratuit |
| Production future | branche `main` après validation | Vercel Production | projet Supabase de production distinct, créé seulement avant lancement |

Le dépôt GitHub conserve l'historique existant. La branche `main` et le projet Supabase actuel restent inchangés. Les 51 démonstrations historiques restent dans la cible actuelle et ne sont ni copiées ni supprimées.

Une Preview Vercel standard suffit pour la préproduction : les environnements personnalisés Vercel sont inutiles à ce stade. Les variables Preview doivent être limitées à la branche `preproduction`.

## État préparé dans le dépôt

- branche locale `preproduction` créée depuis le dernier commit de `main` ;
- workflow GitHub Actions préparé pour `main`, `preproduction`, les demandes de fusion et un lancement manuel connecté ;
- garde `npm run ci:preprod-env` ajoutée avant toute recette connectée ;
- e-mails Auth désactivés, e-mails métier désactivés et nettoyage automatique des démos interdit dans ce job ;
- référence Supabase actuelle explicitement interdite comme cible de préproduction ;
- cron quotidien des récurrences conservé ; cron opérationnel chaque minute retiré du manifeste Vercel, car cette fréquence fait échouer un déploiement Hobby.

Le retrait du cron ne supprime pas sa route. `/api/cron/operations` reste appelable avec son secret pour les essais et pourra être reliée à un planificateur compatible avant les pilotes.

## Ordre de configuration distante

1. Connexion aux tableaux de bord confirmée le 19 octobre 2026.
2. Vercel vérifié : `main` est la branche Production et le projet est relié à `orsocrtnt/tutelliv-v2`.
3. Supabase vérifié : un projet actif et deux projets en pause ; un second emplacement actif Free est disponible. La cible actuelle et la future préproduction utilisent Paris (`eu-west-3`).
4. Terminé le 19 octobre 2026 : `tutelliv-preproduction` créé à Paris sans copie de données, avec exposition automatique des nouvelles tables désactivée et RLS automatique activée.
5. Les secrets propres à cette cible sont stockés dans `.env.preproduction.local`, ignoré par Git et en mode `0600`. Le mot de passe se retrouve dans la variable `SUPABASE_DB_PASSWORD` de ce fichier ; ne jamais le copier dans un rapport, un commit ou la conversation.
6. La migration initiale DB-1 est appliquée et vérifiée sur la base vide : vingt tables métier, registre Prisma, RLS partout, aucun droit navigateur direct, bucket privé et zéro utilisateur Auth. Remplacer les identifiants signalés avant le premier seed ou déploiement.
7. Configurer dans Vercel les variables Preview limitées à `preproduction`. Conserver `AUTH_EMAIL_LINKS_ENABLED=false`, `EMAIL_DELIVERY_MODE=disabled` et `DEMO_CLEANUP_ENABLED=false`.
8. Configurer l'environnement GitHub `preproduction` avec les secrets `PREPROD_*` attendus par le workflow.
9. Pousser la branche seulement après les contrôles précédents. Vérifier que Vercel crée une Preview et ne touche pas au déploiement Production.
10. Lancer le job GitHub connecté manuellement, puis confirmer que les fixtures ont été supprimées.
11. Faire un export logique base + Storage, restaurer sur une cible jetable isolée, chronométrer et vérifier santé, RLS, commandes et photos.

## Variables GitHub nécessaires

- `PREPROD_APP_URL` et `PREPROD_EXPECTED_APP_HOST` ;
- `PREPROD_SUPABASE_URL`, `PREPROD_EXPECTED_SUPABASE_REF` ;
- `PREPROD_SUPABASE_ANON_KEY`, `PREPROD_SUPABASE_SERVICE_ROLE_KEY` ;
- `PREPROD_DATABASE_URL`, `PREPROD_DIRECT_URL` ;
- `PREPROD_CRON_SECRET`, `PREPROD_OPS_HEALTH_SECRET`.

Les valeurs ne doivent apparaître ni dans Git, ni dans un rapport, ni dans les journaux du workflow.

## Conditions d'arrêt

Ne pas pousser si la branche Production Vercel n'est pas confirmée, si la nouvelle référence Supabase n'est pas distincte, si un coût apparaît, ou si la migration demande d'écraser un objet existant. Ne pas tester une restauration sur le projet Supabase actuel.

## Limites des offres gratuites

Supabase Free permet deux projets actifs au total pour un propriétaire/administrateur ; les projets en pause ne comptent pas. Le compte vérifié le 19 octobre 2026 n'en utilise qu'un : développement + préproduction peuvent donc rester gratuits. Les projets gratuits peuvent être mis en pause pour inactivité et ne donnent pas les sauvegardes quotidiennes téléchargeables des offres payantes ; un export logique hors site est nécessaire.

Vercel Hobby fournit les Preview Git, mais limite les crons à une exécution quotidienne et son usage aux projets personnels non commerciaux. Il convient pour préparer techniquement la Preview, pas pour exploiter les pilotes ou vendre TutelLiv. Une offre Vercel commerciale devra être validée avant cette étape.

Sources : [Vercel Git](https://vercel.com/docs/git), [Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Supabase facturation](https://supabase.com/docs/guides/platform/billing-on-supabase), [Supabase sauvegardes](https://supabase.com/docs/guides/platform/backups).
