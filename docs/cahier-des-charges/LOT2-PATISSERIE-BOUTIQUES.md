# Lot n°2 — Pâtisserie, boutiques et stock

Demandes de modification de Théo Nerisson du 18 novembre 2026 (PDF « Annona - Demandes de modification - lot 2 »), recopiées ici avec les choix faits pour les coder. À lire avec le cahier des charges et le lot n°1.

Règles du document : traiter les demandes dans l'ordre ; ne rien changer d'autre ; en cas de doute, poser la question ; une demande est terminée quand toutes ses vérifications sont réussies.

## Le fonctionnement en résumé

- Le laboratoire compte des **boulangers** et des **pâtissiers**.
- Les **boutiques** sont les magasins de l'entreprise. Chaque matin, le laboratoire leur envoie des pâtisseries et un peu de pain, sans qu'elles passent commande.
- Les **restaurants et établissements** commandent du pain, comme aujourd'hui, et désormais aussi des pâtisseries.
- Les **vendeuses** de chaque boutique utilisent une tablette pour noter ce qu'elles reçoivent le matin, ce qui reste et ce qui est jeté le soir, et pour prendre les commandes de gâteaux des particuliers.
- Le pâtissier, l'administrateur et le super-administrateur voient le stock de chaque boutique.

## Ordre de réalisation

1. Demandes 1 à 4 : les nouveaux comptes et les produits (tout le reste en dépend).
2. Demande 5 : les envois vers les boutiques.
3. Demandes 6, 7 et 8 : la tablette de la boutique et le stock.
4. Demandes 9 et 10 : les commandes de gâteaux.

## Décisions de Théo (18 novembre 2026)

| Question | Réponse |
|---|---|
| Base et zone d'Orso | Le code part en PR (branches `theo/lot2-…`). La migration est écrite, mais **pas appliquée sur `annona-dev`** : Orso relit la PR, puis applique la migration après la sienne (DEMO-1). Vérifications par les tests et par la CI (base PostgreSQL neuve), puis recette sur le site une fois la base migrée. |
| Pain ou pâtisserie | Décidé **par la catégorie** : chaque catégorie est « Pain » ou « Pâtisserie », réglée par l'admin. Les catégories existantes sont rangées côté pain, sauf celles dont le nom évoque la pâtisserie ou les gâteaux. |
| Alertes (demande 6) | Dans la **cloche de l'application**, comme les autres alertes. |
| Créneau des boutiques | Toujours livrées **le matin**. |

## Organisation technique retenue

Le principe : réutiliser ce qui existe déjà (clients, tournées, arrêts, production, cloche) plutôt que de construire en parallèle.

- **Boutique = client de type « boutique »** (`Merchant.kind = SHOP`). Elle reprend tout ce qu'un client a déjà : adresse, consignes d'accès, tournée, place sur la carte. Elle est exclue de la liste des clients, du catalogue, des commandes récurrentes et de la facturation.
- **Envoi du jour = commande d'origine « envoi »** (`OrderOrigin.SHIPMENT`), sur le créneau du matin de la tournée de la boutique. Elle devient donc un arrêt de la tournée, avec sa liste de produits, sans nouveau code pour le livreur. Le pâtissier et le boulanger remplissent le même envoi, chacun avec ses produits. On peut le modifier tant que la tournée n'est pas partie, sans heure limite.
- **Nouveaux comptes** : `PASTRY_CHEF` (pâtissier, espace `/pastry`) et `SELLER` (vendeuse, espace `/shop`, rattachée à sa boutique par `User.merchantId`). Rôles et permissions sont ajoutés par la migration, comme au lot 1.
- **Pain ou pâtisserie** : `Category.family` (`BREAD` ou `PASTRY`). Le boulanger ne voit que `BREAD`, le pâtissier que `PASTRY`.
- **Produits** :
  - pour une pâtisserie, `Product.pastryFormat` vaut `SMALL` (petite pièce) ou `LARGE` (gros gâteau) ;
  - `recipe` (jamais envoyée aux vendeuses, aux livreurs ni aux clients) ;
  - `shelfLifeDays`, la durée de vente (jour de réception compris, 1 par défaut) ;
  - les tailles d'un gros gâteau dans `ProductSize` (nombre de parts, prix restaurant de la taille).
