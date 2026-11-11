---
name: annona-orchestre
description: Lancer et piloter en autonomie un chantier multi-agents Annona — orchestrateur décideur, agents de code par lot avec le modèle adapté au risque, recette navigateur, double vérification (code-review + Codex) puis push sur preproduction. À utiliser quand le propriétaire demande un chantier avec plusieurs agents.
---

# Orchestre — chantier multi-agents Annona

> **6 novembre 2026 (NET-1)** : la branche de travail est `base` (nouveau produit). Aucun push — ni `base`, ni `preproduction`, ni `main` — sans demande explicite du propriétaire : `preproduction` et le site en ligne portent encore l'ancien produit. Partout ci-dessous, lire `base` à la place de `preproduction` et s'arrêter avant toute étape de push ou de déploiement.

Lancement : `/annona-orchestre`, ou « lance le chantier multi-agents ». Les lots ci-dessous sont ceux du chantier n° 2 ; pour un chantier suivant, les recalculer depuis `TODO.md` selon la même méthode.

## Mandat : autonomie totale

Le propriétaire n'est pas là pendant le chantier. **L'orchestrateur est le patron et le décideur** : il tranche, lance, relance, remplace ou recadre les agents, et le chantier continue tant que le propriétaire n'intervient pas. Il ne s'arrête et ne pose une question que si la réponse est indispensable au sens même du projet : une décision commerciale ou juridique engageante, une dépense, une donnée réelle, une action irréversible.

