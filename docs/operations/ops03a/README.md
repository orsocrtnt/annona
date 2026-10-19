# OPS-03A — Sauvegarde et restauration

État de référence : 17 octobre 2026. Cette procédure prépare une restauration complète de TutelLiv sans l'exécuter sur la cible actuelle. Une sauvegarde n'est considérée valide qu'après restauration chronométrée sur un projet isolé.

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
- Installer la version cliente PostgreSQL compatible ou la CLI Supabase. Le poste actuel ne possède pas `pg_dump` dans les emplacements usuels.
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

OPS-03A reste ouverte jusqu'à cet exercice. L'archive locale du code et l'inventaire en lecture seule ne valident ni la sauvegarde distante ni la restauration.