- **Prix restaurant** : `basePriceCents` devient facultatif (vide = « Produit sans prix »). Un produit sans prix restaurant n'apparaît pas dans le catalogue des restaurants. Les prix par client existants restent tels quels.
- **Prix boutique** : `ShopPrice` (boutique, produit, taille). Le code responsable est rangé haché, et l'admin peut le réinitialiser.
- **Réception** (demande 6) : quantités reçues et abîmées sur chaque ligne de l'envoi.
- **Stock** (demandes 7 et 8) :
  - des **lots** datés par boutique et par produit, vendus du plus ancien au plus récent ;
  - une **clôture du soir** qui garde, pour chaque produit, le stock du matin, la quantité reçue en bon état, la quantité vendue, la quantité restante et la quantité jetée (abîmée ou en fin de vente).
- **Commandes de gâteaux des particuliers** (demande 9) :
  - un modèle à part, `CakeOrder` : client, inscription, taille, prix, paiement et retrait ;
  - un acompte d'au moins 50 % ;
  - un délai de 48 h, réglable par l'admin ;
  - le jour du retrait, la commande est ajoutée à l'envoi du matin de sa boutique.
- **Gros gâteaux des restaurants** (demande 10) : la ligne de commande porte la taille et l'inscription. Deux fraisiers de tailles ou d'inscriptions différentes font deux lignes.

## Les demandes et leurs vérifications

### Demande 1 · Boutiques et comptes vendeuse
L'administrateur crée les boutiques (nom, adresse, consignes d'accès), un compte vendeuse par boutique (sur la tablette du magasin), et rattache chaque boutique à une tournée. La boutique devient un arrêt de la tournée du livreur les jours où elle reçoit un envoi. Une boutique n'est pas un client : pas de commande dans le catalogue, pas de facture. Une vendeuse ne voit que sa boutique.

Vérifications :
1. L'administrateur crée la boutique « Centre-ville » et son compte vendeuse.
2. Connectée sur la tablette, la vendeuse ne voit que la boutique « Centre-ville ».
3. Un jour où la boutique reçoit un envoi, elle apparaît dans la tournée du livreur.

### Demande 2 · Compte pâtissier
Un type de compte « pâtissier », créé par l'administrateur, et un laboratoire peut en avoir plusieurs. Le pâtissier voit le total à produire du lendemain, en trois parties : les commandes des restaurants (demande 10), les commandes de gâteaux des particuliers (demande 9) et les envois prévus vers les boutiques (demande 5). Il crée les pâtisseries (demande 3), saisit les envois (demande 5) et voit le stock des boutiques (demande 8). Il ne voit que les pâtisseries ; le boulanger ne voit que le pain.

Vérifications :
1. L'administrateur crée un compte pâtissier.
2. Le pâtissier voit le total à produire pour les pâtisseries, et aucun produit de pain.
3. Le boulanger ne voit aucune pâtisserie.

### Demande 3 · Produits : création, recettes, durée de vente
Le pâtissier crée et modifie les pâtisseries. L'administrateur et le super-administrateur peuvent créer et modifier tous les produits. Chaque produit comporte :
- nom et photo ;
- catégorie : petite pièce ou gros gâteau ;
- pour un gros gâteau, les tailles en nombre de parts ;
- allergènes (lot 1, demande 3) ;
- recette ;
- durée de vente : le nombre de jours de vente en boutique, jour de réception compris.

Le pain a aussi une durée de vente, réglée par le boulanger ou l'administrateur.

Règles : la recette n'est visible que par les pâtissiers, l'administrateur et le super-administrateur, jamais par les vendeuses, les livreurs ou les clients. Le pâtissier ne saisit pas de prix.

Vérifications :
1. Le pâtissier crée « Fraisier » en gros gâteau, tailles 6, 8 et 10 personnes, avec sa recette et une durée de vente de 2 jours.
2. L'administrateur voit ce produit et peut le modifier.
3. Connectée en vendeuse, il est impossible de voir la recette du fraisier.

### Demande 4 · Prix restaurant et prix boutique
Deux sortes de prix, avec un prix par taille pour un gros gâteau.

Le **prix restaurant** est saisi par l'admin ou le super-admin, et reste personnalisable par client. L'admin voit la liste des nouveaux produits sans prix restaurant.

Le **prix boutique** se règle dans la tablette de chaque boutique :
- dans Paramètres › « Produits et prix », derrière un **code responsable** ;
- à la mise en place de la tablette, la responsable choisit les produits vendus et saisit leurs prix ;
- un nouveau produit y apparaît comme « Nouveau produit, prix à saisir ».

