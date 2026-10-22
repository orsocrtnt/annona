# OPS-03A — Répétition sauvegarde et restauration

Date : 21 octobre 2026  
Cible : préproduction Supabase isolée  
Résultat applicatif : réussi  
Résultat fournisseur complet au moment de ce premier exercice : non encore exécuté

## Résultat obtenu

Une archive locale temporaire a sauvegardé le graphe complet des vingt tables applicatives ainsi qu'une preuve de livraison PNG privée. Son manifeste a enregistré les tailles et empreintes SHA-256. Après vérification, le schéma et le bucket sources temporaires ont été supprimés avant le début de la restauration.

Les deux migrations du dépôt ont reconstruit un second schéma. Les vingt tables ont été restaurées à l'identique et la preuve a été recopiée dans un second bucket privé sous son chemin d'origine. La validation a retrouvé la commande, la livraison livrée, leur relation, le résultat de preuve, le chemin Storage et les octets exacts du PNG. Une URL signée du fichier restauré a été téléchargée avec succès.

## Mesures

- sauvegarde et manifeste : 18,332 s ;
- restauration base et Storage : 10,529 s ;
- validation complète : 12,9 s ;
- exercice total avec contrôles et nettoyage : 55,969 s ;
- tables restaurées : 20/20 ;
- objets Storage restaurés : 1/1 ;
- migrations appliquées : 2/2 ;
- tables sous RLS : 20/20 ;
- drift Prisma : aucun ;
- migration rejouée : aucune opération restante.

Le temps de restauration logique observé respecte largement l'objectif interne de RTO inférieur à quatre heures. Cette mesure ne comprend pas la création d'un nouveau projet fournisseur, la remise en place d'Auth, des secrets et des réglages externes.

## Garde-fous et nettoyage

Les noms de schémas et buckets acceptés sont limités par des expressions strictes. `public`, `auth`, `storage`, `delivery-pods` et tout nom inattendu sont refusés par le code et par trois tests dédiés. Une variable de confirmation est obligatoire avant l'exécution connectée.

Après la répétition :

- les deux schémas temporaires sont absents ;
- les deux buckets temporaires sont absents ;
- l'archive locale temporaire est supprimée ;
- l'empreinte du schéma public est inchangée ;
- les compteurs des vingt tables publiques sont inchangés ;
- le catalogue Storage est inchangé ;
- les objets existants de `delivery-pods` ont le même nombre et les mêmes empreintes ;
- les comptes Auth ont le même nombre et la même empreinte ;
- aucun secret n'est inclus dans la preuve structurée.

## Limite fournisseur

La préproduction est sur Supabase Free. La documentation officielle indique que les sauvegardes quotidiennes gérées sont disponibles sur les plans payants et recommande aux projets Free des exports réguliers hors site. Elle précise également que les sauvegardes de base ne contiennent pas les objets Storage. La restauration vers un nouveau projet est réservée aux offres payantes et nécessite encore une recopie manuelle de Storage et de plusieurs réglages : [Database Backups](https://supabase.com/docs/guides/platform/backups), [Restore to a new project](https://supabase.com/docs/guides/platform/clone-project).

Les deux emplacements gratuits actifs sont déjà occupés par la cible historique et la préproduction. Sans modifier l'existant ni déclencher une dépense, il n'est donc pas possible d'exercer aujourd'hui un clone physique complet vers un troisième projet avec restauration des schémas gérés, des paramètres Auth/Realtime et des secrets.

Cette première étape ne devait pas être présentée comme un plan de reprise fournisseur complet. Le même jour, après mise en pause autorisée de la cible historique et libération d'un emplacement Free, l'exercice fournisseur a finalement été réalisé avec succès. Voir `docs/rapports/2026-10-21/ops03a-provider-restore.md`.
