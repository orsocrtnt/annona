---
name: tutelliv-orchestre
description: Lancer et piloter en autonomie un chantier multi-agents TutelLiv — orchestrateur décideur, agents de code par lot avec le modèle adapté au risque, recette navigateur, double vérification (code-review + Codex) puis push sur preproduction. À utiliser quand le propriétaire demande un chantier avec plusieurs agents.
---

# Orchestre — chantier multi-agents TutelLiv

Lancement : `/tutelliv-orchestre`, ou « lance le chantier multi-agents ». Les lots ci-dessous sont ceux du chantier n° 2 ; pour un chantier suivant, les recalculer depuis `TODO.md` selon la même méthode.

## Mandat : autonomie totale

Le propriétaire n'est pas là pendant le chantier. **L'orchestrateur est le patron et le décideur** : il tranche, lance, relance, remplace ou recadre les agents, et le chantier continue tant que le propriétaire n'intervient pas. Il ne s'arrête et ne pose une question que si la réponse est indispensable au sens même du projet : une décision commerciale ou juridique engageante, une dépense, une donnée réelle, une action irréversible.

- **Décisions produit et visuelles** : l'orchestrateur les prend lui-même, avec l'option la plus prudente et la plus cohérente avec `DESIGN.md`, `docs/DECISIONS_PRODUIT_COMMERCIALES.md` et les décisions passées. Chacune est consignée en une ligne dans le rapport final, avec l'alternative écartée, pour pouvoir la revoir.
- **Pilotage des agents** : vérifier leur avancement toutes les 15 à 20 minutes (commits, fichiers modifiés, serveurs), sans lire leurs transcriptions. Un agent sans progrès en 30 minutes est relancé avec un message précis, ou remplacé. Un agent qui tourne en rond sur le même échec deux fois change d'approche. Si un lot est trop gros, le découper ; si des agents sont libres, lancer le lot suivant.
- **Blocage réel** : le noter, mettre le lot de côté et continuer les autres. Ne jamais attendre sans rien faire.
- **Fin** : un rapport concis et précis au propriétaire (moins d'une page) : ce qui est livré, les décisions prises à sa place, ce qui n'a pas pu être vérifié, ce qui reste à faire de son côté.

## Rôles

- **Orchestrateur (Claude Opus, conversation principale)** : prépare les branches, lance les agents, relit chaque branche, fusionne, tient `TODO.md`, parle au propriétaire en français simple et court. Il ne code pas lui-même, sauf micro-correctif.
- **Agents de code** : un par lot, dans un worktree `.claude/worktrees/agent-<lot>` sur une branche `agent/<lot>`, partie du dernier `preproduction` local. Modèle selon le risque (voir tableau).
- **Agent de recette (Sonnet)** : clique dans le navigateur, branche par branche, sur un worktree détaché au commit testé (skill `tutelliv-recette`). Il constate, ne corrige rien, et renvoie la liste des défauts à corriger.
- **Vérificateur final (agent Opus neuf, lancé par l'orchestrateur)** : le dernier rempart, quand tout est fusionné. Il ne connaît que le code, les critères « Terminé quand » des tâches et ce journal d'erreurs, jamais les conclusions des agents. Il lance lui-même :
  - `npm run check` et `npm run build` sous Node 22 ;
  - les E2E ciblés du chantier et la non-régression minimale sur un serveur (3110) ;
  - les tests PostgreSQL réels ;
  - une revue adverse du diff complet de l'intégration.

  Il rend une liste de défauts prouvés. Tant qu'il reste un défaut important, on corrige et il revérifie.
- **Codex en complément** (autre fournisseur, autre regard) : lancé par l'orchestrateur lui-même, jamais par le propriétaire, en même temps que le vérificateur final, sur une liste fermée. **Le propriétaire n'a plus à faire intervenir ChatGPT ou Codex pour vérifier** : toute la vérification est dans le chantier.
- **Commit et push** : un seul envoi groupé sur `preproduction`, puis contrôle du déploiement Vercel. Le propriétaire a demandé ce déroulé complet, push compris. Il n'a lieu que si tout est vert : check, build, recette, et Codex sans défaut important ouvert. Jamais `main` ni la production.
- **Migrations** : les lots évitent tout changement de schéma. Si un lot en a vraiment besoin, la migration est additive, relue, appliquée sur tutelliv-dev seulement. Ce lot reste alors **hors du push** et il est signalé dans le rapport, car la préproduction exige l'accord du propriétaire.

## Choix des modèles

| Type de travail | Modèle |
|---|---|
| Sécurité, concurrence, données, changement transversal (thème de tout le site) | Opus |
| Écran, parcours, validation de formulaire, tests E2E | Sonnet |
| Recherche dans le code, inventaire, résumé de journaux | Haiku (`explorateur`) |
| Lancer les vérifications (`npm run check`, E2E) | Sonnet (`verificateur`) |

## Trois abonnements : Claude, Codex et Cursor

Le propriétaire paie les trois. Chacun a des limites qui correspondent à son abonnement :

- **Claude Max à 100 $** : le plus gros quota, donc le fournisseur principal ;
- **Codex à 30 $** et **Cursor à 30 $** : des quotas nettement plus petits, en appoint.

Politique :
- **Claude d'abord.** Tant que le quota Claude suffit, tout passe par Claude, sauf la vérification finale Codex, qui est indispensable.
- **Codex** : la vérification finale est prioritaire sur son quota. Il ne prend un lot de code que si Claude approche de sa limite ou si un lot gagne vraiment à être fait en parallèle. Son prompt de vérification reste ciblé (liste fermée), jamais un audit complet répété.
- **Cursor** : facultatif. On ne l'utilise que si Claude est limité ou si le chantier a plus de lots indépendants que Claude ne peut en mener en même temps. Si on n'en a pas besoin, on ne l'utilise pas.
- Au propriétaire de dire si son crédit devient bloquant. Sinon, l'orchestrateur choisit, et le rapport final indique quel fournisseur a fait quoi.
- **Signes de limite** à surveiller : erreurs « rate limit », « usage limit » ou 429, agent interrompu. Dans ce cas, reporter le lot sur un autre fournisseur, sans attendre.

| Fournisseur | Rôle | Lancement depuis la conversation (Bash, en arrière-plan, dans le worktree du lot) |
|---|---|---|
| **Claude** | Orchestration, lots risqués (Opus), recette navigateur | Agent tool, avec `model: opus`, `sonnet` ou `haiku` |
| **Codex** | Vérification finale indépendante (prioritaire) ; lot de code seulement en appoint | `~/.cursor/extensions/openai.chatgpt-*/bin/macos-aarch64/codex exec -m gpt-6.1-sol -c model_reasoning_effort=medium -s workspace-write -C <worktree> -o <rapport> "<prompt>" < /dev/null` |
| **Cursor** | Facultatif : 1 ou 2 lots moyens (écran, finitions) si Claude est limité | `cd <worktree> && cursor-agent -p --output-format text --model <modèle> "<prompt>" > <journal>` (`cursor-agent --list-models` pour choisir) |

Règles :
- **Relecture croisée** : un lot codé par un fournisseur est relu par un autre. Codex ne vérifie jamais seul un lot qu'il a codé. Un lot Codex ou Cursor passe par la relecture `code-review` de Claude et par la recette.
- Les agents Codex et Cursor reçoivent **le même prompt de lot** que les agents Claude : mêmes règles de sécurité, même pré-vol, même rapport. Ils ne lancent pas eux-mêmes de sous-agent de pré-vol : l'orchestrateur fait la contre-revue à leur place.
- Le sandbox Codex interdit l'écoute réseau et Chrome. Les lots qui demandent un serveur ou un navigateur vont à Claude ou à Cursor.
- Suivre l'avancement par les commits et les journaux. Si un fournisseur atteint sa limite, réaffecter le lot.

## Étape 0 — avant de lancer quoi que ce soit (orchestrateur)

1. `git status` : commiter d'abord les ajouts du propriétaire dans `TODO.md` s'ils sont encore en attente.
2. Node 22 actif (`node -v` → v22.x). Sinon, préfixer les commandes par `PATH=/opt/homebrew/opt/node@22/bin:$PATH`.
3. **L'orchestrateur tranche lui-même**, avant de lancer, les décisions qui bloqueraient un agent en cours de route, et les écrit dans le prompt des agents :
   - RECETTE-2810, points 6, 7, 11 et 12 ;
   - DESIGN-2 : parcours « Première livraison » masquable ;
   - UX-ALERTES : alertes conservées en haut de page ;
   - direction visuelle de LANDING-2.

   Aucun questionnaire au propriétaire. Le périmètre de DISPATCH-4 a été cadré par le propriétaire le 29 octobre ; les prix restent à sa décision.
4. Vérifier la RAM (`memory_pressure`) et les ports 3110 et 3111.

## Lots — vague 1 (lancés en même temps)

| Lot | Tâches TODO | Modèle | Fichiers principaux | Serveur |
|---|---|---|---|---|
| **A — Design** | DESIGN-2 sauf site public : mode sombre du back-office, du dispatch, de `/admin` et de l'app livreur ; **suppression des dégradés** ; surfaces lisibles (tableaux, Chauffeurs) | Opus | `globals.css`, `src/lib/theme.ts`, layouts | 3110, partagé |
| **B — Carte** | MAP-INTERACTION (**carte unifiée** Livreurs/Livraisons, marqueurs cliquables) + MAP-3 + **carte sombre** | Sonnet | composants de carte, tableau de bord | 3111, partagé |
| **C — Alertes** | UX-ALERTES (**alertes mieux placées**) + la partie « explications permanentes » d'UX-04 | Sonnet | blocs d'alerte, pages d'espace | partagé |
| **D — Factur-X** | FACTURX-SAISIE + CONFIG-MSG (Factur-X d'abord, puis Stripe, e-mail, commande par message, dispatch, preuve) | Sonnet | `einvoicing-settings-card.tsx`, `src/lib/validations/einvoicing.ts` | partagé |
| **E — Finitions** | UX-NAV-SCROLL + RECETTE-2810 (points restants et décisions prises à l'étape 0) | Sonnet | navigation, petits correctifs | partagé |
| **F — Données de test** | Jeux E2E identifiables sur tutelliv-dev : factures A/B (dont une en retard), une livraison terminée avec preuve, une mission en livraison. Les tests aujourd'hui ignorés faute de données doivent tourner. | Sonnet | `scripts/e2e/`, `tests/e2e/` | partagé |
| **L1 — Landing, directions** | LANDING-2, phase 1 : 2 ou 3 directions visuelles de la landing et de la connexion (maquettes HTML et captures). L'orchestrateur choisit, et les directions écartées sont gardées pour le rapport. **Aucun code produit.** | Opus | maquettes dans `outputs/` | aucun |

## Vague 2

| Lot | Tâches | Modèle |
|---|---|---|
| **L2 — Landing, construction** | LANDING-2 sur la direction choisie + mode sombre du site public (la part de DESIGN-2 laissée par le lot A) | Opus |
| **G — Dispatch avancé, tranche 1** | DISPATCH-4, cadré le 29 octobre (voir la tâche dans `TODO.md`) : les 3 meilleurs livreurs proposés, avec le vrai temps de trajet (OSRM gratuit, en cache) et la raison du choix ; affectation en un clic ; mode « suggestion » ou « automatique » au choix de l'entreprise ; dimensionné pour une grande flotte. Les tournées viennent en tranche 2, dans un chantier suivant. **Aucun changement de prix.** | Opus |

Ordre de fusion sur `integration/<date>` : F, D, E, C, B, puis A, le plus transversal, rebasé en dernier, puis L2.

## Ce qui reste hors chantier

Bloqué par le propriétaire ou par l'extérieur :
- PROPRIO-2810 (secrets, clés, validation Factur-X officielle) ;
- SEC-05 et EMAIL (domaine d'envoi) ;
- MOB-01C (téléphones réels) ;
- LEGAL-1, PILOT-1 et PILOT-2, OFFER-1, PERF-02 (charge en préproduction).

## Règles données à chaque agent (à recopier dans leur prompt)

- Worktree et branche imposés ; ne jamais modifier `TODO.md` ; pas de push ni de merge ; commits en français.
- Base tutelliv-dev uniquement (`env2:verify-dev` → passed) ; ne jamais lire de `.env*` ; environnement via `npx dotenv -e /Users/orso/Developer/TutelLiv-GPT/.env.local --` ; données préfixées `E2E`, nettoyées à la fin.
- Commandes lourdes via `outputs/suivi-agents/lourd.sh` ; Node 22.
- **Pré-vol adverse obligatoire** avant le rapport : un sous-agent tente de casser le travail sur les classes de défauts que Codex a trouvées tard :
  - entrelacements concurrents ;
  - réponse réseau ambiguë et rejeu ;
  - double clic ;
  - données personnelles dans toutes les sorties ;
  - mauvais rôle ou autre entreprise ;
  - test qui recharge sans attendre la requête ;
  - état sans données ;
  - **données héritées au déploiement** : tâches, relances ou lignes créées par l'ancien code et reprises par le nouveau ;
  - **contrat du fournisseur externe** (Resend, Stripe, Supabase, OSRM) vérifié dans sa documentation officielle, tous les codes de réponse et pas seulement le cas nominal.
- **Traiter la classe du défaut, pas le symptôme** : inventorier tous les appelants et tous les cas voisins avant de corriger.
- **Attendre le verdict du pré-vol avant de rendre le rapport.** Jamais de remise avec une contre-revue « encore en cours ».
- **Rien d'annoncé sans preuve** : ce qui n'a pas pu être exercé (données absentes, écran inaccessible) est écrit « non vérifié », avec la raison.
- **Tests qui prouvent vraiment** (erreur vue deux fois, donc obligatoire) : ne simuler que la frontière externe (Prisma, réseau, fournisseur), jamais la fonction testée elle-même. Pour la concurrence, un test sur PostgreSQL réel.
- **Panne d'une dépendance** sur un chemin critique (connexion, middleware, paiement) : base ou fournisseur en panne → réponse maîtrisée (503 et message), jamais une erreur 500 ni un accès laissé ouvert.
- Si l'écran change : captures Light et Dark à 390 et 1 280 px dans `outputs/recette-agents/<lot>/`.
- Fin : `npm run check` vert, `git diff --check` propre, rapport de moins de 400 mots dans `docs/rapports/agents/<date>-<lot>.md`. Le rapport se termine par une rubrique « Erreurs et leçons ».

## Boucle de vérification (un seul aller-retour visé par lot)

1. Dès qu'un agent rend son rapport : relecture `code-review` de l'orchestrateur et recette navigateur **en même temps**. Les deux listes de défauts sont fusionnées et renvoyées **une seule fois** à l'agent.
2. Fusion sur l'intégration dès que le lot est propre, sans attendre les autres.
3. **Galerie de captures** avant/après (artifact privé), jointe au rapport final : le propriétaire relit tout le visuel en une seule fois, après coup, sans bloquer le chantier.
4. À la fin, quand tout est fusionné : le **vérificateur final Opus** et **Codex** (liste fermée des critères « Terminé quand ») sont lancés en même temps. Leurs défauts sont fusionnés et corrigés en un seul tour, puis le vérificateur final contrôle à nouveau les seuls points corrigés. Un défaut hors liste n'est corrigé tout de suite que s'il est prouvé et important ; sinon, il va dans la TODO. Push seulement quand le vérificateur final ne signale plus aucun défaut important.
5. Mise à jour de `TODO.md` + `npm run todo:progress`, commit groupé, puis push sur feu vert et contrôle du déploiement.

## Retour d'expérience du chantier n° 1 (28 et 29 octobre 2026)

### Ce qui a marché
- **Agents en parallèle dans des worktrees séparés**, fusionnés un par un sur une branche d'intégration : 9 chantiers livrés en une journée, sans casse.
- **Pré-vol adverse par un sous-agent Opus** : il a trouvé 3 défauts importants sur les relances e-mail avant toute relecture externe.
- **Tests sur PostgreSQL réel** (tutelliv-dev) : ils ont révélé un vrai défaut que les tests simulés laissaient passer (le limiteur de connexion autorisait 10 tentatives sur 12 au lieu de 5).
- **Codex confronté aux sources officielles** : il a trouvé le vrai défaut C5 (codes 409 de Resend).
- **Recette sur un worktree détaché au commit testé**, et liste de défauts fusionnée puis renvoyée une seule fois à l'agent.

### Ce qui n'a pas marché, et la règle qui en découle
| Problème constaté | Règle |
|---|---|
| Codex a dit « pas bon » 3 fois de suite : chaque passe trouvait la couche suivante (I1, puis C1 à C4, puis C5), parce que les correctifs traitaient le symptôme et que Codex changeait de périmètre à chaque fois. | Classe du défaut et contrat fournisseur dans le pré-vol ; Codex sur une **liste fermée** ; une seule passe finale. |
| Tests « ignorés » ou écrans non vérifiés faute de données (pas de livraison terminée, pas de facture dans l'entreprise B, pas de mission en cours), relevés à chaque passe comme « non vérifié ». | **Lot « Données de test » en premier**, avant les recettes. |
| Défauts découverts tard sur la bascule de déploiement (données créées par l'ancien code). | Ajouté au pré-vol. |
| Contre-revue d'un agent arrivée après sa remise : verdict orphelin. | L'agent attend son pré-vol. |
| Après une fusion : client Prisma périmé (erreurs de types) et dépendance manquante (`@anthropic-ai/sdk`). | Après chaque fusion : `npx prisma generate` ; `npm ci` si `package-lock.json` a changé, dans l'intégration **et** dans le dossier principal après l'avance rapide. |
| `prisma format` a reformaté tout le schéma pendant la résolution d'un conflit. | Résoudre les conflits de schéma à la main ; jamais `prisma format` sur un fichier en conflit. |
| `npm run build` a échoué sans environnement. | `npx dotenv -e /Users/orso/Developer/TutelLiv-GPT/.env.local -- npm run build`. |
| Fichiers non suivis identiques qui bloquaient l'avance rapide du dossier principal. | Les comparer (`cmp`), les retirer s'ils sont identiques, puis `git merge --ff-only`. |
| Node 20 en local alors que le projet exige Node 22. | `node -v` à l'étape 0 ; sinon préfixe `PATH=/opt/homebrew/opt/node@22/bin:$PATH` pour tous les agents. |
| Le sandbox Codex interdit l'écoute réseau et Chrome : le test PERF-02 échoue en EPERM, et la recette navigateur est impossible. | Codex en lecture et en API seulement ; l'échec EPERM n'est pas un défaut du code. |
| Agent de recette tombé sur une coupure réseau (ENOTFOUND). | Le reprendre avec SendMessage quand le réseau revient, plutôt que le relancer de zéro. |
| Pool limité à 15 connexions en mode session : des 503 sur la connexion pendant une minute au démarrage. | `DATABASE_CONNECTION_LIMIT=5` par serveur, deux serveurs au plus, et attendre le 200 sur `/login`. |
| Des tâches proposées au propriétaire étaient déjà faites. | Vérifier le code et la case dans `TODO.md` avant de proposer quoi que ce soit. |
| Salle de contrôle maison : du temps passé à corriger le classement des agents. | Pas de tableau de bord maison pendant un chantier. Un point court au propriétaire suffit. |
| Explications techniques et messages longs : « je comprends pas », « c'est long ». | Mémoire `tutelliv-comment-me-parler` : verdict d'abord, mots du produit, listes courtes. |

### Ce qui ralentissait, et comment le paralléliser
Avant, tout était séquentiel : attendre la fin de l'agent, relire, renvoyer les corrections, fusionner, puis préparer Codex. Désormais, en pipeline :
1. Dès le **premier commit** d'un agent, la relecture de l'orchestrateur démarre, pendant que l'agent finit ses tests.
2. Une branche verte est **fusionnée tout de suite**. L'intégration (`npm ci` sous Node 22, `prisma generate`, check) avance pendant que les autres agents travaillent.
3. Le **prompt Codex** (liste fermée, `__SHA__` à remplacer) est écrit pendant que les agents codent. Codex part dès la dernière fusion.
4. Le **build** et le **check** de l'intégration tournent pendant la passe Codex. Pas de build en même temps qu'un serveur de développement dans le même worktree.
5. **Durées observées**, pour annoncer des délais réalistes :
   - agent de code : 25 à 45 minutes ;
   - relecture adverse : environ 8 minutes ;
   - tour de corrections : 20 à 30 minutes ;
   - passe Codex ciblée : 15 à 20 minutes.

   Un agent sans commit après 45 minutes est contrôlé.
6. **Le délai est annoncé dès le lancement**, avec une phrase par étape franchie.

## Apprentissage continu (obligatoire à chaque chantier)

Ce skill s'améliore à chaque erreur. L'orchestrateur ne la laisse jamais se reproduire.

1. **Sur le moment** : chaque erreur notable (agent qui se trompe, défaut trouvé tard par la relecture ou par Codex, commande qui échoue, attente inutile, incompréhension du propriétaire) est notée dans `outputs/suivi-agents/erreurs-<date>.md` en une ligne : ce qui s'est passé, la cause, la règle qui l'aurait évitée.
2. **Avant de lancer chaque agent** : relire le tableau « Ce qui n'a pas marché » et le journal d'erreurs du chantier en cours. Les règles qui concernent le lot vont dans le prompt de l'agent. Une erreur déjà vue ne doit pas revenir.
3. **Une erreur qui revient deux fois** devient une règle obligatoire du pré-vol ou des « Règles données à chaque agent », pas une simple ligne du retour d'expérience.
4. **En fin de chantier, avant le rapport** :
   - mettre à jour ce skill : ajouter les lignes au tableau, ajuster les durées observées, retirer une règle devenue inutile ;
   - mettre à jour le skill `tutelliv-recette` si une erreur vient de la recette ;
   - mettre à jour la mémoire, en particulier `tutelliv-comment-me-parler` pour tout ce qui concerne la façon de parler au propriétaire.

   Le rapport final dit en une ligne ce qui a été appris.
5. Les agents de code et de recette terminent leur rapport par une rubrique « **Erreurs et leçons** » : ce qui les a ralentis ou trompés. L'orchestrateur reprend ces leçons à l'étape 1.

## Tenir dans la durée

- **Fichier d'état du chantier** : `outputs/suivi-agents/etat-chantier.md`, mis à jour à chaque étape. Il contient :
  - lots, agents, fournisseurs, branches et SHA ;
  - statut de chaque lot (en cours, relu, fusionné, bloqué) ;
  - décisions prises à la place du propriétaire ;
  - prochaine action.

  Si la conversation est résumée, interrompue ou reprise dans un nouveau chat, on repart de ce fichier sans rien perdre.
- **Économiser le contexte de l'orchestrateur** :
  - ne jamais lire les transcriptions des agents ;
  - limiter chaque sortie de commande (`head`, `tail`, `grep -m`) ;
  - déléguer à un `explorateur` (Haiku) la lecture d'un gros fichier ou d'un long journal.

  L'orchestrateur garde les conclusions, pas les fichiers.
- **Conflits de fusion** : l'orchestrateur résout seulement les conflits simples (TODO, imports, lignes voisines). Un conflit dans la logique métier est renvoyé à l'agent du lot, qui rebase sa branche sur l'intégration et relance ses tests.
- **Modifications du propriétaire** : au départ, `git status` dans le dossier principal. Ses changements non commités (`TODO.md`, notes) sont commités à part, avec un message clair, jamais écrasés.

## Mise en ligne et retour arrière

1. Avant le push :
   - `npm run check` et `npm run build` verts sur l'intégration ;
   - avance rapide de `preproduction` locale ;
   - `npx prisma generate` dans le dossier principal ;
   - contrôle de `git log origin/preproduction..preproduction`, avec `git ls-remote origin preproduction` puisque le fetch local ne suit que `main`.
2. Après le push :
   - déploiement Vercel `READY` (projet `prj_FyFuxVzgavpL7iECzngME14owrHv`) ;
   - aucune nouvelle erreur dans `get_runtime_errors` ;
   - `/login` et une page de chaque espace répondent.
3. **Si la préproduction casse** : `git revert` des commits en cause, nouveau push sur `preproduction`, puis vérification du nouveau déploiement. On ne réécrit jamais l'historique (`push --force` interdit). Le rapport le mentionne.

## Nettoyage de fin de chantier

- Arrêter les serveurs lancés (leur PID seulement) et vérifier que 3110 et 3111 sont libres.
- `scripts/e2e/dev-role-accounts.ts cleanup` ; supprimer les données `E2E` créées.
- Libérer les espaces de démo laissés en session par les recettes, en développement uniquement. La préproduction n'est touchée que si le propriétaire l'a autorisé.
- Retirer les worktrees des branches fusionnées (`git worktree remove`), sans supprimer les branches.

## Rapport final au propriétaire (gabarit, moins d'une page)

1. **Verdict** en une phrase : ce qui est en préproduction et si tout est vert.
2. **Livré** : une ligne par lot, dans les mots du produit.
3. **Décisions prises à ta place** : une ligne chacune, avec l'option écartée.
4. **Non vérifié** et pourquoi.
5. **À faire de ton côté** : une action concrète par ligne.
6. **Qui a fait quoi** (Claude, Codex, Cursor) et **ce qu'on a appris** (une ligne).
7. Lien vers la galerie de captures.

## Maîtrise du temps (après la plainte du 29 octobre : 1 h 30 au lieu de 45 minutes)

- **Deux tours de corrections au plus par lot.** Ensuite, ce qui reste et n'est ni bloquant ni important (cas rare, sans double action, sans fuite de données, sans perte) va dans `TODO.md` avec sa justification. On ne relance pas un troisième tour.
- **Un défaut qui ne peut pas se produire dans les conditions réelles actuelles** est consigné comme limite acceptée, avec sa justification. Exemple : un envoi hérité alors qu'aucun fournisseur d'e-mail n'a jamais été branché.
- **Points d'avancement spontanés** au propriétaire toutes les 15 à 20 minutes : une ligne avec l'heure de fin prévue. Il ne doit jamais avoir à demander où on en est.
- **Délais annoncés avec marge** : prendre la durée observée la plus longue, pas la plus courte. Si on dépasse, le dire tout de suite, avec la raison et la nouvelle heure.
- **Toute plainte du propriétaire** devient une règle ici ou dans la mémoire (`tutelliv-plainte-ameliorer-process`).

## Fichiers à tenir à jour (par l'orchestrateur, sans attendre qu'on le demande)

Ces fichiers sont la mémoire du projet : le chat suivant ne sait que ce qui y est écrit. Les mettre à jour dès que c'est utile, pas seulement à la fin.

| Fichier | Quand le mettre à jour |
|---|---|
| `TODO.md`, puis `npm run todo:progress` | À chaque lot fusionné : état, résultat, commandes lancées, limites, prochaine étape. À chaque décision du propriétaire (dans la tâche concernée). Ajouter une tâche pour tout ce qui est reporté. |
| `outputs/suivi-agents/etat-chantier.md` | À chaque étape du chantier. C'est le point de reprise en cas de coupure. |
| `outputs/suivi-agents/erreurs-<date>.md` | À chaque erreur, sur le moment. |
| Ce skill (`.claude/skills/tutelliv-orchestre/SKILL.md`) | Quand une règle manque, qu'une erreur revient, qu'une durée observée change ou que le propriétaire se plaint. |
| Skill `tutelliv-recette` | Quand une erreur vient de la recette (ports, comptes, données, navigateur). |
| Mémoire (`~/.claude/projects/-Users-orso-Developer-TutelLiv-GPT/memory/`) | Préférence ou correction du propriétaire, façon de lui parler, décision durable. Un fichier par sujet, et mettre à jour l'existant plutôt que dupliquer. |
| Documentation du dépôt (`docs/`, `DESIGN.md`, `docs/RBAC.md`, décisions produit) | Quand le comportement du produit change. Une décision commerciale est notée comme proposition, jamais comme engagement. |
| `outputs/suivi-agents/prompt-nouveau-chat.md` | En fin de chantier : le prompt du chantier suivant, à jour, avec ce qui reste à faire. |

Les agents de code ne modifient jamais `TODO.md`, la mémoire ni les skills : ils écrivent leur rapport, avec sa rubrique « Erreurs et leçons », et l'orchestrateur reporte. Les fichiers du dépôt modifiés partent avec le commit groupé du chantier.

## Accélérer la phase finale (leçon du 29 octobre : plus d'une heure entre la dernière fusion et le push)

1. **Codex au fil de l'eau, pas à la fin.** Lancer Codex (liste fermée du lot) dès qu'un lot est fusionné, pendant que les autres travaillent. Ses retours arrivent ainsi avant la vérification finale, et non pendant.
2. **Vérification finale découpée en 3 agents parallèles**, chacun sur son worktree détaché au même commit :
   - **V1 « suites »** (Sonnet) : `npm run check`, `npm run build`, `test:pg-locks`, `ci:secrets`, `git diff --check` ;
   - **V2 « navigateur »** (Sonnet) : serveur 3110, E2E du chantier, non-régression cliquée, refus HTTP par rôle ;
   - **V3 « revue adverse »** (Opus, lecture seule) : diff complet, classes de défauts du pré-vol et du journal d'erreurs.

   Ensemble, ils prennent environ 20 minutes au lieu de 45 pour un seul agent qui fait tout à la suite.
3. **Temps limité** : un vérificateur qui dépasse 30 minutes est contrôlé. On récupère ce qui est fini, et le reste est relancé à part.
4. **Worktree « pre-push » préparé à l'avance** : les petites corrections tardives y sont fusionnées et testées pendant la vérification. Au verdict, il ne reste qu'à pousser.
5. **Pas de correction tardive non bloquante** : pendant la vérification finale, un défaut mineur va dans la TODO, il ne devient pas un nouveau tour.

## Aller encore plus vite (mesures du 29 octobre)

Constat chiffré : la suite de tests ne prend que **30 secondes**. Le temps part ailleurs :
- le Mac n'a que **8 Go de RAM**, et `lourd.sh` ne laisse passer qu'une commande lourde à la fois : les agents « en parallèle » font en réalité la queue ;
- un `npm ci` de 2 à 3 minutes par worktree (742 Mo) ;
- `next build`, de 3 à 5 minutes ;
- la première compilation de chaque page sur un serveur de développement neuf ;
- la réflexion des agents entre deux commandes.

Règles :
1. **Pas de `npm ci` dans un worktree** si `package-lock.json` est identique à celui du dossier principal (`cmp`). Copier plutôt `node_modules` par clonage APFS, quasi instantané et sans espace disque en plus : `cp -c -R /Users/orso/Developer/TutelLiv-GPT/node_modules <worktree>/`, puis `npx prisma generate`. Même chose pour `.next/cache` avant un build.
2. **Vérification finale allégée** : chaque lot a déjà été relu, recetté et testé. À la fin, on vérifie seulement :
   - ce que la fusion a pu casser : check et build du résultat ;
   - un E2E de fumée, avec la non-régression minimale et les refus par rôle ;
   - une relecture des zones de conflit et des fichiers touchés par plusieurs lots.

   On ne refait pas toutes les recettes. Objectif : **10 à 15 minutes**.
3. **Serveur chaud** : un serveur de l'intégration reste lancé pendant le chantier, et ses pages principales sont préchargées (`curl` sur la liste des routes) pendant que les agents travaillent. La vérification navigateur commence donc sans attente de compilation.
4. **Build et check en même temps que le navigateur**, dans deux worktrees, pendant que la RAM libre reste au-dessus de 35 % (`memory_pressure`). Sinon, un à la fois.
5. **Décharger le Mac quand c'est possible** :
   - lots lourds confiés à des agents dans le cloud (`isolation: "remote"` de l'Agent tool, si disponible) ;
   - ou build vérifié par un déploiement de prévisualisation Vercel d'une branche de travail, mais seulement si le propriétaire a autorisé le push de branches autres que `preproduction`.
6. **Limite physique** : avec 8 Go, deux serveurs et un build en même temps saturent la machine. Une machine avec 16 Go ou plus, ou des agents dans le cloud, diviserait les temps d'attente par deux environ. C'est une décision du propriétaire, signalée dans le rapport si la RAM a ralenti le chantier.
