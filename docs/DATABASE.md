# Base de données Annona

État de référence : 22 octobre 2026. La définition actuelle est `prisma/schema.prisma`; ce document décrit les groupes fonctionnels et les règles de modification sans recopier chaque colonne.

## Modèles actuels

> 6 novembre 2026 (NET-1) : les modèles de l'ancien produit (offres et souscriptions SaaS, inscription, démonstrations, prospection, ventes, pilotes, liste d'attente, contact, journal d'accès plateforme, commande par message, liens de suivi publics, conversation de commande) ont été retirés du schéma. Le modèle métier (commande, livraison, rôles) reste celui de l'ancien produit jusqu'à SCHEMA-1, qui le remplace par le modèle de `docs/cahier-des-charges/` avec une migration initiale. Les migrations historiques de `prisma/migrations` ne correspondent donc plus au schéma.

### Identité et isolation

- `Company` : entreprise locataire, statut et réglages ;
- `User` : identité métier liée à Supabase Auth, entreprise, rôle et statut ;
- `Role`, `Permission`, `RolePermission` : RBAC ;
- `ClientNotification` : notifications intégrées au portail ;
- `AuthLoginFailure` : empreintes transitoires des échecs de connexion.

### Commande et livraison

- `Order`, `OrderItem`, `OrderStop` : commande, articles et collectes ordonnées ;
- `Delivery` : mission logistique, livreur, états, horaires, preuve et idempotence ;
- `DriverLocation`, `TrackingEvent` : dernière position autorisée et chronologie ;
- `DriverPushSubscription` : abonnements aux notifications push du livreur ;
- `OperationJob` : notifications et factures différées avec reprise.

### Client et exploitation

- `Invoice`, `InvoiceCounter`, `InvoiceReminder` : facturation, numérotation continue et relances ;
- `SupportTicket`, `SupportTicketMessage` : support client et historique ;
- `CustomerAddress` : carnet d'adresses client ;
- `CompanyCustomer` : fiche client sans accès propre à chaque entreprise ;
- `RecurringOrder` : modèle et planification de commandes récurrentes.

Le schéma comprend 23 modèles Prisma.

## Relations essentielles

```text
Company
├── User ── Role ── RolePermission ── Permission
├── Order ── OrderItem / OrderStop
│     ├── Delivery ── DriverLocation / TrackingEvent
│     └── Invoice
├── SupportTicket ── SupportTicketMessage
├── RecurringOrder
└── OperationJob
```

Les liens vers un client, un livreur, une commande ou une livraison ne suffisent jamais seuls : l'entreprise doit aussi correspondre.

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

Le dépôt contient dix-neuf migrations reproductibles, de la baseline initiale aux codes commerciaux (`prisma/migrations/`). Toutes sont appliquées uniquement à la préproduction autorisée. Les deux dernières, `20261027090000_contact_messages` puis `20261027120000_sales_codes`, l'ont été le 27 octobre 2026 par `prisma migrate deploy`, sur instruction du propriétaire, **avant** la fusion du code qui les lit. Contrôle après application : `prisma migrate diff` sans aucun écart, `migrate status` à jour, 39 tables applicatives, RLS active sur les 4 nouvelles, aucun droit public ni politique, et données existantes inchangées (3 brouillons d'inscription, 16 entreprises, 94 événements d'accès). Le contrôle en lecture seule du 26 octobre 2026 y avait retrouvé dix-sept migrations terminées, 35 tables applicatives, RLS active sur chacune et aucun droit direct public.

Retour arrière : une fois que le nouveau code a journalisé des accès `CONTACT_MESSAGES`, `SALES_CODES` ou `SALES_COMMISSIONS`, l'ancien code ne sait plus lire la liste des événements d'accès, car son client Prisma ignore ces valeurs d'énumération. Avant tout retour à une version antérieure, filtrer ces ressources ou attendre la purge à 90 jours ; les autres écrans ne sont pas concernés.

