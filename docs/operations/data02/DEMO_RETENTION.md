# DATA-02 — nettoyage prudent des sessions démo

État au 18 octobre 2026 : première tranche opérationnelle, uniquement sur sessions fictives identifiables sans ressources externes. Un exécuteur de lot et une route de cron protégée sont prêts localement, mais aucun horaire, déploiement, migration ni suppression d'entreprise préexistante n'a été activé.

## Identification et échéance

Le modèle `Company` possède `isDemo`, `slug`, `settings` et `createdAt`. DEMO-1 produisait un slug `logiexpress-demo-session-<24 caractères hexadécimaux>` et `settings.demoSession=true`, mais seulement un cookie expirant après huit heures. L'échéance n'était pas persistée : les anciennes sessions ne sont donc jamais automatiquement adoptées ou supprimées par ce mécanisme. Elles sont désormais aussi refusées côté serveur si un ancien cookie est rejoué ; une nouvelle connexion ouvre une nouvelle session correctement bornée.

Les nouvelles sessions reçoivent à leur création `settings.demoRetention={version:1, expiresAt:…}`. L'échéance doit correspondre exactement à `createdAt + 8 heures`. Elle ne glisse ni à la reconnexion ni au reset. Le serveur refuse un cookie rejoué après cette échéance ou après suppression ; une nouvelle connexion crée une nouvelle session. La démo canonique, les entreprises ordinaires et les marqueurs incomplets restent hors périmètre.

Une heure de grâce supplémentaire est imposée avant purge pour laisser se terminer les requêtes déjà autorisées. Une exécution horaire correctement configurée pourrait nettoyer les sessions éligibles vers neuf à dix heures après création. **La cible de 24 heures n'est pas encore garantie globalement** : planificateur non activé, cas avec fichiers ou comptes ajoutés bloqués, disponibilité fournisseur et volume à qualifier. Ne pas diffuser largement les démos en prétendant cette cible acquise.

## Commandes et activation

Lecture seule par défaut, depuis la racine du dépôt :

```sh
npm run data02:demo-cleanup
```

Inventaire agrégé, également en lecture seule, des anciennes candidates :

```sh
npm run data02:demo-legacy-inventory
```

La preuve `outputs/data02/demo-legacy-inventory.json` ne contient aucun identifiant ni e-mail. Elle classe les marqueurs, l'âge et les signaux de prudence visibles en base. L'option `--deep` sonde aussi, en lecture seule et séquentiellement, le dossier Storage exact et les références interentreprises :

```sh
npm run data02:demo-legacy-inventory -- --deep
```

Les compteurs `databaseReviewCandidates` et `deepReviewCandidates` ne constituent jamais une autorisation de suppression ou de rétrodatage : l'échéance et la règle de suppression n'existaient pas au moment de la création.

Après examen du dry-run et seulement dans l'environnement autorisé, activation explicite :

```sh
DEMO_CLEANUP_ENABLED=expired-demo-sessions-v1 npm run data02:demo-cleanup -- --apply
```

La variable seule ne suffit pas ; l'option seule ne suffit pas. La variable reste vide dans `.env.example` et aucune valeur n'a été ajoutée à `.env.local`.

La même logique de lot est exposée par `GET /api/cron/demo-cleanup` pour une future planification. Cette route ne traite des suppressions que si les deux conditions suivantes sont réunies :

- en-tête `Authorization: Bearer <CRON_SECRET>` strictement valide ;
- `DEMO_CLEANUP_ENABLED=expired-demo-sessions-v1` dans l'environnement d'exécution.

Une absence ou une erreur de secret répond `401` sans lecture de la base. Une activation DATA-02 absente répond `503`, également sans lecture. Un lot entièrement traité répond `200`. Un refus métier ou un reliquat répond `503` et produit un incident opérationnel agrégé ; une panne répond `500` avec un message générique. La réponse et les incidents ne contiennent jamais les identifiants des entreprises. **Aucune entrée de planification n'a été ajoutée à `vercel.json`** : la route ne s'exécute donc pas automatiquement. Ne pas installer d'horaire distant sans préproduction isolée, alertes branchées et autorisation de publication.

Le lot contient au maximum 100 entreprises, triées par ancienneté puis identifiant ; une 101e ligne sert uniquement à signaler le reliquat. La sortie contient uniquement des compteurs et codes de refus, sans identifiants ni données personnelles. Code de sortie de l'outil opérateur : `0` si le lot est traité sans blocage, `2` pour refus ou reliquat, `1` pour échec technique. Les lignes bloquées ne sont pas sautées silencieusement : un lot saturé exige une intervention avant que les suivants puissent être traités. La route signale déjà ces situations au reporter opérationnel, mais le vrai canal d'alerte et la surveillance de l'âge du reliquat restent OPS-03B.

## Garde-fous avant chaque suppression

