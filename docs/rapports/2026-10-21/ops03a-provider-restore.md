# OPS-03A — Restauration fournisseur sur cible isolée

Date : 21 octobre 2026  
Source : export officiel du projet Supabase historique mis en pause  
Cible : projet Supabase Free temporaire `tutelliv-restore-rehearsal`  
Résultat : réussi, sans modification de la préproduction ni de la production

## Périmètre

L'exercice a utilisé le troisième emplacement Free libéré par la mise en pause du projet historique. Un nouveau projet, sans intégration sortante, a reçu l'export PostgreSQL officiel et l'archive Storage. Les données sont fictives. Aucun abonnement payant, déploiement Vercel, envoi d'e-mail ou modification de la préproduction n'a été déclenché.

Les archives locales sont conservées avec des permissions limitées au propriétaire dans `Bureau/03 — Projets/TutelLiv/Sauvegardes Supabase/2026-10-21-ancien-projet`. Le manifeste `SHA256SUMS` couvre l'export compressé, sa version SQL, l'archive Storage, les journaux de restauration, les inventaires et les preuves finales. Sa vérification est entièrement verte.

## Base restaurée

L'import SQL initial a duré 2 min 12 s. Les erreurs du journal concernent les rôles réservés, propriétaires et objets gérés déjà créés par Supabase. Cinq tables Auth dépendantes n'avaient pas reçu leurs lignes à cause de l'ordre de l'export ; leurs blocs `COPY` ont été rejoués dans l'ordre des dépendances. Le second contrôle compare les compteurs de chaque table présente dans l'export.

- 58 tables sauvegardées sur 58 retrouvées ;
- aucune table manquante et aucun compteur différent ;
- 4 569 lignes publiques restaurées ;
- 1 061 lignes Auth restaurées, dont 25 utilisateurs visibles par l'API d'administration ;
- 91 lignes Realtime et 77 lignes Storage restaurées ;
- 20 tables applicatives sur 20 avec RLS active ;
- 438 commandes, 438 livraisons et deux références de preuve retrouvées ;
- six rôles, trente-trois permissions et les 107 liaisons de l'export historique retrouvés.

La cible contient en plus `realtime.messages`, table système créée par la version actuelle de Supabase. Elle n'était pas dans l'ancien export et ne constitue pas un écart de données.

## Storage et Auth

Les deux PNG de l'archive Storage ont été replacés sous leurs chemins d'origine dans le bucket privé `delivery-pods`. La restauration et les deux modes de lecture ont été automatisés par `scripts/ops03a/restore-provider-storage.ts` avec une garde qui refuse le projet historique et la préproduction.

- deux objets sur deux envoyés ;
- empreinte SHA-256 identique après téléchargement direct ;
- empreinte identique après lecture par URL signée ;
- deux références de livraison sur deux reliées à leur métadonnée Storage ;
- bucket confirmé privé ;
- 25 utilisateurs confirmés par l'API Auth d'administration.

Le dernier passage Storage a pris 3,298 s. La preuve structurée ne contient ni clé, ni mot de passe, ni e-mail, ni chemin d'objet en clair.

## Configuration hors sauvegarde

L'exercice confirme aussi ce que l'export ne restaure pas. Les clés du nouveau projet restent propres à la cible ; l'URL Auth est restée sur `localhost` et aucune URL de redirection n'a été ajoutée ; les secrets Vercel, fournisseurs d'e-mails, domaines, crons et intégrations doivent être remis depuis leur inventaire lors d'un vrai sinistre. Cette remise en place figure dans la procédure et doit précéder tout basculement.

## Conclusion et limite

Le critère de sortie d'OPS-03A est atteint : restauration complète de l'export base + Auth + catalogue Storage + fichiers sur une cible isolée, commandes et preuves contrôlées, temps mesurés et procédure écrite.

Le plan Free ne fournit pas de point automatique chaque heure et les sauvegardes de base Supabase n'incluent pas les fichiers Storage. L'objectif interne RPO ≤ 1 h n'est donc pas garanti en production par cette seule procédure. Avant une mise en vente, RELEASE-1 devra valider soit une automatisation chiffrée hors site testée, soit une offre fournisseur payante approuvée, en conservant une copie distincte des preuves Storage.
