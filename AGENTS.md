# Travailler sur TutelLiv

## Sources et périmètre
- Lire ce fichier, `TODO.md` et `docs/CONVENTIONS.md` avant de travailler.
- `TODO.md` est la source unique des priorités et statuts ; vérifier le code avant de croire un ancien statut.
- Respecter la demande en cours : une demande de préparation ou d'audit n'autorise pas à implémenter tout le backlog.
- Réutiliser l'architecture Next.js / features / domains / services et préserver le code existant.

## Boucle autonome (quand le développement est demandé)
1. Lire `git status`, préserver les modifications utilisateur et prendre la première tâche non bloquée.
2. Inspecter l'existant et les critères de réussite ; choisir les détails techniques raisonnables sans demander confirmation.
3. Implémenter un changement ciblé et ajouter des tests pertinents pour les comportements métier modifiés.
4. Lancer les vérifications adaptées, corriger, puis relancer celles qui ont échoué ou sont affectées.
5. Mettre à jour `TODO.md` : état, résultat, commandes exécutées, limites et prochaine étape.
6. Synchroniser toute copie de partage de la TODO ou de la recette, puis vérifier qu’elle est identique à la source du dépôt. Les copies sous `work/` restent des archives de travail et ne servent jamais de statut courant.
7. Continuer sur la prochaine tâche autorisée sans demander confirmation entre les étapes.
- Depuis le 16 octobre 2026, le propriétaire demande d’enchaîner les tâches autorisées sans confirmation jusqu’à instruction contraire et de regrouper la revue pour plus tard. Une revue visuelle différée ne bloque pas une tâche indépendante suivante ; ne jamais contourner un vrai blocage listé ci-dessous.
- Ne cocher une tâche que lorsque ses critères sont vérifiés ; ne jamais présenter un contrôle statique comme un test fonctionnel.
- Une tâche commencée doit être menée jusqu’à ses critères, ses tests, sa documentation et sa case cochée, sauf blocage réel consigné.
- Si une tâche bloque, noter la cause et poursuivre une tâche indépendante. Ne solliciter l'utilisateur que pour un accès indispensable, une action destructive, une décision produit/architecture majeure ou une ambiguïté réellement bloquante.

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
- Pas de push, déploiement, suppression de données ou réinitialisation Git sans demande explicite.
- Respecter les limites d'accès du système ; une autorisation supplémentaire peut être nécessaire pour écrire hors du dossier de la session.
