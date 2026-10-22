# OPS-03A — Sauvegarde et restauration

État de référence : 21 octobre 2026. La répétition logique sur la préproduction puis la restauration de l'export fournisseur complet vers un troisième projet Supabase isolé ont réussi. La base, Auth, le catalogue Storage et les deux preuves physiques ont été retrouvés et contrôlés sans modifier la préproduction ni la production.

## Objectifs avant vente

Objectif technique retenu pour une V1 payante : **RPO d'une heure maximum** pour la base et les preuves photo, **RTO de quatre heures maximum** pour rétablir un service contrôlé. Ces valeurs guident le choix du plan et de la copie Storage ; elles ne constituent pas une promesse client tant que l'exercice isolé n'a pas réussi.

Répéter l'exercice au moins chaque trimestre, après un changement important de stockage/base et avant d'élargir fortement le nombre de clients. Conserver la durée réelle, la date du point restauré et les écarts constatés.

## Ce qui doit être sauvegardé

1. La base PostgreSQL complète : schémas `public`, `auth`, `storage`, rôles, politiques RLS, fonctions, contraintes et données.
2. Les objets réels du bucket privé `delivery-pods`. Les lignes `storage.objects` ne sont que les métadonnées et ne remplacent pas les fichiers.
3. La configuration du projet : Auth, URL de retour, e-mails, Storage, Realtime, extensions et restrictions réseau.
4. La configuration d'hébergement : variables, tâches planifiées, domaine et version applicative. Les valeurs de secrets doivent être conservées dans un coffre dédié, jamais dans le dépôt ou la preuve de recette.
5. Le code versionné et le manifeste des versions Node, Prisma, PostgreSQL et dépendances.

