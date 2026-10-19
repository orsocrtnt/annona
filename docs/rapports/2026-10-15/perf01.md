# PERF-01 — Navigation, connexion et fraîcheur

Date : 15 octobre 2026. Périmètre : PERF-01 uniquement, sur le worktree existant conservé. Aucun push, déploiement, migration, seed ou reset. Les données présentes sont la base de test autorisée ; les commandes temporaires PERF01 créées pour la recette ont été nettoyées avec garde id/référence/notes.

## Résultat de référence

La lenteur dominante venait des lectures d’authentification répétées, des allers-retours PostgreSQL et de leur sérialisation, auxquels s’ajoutaient un préchargement excessif du menu et certaines attentes inutiles.

Sur le build production local :

- Administrateur : pages directes hors carte **11,69–32,32 s avant → 1,63–2,68 s après**. Carte dispatch : **29,42 → 2,12 s**.
- Client : pages directes hors carte **15,82–19,80 s → 2,11–2,15 s**. Carte livraisons : **19,74 → 3,12 s**.
- Livreur : accueil/missions **19,77–20,78 s → 2,12 s** sur le build final.
- Connexion jusqu’au contenu : admin **14,29 → 3,55 s**, client **20,09 → 3,94 s**, livreur **27,53 → 3,62 s**.
- Retours internes déjà chargés : **71–102 ms** après correction, deux échantillons par destination. Cette mesure est distincte du clic rapide depuis un accueil encore en chargement ; elle n’est pas comparée artificiellement aux premières pages ci-dessus.
- Annulation d’une commande de test : **4,11 → 1,59 s** par API ; **1,57 s** par le menu réel admin. Le portail client déjà ouvert retire automatiquement cette commande **13,93 s** après confirmation.
- Retour visuel : barre de progression observée **1,3 ms** après clic, puis masquée à la fin de navigation.

Les fichiers bruts, scénarios, échantillons et budgets sont dans `outputs/perf01`. Le contrôle final exploitable est `budget-verification.json` ; `task-change.patch` isole les changements de cette tâche des modifications utilisateur antérieures.

## Environnement et protocole

Mac Apple M1, 8 Go, arm64, Darwin 25.3.0 ; Node 22.18.0, Next 15.5.19, Prisma 5.22.0 ; Chrome headless 1440 × 1000 via le Playwright déjà installé. Application sur HTTP loopback, port de test 3110, Auth/Storage/PostgreSQL Supabase distants existants. Volumes : 5 entreprises, 30 utilisateurs, 32 commandes, 32 livraisons. Aucun téléphone physique ni throttling artificiel.

Le build avant est une copie isolée du code **déjà modifié avant PERF-01**, avec son propre client Prisma sans relationJoins. Il ne réutilise pas le client régénéré après correction. Les instantanés source et leurs empreintes sont archivés dans `before-source/` et `task-files.json` ; aucune copie de `.env.local` n’y figure.

API : connexion de chaque rôle puis deux passages séquentiels ; premier usage de route puis route/connexions chaudes. Navigateur : connexion UI, navigation directe avec reconstruction du cache applicatif, puis clic depuis l’accueil. Le cache HTTP du navigateur reste disponible. `readyMs` attend le titre du contenu ou le conteneur Leaflet, puis 250 ms de stabilisation. Les retours internes chauds sont mesurés séparément après chargement complet, avec deux images de rendu de stabilisation. Les mesures API sont séparées des matrices navigateur.

Les parcours comprennent dashboard, commandes, dispatch, carte et utilisateurs admin ; accueil, commandes, historique et carte client ; accueil/missions livreur. L’historique client est testé directement ; le lien interne n’est pas présent sur l’accueil et ce cas est explicitement marqué non applicable dans le harnais. L’accès depuis le parcours commandes existant reste conservé.

## Diagnostic séparé

**Authentification applicative et base.** La lecture profil + société, puis rôle SQL, puis permissions multipliait les transactions et requêtes. Sur la même base et le même client, l’ancien chemin exige **14 commandes de protocole/SQL et 1 814–1 828 ms**, contre **4 commandes et 432–450 ms** pour une jointure fraîche. La route session relisait ensuite une seconde fois tout le profil, même hors démo.

**Réseau/protocole PostgreSQL.** Un simple compteur chaud prenait **435–437 ms** en mode transactionnel `pgbouncer=true`, contre **89–91 ms** sur le pooler session sans ce paramètre. Les durées de requête Prisma incluent le réseau et ne sont pas des temps CPU SQL purs. Cette comparaison et les commandes BEGIN/DEALLOCATE/SELECT/COMMIT identifient un coût dominant d’allers-retours. Le mode transactionnel de production est conservé ; le mode session reste explicite, optionnel et limité au pooler Supabase.

