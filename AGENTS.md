# Travailler sur TutelLiv

## OBLIGATION : mettre `TODO.md` à jour
- **Mettre `TODO.md` à jour est obligatoire, pas optionnel.** Après chaque changement de code, de comportement ou de visuel, même petit et même demandé en passant (retouche, correction rapide), consigner dans la tâche concernée ce qui a changé, les vérifications lancées avec leur résultat, ce qui reste non vérifié et la suite. S'il n'existe aucune tâche concernée, en créer une.
- Ne jamais terminer un tour ni annoncer un travail fini sans avoir mis `TODO.md` à jour puis lancé `npm run todo:progress`. Le propriétaire ne doit jamais avoir à le demander.
- Tenir à jour le bloc « Ce qu'il reste vraiment à faire » en tête de `TODO.md` (trois listes courtes : propriétaire, agent, attente extérieure ; simples tirets, pas de cases). C'est la seule vue que le propriétaire lit : la corriger à chaque fin de tâche.
- Sous le titre de chaque tâche ouverte, écrire qui doit agir ensuite : `**Qui : Claude.**` ou `**Qui : Toi.**`, avec une condition éventuelle (`**Qui : Claude — après le juriste.**`). `npm run todo:progress` en tire les listes sous la jauge ; une tâche sans cette ligne apparaît dans « À classer ». La changer quand la main passe.

## Sources et périmètre
- Lire ce fichier, `TODO.md` et `docs/CONVENTIONS.md` avant de travailler. Tâches closes, anciens tableaux et journal : `docs/TODO-ARCHIVE.md`, à ouvrir seulement si besoin.
- Quand une case est cochée, déplacer la tâche et ses preuves dans `docs/TODO-ARCHIVE.md`. Y ajouter aussi les lignes de journal. `TODO.md` reste une page de pilotage.
- `TODO.md` est la source unique des priorités et statuts ; vérifier le code avant de croire un ancien statut.
- Respecter la demande en cours : une demande de préparation ou d'audit n'autorise pas à implémenter tout le backlog.
- Réutiliser l'architecture Next.js / features / domains / services et préserver le code existant.

## Boucle autonome (quand le développement est demandé)
1. Lire `git status`, préserver les modifications utilisateur et prendre la première tâche non bloquée.
2. Inspecter l'existant et les critères de réussite ; choisir les détails techniques raisonnables sans demander confirmation.
3. Implémenter un changement ciblé et ajouter des tests pertinents pour les comportements métier modifiés.
4. Lancer les vérifications adaptées, corriger, puis relancer celles qui ont échoué ou sont affectées.
5. Mettre à jour `TODO.md` : état, résultat, commandes exécutées, limites et prochaine étape.
6. Lire `TODO.md` et le contexte Markdown exclusivement dans le dépôt. Après modification de `TODO.md`, lancer `npm run todo:progress` ; mettre à jour les preuves et documents pertinents dans le dépôt. Les modifications Markdown autorisées se publient uniquement sur la branche GitHub `preproduction`, conformément à `.cursor/rules/contexte-markdown.mdc`. Ne jamais rechercher, lire, écrire ni republier ces documents sur Google Drive, Google Docs, Google Sheets ou Notion dans un workflow d'agent de développement.
7. Continuer sur la prochaine tâche autorisée sans demander confirmation entre les étapes.
- Depuis le 16 octobre 2026, le propriétaire demande d’enchaîner les tâches autorisées sans confirmation jusqu’à instruction contraire et de regrouper la revue pour plus tard. Une revue visuelle différée ne bloque pas une tâche indépendante suivante ; ne jamais contourner un vrai blocage listé ci-dessous.
- Ne cocher une tâche que lorsque ses critères sont vérifiés ; ne jamais présenter un contrôle statique comme un test fonctionnel.
- Une tâche commencée doit être menée jusqu’à ses critères, ses tests, sa documentation et sa case cochée, sauf blocage réel consigné.
- Si une tâche bloque, noter la cause et poursuivre une tâche indépendante. Ne solliciter l'utilisateur que pour un accès indispensable, une action destructive, une décision produit/architecture majeure ou une ambiguïté réellement bloquante.