Supabase précise que ses sauvegardes de base **n'incluent pas les objets Storage** et qu'une restauration à un nouveau projet exige de recopier les fichiers et plusieurs réglages. Voir les documents officiels [Database Backups](https://supabase.com/docs/guides/platform/backups) et [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project).

## Préparer l'exercice

- Obtenir un accès administrateur au projet source et à un projet Supabase isolé, sans données réelles ni intégrations externes actives.
- Vérifier dans le tableau de bord le plan, le type de sauvegarde, la rétention, le dernier point récupérable et le coût d'une restauration vers un nouveau projet. Ne pas déduire ces éléments de l'URL de connexion.
- Installer la version cliente PostgreSQL compatible ou la CLI Supabase. Le poste de répétition utilise `libpq` 18.6.
- Désactiver sur la cible les crons, webhooks, e-mails et autres effets externes avant restauration. Une copie physique peut réactiver des extensions ou tâches présentes dans la base.
- Relever le manifeste source avec `npm run audit:ops03a`. Il est en lecture seule et ne contient ni identifiant, ni URL, ni secret.

## Exercice de restauration isolée

1. Noter l'heure de départ et l'heure du point de récupération choisi.
2. Exporter ou cloner la base selon la méthode du fournisseur. Pour un export logique, utiliser la connexion directe ou le pooler en mode session, jamais le pooler transactionnel de l'application.
3. Télécharger séparément tous les objets de `delivery-pods` et produire un manifeste local comprenant chemin, taille et empreinte cryptographique. Chiffrer l'archive et appliquer une rétention limitée.
4. Restaurer la base sur le nouveau projet. Recréer les réglages hors base et les secrets avec de nouvelles valeurs.
5. Recréer `delivery-pods` en privé, recopier les objets sous les mêmes chemins puis vérifier les empreintes.
6. Pointer une copie locale de l'application vers la cible isolée, garder les e-mails et crons désactivés, puis exécuter génération Prisma, contrôle de santé et recette A/B.
7. Vérifier les vingt tables métier, RLS, absence de droits publics, comptes Auth, commandes, livraisons, conversations, factures, deux preuves photo et leurs liens signés.
8. Comparer le manifeste source au manifeste restauré. Aucun objet manquant, aucune preuve orpheline et aucune donnée d'une autre entreprise ne sont acceptés.
9. Noter le RPO et le RTO réels. Détruire la cible ou ses fixtures seulement après autorisation explicite et selon sa politique de rétention.

## Décision de reprise

Une restauration vers le projet source est une action destructive et peut supprimer les écritures postérieures au point choisi. Préférer une restauration vers un nouveau projet, qualifier les données, puis décider du basculement. La décision exige le responsable produit/opérations, l'identification de l'incident et un plan pour les écritures survenues pendant l'interruption.

Le retour au service exige : santé profonde verte, connexions des trois rôles, commande → affectation → prise en charge → preuve, refus interentreprise, téléchargement photo, crons encore maîtrisés et journal d'incident complété.

## Répétition reproductible sur la préproduction

La commande suivante exige la garde de préproduction et une confirmation explicite :

`OPS03A_RESTORE_REHEARSAL=I_UNDERSTAND_TEMP_SCHEMAS_AND_BUCKETS_ONLY npm run ops03a:rehearse-preproduction`

Elle réalise le scénario suivant :

1. empreinte du schéma et des vingt tables publiques, du catalogue Storage, des fichiers existants de `delivery-pods` et des comptes Auth ;
2. création de deux schémas et deux buckets temporaires strictement nommés ;
3. application des deux migrations, création d'un graphe fictif couvrant les vingt tables et ajout d'une vraie preuve PNG privée ;
4. export logique dans une archive locale temporaire avec manifeste, taille et SHA-256 ;
5. vérification de l'archive, puis suppression de la source avant toute restauration ;
6. reconstruction du schéma cible, restauration des vingt tables et copie du fichier sous son chemin d'origine ;
7. comparaison des vingt empreintes, relations commande/livraison, configuration privée du bucket, octets du fichier et lecture par URL signée ;
8. rejeu sans migration en attente, suppression des cibles temporaires et comparaison de l'environnement public avant/après ;
9. suppression de l'archive locale temporaire.

Le 21 octobre, la sauvegarde a pris 18,332 s, la restauration 10,529 s, la validation 12,9 s et l'exercice complet 55,969 s. Les vingt tables et la preuve ont été restaurées à l'identique. Schéma public, compteurs applicatifs, catalogue et fichiers Storage existants ainsi que comptes Auth sont restés inchangés. La preuve structurée sans secret est enregistrée sous `outputs/ops03a/restore-rehearsal.json`.

## Restauration fournisseur sur un nouveau projet

Le même jour, l'export officiel de la cible historique a été restauré sur le projet Free temporaire `tutelliv-restore-rehearsal`. La cible historique était déjà en pause et la préproduction n'a pas été utilisée.

1. Conserver `database.backup.gz`, `database.backup.sql` et `storage.zip` dans un dossier privé, puis vérifier `SHA256SUMS`.
2. Créer un projet Supabase isolé sans intégration sortante, conserver son mot de passe dans un fichier `.env*.local` ignoré et tester la connexion.
3. Importer le SQL. Les objets Supabase déjà gérés peuvent produire des erreurs de propriété/rôle ; comparer ensuite toutes les tables et ne jamais conclure sur le seul code retour.
4. Si les tables Auth dépendantes sont absentes, extraire leurs blocs `COPY` de l'export et les rejouer dans l'ordre : `identities`, `one_time_tokens`, `sessions`, `mfa_amr_claims`, `refresh_tokens`.
5. Recompter chaque table des schémas `auth`, `public`, `realtime`, `storage` et `vault`. Refuser tout manque ou compteur différent.
6. Récupérer une clé serveur propre à la cible et lancer, avec une confirmation explicite :

   `OPS03A_PROVIDER_RESTORE=I_UNDERSTAND_ISOLATED_RESTORE_PROJECT_ONLY npm run ops03a:restore-provider-storage -- /chemin/storage.zip outputs/ops03a/provider-restore.json`

7. Le script refuse les références de la cible historique et de la préproduction, restaure uniquement `delivery-pods`, vérifie chaque octet par téléchargement direct et URL signée, confirme le bucket privé et contrôle Auth.
8. Reconfigurer séparément les URL Auth, e-mails, secrets, crons, domaines et variables d'hébergement : ils ne sont pas fournis par l'export SQL/Storage.
9. Ne basculer l'application qu'après santé, RLS, trois rôles, parcours commande/livraison/preuve et refus interentreprise verts.

Résultat observé : import SQL 2 min 12 s ; 58/58 tables attendues avec compteurs identiques ; 25 utilisateurs Auth visibles ; 20/20 tables publiques sous RLS ; 438 commandes et 438 livraisons ; deux preuves sur deux restaurées et lisibles ; phase Storage finale 3,298 s. Rapport : `docs/rapports/2026-10-21/ops03a-provider-restore.md`.

## Limite du plan gratuit

Supabase recommande aux projets Free d'exporter régulièrement leurs données et de conserver une sauvegarde hors site. Les sauvegardes quotidiennes gérées concernent les plans payants et ne comprennent pas les fichiers Storage. La fonction « Restore to a new project » est elle aussi réservée aux plans payants et ne copie pas les objets Storage ni plusieurs réglages du projet : [Database Backups](https://supabase.com/docs/guides/platform/backups), [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project).

Les deux répétitions valident donc la reprise logique des données TutelLiv, d'Auth et des preuves sur une cible fournisseur distincte, sans dépense. Elles ne fournissent pas :

- la conservation automatique d'un point de reprise chaque heure ;
- une restauration automatique des réglages Auth, Realtime, extensions, clés et variables d'hébergement ;
- le RPO d'une heure en exploitation continue.

Le 21 octobre 2026, le propriétaire a confirmé que les données restantes de la cible historique étaient fictives. Un inventaire final sans identifiant a compté cinquante-deux anciennes sessions, puis le projet historique a été mis en pause sans suppression. Supabase l'affiche comme récupérable et il ne consomme plus un emplacement actif Free. La préproduction est restée conforme après la pause.

OPS-03A est close par l'exercice fournisseur complet. L'objectif RPO d'une heure reste une porte de mise en vente : RELEASE-1 devra choisir et vérifier une exportation chiffrée hors site au moins horaire ou une capacité fournisseur payante approuvée, avec sauvegarde Storage séparée. Le RTO observé est compatible avec la cible interne de quatre heures, mais ne devient pas une garantie contractuelle.