**Serveur/concurrence.** Le code imposait une seule connexion Prisma en production, sérialisant les API simultanées et les groupes Promise.all. Le montage des espaces déclenche plusieurs lectures authentifiées ; les temps s’additionnaient. Le pool de référence est désormais borné à cinq connexions. Les compteurs indépendants ont aussi été regroupés pour réduire la demande, plutôt que d’augmenter uniquement la concurrence.

**Préchargement.** Jusqu’à 50–52 fetch sont observés autour d’une navigation admin avant correction, dont de nombreux préchargements RSC ; il ne s’agit pas de 50 API métier. Après : 6–16 fetch sur les mêmes fenêtres. Le préchargement de tout le menu au montage et celui automatique des liens concernés ont été retirés ; survol, focus et pression préchargent toujours la destination voulue et dédupliquent ses données.

**JavaScript/rendu.** Les pages et ressources déjà chaudes arrivent rapidement ; les attentes principales restent dans les API. Les tâches longues maximales observées sont de l’ordre de **66 ms avant / 51 ms après**, loin des attentes de plusieurs secondes. Le build conserve environ **115 kB de JavaScript initial partagé**. Cela n’établit pas un profil CPU complet, mais ne montre pas de cause dominante côté bundle ou rendu. Aucune réécriture de carte ni optimisation de bundle spéculative n’a été faite.

**Photos historiques.** Une passe dev a isolé un pic à **17,36 s**, dont **15,34 s dans GET missions**, avec compilation de page de 410 ms et autres API voisines autour d’une seconde. La liste attendait aussi les signatures Storage des photos de missions terminées, alors que les vues actives ne les affichaient pas. Cette dépendance a été supprimée du chemin critique : la liste fournit un lien applicatif privé, et seule une image effectivement affichée déclenche sa signature. Le pic initial reste archivé. Cinq lectures du build final prennent **924–1 756 ms** ; aucun appel de signature Storage n’est nécessaire à la liste, vérifié aussi par test isolé. Le temps exact passé chez le fournisseur pendant le pic initial n’a pas été instrumenté.

**Connexion démo.** L’ancien code reconstruisait tout le scénario et pouvait reprovisionner des comptes à chaque connexion. Ces opérations implicites sont retirées : connexion à la démo existante, persona admin conservée, erreur 503 claire si l’environnement est incomplet. Le bouton de réinitialisation explicite reste disponible. Aucun reset distant n’a été exécuté pour mesurer ce chemin ; son absence au login est testée en interdisant toute dépendance reset/provision.

## Corrections et fraîcheur

- Jointures natives Prisma pour les relations, explicites pour le contexte auth ; aucune mémorisation du compte, de sa société, de son rôle ou de ses droits entre requêtes. Suspension et révocation restent vérifiées par les gardes à chaque lecture protégée.
- Une lecture de session au lieu de deux. Login existant via le profil joint, mise à jour lastLoginAt et rattachement en parallèle uniquement pour les clients ; aucun rattachement client inutile pour admin/livreur.
- Compteurs livreur en une agrégation ; compteurs livraison du dispatch en une agrégation ; compteur total client et compteurs actifs regroupés. Dates `completedAt`, états logistiques et filtres entreprise/client conservés.
- Réglages société réutilisés depuis le contexte authentifié fraîchement joint pour le dispatch, les missions disponibles et les paramètres GPS ; pas de nouveau cache société.
- Données opérationnelles : fraîcheur de cache 15 s au lieu de 5 min, revalidation au retour et au focus ; dashboard/listes opérationnelles actualisés toutes les 15 s quand visibles. Les invalidations de mutation sont conservées. Polling en arrière-plan désactivé ; états/horodatages GPS conservés. Le tableau indique « Actualisation… » pendant sa revalidation.
- Barre de navigation accessible, immédiate, tenant compte aussi des changements de recherche ; clics modifiés, téléchargements et liens externes exclus.
- Photos : nouvelle route privée `/api/driver/missions/[id]/proof`, garde rôle puis prédicat id + propriétaire + entreprise, URL signée seulement ensuite, redirection `private, no-store`. Aucun chemin de stockage brut dans la liste.