Règles :
- l'admin crée le code avec la boutique ; la responsable peut le changer ; l'admin le réinitialise s'il est oublié ;
- chaque boutique a ses prix ;
- la vendeuse ne peut jamais modifier un prix pendant la journée ni pendant une commande ;
- un produit sans prix boutique peut être reçu et suivi en stock, mais pas commandé par un particulier ;
- un produit sans prix restaurant n'est pas au catalogue des restaurants ;
- l'admin et le super-admin consultent et modifient les prix boutique sans code, et le changement s'affiche aussitôt sur la tablette ;
- le pâtissier voit les prix, sans pouvoir les modifier.

Vérifications :
1. Le fraisier du pâtissier apparaît dans « Produits sans prix » de l'admin, et comme nouveau produit dans « Produits et prix » de chaque tablette.
2. Sans le code responsable, « Produits et prix » ne s'ouvre pas.
3. Avec le code, la responsable saisit 40 € pour le fraisier 10 personnes ; ce prix ne vaut que dans sa boutique.
4. Pendant une commande, le prix du fraisier s'affiche mais ne peut pas être changé.
5. Sans prix restaurant, le fraisier est absent du catalogue des restaurants.
6. L'admin passe le fraisier 10 personnes à 42 € pour « Centre-ville » ; la tablette de cette boutique affiche 42 €.

### Demande 5 · Envois quotidiens vers les boutiques
Chaque jour, le pâtissier choisit une boutique, des produits et des quantités ; le boulanger fait de même pour le pain. Les envois s'ajoutent à l'arrêt de la boutique dans la tournée, avec la liste des produits.

Règles : les envois sont décidés par le laboratoire ; ils sont modifiables jusqu'au départ de la tournée ; la quantité envoyée sert de référence à la réception.

Vérifications :
1. Le pâtissier envoie 12 éclairs et 8 tartes au citron à « Centre-ville ».
2. Le livreur voit ces produits sur l'arrêt « Centre-ville ».
3. Le boulanger ajoute 20 baguettes pour la même boutique ; elles apparaissent sur le même arrêt.

### Demande 6 · Réception le matin en boutique
À l'arrivée de la livraison, la tablette liste les produits envoyés avec leurs quantités prévues. Pour chaque produit, la vendeuse note la quantité reçue et la quantité abîmée pendant la livraison. Les produits reçus en bon état entrent en stock.

Règles : si la quantité reçue diffère de l'envoi, le pâtissier (ou le boulanger) et l'administrateur reçoivent une alerte. Les produits abîmés sont comptés à part et n'entrent pas en stock.

Vérifications :
1. La boutique reçoit 11 éclairs au lieu des 12 envoyés, dont 1 abîmé : 10 éclairs entrent en stock.
2. Le pâtissier et l'administrateur reçoivent une alerte pour l'éclair manquant.

### Demande 7 · Clôture du soir, produits à jeter et ventes calculées
Le soir, la vendeuse note la quantité restante de chaque produit. La tablette indique ensuite les produits à jeter :
- ceux qui atteignent leur dernier jour de vente ;
- les produits abîmés en boutique pendant la journée, ajoutés par la vendeuse.

La vendeuse confirme les quantités jetées, et le reste reste en stock. Les ventes sont calculées ainsi : stock du matin + reçu en bon état − reste du soir.

Règles : les plus anciens sont vendus en premier. Exemple : un éclair qui se vend 2 jours, reçu le lundi, se vend le lundi et le mardi ; mardi soir, s'il reste, la tablette demande de le jeter.

Vérifications :
1. Lundi : 10 éclairs en stock le matin, 3 restants le soir, donc 7 vendus.
2. Mardi matin : 10 éclairs reçus, soit 13 en stock.
3. Mardi soir : 11 restants, donc 2 vendus. Les éclairs du lundi partent en premier : il en reste 1, à son dernier jour, et la tablette demande de le jeter. Les 10 du mardi restent en stock.
4. La vendeuse ajoute 1 tarte abîmée en vitrine, comptée dans les produits jetés.

### Demande 8 · Stock des boutiques
Un écran « Stock boutiques » pour le pâtissier, le boulanger (pain seulement), l'admin et le super-admin. Il donne, pour chaque boutique et chaque produit :
- la quantité en stock ;
- la quantité à jeter ce soir ;
- pour la veille : les quantités reçues, abîmées à la livraison, vendues et jetées.

