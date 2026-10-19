# ENV-1 — Inventaire local des environnements

Date : 17 octobre 2026. Avancement partiel en lecture seule ; aucune ressource, variable distante ou donnée n'a été créée, modifiée ou supprimée.

## Résultat

L'inventaire automatisé confirme un seul jeu local de configuration, classé comme cible de test autorisée. L'origine de l'application est locale. Supabase est configuré ; le runtime PostgreSQL utilise le pooler sur le port 6543 et l'accès direct le port 5432. Sept variables runtime sur huit sont persistées localement. `OPS_HEALTH_SECRET` est fourni temporairement au serveur de vérification, mais absent de `.env.local`.

Le dépôt distant utilise GitHub et le dossier est relié localement à Vercel. Le workflow CI-1 est préparé. Aucun environnement préproduction ou production distinct, aucune comparaison de secrets et aucune protection distante ne sont toutefois vérifiés.

Les liens d'authentification e-mail, l'expéditeur métier et le webhook opérationnel sont désactivés. `.env.local` est ignoré par Git. La preuve ne contient ni hôte, ni URL, ni clé, ni chaîne de connexion ; elle rapporte zéro mutation et zéro valeur dévoilée.

## Architecture préparée

La procédure propose trois frontières : développement sur la cible fictive actuelle, préproduction sur un projet Supabase séparé et une Preview Vercel stable/protégée, puis production sur un troisième projet et l'environnement Vercel Production. Tous les secrets d'accès, cron, santé et notification doivent être indépendants.

Cette structure suit les recommandations actuelles des fournisseurs : [Supabase — Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments), [Vercel — Environments](https://vercel.com/docs/deployments/environments).

## Validation

L'inventaire a été exécuté deux fois avec le même classement et zéro mutation. Son script passe ESLint strict. Le contrôle de 37 documents, le scanner de secrets sur 796 fichiers et `git diff --check` réussissent. Le contrôle dédié confirme que `.env.local` est ignoré et que la preuve rapporte zéro valeur sensible.

## Blocages

- accès aux tableaux de bord Supabase, Vercel et GitHub ;
- décision et éventuel coût de deux cibles supplémentaires ;
- baseline et migrations DB-1 avant initialisation contrôlée ;
- clés SMTP/webhook seulement après choix des canaux.

Preuve : `outputs/env1/inventory.json`. ENV-1 reste ouverte jusqu'à une recette connectée sur une préproduction réellement isolée.
