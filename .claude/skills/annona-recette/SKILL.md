---
name: annona-recette
description: Recette navigateur d'une branche Annona sur la base de développement annona-dev — deux serveurs au plus sur un commit figé, comptes de test par rôle, parcours cliqués, captures Light/Dark, E2E ciblés, nettoyage. À utiliser par l'agent de recette ou l'orchestrateur avant de déclarer qu'un écran ou un parcours fonctionne.
---

# Recette navigateur Annona

Une recette prouve qu'un parcours marche **dans le navigateur**. Lire le JSX ou un test unitaire n'en est pas une. Elle ne corrige rien : elle constate, chiffre et rend des défauts reproductibles.

## Garde-fous (non négociables)

- **Base de développement uniquement.** Avant toute commande, lancer depuis le dossier principal `npm run -s env2:verify-dev`, qui doit renvoyer `{"passed":true}`. Sinon, s'arrêter et le signaler. Préproduction (`zwwyalsslyydubtetagj`) et production sont interdites.
- **Deux serveurs au maximum**, sur 3110 et 3111, chacun avec `DATABASE_CONNECTION_LIMIT=5` (le mode session est limité à 15 connexions). Le second n'est autorisé que si `memory_pressure` (macOS) indique au moins 35 % de RAM libre. Vérifier ce qui écoute : `lsof -nP -iTCP -sTCP:LISTEN | grep -E ':31(0[0-9]|1[0-9]|2[0-9])'` (macOS) ou `netstat -ano | grep -E ':31[0-2][0-9] .*LISTENING'` (Windows, Git Bash), puis prendre le premier port libre des deux. Ne jamais arrêter un processus qu'on n'a pas lancé : si les deux ports sont occupés, le signaler et attendre.
- **Recette sur un commit figé** : l'orchestrateur prépare un worktree de recette détaché sur le commit à tester (`git worktree add --detach .claude/worktrees/recette-<n> <sha>`, puis `npm ci` et `npx prisma generate` sous `lourd.sh`). Les fusions peuvent ainsi continuer sur l'intégration sans changer le code sous les yeux de l'agent de recette. Le rapport cite toujours le SHA testé.
- **Ne jamais lire ni copier les `.env*`.** Dans un worktree, injecter l'environnement du dossier principal sans le copier : `npx dotenv -e <dossier principal>/.env.local -- <commande>`. Ci-dessous, `$MAIN` désigne ce dossier principal, propre à chaque développeur : `/Users/orso/Developer/Annona` chez Orso, `C:/Users/theon/annona` chez Théo.
- **Données de test identifiables seulement** : comptes de démo du seed, préfixe `E2E` ou `test-<prénom>-` (`test-orso-…`, `test-theo-…`) dans les libellés. Conserver les données préexistantes et ne jamais toucher à celles de l'autre développeur (`AGENTS.md`, « Travail à deux »). Nettoyer à la fin, même en cas d'échec.
- **Migrations d'une branche** : les appliquer seulement si l'orchestrateur a relu et autorisé le SQL, sur annona-dev uniquement, après l'avoir annoncé dans la tâche de `TODO.md` (un seul développeur à la fois sur le schéma), avec `npx dotenv -e $MAIN/.env.local -- npx prisma migrate deploy`, lancé depuis le worktree de la branche. Noter le nom de chaque migration appliquée dans le rapport.
- Pas de push, de merge, de déploiement ni de modification du code. Aucune donnée personnelle réelle dans les captures.

## Déroulé

1. **Préparer** (dans le worktree de la branche) : `git log --oneline base..HEAD`, puis `npm ci` si `node_modules` manque, puis `npx prisma generate`. Lire le rapport de l'agent (`docs/rapports/agents/2026-10-28-*.md`) : il liste les écrans et les parcours à recetter.
2. **Démarrer un serveur** sur le port libre attribué (3110 ou 3111), en arrière-plan, journal dans `outputs/recette-agents/<branche>/server.log` :
   `npx dotenv -e $MAIN/.env.local -- env DATABASE_CONNECTION_MODE=session DATABASE_CONNECTION_LIMIT=5 npx next dev --turbopack -H 127.0.0.1 -p 3110` (sous Windows, depuis Git Bash : `env` y existe, pas dans PowerShell)
   Attendre que `curl -s -o /dev/null -w '%{http_code}' http://localhost:3110/login` renvoie 200, en vérifiant par tranches de 30 s au moins.