- **Exception, les directions visuelles majeures** (landing, identité, refonte d'un écran phare) : le propriétaire choisit lui-même sur maquettes, par questionnaire avec captures, dès le début du chantier ; les autres lots avancent pendant ce temps. Constat du 29/10 : la landing choisie par l'orchestrateur a été rejetée (« j'aime pas du tout »).
- **Décisions produit et visuelles** : l'orchestrateur les prend lui-même, avec l'option la plus prudente et la plus cohérente avec `DESIGN.md`, `docs/DECISIONS_PRODUIT_COMMERCIALES.md` et les décisions passées. Chacune est consignée en une ligne dans le rapport final, avec l'alternative écartée, pour pouvoir la revoir.
- **Pilotage des agents** : vérifier leur avancement toutes les 15 à 20 minutes (commits, fichiers modifiés, serveurs), sans lire leurs transcriptions. Un agent sans progrès en 30 minutes est relancé avec un message précis, ou remplacé. Un agent qui tourne en rond sur le même échec deux fois change d'approche. Si un lot est trop gros, le découper ; si des agents sont libres, lancer le lot suivant.
- **Blocage réel** : le noter, mettre le lot de côté et continuer les autres. Ne jamais attendre sans rien faire.
- **Fin** : un rapport concis et précis au propriétaire (moins d'une page) : ce qui est livré, les décisions prises à sa place, ce qui n'a pas pu être vérifié, ce qui reste à faire de son côté.

## Rôles

- **Orchestrateur (Claude Opus, conversation principale)** : prépare les branches, lance les agents, relit chaque branche, fusionne, tient `TODO.md`, parle au propriétaire en français simple et court. Il ne code pas lui-même, sauf micro-correctif.
- **Agents de code** : un par lot, sur une branche `agent/<lot>` partie du dernier `preproduction`. **Dans le cloud par défaut** (voir « Où tourne chaque agent »), sinon dans un worktree local `.claude/worktrees/agent-<lot>`. Modèle selon le risque (voir tableau).
- **Agent de recette (Sonnet)** : clique dans le navigateur, branche par branche, sur un worktree détaché au commit testé (skill `annona-recette`). Il constate, ne corrige rien, et renvoie la liste des défauts à corriger.
- **Vérificateur final (agent Opus neuf, lancé par l'orchestrateur)** : le dernier rempart, quand tout est fusionné. Il ne connaît que le code, les critères « Terminé quand » des tâches et ce journal d'erreurs, jamais les conclusions des agents. Il lance lui-même :
  - `npm run check` et `npm run build` sous Node 22 ;
  - les E2E ciblés du chantier et la non-régression minimale sur un serveur (3110) ;
  - les tests PostgreSQL réels ;
  - une revue adverse du diff complet de l'intégration.

  Il rend une liste de défauts prouvés. Tant qu'il reste un défaut important, on corrige et il revérifie.
- **Codex en complément** (autre fournisseur, autre regard) : lancé par l'orchestrateur lui-même, jamais par le propriétaire, en même temps que le vérificateur final, sur une liste fermée. **Le propriétaire n'a plus à faire intervenir ChatGPT ou Codex pour vérifier** : toute la vérification est dans le chantier.
- **Commit et push** : un seul envoi groupé sur `preproduction`, puis contrôle du déploiement Vercel. Le propriétaire a demandé ce déroulé complet, push compris. Il n'a lieu que si tout est vert : check, build, recette, et Codex sans défaut important ouvert. Jamais `main` ni la production.
- **Migrations** : les lots évitent tout changement de schéma. Si un lot en a vraiment besoin, la migration est additive, relue, appliquée sur annona-dev seulement. Ce lot reste alors **hors du push** et il est signalé dans le rapport, car la préproduction exige l'accord du propriétaire.

## Où tourne chaque agent : Mac ou cloud

Depuis le 29 octobre 2026, le cloud de Claude Code est connecté : machines de 16 Go, 4 cœurs, sans la file `lourd.sh`. Le Mac (8 Go) ne garde que ce qui a besoin de lui.

| Travail | Où | Pourquoi |
|---|---|---|
| Orchestration (cette conversation) | Mac | Pilote tout, a les outils Vercel et Supabase, Codex et Cursor |
| Agents de code (écrire, tests unitaires, `npm run check`) | **Cloud** | Le plus lourd ; en parallèle sans faire la queue |
| Données de test sur annona-dev (lot F), tests PostgreSQL réels (`test:pg-locks`), E2E | **Mac** | Le cloud ne joint pas PostgreSQL : son proxy ne laisse passer que HTTP/HTTPS (vérifié le 28 octobre) |
| Pré-vol adverse d'un agent de code | Avec l'agent (cloud) | Même session |
| Recette navigateur, captures Light/Dark | Mac | Chrome et Playwright fiables en local ; le navigateur n'est pas garanti dans le cloud |
| Relecture `code-review` de l'orchestrateur | Mac | Sur la branche récupérée |
| Codex et Cursor | Mac | Leurs outils en ligne de commande sont installés sur le Mac ; leurs propres clouds ne sont pas reliés à GitHub |
| Vérification finale V1 « suites » (check, build) | Mac (`test:pg-locks` exige la base) | Le cloud ne joint pas la base |
| Vérification finale V2 « navigateur » et V3 « revue » | Mac | Navigateur, outils locaux |
| Push sur `preproduction`, contrôle Vercel | Mac | Toujours par l'orchestrateur |

**Repli** : si l'environnement cloud n'est pas prêt, ou si le cloud échoue (session qui ne démarre pas, réseau refusé), le lot tourne en local dans un worktree avec `lourd.sh`, comme avant. Le chantier ne s'arrête jamais pour ça.

**Conséquences** :
- Les agents cloud continuent même si le Mac se met en veille ou si l'écran est fermé. En revanche, l'orchestrateur tourne sur le Mac : s'il s'endort, le pilotage s'arrête. L'anti-veille (`fr.orso.agents-eveilles`) garde le Mac éveillé tant qu'un agent travaille.
- Le propriétaire peut suivre et commenter les sessions cloud depuis son téléphone (application Claude, onglet Code, ou claude.ai/code).
- Le cloud consomme le quota Claude Max comme le local : plus de lots en parallèle, c'est une consommation plus rapide. Surveiller les signes de limite.
- Les lots cloud poussent leur branche `agent/<lot>` sur GitHub (jamais `preproduction` ni `main`). L'orchestrateur la récupère, la relit et la fusionne en local.

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
| **Claude, cloud** | Agents de code par défaut | Routine `RemoteTrigger` : `create`, puis `run` (voir « Agents dans le cloud »). Jamais `claude --cloud` |
| **Claude, local** | Orchestration, recette navigateur, relectures, vérification, repli des lots | Agent tool, avec `model: opus`, `sonnet` ou `haiku` |
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
4. Vérifier que le cloud est prêt : environnement `annona-dev` créé, accord pour les branches `agent/*`, réglage Vercel des prévisualisations. S'il manque quelque chose, lots en local (repli) et mention dans le rapport.
5. Vérifier la RAM (`memory_pressure`), les ports 3110 et 3111, et que l'anti-veille tourne (`launchctl list | grep agents-eveilles`).

## Lots — vague 1 (lancés en même temps)

Tous les lots codent dans le cloud ; leurs recettes et captures se font sur le Mac (ports 3110 et 3111, une recette à la fois par port).

| Lot | Tâches TODO | Modèle | Fichiers principaux | Recette Mac |
|---|---|---|---|---|
| **A — Design** | DESIGN-2 sauf site public : mode sombre du back-office, du dispatch, de `/admin` et de l'app livreur ; **suppression des dégradés** ; surfaces lisibles (tableaux, Chauffeurs) | Opus | `globals.css`, `src/lib/theme.ts`, layouts | 3110, partagé |
| **B — Carte** | MAP-INTERACTION (**carte unifiée** Livreurs/Livraisons, marqueurs cliquables) + MAP-3 + **carte sombre** | Sonnet | composants de carte, tableau de bord | 3111, partagé |
| **C — Alertes** | UX-ALERTES (**alertes mieux placées**) + la partie « explications permanentes » d'UX-04 | Sonnet | blocs d'alerte, pages d'espace | partagé |
| **D — Factur-X** | FACTURX-SAISIE + CONFIG-MSG (Factur-X d'abord, puis Stripe, e-mail, commande par message, dispatch, preuve) | Sonnet | `einvoicing-settings-card.tsx`, `src/lib/validations/einvoicing.ts` | partagé |
| **E — Finitions** | UX-NAV-SCROLL + RECETTE-2810 (points restants et décisions prises à l'étape 0) | Sonnet | navigation, petits correctifs | partagé |
| **F — Données de test** | Jeux E2E identifiables sur annona-dev : factures A/B (dont une en retard), une livraison terminée avec preuve, une mission en livraison. Les tests aujourd'hui ignorés faute de données doivent tourner. | Sonnet | `scripts/e2e/`, `tests/e2e/` | partagé |
| **L1 — Landing, directions** | LANDING-2, phase 1 : 2 ou 3 directions visuelles de la landing et de la connexion (maquettes HTML et captures). L'orchestrateur choisit, et les directions écartées sont gardées pour le rapport. **Aucun code produit.** | Opus | maquettes dans `outputs/` | aucun |

## Vague 2

| Lot | Tâches | Modèle |
|---|---|---|
| **L2 — Landing, construction** | LANDING-2 sur la direction choisie + mode sombre du site public (la part de DESIGN-2 laissée par le lot A) | Opus |
| **G — Dispatch avancé, tranche 1** | DISPATCH-4, cadré le 29 octobre (voir la tâche dans `TODO.md`) : les 3 meilleurs livreurs proposés, avec le vrai temps de trajet (OSRM gratuit, en cache) et la raison du choix ; affectation en un clic ; mode « suggestion » ou « automatique » au choix de l'entreprise ; dimensionné pour une grande flotte. Les tournées viennent en tranche 2, dans un chantier suivant. **Aucun changement de prix.** | Opus |

| **H — Mobile web** | MOBILE-WEB : revue de toute l'application à 390 et 360 px dans le navigateur, page par page, et corrections. À lancer après la fusion de A, B et C, pour ne pas retoucher deux fois les mêmes écrans. | Sonnet (code cloud, captures Mac) |

Ordre de fusion sur `integration/<date>` : F, D, E, C, B, puis A, le plus transversal, rebasé en dernier, puis L2, puis H.

## Ce qui reste hors chantier

Bloqué par le propriétaire ou par l'extérieur :
- PROPRIO-2810 (secrets, clés, validation Factur-X officielle) ;
- SEC-05 et EMAIL (domaine d'envoi) ;
- MOB-01C (téléphones réels) ;
- LEGAL-1, PILOT-1 et PILOT-2, OFFER-1, PERF-02 (charge en préproduction).

## Règles données à chaque agent (à recopier dans leur prompt)

- Branche imposée `agent/<lot>` ; ne jamais modifier `TODO.md` ; jamais de merge ; commits en français.
- **Agent cloud** : l'environnement fournit les variables de annona-dev. Commencer par `git fetch origin preproduction && git checkout -B agent/<lot> origin/preproduction && npm ci --no-audit --no-fund` (le clone part de `main`, sans `node_modules`), puis vérifier `npm run -s env2:verify-dev` → passed (preuve d'être sur le bon environnement), sinon s'arrêter. **La base PostgreSQL n'est pas joignable depuis le cloud** (proxy HTTP/HTTPS seulement) : dans le cloud, uniquement le code et `npm run check`, qui tourne sans services externes. Tout ce qui touche la base (seed, `test:pg-locks`, E2E, serveur connecté) est listé dans le rapport « à lancer sur le Mac » et fait par l'orchestrateur. Pousser seulement sa branche `agent/<lot>` (`git push -u origin agent/<lot>`), jamais `preproduction` ni `main`. Pas de `lourd.sh`. Node 22 est celui du `PATH` par défaut (`/opt/node22`).
- **Agent cloud, personne ne regarde** : le propriétaire n'ouvre jamais la session cloud. L'agent ne pose aucune question et n'attend aucune réponse. Il tranche avec l'option la plus prudente et la note dans son rapport. Sur un vrai blocage, il écrit le blocage dans son rapport, commite, pousse sa branche et s'arrête. Pour tenir sur la durée :
  - **feuille de route dans la branche** : dès le départ, il crée son rapport `docs/rapports/agents/<date>-<lot>.md` avec les critères « Terminé quand » cochables, puis le met à jour à chaque étape ;
  - **commit et push à chaque étape franchie** : la machine du cloud peut être reprise après une pause, et seul ce qui est poussé survit ;
  - **après un compactage** (automatique dans le cloud) ou une reprise, il relit d'abord son rapport et `git log`, avant de continuer ;
  - **contexte léger** : sorties limitées (`| tail -40`, `grep -m`) ; gros fichiers et longs journaux délégués à un sous-agent `explorateur` ; `/compact` de lui-même entre deux grandes étapes (fin d'implémentation, avant le pré-vol) ;
  - **commandes longues** (`npm run check`, build) en arrière-plan avec attente, jamais coupées par le délai de 2 minutes.
- **Agent local (repli)** : worktree imposé, pas de push ; environnement via `npx dotenv -e /Users/orso/Developer/Annona/.env.local --` ; commandes lourdes via `outputs/suivi-agents/lourd.sh` ; Node 22.
- Base annona-dev uniquement ; ne jamais lire ni afficher de secret ; données préfixées `E2E`, nettoyées à la fin.
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

## Vérification rapide (plainte du 29 octobre : plus de 2 h de recette navigateur pour presque rien)
Constat : l'agent de recette a tourné plus de 2 h. Ses causes :
- un serveur de développement, avec un test de 18 minutes à cause de la compilation à la demande ;
- un navigateur qui expirait au lancement dans l'environnement du sous-agent, alors qu'il démarrait en 0,2 s depuis la session de l'orchestrateur ;
- des comptes de test écrasés par un autre agent ;
- des captures mêlées aux tests qui décident du push ;
- aucun contrôle de l'orchestrateur pendant 1 h 30.

Règles :
- **Les E2E sont un script, pas un agent.** L'orchestrateur lance lui-même, en arrière-plan et depuis sa session, un script déterministe : `outputs/suivi-agents/e2e-final.sh`, ou une copie adaptée. Ce script fait un build de production (`next build`), lance `next start` sur 3111, fait `setup` et `seed` en vérifiant leur code de sortie, puis passe chaque spec avec `PLAYWRIGHT_CHANNEL=chromium E2E_SKIP_WEB_SERVER=1`, avec une ligne de résultat par spec. Un agent (Sonnet) n'intervient qu'ensuite, pour qualifier les échecs à partir des journaux.
- **Jamais de serveur de développement pour une recette.** Toujours le build de production.
- **Étape 0** : `npx playwright install chromium`, déjà fait le 29/10, et un test de lancement du navigateur (0,2 s attendu). Si un sous-agent n'arrive pas à lancer le navigateur au premier essai, l'orchestrateur reprend la main tout de suite.
- **Les captures de la galerie ne bloquent jamais le push.** Elles se font après, par le même script ou un agent, pendant le contrôle Vercel.
- **Un seul propriétaire des comptes de rôle** par chantier : celui qui fait la recette. Aucun autre agent ne lance `e2e:role-accounts setup` ni `cleanup`.
- **Un E2E écrit est un E2E lancé.** Un lot qui ajoute ou modifie une spec la fait tourner au moins une fois avant `LOT TERMINÉ`. S'il ne peut pas lancer le navigateur, l'orchestrateur la passe tout de suite avec `e2e-final.sh` (navigateur `chromium-headless-shell`) avant la relecture du lot. Constat du 29/10 : 7 échecs en fin de chantier, tous dans des specs jamais lancées ou rendues obsolètes par un autre lot, aucun dans le produit.
- **Spec d'audit en un passage** : une spec qui balaie des pages (débordement, cibles de 44 px, contraste) utilise `expect.soft` ; sinon chaque passage ne révèle qu'un défaut (constat du 29/10 : 3 passages de 15 min pour la spec `mobile-web`). Corriger le composant commun plutôt que la page.
- **Proportion** : le 29/10, la relecture (Codex et la revue adverse) a trouvé tous les défauts réels ; les E2E n'ont trouvé que des tests périmés, pour un coût de plusieurs heures. Avant un push, ne passer que les specs des parcours critiques touchés par le chantier (connexion, paiement, preuve, affectation). La suite complète tourne une fois par semaine, ou avant une mise en production, pas à chaque envoi.
- **Délai maximal** : 30 minutes pour les E2E du chantier. L'orchestrateur regarde les journaux toutes les 15 minutes. Si un test n'a pas avancé depuis 15 minutes, il change d'approche sans attendre.

## Retour d'expérience du chantier n° 1 (28 et 29 octobre 2026)

### Ce qui a marché
- **Agents en parallèle dans des worktrees séparés**, fusionnés un par un sur une branche d'intégration : 9 chantiers livrés en une journée, sans casse.
- **Pré-vol adverse par un sous-agent Opus** : il a trouvé 3 défauts importants sur les relances e-mail avant toute relecture externe.
- **Tests sur PostgreSQL réel** (annona-dev) : ils ont révélé un vrai défaut que les tests simulés laissaient passer (le limiteur de connexion autorisait 10 tentatives sur 12 au lieu de 5).
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
| `npm run build` a échoué sans environnement. | `npx dotenv -e /Users/orso/Developer/Annona/.env.local -- npm run build`. |
| Fichiers non suivis identiques qui bloquaient l'avance rapide du dossier principal. | Les comparer (`cmp`), les retirer s'ils sont identiques, puis `git merge --ff-only`. |
| Node 20 en local alors que le projet exige Node 22. | `node -v` à l'étape 0 ; sinon préfixe `PATH=/opt/homebrew/opt/node@22/bin:$PATH` pour tous les agents. |
| Le sandbox Codex interdit l'écoute réseau et Chrome : le test PERF-02 échoue en EPERM, et la recette navigateur est impossible. | Codex en lecture et en API seulement ; l'échec EPERM n'est pas un défaut du code. |
| Le cloud n'a été proposé qu'en fin de chantier, alors que les 8 Go du Mac ralentissaient tout depuis le début. | Code dans le cloud par défaut ; vérifier à l'étape 0. |
| Agent de recette tombé sur une coupure réseau (ENOTFOUND). | Le reprendre avec SendMessage quand le réseau revient, plutôt que le relancer de zéro. |
| Pool limité à 15 connexions en mode session : des 503 sur la connexion pendant une minute au démarrage. | `DATABASE_CONNECTION_LIMIT=5` par serveur, deux serveurs au plus, et attendre le 200 sur `/login`. |
| Des tâches proposées au propriétaire étaient déjà faites. | Vérifier le code et la case dans `TODO.md` avant de proposer quoi que ce soit. |
| Salle de contrôle maison : du temps passé à corriger le classement des agents. | Pas de tableau de bord maison pendant un chantier. Un point court au propriétaire suffit. |
| Explications techniques et messages longs : « je comprends pas », « c'est long ». | Mémoire `annona-comment-me-parler` : verdict d'abord, mots du produit, listes courtes. |

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
   - mettre à jour le skill `annona-recette` si une erreur vient de la recette ;
   - mettre à jour la mémoire, en particulier `annona-comment-me-parler` pour tout ce qui concerne la façon de parler au propriétaire.

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
- Supprimer les données `E2E` et `test-<prénom>-` créées (jamais les comptes du seed de démo ; voir `annona-recette`).
- Libérer les espaces de démo laissés en session par les recettes, en développement uniquement. La préproduction n'est touchée que si le propriétaire l'a autorisé.
- Retirer les worktrees des branches fusionnées (`git worktree remove`), sans supprimer les branches.
- Lister dans le rapport les branches `agent/*` poussées sur GitHub et les sessions cloud du chantier. On ne les supprime pas sans l'accord du propriétaire.

## Rapport final au propriétaire (gabarit, moins d'une page)

1. **Verdict** en une phrase : ce qui est en préproduction et si tout est vert.
2. **Livré** : une ligne par lot, dans les mots du produit.
3. **Décisions prises à ta place** : une ligne chacune, avec l'option écartée.
4. **Non vérifié** et pourquoi.
5. **À faire de ton côté** : une action concrète par ligne.
6. **Qui a fait quoi** (Claude cloud ou local, Codex, Cursor) et **ce qu'on a appris** (une ligne).
7. Lien vers la galerie de captures.

## Maîtrise du temps (après la plainte du 29 octobre : 1 h 30 au lieu de 45 minutes)

- **Deux tours de corrections au plus par lot.** Ensuite, ce qui reste et n'est ni bloquant ni important (cas rare, sans double action, sans fuite de données, sans perte) va dans `TODO.md` avec sa justification. On ne relance pas un troisième tour.
- **Un défaut qui ne peut pas se produire dans les conditions réelles actuelles** est consigné comme limite acceptée, avec sa justification. Exemple : un envoi hérité alors qu'aucun fournisseur d'e-mail n'a jamais été branché.
- **Points d'avancement spontanés** au propriétaire toutes les 15 à 20 minutes : une ligne avec l'heure de fin prévue. Il ne doit jamais avoir à demander où on en est.
- **Délais annoncés avec marge** : prendre la durée observée la plus longue, pas la plus courte. Si on dépasse, le dire tout de suite, avec la raison et la nouvelle heure.
- **Toute plainte du propriétaire** devient une règle ici ou dans la mémoire (`annona-plainte-ameliorer-process`).
- **File d'attente et plafond (demandes du propriétaire du 28 octobre : « ralentis, on va taper la limite » ; « sinon c'est ingérable »)** :
  - le propriétaire peut donner une liste de X tâches d'un coup. L'orchestrateur les range dans une **file d'attente**, inscrite dans `etat-chantier.md`, dans l'ordre des dépendances et des priorités ;
  - **4 à 5 lots au plus en même temps**, et jamais plus de 5 agents actifs, relectures et contre-relectures comprises. Le lot suivant de la file ne part que quand un lot se termine ;
  - si le quota semble serré, mettre en pause le lot le moins avancé (commit « wip », feuille de route à jour), jamais un lot presque fini. Les lots en pause repartent en tête de file.
- **Réflexe « plus vite, même qualité »** (demande du propriétaire du 28 octobre) : à chaque point d'avancement (toutes les 15 à 20 minutes), se poser la question et **agir aussitôt**, sans attendre qu'on le demande :
  - qu'est-ce qui attend sans raison ? Un lot prêt à relire, une fusion possible, une recette qui peut démarrer ;
  - quel lot peut partir **maintenant** au lieu de « la vague suivante » ? Seule une vraie dépendance de fichiers justifie d'attendre ;
  - qu'est-ce qui peut sortir du chemin critique ? Un push en deux fois, un lot reporté, une vérification déjà faite au niveau du lot ;
  - quelle machine est sous-employée ? Le cloud libre pendant que le Mac fait la queue, ou l'inverse.

  On ne gagne jamais de temps en retirant une vérification qui protège la qualité.
- **Annonce du délai** (plainte du 28 octobre : « 5 h du matin, c'est super long ») : donner le détail par étape et proposer d'emblée la version courte (vague 2 en parallèle, push en deux fois, lot reporté), au lieu d'un seul horaire lointain.


## Fichiers à tenir à jour (par l'orchestrateur, sans attendre qu'on le demande)

Ces fichiers sont la mémoire du projet : le chat suivant ne sait que ce qui y est écrit. Les mettre à jour dès que c'est utile, pas seulement à la fin.

| Fichier | Quand le mettre à jour |
|---|---|
| `TODO.md`, puis `npm run todo:progress` | À chaque lot fusionné : état, résultat, commandes lancées, limites, prochaine étape. À chaque décision du propriétaire (dans la tâche concernée). Ajouter une tâche pour tout ce qui est reporté. |
| `outputs/suivi-agents/etat-chantier.md` | À chaque étape du chantier. C'est le point de reprise en cas de coupure. |
| `outputs/suivi-agents/erreurs-<date>.md` | À chaque erreur, sur le moment. |
| Ce skill (`.claude/skills/annona-orchestre/SKILL.md`) | Quand une règle manque, qu'une erreur revient, qu'une durée observée change ou que le propriétaire se plaint. |
| Skill `annona-recette` | Quand une erreur vient de la recette (ports, comptes, données, navigateur). |
| Mémoire (`~/.claude/projects/-Users-orso-Developer-Annona/memory/`) | Préférence ou correction du propriétaire, façon de lui parler, décision durable. Un fichier par sujet, et mettre à jour l'existant plutôt que dupliquer. |
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
1. **Pas de `npm ci` dans un worktree** si `package-lock.json` est identique à celui du dossier principal (`cmp`). Copier plutôt `node_modules` par clonage APFS, quasi instantané et sans espace disque en plus : `cp -c -R /Users/orso/Developer/Annona/node_modules <worktree>/`, puis `npx prisma generate`. Même chose pour `.next/cache` avant un build.
2. **Vérification finale allégée** : chaque lot a déjà été relu, recetté et testé. À la fin, on vérifie seulement :
   - ce que la fusion a pu casser : check et build du résultat ;
   - un E2E de fumée, avec la non-régression minimale et les refus par rôle ;
   - une relecture des zones de conflit et des fichiers touchés par plusieurs lots.

   On ne refait pas toutes les recettes. Objectif : **10 à 15 minutes**.
3. **Serveur chaud** : un serveur de l'intégration reste lancé pendant le chantier, et ses pages principales sont préchargées (`curl` sur la liste des routes) pendant que les agents travaillent. La vérification navigateur commence donc sans attente de compilation.
4. **Build et check en même temps que le navigateur**, dans deux worktrees, pendant que la RAM libre reste au-dessus de 35 % (`memory_pressure`). Sinon, un à la fois.
5. **Décharger le Mac** : c'est désormais la règle, avec le code dans le cloud (voir « Où tourne chaque agent »). `lourd.sh` ne sert plus qu'aux commandes lourdes restées en local : recette, vérification, repli.
6. **Limite physique restante** : le Mac (8 Go) supporte deux serveurs de recette au plus. Si les recettes font la queue, en faire moins en même temps plutôt que de saturer la machine.

## Agents dans le cloud (vérifié le 29 octobre 2026)

- **Connexion faite** : sur claude.ai/customize/connectors, le compte GitHub `orsocrtnt` est connecté, l'application Claude est installée et l'état du dépôt `annona` est vert.
- **⚠️ Ne jamais lancer un lot avec `claude --cloud`** : sa vérification préalable répond à tort `GitHub app is not installed` (journal `--debug-file`, 29 octobre, même après reconnexion de GitHub). La session part alors en copie locale (« bundle »), sans remote `origin`, et ne peut pas pousser. Le 28 octobre, quatre lots finis ont été perdus ainsi. L'option `isolation: "remote"` de l'Agent tool ne marche pas non plus : l'agent tourne en local, sans prévenir.
- **Lancer un lot par une routine** (vérifié le 29 octobre : clone depuis GitHub et push réel de `agent/test-cloud-4` depuis `preproduction`). Une routine par lot, avec l'outil `RemoteTrigger` :
  1. `action: "create"`, avec `body` :
     ```json
     {"name":"lot-<x>","run_once_at":"2027-10-01T12:00:00Z","enabled":true,
      "job_config":{"ccr":{"environment_id":"env_01TspvfnXJQVRTy6pQ8UPQho",
        "session_context":{"model":"claude-sonnet-5-5",
          "sources":[{"git_repository":{"url":"https://github.com/orsocrtnt/annona"}}],
          "allowed_tools":["Bash","Read","Write","Edit","Glob","Grep","Agent"]},
        "events":[{"data":{"uuid":"<uuidgen en minuscules>","session_id":"","type":"user",
          "parent_tool_use_id":null,"message":{"role":"user","content":"<prompt du lot>"}}}]}}}
     ```
     `env_01TspvfnXJQVRTy6pQ8UPQho` est `annona-dev` ; `env_01BHQ1eLakq8qFjGX1bZHNXN` est `Default`, sans accès à la base. Modèle : `claude-sonnet-5-5` ou `claude-opus-5-5`. Avec un `run_once_at` lointain, la routine ne part que sur demande.
  2. Tout de suite après, `action: "update"` avec `{"clear_mcp_connections": true}`, car l'API attache sinon tous les connecteurs du compte (Gmail, Drive, Supabase…).
  3. `action: "run"`, **seulement après la réponse du `create`/`update`, jamais dans le même envoi** : sinon la routine part avec l'ancienne configuration (vu le 29 octobre). Le lancement fonctionne même si la routine est désactivée. La réponse donne le `session_id` (`cse_…`), à noter dans l'état du chantier. Le prompt va dans `events`, pas dans le corps de `run`, qui arriverait comme donnée non fiable. Limites : 30 lancements par heure et par routine, 100 par heure pour le compte.
  4. Le prompt du lot commence par `git fetch origin preproduction && git checkout -B agent/<lot> origin/preproduction && npm ci --no-audit --no-fund`, car le clone part de `main` (le champ `branch` de la source est ignoré) et sans `node_modules` (sinon un autre `dotenv` répond et `env2:verify-dev` échoue). Il demande aussi de **ne pas envoyer de notification mobile**.
  5. Lot fini : `action: "update"` avec `{"enabled": false}`. La suppression d'une routine et l'archivage d'une session se font à la main sur claude.ai : les lister dans le rapport final.
  - Vérifié le 29 octobre (test 5) : création avec `Write`, modification avec `Edit` d'un nouveau fichier et de `TODO.md`, `npm run check` 1196/1196 en 2 minutes, commit et push : la session a duré 161 s. `Read` refuse un fichier de plus de 256 Ko (`TODO.md` en fait 366) : le lire par tranches (`offset`/`limit`) ou avec `grep`.
  - **⚠️ Une branche = une seule session, nom jamais réutilisé** : depuis le cloud, un `git push` ordinaire a écrasé un commit existant de `agent/test-cloud-4` au lieu d'être refusé. Deux sessions sur la même branche s'écraseraient sans prévenir. Pour reprendre un lot, envoyer une relance à sa session existante plutôt que relancer une routine sur la même branche.
- **Voir où en est une session (retour des agents)** : `RemoteTrigger` `action: "get_run_log"`, `session_id: "cse_…"`. On y voit le démarrage, les commandes, les erreurs, le dernier message et la ligne `result:` (fini, bloqué, en attente). `action: "list_runs"` avec `trigger_id` liste les sessions d'une routine. Plus de téléportation. À faire à chaque point d'avancement pour tout lot sans envoi récent, et ne jamais naviguer à l'aveugle.
- **Le propriétaire ne voit pas les sessions de routine** dans la liste de gauche de claude.ai/code (constaté le 29/10 : il a cru Mobile non lancé et a mis le chantier en pause). Au lancement de chaque lot cloud, lui donner en une ligne le lien `https://claude.ai/code/session_…` (le `cse_` de `run` sans son préfixe `c`), et rappeler qu'il peut aussi vérifier sur claude.ai/code/routines ou par les commits de la branche sur GitHub. Dans la salle de contrôle, afficher les lots cloud avec un badge « cloud », l'heure du dernier commit et ce lien (à faire au prochain chantier).
- **Suivre l'avancement** sans lire les transcriptions : `git ls-remote origin 'refs/heads/agent/*'` montre les commits poussés. Un lot sans commit poussé après 45 minutes est contrôlé. Pour lui écrire, sans pseudo-terminal : `claude -p "<message>" --cloud cse_… --output-format json < /dev/null` → `{"ok":true,…}`.
- **Récupérer le travail** : la session pousse une branche `agent/<lot>` sur GitHub. L'orchestrateur la récupère (`git fetch origin agent/<lot>`), puis relit et fusionne comme d'habitude. Le proxy du cloud refuse la suppression d'une branche distante (403) : le nettoyage se fait depuis le Mac, avec l'accord du propriétaire.
- **Préparation faite le 28 octobre 2026 (heure de New York)** :
  1. environnement cloud `annona-dev` : 7 variables de la base de **développement** (recopiées par le propriétaire), accès réseau « Limité » (`*.supabase.co`, `*.pooler.supabase.com`, `binaries.prisma.sh` + gestionnaires de paquets), script `if [ -f package.json ]; then npm ci && npx prisma generate; fi`. Vérifié par routine : Node 22, et `env2:verify-dev` passed après `npm ci`. **PostgreSQL injoignable depuis le cloud** (proxy HTTP/HTTPS seulement) ;
  2. accord écrit du propriétaire pour les branches `agent/*` (jamais `preproduction` ni `main`) ;
  3. Vercel, Ignored Build Step du projet : `case "$VERCEL_GIT_COMMIT_REF" in preproduction|main) exit 1;; *) exit 0;; esac`. Seules `preproduction` et `main` sont construites, car les variables « Preview » génériques (base, clé de service) s'appliquent à toute autre branche.
- **Usage** : lots de code et tests unitaires dans le cloud (16 Go, sans file `lourd.sh`). Recette navigateur, Codex et vérification finale restent sur le Mac. Le cloud consomme le quota Claude comme le local.
- **Les meilleures conditions pour un agent cloud** (le propriétaire ne regarde jamais le cloud ; c'est l'orchestrateur qui surveille) :
  - outils autorisés d'avance par `allowed_tools` de la routine : l'agent ne reste jamais bloqué sur une demande d'accord ;
  - le prompt du lot contient tout : règles de la rubrique « Règles données à chaque agent », critères « Terminé quand », décisions déjà prises, chemins des fichiers. L'agent n'a jamais besoin de demander ;
  - feuille de route, push à chaque étape et relecture après un compactage : voir « Agent cloud, personne ne regarde » ;
  - l'orchestrateur surveille par `git ls-remote origin 'refs/heads/agent/*'`. S'il n'y a aucun nouveau commit depuis 45 minutes, il lit `get_run_log`, puis envoie une relance précise avec `claude -p "<message>" --cloud cse_… < /dev/null` : relire le rapport, dire où il en est, finir ou consigner le blocage.