- Tous les marqueurs et l'échéance exacte, le statut `ACTIVE`, puis la fin de la grâce sont revérifiés dans une transaction sérialisable.
- Les huit comptes attendus doivent conserver l'identifiant synthétique propre à cette entreprise, l'e-mail de session et le rôle attendus. Compte ajouté, manquant ou possédant un identifiant Auth réel : refus. Aucun appel de suppression Supabase Auth n'existe.
- Aucune référence externe de logo, avatar, PDF ou photo POD n'est acceptée. Le bucket POD doit être privé et le dossier exact de l'entreprise vide, y compris d'orphelins ou de sous-dossiers. Une panne ou une attente Storage dépassant dix secondes bloque. Cette sonde est uniquement en lecture ; une requête réseau tardive ne peut rien supprimer.
- Aucun job `PENDING` ou `PROCESSING` n'est accepté. Les jobs déjà terminés peuvent être supprimés avec le graphe.
- Les liens entre commandes, livraisons, clients, chauffeurs, factures, récurrences, tickets, auteurs, conversations, lectures, notifications et collectes sont contrôlés dans les deux sens. Toute référence franchissant l'entreprise bloque avant cascade ou `SET NULL`. Les auteurs de messages support, qui sont des identifiants sans clé étrangère, sont aussi contrôlés.
- En mode application, une écriture conditionnelle verrouille la société. Ce verrou, les suppressions enfants et celle de l'entreprise appartiennent à la même transaction. Un refus ou une panne annule tout, y compris le verrou. Les conflits sérialisables sont rejoués au maximum trois fois. Une entreprise déjà supprimée rend `missing` sans mutation.

Le délai de grâce et la vérification transactionnelle réduisent les courses avec des requêtes déjà autorisées ; ils ne constituent pas un protocole distribué de gel des uploads. Aucune promesse de nettoyage des fichiers n'est faite par cette tranche.

## Blocages assumés et prochaine tranche

Le schéma actuel ne conserve ni manifeste durable de purge des assets, ni phase de gel commune aux écritures DB/Storage, ni état de reprise après suppression externe. Une transaction PostgreSQL ne peut pas annuler une suppression Storage. Cette tranche **refuse donc les sessions avec fichiers** plutôt que supprimer les lignes et perdre leur traçabilité. Elle ne supprime pas non plus les identités Auth ou sauvegardes.

L'inventaire approfondi du 18 octobre a trouvé 51 anciennes sessions : toutes possèdent le marqueur de session, le roster synthétique attendu, un statut actif et un graphe métier ; toutes manquent uniquement l'échéance persistée. Aucune référence DB de logo/avatar, photo, PDF ou job actif, aucun objet Storage et aucune référence interentreprises n'ont été trouvés. Les 51 sondes Storage et graphes ont réussi sans indisponibilité ni délai dépassé. Ces sessions restent néanmoins inaccessibles et conservées : leur provenance technique est cohérente, mais aucune échéance ne doit être inventée après coup et aucune suppression n'est autorisée implicitement.

Prochaine avancée distincte : concevoir un gel des écritures et des uploads, un manifeste durable exact, la reprise des erreurs Storage/Auth et le contrôle post-restauration ; qualifier les cas orphelins avant activation. Les anciennes démos exigent une provenance et une échéance validées, sans rétrodatage automatique. Les données réelles, pilotes et durées légales restent bloquées par LEGAL-1.

## Recette reproductible

```sh
node --import tsx --test tests/demo-retention.test.ts
node --import tsx --test tests/demo-cleanup-cron.test.ts
node --import tsx --test tests/demo-legacy-inventory.test.ts
npm run test:data02:demo-retention
```

La recette connectée est réservée à la base de test autorisée. Elle crée sa propre base fictive et deux sessions ; seule A reçoit une date ancienne contrôlée. B reste active et la base fictive est transformée en entreprise normale pour vérifier son exclusion. Une référence étrangère temporaire, un identifiant ressemblant à Auth et un vrai objet Storage servent à vérifier les refus. Aucun compte Auth n'est créé ou supprimé.

Une panne est injectée lors de la suppression des utilisateurs, après plusieurs suppressions enfants : le graphe complet doit être restitué par rollback. Deux nettoyages concurrents donnent un seul `deleted` et un `missing`, puis le rejeu reste sans effet. Les empreintes B/entreprise normale doivent être identiques. Le `finally` enlève uniquement les fixtures et chemins enregistrés par cette exécution ; les 17 compteurs métier globaux doivent revenir à leur valeur initiale, tous les dossiers Storage de fixture être vides.

Preuves : `outputs/data02/demo-retention-connected.json`, `outputs/data02/demo-scheduler-verification.json` et `outputs/data02/demo-legacy-inventory.json`. Rapports : `docs/rapports/2026-10-18/data02-demo-retention.md`, `docs/rapports/2026-10-18/data02-demo-scheduler.md` et `docs/rapports/2026-10-18/data02-legacy-demos.md`.
