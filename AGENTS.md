# Travailler sur Annona

Annona devient une application de commande et de livraison B2B pour boulangerie (voir `PRODUCT.md`). La référence produit est `docs/cahier-des-charges/` : citer les identifiants d'exigence (CLI, BOU, LIV, ADM, PLA, NOT, RG, ENF) dans le code, les tests et `TODO.md`. `TRI-BASE.md` y indique ce qui est gardé, modifié ou créé à partir de l'ancienne base.

## OBLIGATOIRE : mettre `TODO.md` à jour
- Après chaque changement de code, de comportement ou de visuel, même petit, consigner dans la tâche concernée ce qui a changé, les vérifications lancées avec leur résultat, ce qui reste non vérifié et la suite. S'il n'existe aucune tâche concernée, en créer une.
- Ne jamais terminer un tour ni annoncer un travail fini sans avoir mis `TODO.md` à jour puis lancé `npm run todo:progress`. Le propriétaire ne doit jamais avoir à le demander.
- Tenir à jour le bloc « Ce qu'il reste vraiment à faire » en tête de `TODO.md` (listes courtes : Orso, Théo, agent, attente extérieure ; simples tirets, pas de cases).
- Sous le titre de chaque tâche ouverte, écrire qui doit agir ensuite : `**Qui : Claude.**`, `**Qui : Orso.**` ou `**Qui : Théo.**`, avec une condition éventuelle (`**Qui : Claude — après SCHEMA-1.**`). `npm run todo:progress` en tire les listes sous la jauge ; une tâche sans cette ligne apparaît dans « À classer ».
- Quand une case est cochée, déplacer la tâche et ses preuves dans `docs/TODO-ARCHIVE.md`. `TODO.md` reste une page de pilotage et la source unique des priorités ; vérifier le code avant de croire un ancien statut.

## Sources et périmètre
- Lire ce fichier, `TODO.md`, `docs/CONVENTIONS.md` et la partie concernée de `docs/cahier-des-charges/` avant de travailler. Index des autres documents : `docs/README.md`.
- Tout le contexte vient du dépôt. Si une décision ou une pièce manque, la noter dans `TODO.md` et la signaler au propriétaire ; ne rien inventer.
- Respecter la demande en cours : une demande de préparation ou d'audit n'autorise pas à implémenter tout le backlog.
- Réutiliser l'architecture Next.js / features / domains / services et préserver le code existant gardé par `TRI-BASE.md`.

## Boucle de travail
1. Lire `git status`, préserver les modifications utilisateur et prendre la première tâche non bloquée.
2. Inspecter l'existant et les critères de réussite ; choisir les détails techniques raisonnables sans demander confirmation.
3. Implémenter un changement ciblé et ajouter des tests pour les règles métier modifiées (citer l'identifiant d'exigence).
4. Lancer les vérifications adaptées, corriger, relancer celles qui ont échoué.
5. Mettre à jour `TODO.md` puis lancer `npm run todo:progress`.
- Ne cocher une tâche que lorsque ses critères sont vérifiés ; ne jamais présenter un contrôle statique comme un test fonctionnel.
- Si une tâche bloque, noter la cause et poursuivre une tâche indépendante. Ne solliciter le propriétaire que pour un accès indispensable, une action destructive, une décision produit ou d'architecture majeure ou une ambiguïté réellement bloquante.

## Travail à deux (Orso et Théo)
- Deux développeurs codent en parallèle, chacun avec son agent : Orso (propriétaire du dépôt et des décisions produit) et Théo (Claude sans offre Max, et Cursor). « Le développeur » désigne celui qui pilote la session en cours.
- Avant de commencer une tâche, vérifier dans `TODO.md` qu'elle n'est pas déjà prise : une tâche en cours porte « **En cours : Orso.** » ou « **En cours : Théo.** ». Ne jamais travailler sur une tâche prise par l'autre.
- Garde-fou avant chaque push (COLLAB-2) : installer une fois par clone `npm run collab:install-hook`. Le hook `.githooks/pre-push` refuse le push si une branche non fusionnée de l'autre touche les mêmes fichiers (hors `TODO.md`, archive et `package-lock.json`, seulement signalés), travaille aussi dans `prisma/`, ou si la tâche annoncée est « En cours » chez l'autre ; il refuse aussi tout push direct sur `base`, `main` ou `preproduction`. Vérification à la main avant de commencer : `npm run collab:check`. En cas de blocage, en parler à l'autre ; contournement voulu seulement : `ANNONA_COLLAB_OK=1 git push`.
- Schéma Prisma, migrations, `db:push`, `db:sync-schema`, `db:migrate` et seeds : un seul développeur à la fois sur `annona-dev`, annoncé dans la tâche avant de commencer. En cas de doute, demander au développeur.
- Données de test préfixées par le prénom (`test-orso-…`, `test-theo-…`) ; ne jamais modifier ni supprimer celles de l'autre.

## Branche et publication
- `base` est protégée sur GitHub : on n'y pousse jamais directement. Toute modification arrive par une pull request vers `base`, avec la CI verte et la branche à jour.
- Travailler sur une branche `<prénom>/<sujet>` créée depuis un `base` à jour (`git switch base && git pull`, puis `git switch -c orso/sujet`). Committer sur cette branche.
- Pousser sa branche et ouvrir la PR (`gh pr create --base base`) seulement quand le développeur le demande. Avant la PR, récupérer `base` (`git pull --rebase origin base`) et relancer `npm run check`.
- `TODO.md` change dans presque chaque PR : en cas de conflit, garder les deux versions des tâches, puis relancer `npm run todo:progress`.
- Jamais de push sur `preproduction` ni sur `main` sans demande explicite d'Orso : ils portent encore l'ancien produit.
- Pas de déploiement, de suppression de données ni de réinitialisation Git sans demande explicite.

## Routage des modèles
- Suivre `.cursor/rules/annona-model-router.mdc`. Garder un seul agent d'exécution actif et une seule tâche TODO en cours, sauf demande explicite d'un chantier multi-agents.
- Monter d'un niveau de modèle seulement si l'inspection révèle un changement de schéma, un risque de sécurité ou de données, une concurrence complexe ou une décision produit ambiguë.

## Vérifications
- `npm run check` : types, lint sans cache et tests locaux sans accès aux services externes. Vert = code de sortie 0.
- `npm run build` : validation du build ; ne pas lancer en parallèle du serveur dev (cache `.next` partagé).
- Le serveur n'est lancé que lorsque la demande inclut un lancement ou une validation locale. Ne pas arrêter un processus utilisateur.
- Ne jamais valider une étape ni cocher une case tant que la série n'est pas passée : cas demandés et états voisins, tests ciblés, `npm run check`, et clic réel navigateur si l'interface change. Détail : `.cursor/rules/annona-quality-gate.mdc`.

## Données et base
- Base de développement : projet Supabase `annona-dev`, sans données réelles. Utiliser des données de test identifiables et préserver les données préexistantes.
- Ne jamais afficher, versionner ou copier les secrets de `.env.local`.
- Pas de migration, synchronisation, seed ou reset implicite. Les commandes `db:push`, `db:sync-schema`, `db:migrate` et les seeds sont des opérations séparées, à évaluer avant exécution ; `dev` ne synchronise pas la base.
- Ne jamais modifier une base de production.
