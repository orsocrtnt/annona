# Données de test en conditions réelles sur `annona-dev` (20 novembre 2026)

Demande de Théo (nuit du 19 au 20 novembre) : remplir la base pour tester en conditions réelles les 7 derniers jours et
les 7 prochains, avec 4 ou 5 livreurs d'environ 40 arrêts chacun et 2 ou 3 boutiques qui vendent chaque jour une
dizaine de pains spéciaux et une quinzaine de pâtisseries. Base `annona-dev` seulement (entreprise de démo), jamais
la production. Mot de passe des comptes : celui des autres comptes de démo (`outputs/comptes-demo.md`, hors git).

## Ce qui a été créé

- **Tournées** : Est, Ouest et Centre ajoutées à Nord et Sud (matin 5 h 30 – 11 h, soir 16 h – 19 h).
- **Clients** : 200 clients fictifs de plus (identifiants `sim_client_…`, noms terminés par « (démo) », sans e-mail),
  soit 220 clients, environ 44 par tournée. Cafés, brasseries, restaurants, hôtels, épiceries, cantines et salons de
  thé, chacun avec ses habitudes (produits, quantités, jours de fermeture : cantines fermées le week-end, certains
  restaurants le dimanche ou le lundi). Facturation : 144 au mois, 68 à la semaine, 8 au jour. 22 clients en
  commande type (générée par le verrouillage, comme en vrai).
- **Boutiques** : « Centre-ville » (Nord) existait ; « Bastille » (Est) et « Passy » (Ouest) créées, avec le même code
  responsable et les prix boutique de Centre-ville à quelques pour cent près. Comptes `demo-vendeuse-2@annona.fr`
  (Bastille) et `demo-vendeuse-3@annona.fr` (Passy).
- **Assortiment des boutiques** : chaque jour 10 pains spéciaux (environ 10 vendus de chacun) et 15 pâtisseries
  (11 individuelles, environ 15 vendues de chacune, et 4 gâteaux entiers), plus les gâteaux commandés par des
  particuliers.
- **Livreurs** : une tournée par livreur de démo, toujours la même : Nord → livreur 1, Sud → 2, Est → 3, Ouest → 4,
  Centre → 5.

## Ce que contient chaque jour

| Jours | État | Détail |
|---|---|---|
| 13 → 19 nov. | Terminés | Commandes passées la veille, envois du pâtissier et du boulanger, verrouillage à 17 h 05 (vrai service : tournées calculées, prix figés), préparation au fournil (quelques manquants), tournées parties vers 5 h et livrées autour de l'heure estimée, quelques incidents (client absent, refus, colis abîmé, rue barrée). Boutiques : réception à 7 h 30 (rares écarts et produits abîmés, donc quelques alertes dans les cloches), clôture du soir (ventes, invendus jetés en fin de vente), gâteaux retirés et soldés. |
| 20 nov. (aujourd'hui) | Prêt à partir | 216 commandes verrouillées, 5 tournées de 41 à 44 arrêts **attribuées** (le livreur peut démarrer), envois des boutiques en route (réception à faire), 5 gâteaux à retirer. Rien n'est préparé : le boulanger et le pâtissier peuvent cocher. |
| 21 → 27 nov. | À venir | 144 à 193 commandes **validées** par jour (encore modifiables), 2 à 7 gâteaux commandés par jour. Le cron de 17 h 05 verrouille chaque lendemain et calcule ses tournées ; l'admin attribue les livreurs. Les envois aux boutiques ne sont pas saisis : c'est au pâtissier et au boulanger de le faire. |

Totaux sur les 15 jours : 2 915 commandes (14 917 lignes), dont 168 générées par les commandes types et 43 envois
aux boutiques ; 59 gros gâteaux commandés par des restaurants (prix de la taille, parfois une inscription) ; 21
incidents de livraison ; 131 lignes livrées avec un manquant ; boutiques : 6 517 produits reçus, 5 806 vendus,
652 jetés en fin de vente ; 65 gâteaux de particuliers (33 soldés, 32 à retirer).

Tournées passées : 41 à 45 arrêts en semaine, environ 30 le dimanche.

## Comment c'est fait

Script hors dépôt (`outputs/scripts/simulation.mts` sur le PC de Théo), rejouable sans doublon. Le passé est rejoué
avec **les vrais services** de l'application, à l'heure simulée : `saveShipment` (pâtissier et boulanger),
`createCakeOrder` et `settleCakeOrder`, `lockDeliveryDate` (tournées et prix figés), `receiveShipment` et `closeDay`
(lots de stock, alertes d'écart). Seules la préparation et la livraison sont écrites directement, avec les mêmes
champs que les écrans du boulanger et du livreur.

Pour tout retirer : supprimer les commandes des clients `sim_client_…` et des boutiques `sim_shop_…`, puis ces
commerçants (leurs prix, stocks et clôtures partent avec), les deux comptes vendeuses et les tournées Est, Ouest et
Centre.

## Constats

- **Corrigé : erreur React n° 418 sur « Envois aux boutiques » (pâtissier et boulanger) et l'accueil du
  super-administrateur.** Ces pages sont précalculées au build (layout client). La date du jour y était calculée au
  rendu, donc figée à la date du déploiement : dès le lendemain, le navigateur affichait un autre texte et React
  recalculait toute la page. Elle n'apparaissait pas à la recette du 19 parce que le déploiement datait du jour même.
  Correction : `useMounted` (`src/hooks/use-mounted.ts`), les textes datés attendent que la page soit montée. Preuve :
  navigateur réglé au surlendemain, le site en ligne lève l'erreur sur les 3 écrans, le build corrigé aucune.
- **Pour Orso, alerte trompeuse** : l'écran des tournées du lendemain affiche « 3 commandes verrouillées sans tournée »
  avant l'heure limite. Ce sont les envois créés par des commandes de gâteaux, qui naissent verrouillés et n'entrent
  dans une tournée qu'au verrouillage de 17 h 05. Il faudrait ne pas les compter avant l'heure limite.
- **Pour Orso, clôture du soir en une seule transaction** : `closeDay` écrit chaque produit l'un après l'autre (plus
  de 50 requêtes pour 25 produits) dans une transaction limitée à 5 s. Depuis un PC loin de la base, elle a expiré ;
  sur Vercel, à côté de la base, elle passe. Avec un plus grand assortiment ou une base lente, regrouper les écritures
  (`createMany`) éviterait le risque.
- La clôture du 19 novembre à Centre-ville reprend l'envoi de la recette du lot 2 (4 produits), d'où des ventes plus
  faibles ce jour-là.
- Facturation : le cron de 7 h 10 facture les périodes closes (clients à la semaine : semaine du 9 au 15 novembre) ;
  la semaine du 16 au 22 le sera le 23.

Écrans repassés dans un navigateur avec ces volumes (admin, pâtissier, boulanger, vendeuses, livreur, client,
super-admin) : tous répondent en 1 à 2 s, sans débordement.
