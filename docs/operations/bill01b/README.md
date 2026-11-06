# BILL-01B — Export comptable des prestations V1

Référence : 18 octobre 2026. Décision propriétaire BILL-01A (ancien document de décisions commerciales, historique git).

## Usage et périmètre

Dans **Commandes → Export comptable des prestations**, choisir les dates UTC inclusives de création du document et son statut, puis télécharger. Route : `GET /api/invoices/export?from=2026-10-01&to=2026-10-31&status=ALL`.

L'export lit les documents `Invoice` de prestations déjà enregistrés, et non toutes les commandes ni les futures souscriptions SaaS. Le CSV d'historique `/api/orders/export` reste un autre fichier : il ne doit pas être traité comme cet export comptable. Les futurs contrats/revenus d'abonnement doivent rester dans un domaine séparé, selon l'architecture des offres.

Le fichier permet de rapprocher documents, clients et commandes et de transmettre les montants enregistrés à un outil comptable. Il ne constitue ni FEC, ni journal comptable automatiquement imputé, ni facture électronique réglementaire, ni avoir. Le comptable configure l'imputation et les comptes tiers ; Annona n'invente ni numéros de comptes, ni identité légale, ni taux de TVA absent, ni conformité. Les documents PDF portent la qualification de relevé opérationnel.

## Contrat CSV version 1

Version `annona-delivery-v1`, délimiteur virgule, tous les champs de données entre guillemets, guillemet doublé, séparateur de lignes CRLF, encodage UTF-8 avec BOM. Les cellules textuelles susceptibles de devenir une formule sont préfixées d'une apostrophe, y compris après espaces/contrôles initiaux. L'apostrophe appartient alors à la valeur exportée ; un importeur programmatique doit appliquer cette convention, sans activer de formules. Les champs numériques sont construits exclusivement depuis des valeurs validées/Decimal, jamais depuis du texte utilisateur.

Ordre exact des 29 colonnes :

1. `schema_version` : contrat de ce fichier.
2. `record_type` : `DOCUMENT` ou `LINE`.
3. `company_id` : entreprise autorisée.
4. `document_id` : identifiant de rapprochement stable.
5. `document_reference` : référence enregistrée ; aucune séquence réglementaire promise.
6. `document_version_sha256` : empreinte des champs exportés du document, des lignes sources et de la référence/e-mail de commande.
7. `created_at_utc` : date de création du document, ISO UTC.
8. `updated_at_utc` : dernière modification enregistrée, ISO UTC.
9. `due_at_utc` : échéance enregistrée, ou vide.
10. `paid_at_utc` : règlement enregistré, ou vide.
11. `period_from_utc` : premier jour choisi.
12. `period_to_utc_inclusive` : dernier jour choisi, inclus.
13. `status_filter` : filtre choisi explicitement.
14. `document_status` : état enregistré, sans inférence logistique.
15. `order_id` : commande source, ou vide si lien historique absent.
16. `customer_id` : client source, ou vide.
17. `order_reference` : référence enregistrée sur la commande liée, ou vide.
18. `order_customer_email` : e-mail enregistré sur cette commande, ou vide ; aucune relecture de l'e-mail actuel du compte.
19. `currency` : `EUR`, devise du modèle actuel ; pas de conversion.
20. `document_total` : total enregistré à deux décimales, seulement sur `DOCUMENT`.
21. `detail_quality` : qualification du détail, seulement sur `DOCUMENT`.
22. `detail_total_difference` : total document moins somme des lignes arrondies, seulement sur `DOCUMENT` ; vide si détail invalide.
23. `line_number` : position 1-based dans le détail enregistré, seulement sur `LINE`.
24. `source_type` : `ZONE`, `FEE`, `PURCHASE`, `CUSTOM` ou `VAT`, seulement sur `LINE`.
25. `source_id` : identifiant tarifaire enregistré s'il existe, seulement sur `LINE`.
26. `label` : libellé enregistré, seulement sur `LINE`.
27. `quantity` : entier positif enregistré, seulement sur `LINE`.
28. `unit_amount` : montant unitaire décimal enregistré, seulement sur `LINE` ; les anciens sous-centimes éventuels restent visibles.
29. `line_total` : produit unitaire × quantité arrondi au centime, demi supérieur, seulement sur `LINE`.

**Ne sommer que `document_total` des lignes `DOCUMENT` pour le total des documents.** `LINE` est un détail, pas une deuxième écriture. `VAT` désigne uniquement une ligne déjà enregistrée ; aucun taux fiscal, HT/TVA/TTC séparé ou base fiscale ne doit être déduit d'un document historique incomplet. Un import peut prendre le total `DOCUMENT`, puis rapprocher son détail avec `document_id` + `line_number`.

`SAVED_LINES` signifie détail valide concordant ; `TOTAL_ONLY` signifie ancien détail vide ; `INVALID_LINES` signale un détail non interprétable, dont aucune ligne n'est fabriquée ; `TOTAL_MISMATCH` signale un écart avec le total enregistré. Ces trois derniers états nécessitent revue avant imputation. L'export préserve le montant historique et ne répare aucune donnée implicitement.

