# DATA-02 — première tranche de nettoyage des démos expirées

18 octobre 2026. Exécution ciblée, séquentielle, au niveau Astra requis par la TODO (risque de données et concurrence). État Git initial très modifié conservé ; aucune remise à zéro, migration, publication, modification fournisseur ou arrêt du serveur utilisateur.

## Résultat

Une nouvelle session démo porte désormais son échéance serveur de huit heures. Un outil opérateur dry-run par défaut peut supprimer après une heure de grâce les seules sessions précisément identifiées, avec leurs huit utilisateurs synthétiques et sans actifs externes. Les anciennes sessions sans échéance ne sont pas reprises implicitement. Le rejeu d'un cookie expiré/supprimé est refusé ; la reconnexion renouvelle la session.

Le service protège les références entrantes et sortantes avant les cascades, vérifie le bucket privé et le dossier vide, refuse comptes ajoutés/Auth, fichiers et jobs en cours. Verrou conditionnel et suppression s'effectuent dans une transaction sérialisable ; conflits rejoués au plus trois fois. Aucun endpoint générique ni appel de suppression Storage/Auth ajouté. La coordination distribuée nécessaire aux démos avec assets reste un blocage explicite.

## Fichiers de cette avancée

- `src/lib/demo/retention.ts` : marqueur v1 et délais.
- `src/domains/demo/demo-session.service.ts` : émission d'échéance, refus de réemploi expiré, reconnexion ; `src/lib/api/server-auth.ts` : refus d'accès propre.
- `src/domains/data-lifecycle/demo-cleanup.service.ts` : garde-fous, transaction, reprises, sonde Storage uniquement en lecture.
- `scripts/data02/cleanup-demo.ts` : lot borné et activation explicite ; `scripts/data02/demo-retention-connected.ts` : fixtures et contrôles réels.
- `tests/demo-retention.test.ts` : huit tests locaux ; `package.json` : deux commandes ; `.env.example` : activation vide.
- Guide `docs/operations/data02/DEMO_RETENTION.md`, index DATA-02, présent rapport, TODO et copies synchronisées ; preuve `outputs/data02/demo-retention-connected.json`.

## Preuves

La recette connectée du 18 octobre réussit sur les seules fixtures de l'exécution :

- A expirée : dry-run sans mutation, puis suppression complète ; B active et entreprise normale : empreintes identiques.
- Facture de B référençant A : refus ; facture étrangère conservée, puis retrait exact par le harnais.
- Identifiant utilisateur de forme UUID : refus ; aucun appel Auth.
- Orphelin Storage réel : refus et octets inchangés ; photo attachée : refus. L'objet de fixture est ensuite retiré par le harnais, pas par le nettoyeur.
- Panne au milieu de la transaction, après suppressions enfants : empreinte A restaurée à l'identique.
- Deux workers : un `deleted`, un `missing`. Le conflit PostgreSQL P2034 a été observé puis repris automatiquement ; nouveau rejeu `missing`.
- Nettoyage final : zéro entreprise et objet Storage de fixture, 17 compteurs globaux strictement restaurés. Aucune donnée préexistante supprimée.

Validation finale : `npm run check` réussi, 251/251 tests dont huit dédiés, types et lint stricts ; lint explicite des deux scripts et du nouveau fichier de tests réussi. `npm run docs:verify` contrôle 47 documents et synchronise les deux copies de TODO ; scanner sans détection sur 832 fichiers ; `git diff --check` réussi. Le build production de 100 pages a réussi dans une copie temporaire isolée sans `.env.local`, avec variables publiques factices. Le serveur et son cache `.next` n'ont pas été utilisés. L'avertissement connu de bibliothèque Supabase utilisant `process.version` dans Edge reste non bloquant.

## Limites et suite

DATA-02 reste ouverte. Les sessions avec assets, nouveaux comptes ou jobs en cours et les anciennes démos sont délibérément refusées. Aucun ordonnanceur ni alerte n'a été activé : la cible ≤24 h n'est donc pas globalement satisfaite. Prochaine tranche : gel commun des écritures/uploads, manifeste durable et reprise Storage/Auth, traitement de provenance legacy, puis cadence et alerte sur préproduction. Conservation réelle, sauvegardes, canal de remise chiffré et restauration demeurent soumis aux validations externes existantes.