Les 39 tables ont RLS active et aucun droit direct pour `anon`, `authenticated` ou `PUBLIC` (toutes présentes en préproduction depuis le 27 octobre 2026). Prisma utilise une connexion serveur privilégiée ; l'isolation applicative reste donc obligatoire. `tests/db1-migration-security.test.ts` vérifie à chaque `npm run check` que toute table créée par migration a un modèle, active la RLS, retire tous les droits à `PUBLIC`, `anon` et `authenticated`, et qu'aucune politique ni aucun `GRANT` ne la rouvre. Ce test lit les fichiers de migration : l'état réel d'une base reste à auditer après application. Le catalogue SaaS actif et les entreprises historiques migrées en compatibilité `LEGACY` ne créent aucun abonnement payant implicite. Les brouillons d'inscription et événements de paiement restent eux aussi exclusivement accessibles par le serveur.

## Procédure d'évolution

1. Identifier l'environnement et vérifier qu'il ne contient pas de données réelles non autorisées.
2. Comparer `schema.prisma` à la cible sans appliquer de changement.
3. Préparer une migration additive et un retour arrière ou une stratégie de restauration.
4. Tester sur une cible isolée avec fixtures A/B.
5. Vérifier RLS, droits publics, index, contraintes et compatibilité des lignes existantes.
6. Exécuter les tests locaux, connectés et le build.
7. Consigner l'empreinte avant/après et le nettoyage ciblé.

Le contrôle en lecture seule se relance avec `npm run audit:db1`. La procédure de baseline, les écarts couverts et la stratégie de retour arrière sont détaillés dans `operations/db1/README.md`.

La préproduction, la baseline et la restauration fournisseur sont terminées. La sauvegarde récurrente hors site, les alertes et l'exercice périodique de restauration restent suivis dans OPS-03B.

## Export de sortie d'une entreprise

Le socle DATA-02 ajoute un export JSON versionné du graphe d'une entreprise dans `src/domains/data-lifecycle/company-export.service.ts`. Il exclut les identifiants Auth et les clés internes, et produit un manifeste des preuves privées à extraire séparément. La procédure et ses limites sont dans `operations/data02/README.md` ; aucune suppression générique d'entreprise existante n'est exposée.

### Preuve de livraison : signature, position et conservation (POD-2)

- Colonnes de `deliveries` ajoutées par `20261028120000_pod_signature` : `pod_signature_path`, `pod_recipient_name`, `pod_signature_refused_reason`, `pod_latitude`, `pod_longitude`, `pod_position_at`. La signature (PNG aplati sur fond blanc) est stockée dans le bucket privé existant `delivery-pods`, sous `companyId/deliveryId-sig-<horodatage>-<uuid>.png` ; aucun nouveau bucket.
- Export et archive DATA-02 : le JSON exporte déjà ces colonnes avec la livraison ; le manifeste `externalAssets.proofObjects` liste désormais la signature (`kind: "signature"`, la photo n'a pas de `kind`) et l'archive la télécharge dans `proofs/` avec le même contrôle de chemin (entreprise et livraison) et le même manifeste SHA256 (`proofCount` compte photos et signatures).
- Purge de démonstration (`demo-cleanup`, `demo-pool`, inventaire hérité) : une signature compte comme une référence externe, au même titre que la photo, et bloque le recyclage tant que l'objet Storage existe.
- Durée de conservation : la signature suit exactement le sort de la photo et de la livraison. Aucune durée n'est encore validée (projet `operations/data02/RETENTION_POLICY_DRAFT.md` : durée nécessaire au suivi et aux contestations, jusqu'à cinq ans si la preuve commerciale le justifie) et aucun purgeur général n'existe : ne présenter aucune durée comme effective. La position (`pod_latitude`, `pod_longitude`) est une donnée de géolocalisation du livreur : à aligner sur la décision GPS (point 7 de `legal/README.md`) avant données réelles.
- Les photos sont ré-encodées côté serveur (EXIF, dont la position GPS, supprimé) ; les liens Storage ne sont jamais renvoyés par l'API : ils sont générés à la demande (5 minutes) par les routes `.../proof/photo` et `.../proof/signature`.
- Règles par entreprise : `companies.settings.proofRules` = `{ signatureRequired: false, emailToClient: true }` (défauts), via `GET/PATCH /api/company/proof-rules`. La signature est donc facultative par défaut.
