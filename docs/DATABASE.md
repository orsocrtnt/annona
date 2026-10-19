# Base de données TutelLiv

État de référence : 17 octobre 2026. La définition actuelle est `prisma/schema.prisma`; ce document décrit les groupes fonctionnels et les règles de modification sans recopier chaque colonne.

## Modèles actuels

### Identité et isolation

- `Company` : entreprise locataire, statut et réglages ;
- `User` : identité métier liée à Supabase Auth, entreprise, rôle et statut ;
- `Role`, `Permission`, `RolePermission` : RBAC ;
- `ClientNotification` : notifications intégrées au portail.

### Commande et livraison

- `Order`, `OrderItem`, `OrderStop` : commande, articles et collectes ordonnées ;
- `Delivery` : mission logistique, chauffeur, états, horaires, preuve et idempotence ;
- `DriverLocation`, `TrackingEvent` : dernière position autorisée et chronologie ;
- `OrderMessage`, `OrderThreadRead` : conversation liée à la commande et marqueurs de lecture ;
- `OperationJob` : auto-dispatch et notifications différées avec reprise.

### Client et exploitation

- `Invoice` : facturation de livraison séparée de l'état logistique ;
- `SupportTicket`, `SupportTicketMessage` : support client et historique ;
- `CustomerAddress` : carnet d'adresses client ;
- `RecurringOrder` : modèle et planification de commandes récurrentes.

Le schéma comprend 20 modèles Prisma. Les anciens enum `INVOICED` et `PAID` existent encore dans les statuts commande/livraison pour compatibilité historique ; les services courants refusent de les utiliser comme transitions logistiques.

## Relations essentielles

```text
Company
├── User ── Role ── RolePermission ── Permission
├── Order ── OrderItem / OrderStop / OrderMessage
│     ├── Delivery ── DriverLocation / TrackingEvent
│     └── Invoice
├── SupportTicket ── SupportTicketMessage
├── RecurringOrder
└── OperationJob
```

Les liens vers un client, un chauffeur, une commande ou une livraison ne suffisent jamais seuls : l'entreprise doit aussi correspondre.

## Connexions

- `DATABASE_URL` est utilisée par l'application, y compris en développement. Avec Supabase serverless, elle vise normalement le pooler transactionnel.
- `DIRECT_URL` est réservée aux opérations Prisma qui exigent une connexion directe.
- `DATABASE_CONNECTION_LIMIT` borne le pool par instance entre 1 et 10, valeur par défaut 5.
- `DATABASE_CONNECTION_MODE=session` est une option pour un serveur local permanent ; le mode transactionnel reste le défaut documenté.

Ne jamais afficher ni archiver ces URL. Les sorties de tests ne doivent contenir ni hôte, ni utilisateur, ni mot de passe.

## Commandes et niveau de risque

```bash
npm run db:generate       # local : régénère le client Prisma
npm run db:studio         # lecture/édition manuelle selon les accès fournis
npm run db:push           # écrit le schéma sur la base
npm run db:sync-schema    # synchronisation spécifique au projet
npm run db:migrate        # crée/applique une migration de développement
npm run db:seed           # écrit rôles et permissions
```

Seule `db:generate` fait partie du travail local courant. Toutes les autres commandes exigent l'identification de la cible, une sauvegarde adaptée, une inspection du diff et une autorisation correspondant à l'opération.

## État des migrations et de la sécurité

Le dépôt ne contient pas encore de répertoire `prisma/migrations` servant de baseline reproductible. Plusieurs évolutions additives ont été contrôlées sur la base de test et leurs procédures se trouvent dans `docs/operations/`, mais elles ne remplacent pas DB-1.

L'inventaire DB-1 aligne désormais les actions référentielles et le défaut `operation_jobs.updated_at` du fichier Prisma sur la cible de test, sans écrire dans la base. Le diff Prisma cible → schéma est vide. Deux brouillons non applicables directement se trouvent sous `outputs/db1/` : la création des modèles Prisma et le complément RLS/retraits de droits. Ils ne couvrent pas Supabase Auth, Storage ni la configuration fournisseur et ne constituent pas encore `prisma/migrations`.

La base de test inspectée a RLS active sur les tables métier et aucun droit direct pour `anon`, `authenticated` ou `PUBLIC`. Prisma utilise une connexion serveur privilégiée ; l'isolation applicative reste donc obligatoire. Toute nouvelle table doit être auditée de nouveau.

## Procédure d'évolution

1. Identifier l'environnement et vérifier qu'il ne contient pas de données réelles non autorisées.
2. Comparer `schema.prisma` à la cible sans appliquer de changement.
3. Préparer une migration additive et un retour arrière ou une stratégie de restauration.
4. Tester sur une cible isolée avec fixtures A/B.
5. Vérifier RLS, droits publics, index, contraintes et compatibilité des lignes existantes.
6. Exécuter les tests locaux, connectés et le build.
7. Consigner l'empreinte avant/après et le nettoyage ciblé.

Le contrôle en lecture seule se relance avec `npm run audit:db1`. La procédure de baseline, les écarts couverts et la stratégie de retour arrière sont détaillés dans `operations/db1/README.md`.

La création d'une préproduction, la baseline complète et la restauration chronométrée restent respectivement dans ENV-1, DB-1 et OPS-03A.

## Export de sortie d'une entreprise

Le socle DATA-02 ajoute un export JSON versionné du graphe d'une entreprise dans `src/domains/data-lifecycle/company-export.service.ts`. Il exclut les identifiants Auth et les clés internes, et produit un manifeste des preuves privées à extraire séparément. La procédure et ses limites sont dans `operations/data02/README.md` ; aucune suppression générique d'entreprise existante n'est exposée.