## Contexte local obligatoire — aucune dépendance à Drive
- Avant toute tâche : consulter `AGENTS.md`, `TODO.md`, `docs/README.md`, `docs/CONVENTIONS.md` et la documentation concernée dans `docs/`. La source de vérité technique est le dépôt `orsocrtnt/tutelliv-v2` sur `preproduction`, pas les copies Drive ni la TODO personnelle Notion.
- Ne jamais invoquer une recherche ou une écriture dans Drive/Docs/Sheets/Notion pour « se remettre en contexte », mettre à jour une TODO, produire une preuve ou republier du Markdown. Aucun fichier hors dépôt ne doit être modifié par les agents. Les `outputs/` générés pour les tests locaux restent locaux et ne doivent pas être diffusés.
- Si une donnée de décision ou un contrat n'est disponible qu'en dehors du dépôt : ne pas y accéder, ne pas inventer de contenu ni inférer une validation ; consigner précisément la pièce manquante et demander au fondateur de la traiter dans ChatGPT puis, si nécessaire, de fournir une version exploitable dans le dépôt. Poursuivre les travaux indépendants autorisés.
- Pour une modification de comportement, consulter la documentation métier existante (`docs/DECISIONS_PRODUIT_COMMERCIALES.md`, `docs/SAAS_OFFERS_ARCHITECTURE.md`, `docs/legal/`, `docs/operations/`) sans transformer une hypothèse ou une version de travail en engagement commercial ou juridique.
- Ne pas synchroniser les 45 actions personnelles Notion avec les 78 tâches techniques : périmètres différents. L'agent ne modifie que `TODO.md` pour le suivi technique.

## Routage autonome des modèles et maîtrise du quota
- Suivre `.cursor/rules/tutelliv-model-router.mdc` pour toute tâche de la TODO.
- L'étiquette `Modèle conseillé` de `TODO.md` choisit le modèle initial ; sa légende définit les replis lorsque ce modèle est indisponible.
- Réutiliser l'agent courant lorsqu'il a déjà le modèle adapté. Sinon, déléguer à `tutelliv-task-runner` avec le modèle exact indiqué. Une délégation autorisée peut sélectionner explicitement ce modèle sans redemander au propriétaire.
- Garder un seul agent d'exécution actif et une seule tâche TODO en cours. Ne pas utiliser Ultra, plusieurs sous-agents ou une revue séparée par défaut : leur coût doit être justifié par un travail réellement divisible ou un risque critique.
- Mener la tâche choisie jusqu'à ses critères, tests, corrections, rapport et case mise à jour. Après une tâche terminée, s'arrêter sauf si le propriétaire a explicitement demandé d'enchaîner plusieurs tâches.
- Monter d'un niveau seulement si l'inspection révèle un changement de schéma, un risque de sécurité ou de données, une concurrence complexe, plusieurs domaines fortement couplés ou une décision produit ambiguë. Ne jamais baisser le modèle d'une tâche à risque pour économiser du quota.

## Vérifications
- `npm run check` : types, lint sans cache et tests locaux sans accès aux services externes.
- `npm run build` : validation du build ; ne pas lancer en parallèle du serveur dev (cache `.next` partagé).
- Le serveur n'est lancé que lorsque la demande inclut un lancement ou une validation locale. Ne pas arrêter un processus utilisateur.
- Tester les parcours authentifiés uniquement avec un environnement et des comptes de développement identifiés.
- Ne jamais valider une étape, cocher une case ou demander un push tant que la série n'est pas passée : cas demandés + états voisins (reprise, compte déjà confirmé, retour arrière), tests ciblés, `npm run check`, et clic réel navigateur si l'UI change. Allonger le travail plutôt que faire revenir le propriétaire. Détail : `.cursor/rules/tutelliv-quality-gate.mdc`.

## Données et publication
- Ne pas afficher, versionner ou copier les secrets de `.env.local` dans les rapports/tests.
- Base distante actuelle : le 27 septembre 2026, l’utilisateur a confirmé qu’elle ne contient pas de données réelles et a autorisé les tests. Utiliser des données E2E identifiables ; préserver les données préexistantes. Cette autorisation ne vaut pas pour une future base de production.
- Ne jamais modifier les données de production. Pas de migration, synchronisation, seed ou reset implicite.
- `dev` ne synchronise pas la base. Les commandes `db:push`, `db:sync-schema`, `db:migrate` et les seeds sont des opérations séparées à évaluer avant exécution.
- Pas de push, déploiement, suppression de données ou réinitialisation Git sans demande explicite. Exception : les seuls Markdown listés dans `.cursor/rules/contexte-markdown.mdc`, une fois modifiés, partent sur `preproduction`.
- Respecter les limites d'accès du système ; une autorisation supplémentaire peut être nécessaire pour écrire hors du dossier de la session.
