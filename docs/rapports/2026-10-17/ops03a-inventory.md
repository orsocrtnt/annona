# OPS-03A — Inventaire local de reprise

Date : 17 octobre 2026. Inspection en lecture seule de la cible de test actuellement autorisée ; aucune restauration, sauvegarde distante ou modification de fournisseur.

## État observé

- PostgreSQL 17.6, environ 15 Mio ; vingt tables publiques, toutes signalées avec RLS.
- Bucket `delivery-pods` présent et privé ; deux objets, deux références de preuve en base, volume inférieur à 1 Mio arrondi dans la preuve.
- Deux routes planifiées sont décrites dans `vercel.json`.
- Aucune baseline `prisma/migrations` globale ; DB-1 reste ouverte.
- Aucun `pg_dump` exécutable dans les emplacements locaux usuels.
- L'accès au compte hébergeur n'est pas disponible dans cette session : plan, rétention, dernier point restaurable et politique réelle des objets Storage restent inconnus.

Preuve sans secret ni identifiant : `outputs/ops03a/inventory.json`. La commande reproductible `npm run audit:ops03a` ne réalise aucune écriture métier.

## Décisions de préparation

Le guide `docs/operations/ops03a/README.md` fixe comme cible avant vente un RPO maximal d'une heure pour base et photos, et un RTO maximal de quatre heures. Ces objectifs restent internes jusqu'à un exercice réussi. La base, les objets Storage, les réglages fournisseur, l'hébergement, les secrets et le code doivent être traités séparément puis validés ensemble.

La documentation Supabase courante confirme que les sauvegardes de base n'incluent pas les fichiers Storage, même si leurs métadonnées se trouvent en base. Une duplication vers un nouveau projet ne copie pas non plus les objets et plusieurs réglages doivent être recréés.

## Blocages restants

Il faut un accès administrateur au fournisseur, une cible Supabase isolée et un outil PostgreSQL compatible. La restauration doit ensuite être chronométrée avec comparaison base/photos, RLS, Auth et recette des trois rôles. OPS-03A reste ouverte ; aucune dépense, installation, création de projet ou opération destructive n'a été engagée.