On choisit une boutique ou on les voit toutes ensemble, et on peut consulter les jours passés.

Vérifications :
1. Le pâtissier voit le stock d'éclairs de chaque boutique.
2. Il retrouve, pour la veille, les éclairs reçus, abîmés, vendus et jetés de « Centre-ville ».

### Demande 9 · Commandes de gâteaux des particuliers en boutique
La vente en ligne aux particuliers reste exclue. Sur la tablette, la vendeuse enregistre :
- le gâteau et sa taille ;
- l'inscription ;
- le nombre de parts ;
- le prix ;
- le paiement (réglé en totalité, ou acompte avec son montant) ;
- le nom et le téléphone du client ;
- la date et l'heure de retrait.

Règles :
- pas de commande sans paiement : réglée en totalité, ou acompte d'au moins 50 %, sinon refus ;
- le prix est le prix boutique de la taille, non modifiable ;
- la commande apparaît dans la production du pâtissier le jour prévu, et le gâteau part avec la livraison du matin vers la boutique ;
- la commande est passée au moins 48 h avant le retrait (délai réglable par l'admin) ;
- au retrait, la vendeuse marque la commande « soldée ».

Vérifications :
1. Fraisier 10 personnes à 40 €, acompte de 15 € : refusé.
2. Avec un acompte de 20 €, la commande est enregistrée.
3. Le pâtissier voit le fraisier et son inscription dans la production du jour prévu.
4. Le gâteau apparaît dans l'envoi du matin vers la boutique.
5. Au retrait, la vendeuse marque la commande « soldée ».

### Demande 10 · Pâtisseries pour les restaurants
Le catalogue des restaurants propose, en plus du pain :
- les petites pièces ;
- les gros gâteaux, au choix de la taille ;
- pour un gros gâteau, une inscription et la date de livraison.

Règles :
- prix restaurant de la taille ;
- pas d'acompte : la pâtisserie est facturée avec le reste ;
- heure limite et créneaux comme pour le pain ;
- ces commandes entrent dans le total à produire du pâtissier.

Vérifications :
1. Un restaurant commande 20 éclairs et un castel 10 personnes avec l'inscription « Bon anniversaire Julie ».
2. Le pâtissier voit ces produits et l'inscription dans sa production.
3. Le castel figure sur la facture du restaurant, au prix restaurant.

## Droits d'accès

| Fonction | Super admin | Admin | Pâtissier | Boulanger | Vendeuse |
|---|---|---|---|---|---|
| Créer des boutiques et comptes vendeuse | Oui | Oui | Non | Non | Non |
| Créer et modifier les pâtisseries | Oui | Oui | Oui | Non | Non |
| Voir les recettes | Oui | Oui | Oui | Non | Non |
| Fixer les prix restaurant | Oui | Oui | Non | Non | Non |
| Fixer les prix boutique | Oui | Oui | Non | Non | Responsable, avec le code |
| Envoyer des produits aux boutiques | Non | Non | Oui (pâtisserie) | Oui (pain) | Non |
| Réception, clôture du soir | Non | Non | Non | Non | Oui (sa boutique) |
| Prendre une commande de particulier | Non | Non | Non | Non | Oui |
| Voir le stock des boutiques | Oui | Oui | Oui | Oui (pain) | Sa boutique |

Ces fonctions s'ajoutent à la liste de celles que l'admin peut accorder à un mini admin (lot 1, demande 4).

## Ce qui change dans le cahier des charges

| Sujet | Changement |
|---|---|
| Types de comptes | Ajout des comptes pâtissier et vendeuse. |
| Boutiques | Nouvelle notion : les magasins de l'entreprise, qui reçoivent des envois et suivent leur stock. |
| Produits | Ajout des pâtisseries (petites pièces, gros gâteaux), avec recette, durée de vente et deux prix (restaurant et boutique). |
| Prix | Prix restaurant fixés par l'admin et le super-admin ; prix boutique fixés par la responsable de chaque boutique (tablette, avec un code), et modifiables aussi par l'admin et le super-admin. |
| Vente aux particuliers | Toujours exclue en ligne ; les commandes de gâteaux prises en boutique sont désormais prévues. |
| Tournées | Les boutiques deviennent des arrêts de livraison. |