## Période, statuts, historique et déduplication

Les deux dates sont obligatoires, sans heure ni décalage. Le filtre inclut `from 00:00:00 UTC` et exclut le lendemain de `to 00:00:00 UTC`. Il n'utilise pas la date de livraison, d'échéance ou de paiement. Les jours de changement d'heure France ne modifient pas ces bornes UTC. L'opérateur adapte sa période s'il vise des journées civiles françaises.

Le statut est obligatoire : `ALL`, `DRAFT`, `PENDING`, `PAID`, `OVERDUE`, `CANCELLED`. `ALL` inclut les brouillons et annulations ; le statut n'est jamais transformé en écriture comptable. Une annulation conserve son montant positif d'origine pour traçabilité : **elle ne vaut pas avoir négatif**. Le modèle n'a pas d'avoir ni de lien de correction. Une commande annulée ne modifie pas automatiquement son document ; toute correction comptable se fait dans l'outil externe.

Les tarifs actuels, le nom actuel de l'entreprise et les coordonnées actuelles du compte client ne recalculent jamais les anciens montants/libellés. Les données sources restent toutefois celles du modèle actuel : un document `PENDING` peut être révisé par le service existant, son statut et sa date de paiement évoluent, et le modèle ne contient pas de véritable instantané immuable de l'identité/adresse/mentions de l'émetteur et du client. Ces éléments absents ne sont pas inventés. La référence/e-mail de commande, lorsqu'ils existent, sont inclus dans l'empreinte afin qu'une modification soit détectable. Le PDF utilise encore des coordonnées et un pied de page courants ; aucune immutabilité complète de facture finale n'est revendiquée.

La clé de déduplication côté importeur est `company_id + document_id + document_version_sha256`, et non la date du téléchargement. Un nouvel export sans mutation est strictement identique ; il ne produit aucune écriture en base, aucun e-mail ni job. Une version différente du même document demande rapprochement/remplacement explicite, jamais addition automatique. Conserver les CSV remis hors de Annona selon la politique validée par l'entreprise ; le serveur ne stocke pas d'archive d'export.

## Droits, cohérence et volumes

Personnel authentifié avec `invoices:read`, entreprise relue par la garde serveur ; un rôle commandes seul, un client et un chauffeur ne peuvent pas obtenir l'export comptable. Le client continue de consulter ses propres documents par ses routes existantes. Aucun paramètre entreprise/client arbitraire n'est accepté. Une référence de commande ou de client vers une autre entreprise fait échouer l'export sans divulgation.

Chaque téléchargement s'exécute dans une transaction PostgreSQL `RepeatableRead` : les lectures par lots de 250 voient le même instantané. Tri stable `id ASC`, navigation par clé `id > dernierId`, aucune pagination d'écran appliquée. Le CSV complet est construit avant réponse, avec limites 10 000 documents, 50 000 enregistrements et 20 Mio de contenu UTF-8, délai transactionnel 60 s. Dépassement : 422 et demande de réduire la période, sans fichier partiel. Ce ne sont pas des garanties de capacité sous charge ; les lots, les lignes d'un document et le CSV restent en mémoire. Les périodes volumineuses doivent être fractionnées. Réponses privées `no-store`, noms de fichier datés sans données utilisateur, erreur technique générique sans contenu métier.

## Vérifier

Sans service externe : `npm run check`. Tests dédiés : `node --import tsx --test tests/accounting-export.test.ts tests/billing-separation.test.ts`.

Sur la cible de test explicitement autorisée uniquement : `./node_modules/.bin/dotenv -e .env.local -- node --import tsx scripts/bill01b/connected.ts`. Le harnais crée deux entreprises fictives `bill01b-UUID`, deux commandes et des documents de test ; aucun utilisateur Auth, fichier ou envoi. Nettoyage exact des IDs de son exécution dans `finally`, puis compteurs zéro et empreinte des préexistants. Preuve nettoyée : `outputs/bill01b/connected.json`. Ne pas utiliser une base contenant des données réelles.

Le contrôle HTTP de garde est un test local exécutant la vraie route avec authentification substituée ; la recette connectée qualifie le domaine et PostgreSQL, sans prétendre à un nouveau parcours navigateur authentifié. Prévisualisation synthétique du document long : `node --import tsx scripts/bill01b/pdf-preview.ts`.

## Intégration future

Un adaptateur comptable/plateforme agréée pourra consommer le contrat versionné et la clé de rapprochement sans mélanger abonnements et prestations. Pour une émission finale, décider et versionner séparément séquence par entreprise, identité et coordonnées figées, corrections/avoirs, mentions validées par spécialiste et protocole de remise. Ces exigences ne sont pas déclarées satisfaites par le CSV V1. Aucune migration n'est nécessaire pour cette tranche export.