3. **Comptes** : ceux du seed de démo (`prisma/seed.ts`), rangés dans `$MAIN/outputs/comptes-demo.json` (et `.md`), dossier ignoré par git. Clés : `super-admin`, `admin`, `mini-admin` (modules commandes et suivi), `boulanger`, `client-1` à `client-3`, `livreur-1` à `livreur-5`. Connexion : `/login` (admin, mini-admin, boulanger, super-admin), `/login/client` (clients), `/login/driver` (livreurs). Lecture du fichier dans un script, jamais affichée : voir `account()` et `open()` dans `tests/e2e/lot1-recette.spec.ts`. Ne jamais recopier un mot de passe dans un rapport, un journal ou une capture.
   - Fichier absent (nouveau clone, autre développeur) : le demander au propriétaire par un canal sûr. **Ne pas relancer `npm run db:seed` pour l'obtenir** : sans ce fichier, le seed tire de nouveaux mots de passe et les impose dans Supabase, ce qui casse le fichier de l'autre développeur ; un seed est de toute façon une opération à annoncer (`AGENTS.md`).
   - Un agent ne se connecte pas à un compte par un lien magique ou une session fabriquée avec la clé `service_role` : le garde-fou de la session le refuse. Sans comptes, noter « non testé : comptes de démo absents » et le signaler.
   - Rôles absents du seed (dispatcher, administrateurs de facturation de deux entreprises…) : plus de script dédié (`scripts/e2e/dev-role-accounts.ts` a été retiré avec l'ancien produit) ; les créer seulement si la recette l'exige, préfixés `test-<prénom>-`, et les supprimer au nettoyage.
4. **Parcours cliqués**, avec Playwright via un script ou la CLI, Chrome (`channel: "chrome"`), sur `http://localhost:3110`. Pour chaque parcours annoncé par la branche :
   - cas nominal, puis états voisins : retour arrière, rechargement, double clic, entrée invalide, rôle non autorisé, autre entreprise ;
   - clavier : tabulation, focus visible, Échap sur les modales ;
   - thème clair et sombre si la branche touche au design, et largeurs 390 px et 1 280 px ;
   - console : zéro erreur ; noter les violations CSP, y compris en Report-Only.

   Captures : `outputs/recette-agents/<branche>/<parcours>-<état>.png`.
5. **E2E ciblés** de la branche (jamais toute la suite par défaut) :
   `E2E_BASE_URL=http://localhost:3110 E2E_SKIP_WEB_SERVER=1 PLAYWRIGHT_CHANNEL=chrome npx dotenv -e $MAIN/.env.local -- npx playwright test tests/e2e/<spec>.spec.ts`
   Les specs se déconnectent à la fin. `tests/e2e/v1-roles.spec.ts` (réécrite le 13 novembre) contrôle vite les quatre rôles avec les comptes du seed, sans rien écrire en base.
6. **Non-régression minimale**, à chaque recette : connexion et déconnexion, `/dashboard` avec la carte des tournées qui s'affiche, puis changement de page aussitôt (console sans erreur), `/dashboard/tracking`, `/portal/orders`, `/driver` (la tournée du livreur), sans erreur console.
7. **Nettoyer** : supprimer les données `E2E` et `test-<prénom>-` créées pendant la passe (jamais les comptes du seed), puis arrêter le serveur lancé (son PID uniquement). Vérifier que le port est libre.

## Rapport (moins de 400 mots)

- Branche, commit testé, migrations appliquées.
- Tableau parcours → résultat (OK, KO ou non testé), avec capture et étapes de reproduction pour chaque KO.
- Défauts classés **bloquant**, **majeur** ou **mineur**, chacun avec la cause probable (`fichier:ligne` si identifiable) et le correctif attendu, sans l'implémenter.
- Ce qui n'a pas pu être testé et pourquoi (migration non autorisée, e-mail non configuré, téléphone réel nécessaire).
- Preuve du nettoyage : comptes supprimés, port libre.