`relationJoins` est une capacité du générateur Prisma : client régénéré localement, aucune table/migration modifiée par PERF-01. Le défaut de jointure concerne aussi les autres lectures de relations ; leur équivalence a été vérifiée sur les données présentes, notamment les relations utilisateur/commande/livraison et le curseur d’export. Sources techniques : [Prisma — stratégies de jointure](https://www.prisma.io/blog/prisma-orm-now-lets-you-choose-the-best-join-strategy-preview), [Supavisor — Prisma](https://supabase.github.io/supavisor/orms/prisma/).

**Correctif du 16 octobre 2026 :** vingt lectures auth concurrentes ont reproduit une panique du moteur Prisma 5.22 dans la stratégie expérimentale `relationJoins`. Cette capacité a été retirée du générateur et la lecture relationnelle est revenue à la stratégie stable. La fraîcheur par requête et l'absence de cache d'autorisation sont conservées ; les mesures ci-dessus restent des résultats historiques, pas une garantie de performance après ce correctif de fiabilité.

## Budgets et validation

Budgets fixés avant les mesures après : production, retour visuel ≤ 100 ms ; API chaude et mutation ≤ 2,5 s ; page directe ≤ 3 s, carte utilisable ≤ 4 s ; connexion complète ≤ 5 s ; retour interne chaud ≤ 500 ms. Portail monté après mutation d’un autre rôle : ≤ 20 s. Le harnais inclut 250 ms de stabilisation dans les premières pages.

La première passe après ne satisfaisait pas tous ces budgets (dispatch 4,66 s, livreur 3,15–3,62 s, login livreur 5,21 s) : elle est conservée et a conduit aux agrégations et au dimensionnement borné à cinq. Les budgets n’ont pas été assouplis pour la production.

La recette réelle valide annulation UI, confirmation serveur, actualisation du client monté, retour visuel et fin de progression. Une première mesure de clic donnait une durée nulle alors que la barre était visible : le listener ajouté après React observait parfois la mutation avant son horodatage. Le harnais capture désormais au niveau window ; la recette complète a été rejouée avec succès, sans modification applicative pour ce défaut de mesure.

Vérifications :

- `npm run check` : **195/195 tests**, dont **12 tests PERF**, types OK, lint sans erreur et 24 avertissements préexistants.
- `npm run build` : réussi, hors serveur dev ; nouvelle route photo présente dans le build.
- `git diff --check` : réussi.
- Équivalence jointures : 30 utilisateurs, 32 commandes, 32 livraisons et curseur d’export ; compteurs client/admin/livreur équivalents aux anciens calculs connectés.
- Auth/permissions connectées : anonyme 401, client et livreur interdits sur route admin 403, autre client/entreprise 404, lecture client fraîche après mutation. Tests locaux couvrant suspension, révocation entre instances, erreurs de lecture et cache invalidé/inactif/changement de compte.
- Lien photo connecté : propriétaire 307 + `private, no-store`, client 403, anonyme 401, mission étrangère 404. La liste ne dépend plus du service de signature.
- Aucune erreur JavaScript dans les matrices finales ; captures de trois rôles et de la recette disponibles.

## Limites du développement et de la référence

Dev ajoute la compilation, les ressources non optimisées et les outils HMR. Budget séparé : API chaude ≤ 2,5 s, retour interne chaud ≤ 750 ms, tolérance de 4 s de compilation/démarrage en plus des budgets de première page/connexion de production. Les fichiers `dev-…` et les journaux Next isolent ces coûts ; ce n’est pas une promesse que dev égale production.

Mesures dev finales : pages directes hors cartes **2,42–3,34 s**, cartes **3,58–4,34 s**, connexions **4,61–7,52 s**, retours internes chauds **113–304 ms**. La connexion livreur à 7,52 s a été rejouée sur un serveur fraîchement démarré et reste dans le budget dev distinct de 9 s. Tous les budgets automatiques finaux passent.

Le watcher macOS dans le contexte d’exécution a reproduit EMFILE puis des 404. Les mesures valides utilisent `WATCHPACK_POLLING=true`. Le même contexte a aussi conservé un ancien module pendant un changement de code : la validation finale du lien privé a été faite après build et redémarrage, puis le parcours livreur dev rejoué sur un processus frais. L’échantillon lent et les essais antérieurs restent archivés.

Les budgets décrivent les échantillons de cet environnement, pas des p95 sous charge. Pour héberger : pool de **5 par instance**, surcharge `DATABASE_CONNECTION_LIMIT` ou paramètre URL `connection_limit` **validés entre 1 et 10**. Prévoir jusqu’à 5 × nombre d’instances, plus workers/scripts, et adapter au pool Supabase avant publication. Une limite explicite 1 est conservée ; elle peut remettre en cause les budgets de concurrence et impose une nouvelle mesure. Aucun dimensionnement hébergé/multi-instance n’est déclaré validé.

La carte utilisable signifie données applicatives et conteneur Leaflet prêts ; disponibilité complète des tuiles/routage tiers et délai d’une photo privée affichée sont des dépendances réseau séparées. Le téléphone physique, la charge et l’infrastructure de production restent hors de cette recette. La fraîcheur de 15 s est une borne de revalidation des vues visibles, augmentée du temps de réponse ; aucun push instantané n’est promis entre utilisateurs.

## Reproduction et intégrité

Instructions et outils : `scripts/perf/README.md`. Compte rendu automatique : `outputs/perf01/budget-verification.json`. Preuves de restauration : `business-before.json`, `business-after.json`, `final-verification.json`. Seuls les horodatages habituels lastLoginAt/updatedAt des comptes ont été exclus de l’empreinte ; contenu métier, rôles, permissions et réglages sont inclus.

Les copies courantes de TODO dans les outputs du dépôt et du chat sont identiques à la source. Les archives sous work restent inchangées. Tous les serveurs temporaires de test sont arrêtés en fin de tâche ; la relance utilisateur est laissée au coordinateur.
