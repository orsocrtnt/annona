# BILL-02 — diagnostic et préparation de reprise historique

Aucune reprise de données préexistantes n'a été exécutée. Les valeurs INVOICED/PAID restent dans les enums pour lire les anciens objets ; les nouveaux flux écrivent exclusivement les statuts de facture sur Invoice.

## Diagnostic en lecture seule

Depuis le dépôt, sur une cible explicitement identifiée, exécuter :

```sh
./node_modules/.bin/dotenv -e .env.local -- ./node_modules/.bin/tsx scripts/diagnose-billing-statuses.ts
```

Le script ne réalise aucune écriture. Conserver la sortie dans un emplacement privé : elle contient des identifiants métier, pas des secrets d'authentification. Le diagnostic inspecte les commandes INVOICED/PAID et celles portant une livraison dans ces états. Une proposition est toujours soumise à revue ; elle ne déclenche aucune correction.

## Décider une reprise

1. Identifier cible, entreprise, commandes/livraisons exactes et obtenir l'instruction explicite de correction de ces objets. Exporter leurs états, dates, événements, preuve et factures avant action ; vérifier restauration de cette copie.
2. Chercher le dernier événement logistique, exclure les événements de facture/paiement. Confronter preuve de succès/échec et completedAt. Ne jamais dériver la date de livraison de paidAt ou de la date de facture.
3. En cas d'absence de preuve, contradiction ou plusieurs livraisons incohérentes, laisser l'objet intact et demander une décision métier. Pour la commande, évaluer toutes les livraisons ; ne pas appliquer un statut unique déduit de la seule facture.
4. Préparer la liste exacte ancienne valeur → valeur proposée et dates conservées. Tester la transaction sur fixtures/copie isolée. La recette du 11 octobre a restauré uniquement une fixture, pas les objets historiques.
5. Après autorisation, appliquer via Prisma dans une transaction, bornée à l'entreprise et aux identifiants approuvés. Comparer aussi status et updatedAt attendus : si l'objet a changé, annuler toute la transaction. Préserver les factures, preuves, événements historiques et dates métier ; consigner distinctement la correction.
6. Relire les objets et compteurs des trois rôles ; vérifier qu'aucune autre entreprise n'est affectée. Conserver avant/après et procédure de retour compensatoire testée, sans suppression d'historique.

## Constat du 11 octobre

Deux commandes historiques portent INVOICED/PAID ; une seule livraison porte INVOICED et dispose de completedAt, POD SUCCESS et événement Livré. Proposition soumise à revue : rétablir DELIVERED en conservant completedAt. L'autre livraison est déjà DELIVERED ; seule la commande a un ancien état comptable. Aucun objet préexistant modifié. Preuves privées : outputs/bill02/historical-diagnostic.json, recovery-proposals.json et connected-final.json.

Cette procédure prépare la reprise ; elle n'est ni une migration automatique ni une validation de DB-1 globale.
