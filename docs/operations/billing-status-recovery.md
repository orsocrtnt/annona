# BILL-02 — diagnostic et reprise des anciens états comptables

Le schéma actuel sépare déjà `Invoice.status` des états de commande et de livraison. BILL-02 cesse d’écrire `INVOICED` et `PAID` dans ces derniers. Les anciennes valeurs d’enum restent lisibles : aucune migration ni conversion implicite.

## Diagnostic en lecture seule

Sur un environnement explicitement choisi :

```sh
node --env-file=.env.local --import tsx scripts/diagnose-billing-statuses.ts > diagnostic-bill02.json
```

La sortie contient les identifiants, versions, états et événements nécessaires à la revue, sans secrets de connexion ni adresses client. Conserver ce fichier dans les preuves internes. Le script ne propose aucune option d’application ; il ne modifie aucune ligne.

Diagnostic de la base de test le 11 octobre 2026 : deux commandes historiques concernées, une livraison encore `INVOICED`. Cette livraison possède une preuve `SUCCESS`, une date `completedAt` et un événement `Livré` antérieurs à la facture. L’autre commande `PAID` possède déjà une livraison `DELIVERED`. Aucune de ces lignes n’a été corrigée dans BILL-02.

## Préparer une reprise, sans inventer l’état ni la date

- Revoir chaque proposition avec le dossier complet, son chauffeur, son historique et sa preuve. Le dernier libellé logistique reconnu est un indice, pas une garantie ; les événements libres, réaffectations, dates identiques et contradictions réclament une revue humaine.
- Une facture ne prouve pas la livraison. Ne jamais remplacer tous les `INVOICED`/`PAID` par `DELIVERED`. Un dossier encore actif doit rester actif ; un échec doit rester un échec.
- `completedAt` reste exactement la date métier existante. Ne jamais employer `Invoice.createdAt`, `paidAt`, `Order.updatedAt` ou la date de réparation comme date de livraison. Sans date fiable, laisser le cas à résoudre au lieu d’en fabriquer une.
- Une commande historique ne prend un état que si les livraisons et le dossier le justifient. Plusieurs livraisons dans des états différents, aucune livraison ou un historique insuffisant restent bloquants pour une reprise automatique.
- Ne pas réécrire les factures, preuves ou événements anciens. Conserver les enums pour les cas non résolus.

## Application future : seulement après autorisation explicite

1. Sauvegarder les lignes et produire un plan identifié avec `companyId`, ID, état et `updatedAt` attendus, état cible, date métier inchangée et justification. Faire vérifier ce plan.
2. Tester sa reprise et son retour arrière sur copie isolée, puis comparer états, dates, preuves et compteurs. DB-1 globale demeure ouverte.
3. Appliquer uniquement les IDs autorisés, dans une transaction avec comparaison de l’état et de la version attendus. Un conflit annule la transaction ; aucun élargissement de filtre ni écrasement forcé.
4. Préserver l’ancien `updatedAt` si la reprise n’est qu’une réparation comptable, et consigner séparément la date de réparation. Si une véritable correction métier est décidée, la tracer explicitement. Ne jamais relancer de notifications ou de dispatch dans cette opération.
5. Relire les mêmes lignes et les compteurs des trois rôles ; conserver preuve et possibilité de retour arrière.

BILL-02 teste cette procédure sur une fixture nouvelle, identifiable puis supprimée. Les tests unitaires couvrent une livraison prouvée, un échec, un état actif, l’absence de preuve/date et les contradictions. Cela prépare la reprise ; cela ne vaut ni application aux données existantes ni validation de restauration globale.

## Limite visible avant reprise

Un état historique `INVOICED`/`PAID` reste affichable, mais n’est plus compté arbitrairement comme livré par les agrégats administrateur. Les anciens dossiers non réparés peuvent donc être absents des compteurs logistiques ou de l’historique chauffeur. Les nouvelles émissions et les nouveaux règlements conservent les états logistiques, leurs dates et leurs compteurs. Les calculs comptables, la conformité et la numérotation des factures restent BILL-01.
