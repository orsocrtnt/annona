---
name: tutelliv-recette
description: Recette navigateur d'une branche TutelLiv sur la base de développement tutelliv-dev — deux serveurs au plus sur un commit figé, comptes de test par rôle, parcours cliqués, captures Light/Dark, E2E ciblés, nettoyage. À utiliser par l'agent de recette ou l'orchestrateur avant de déclarer qu'un écran ou un parcours fonctionne.
---

# Recette navigateur TutelLiv

Une recette prouve qu'un parcours marche **dans le navigateur**. Lire le JSX ou un test unitaire n'en est pas une. Elle ne corrige rien : elle constate, chiffre et rend des défauts reproductibles.

## Garde-fous (non négociables)

- **Base de développement uniquement.** Avant toute commande, lancer depuis le dossier principal `npm run -s env2:verify-dev`, qui doit renvoyer `{"passed":true}`. Sinon, s'arrêter et le signaler. Préproduction (`zwwyalsslyydubtetagj`) et production sont interdites.
- **Deux serveurs au maximum**, sur 3110 et 3111, chacun avec `DATABASE_CONNECTION_LIMIT=5` (le mode session est limité à 15 connexions). Le second n'est autorisé que si `memory_pressure` indique au moins 35 % de RAM libre. Vérifier ce qui écoute : `lsof -nP -iTCP -sTCP:LISTEN | grep -E ':31(0[0-9]|1[0-9]|2[0-9])'`, puis prendre le premier port libre des deux. Ne jamais arrêter un processus qu'on n'a pas lancé : si les deux ports sont occupés, le signaler et attendre.
- **Recette sur un commit figé** : l'orchestrateur prépare un worktree de recette détaché sur le commit à tester (`git worktree add --detach .claude/worktrees/recette-<n> <sha>`, puis `npm ci` et `npx prisma generate` sous `lourd.sh`). Les fusions peuvent ainsi continuer sur l'intégration sans changer le code sous les yeux de l'agent de recette. Le rapport cite toujours le SHA testé.
- **Ne jamais lire ni copier les `.env*`.** Dans un worktree, injecter l'environnement du dossier principal sans le copier : `npx dotenv -e /Users/orso/Developer/TutelLiv-GPT/.env.local -- <commande>`.
- **Données de test identifiables seulement** : comptes `e2e-*@tutelliv.fr`, personas de démo, préfixe `E2E` dans les libellés. Conserver les données préexistantes. Nettoyer à la fin, même en cas d'échec.
- **Migrations d'une branche** : les appliquer seulement si l'orchestrateur a relu et autorisé le SQL, sur tutelliv-dev uniquement, avec `npx dotenv -e /Users/orso/Developer/TutelLiv-GPT/.env.local -- npx prisma migrate deploy`, lancé depuis le worktree de la branche. Noter le nom de chaque migration appliquée dans le rapport.
- Pas de push, de merge, de déploiement ni de modification du code. Aucune donnée personnelle réelle dans les captures.

## Déroulé

1. **Préparer** (dans le worktree de la branche) : `git log --oneline preproduction..HEAD`, puis `npm ci` si `node_modules` manque, puis `npx prisma generate`. Lire le rapport de l'agent (`docs/rapports/agents/2026-10-28-*.md`) : il liste les écrans et les parcours à recetter.
2. **Démarrer un serveur** sur le port libre attribué (3110 ou 3111), en arrière-plan, journal dans `outputs/recette-agents/<branche>/server.log` :
   `npx dotenv -e /Users/orso/Developer/TutelLiv-GPT/.env.local -- env DATABASE_CONNECTION_MODE=session DATABASE_CONNECTION_LIMIT=5 npx next dev --turbopack -H 127.0.0.1 -p 3110`
   Attendre que `curl -s -o /dev/null -w '%{http_code}' http://localhost:3110/login` renvoie 200, en vérifiant par tranches de 30 s au moins.
3. **Comptes** :
   - administrateur, client et livreur : personas de démo via `POST /api/demo/persona` (voir `tests/e2e/v1-roles.spec.ts`) ;
   - dispatcher, mini-admins, super-admin et administrateurs de facturation A et B : `npx dotenv -e /Users/orso/Developer/TutelLiv-GPT/.env.local -- npx tsx scripts/e2e/dev-role-accounts.ts setup`. Le manifeste est écrit dans `outputs/e2e-role-accounts.json` : ne jamais recopier les mots de passe dans un rapport.
4. **Parcours cliqués**, avec Playwright via un script ou la CLI, Chrome (`channel: "chrome"`), sur `http://localhost:3110`. Pour chaque parcours annoncé par la branche :
   - cas nominal, puis états voisins : retour arrière, rechargement, double clic, entrée invalide, rôle non autorisé, autre entreprise ;
   - clavier : tabulation, focus visible, Échap sur les modales ;
   - thème clair et sombre si la branche touche au design, et largeurs 390 px et 1 280 px ;
   - console : zéro erreur ; noter les violations CSP, y compris en Report-Only.

   Captures : `outputs/recette-agents/<branche>/<parcours>-<état>.png`.
5. **E2E ciblés** de la branche (jamais toute la suite par défaut) :
   `E2E_BASE_URL=http://localhost:3110 E2E_SKIP_WEB_SERVER=1 npx dotenv -e /Users/orso/Developer/TutelLiv-GPT/.env.local -- npx playwright test tests/e2e/<spec>.spec.ts`
   Les specs se déconnectent à la fin pour libérer le pool de démo.
6. **Non-régression minimale**, à chaque recette : connexion et déconnexion, `/dashboard`, `/dispatch/map` avec la carte qui s'affiche, `/portal/orders`, `/driver/missions`, sans erreur console.
7. **Nettoyer** : `npx dotenv -e /Users/orso/Developer/TutelLiv-GPT/.env.local -- npx tsx scripts/e2e/dev-role-accounts.ts cleanup`, puis suppression des données `E2E` créées pendant la passe, puis arrêt du serveur lancé (son PID uniquement). Vérifier que le port est libre.

## Rapport (moins de 400 mots)

- Branche, commit testé, migrations appliquées.
- Tableau parcours → résultat (OK, KO ou non testé), avec capture et étapes de reproduction pour chaque KO.
- Défauts classés **bloquant**, **majeur** ou **mineur**, chacun avec la cause probable (`fichier:ligne` si identifiable) et le correctif attendu, sans l'implémenter.
- Ce qui n'a pas pu être testé et pourquoi (migration non autorisée, e-mail non configuré, téléphone réel nécessaire).
- Preuve du nettoyage : comptes supprimés, port libre.
