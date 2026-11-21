# Recette du lot 2 — pâtisserie, boutiques et stock (19 novembre 2026)

Site en ligne https://annona-gray.vercel.app, version `79e2f41` (lot 2 fusionné, PR #47 à #53), base `annona-dev`, boulangerie de démo. Recette menée par la session Claude de Théo, à sa demande, avec les comptes de démo (mot de passe commun, voir `outputs/comptes-demo.md`).

## Données créées pour la recette

- **Boutique** « Centre-ville (démo) », tournée Nord, livrée le matin ; code responsable dans `outputs/comptes-demo.md`.
- **Comptes** `demo-patissier@annona.fr` (pâtissier) et `demo-vendeuse@annona.fr` (vendeuse de la boutique).
- **Catalogue pâtissier**, saisi avec le compte pâtissier :
  - les 28 pâtisseries existantes sont classées « petite pièce », avec une durée de vente réaliste (1 jour pour un millefeuille ou une tartelette aux fraises, 7 jours pour des madeleines) ;
  - 6 petites pièces créées : muffin chocolat, tartelette framboise, tartelette chocolat, brownie noix de pécan, cannelé bordelais, chou praliné ;
  - 7 gros gâteaux créés, vendus par taille : fraisier, framboisier et castel (6, 8, 10 personnes), entremets trois chocolats (6, 8, 10), tarte citron meringuée et tarte aux fraises (4, 6, 8), tarte framboise (6, 8) ;
  - au total, 41 pâtisseries, avec allergènes et recettes.
- **Prix**, saisis avec le compte admin :
  - **prix restaurant** de toutes les nouveautés, gros gâteaux taille par taille (par exemple castel 10 personnes : 34 € HT) ;
  - **prix boutique** des 126 articles de « Centre-ville » (pain et pâtisserie, chaque taille), dont le fraisier 10 personnes à 40 € TTC comme dans le document.
- **Scénario** : un envoi du jour vers la boutique, sa réception, sa clôture du soir, une commande de gâteau d'un particulier (soldée), et une commande de restaurant pour le 21 novembre (20 éclairs et un castel 10 personnes « Bon anniversaire Julie », corrigée ensuite par l'admin).

## Résultat : 63 vérifications sur 63 par l'API, 50 écrans sur 50 dans le navigateur

| Demande | Vérifications du document | Résultat |
|---|---|---|
| D1 Boutiques et vendeuse | Boutique et compte vendeuse créés ; la vendeuse ne voit que sa boutique ; la boutique est un arrêt de la tournée du jour d'envoi | OK |
| D2 Pâtissier | Le pâtissier voit la production et le stock de la pâtisserie, aucun pain ; le boulanger aucune pâtisserie | OK |
| D3 Produits | Le pâtissier crée le fraisier (6, 8, 10 personnes, recette, durée de vente) sans prix ; l'admin le voit et le modifie ; la recette n'est jamais servie à la vendeuse (403 sur le catalogue admin) | OK |
| D4 Prix | « Produits sans prix » chez l'admin, puis plus aucun ; « Produits et prix » fermé sans le code (403) et ouvert avec ; 40 € par la responsable ; 42 € par l'admin, relu par la tablette ; prix non modifiable pendant une commande (un prix envoyé est refusé) ; gros gâteau sans prix de base | OK |
| D5 Envois | Le pâtissier envoie 12 éclairs, 8 tartelettes citron et 10 muffins ; le boulanger ajoute 20 baguettes au **même** envoi ; le boulanger ne peut pas envoyer de pâtisserie | OK |
| D6 Réception | 11 éclairs reçus sur 12, dont 1 abîmé : 10 en stock ; alerte dans la cloche du pâtissier et de l'admin ; une seconde réception est refusée | OK |
| D7 Clôture | 3 éclairs restants, donc 7 vendus ; tartelette abîmée comptée dans les jetés ; baguette restante jetée (1 jour de vente) | OK |
| D8 Stock | Écran de l'admin (tout), du pâtissier (pâtisserie seule), du boulanger (pain seul) et de la vendeuse (sa boutique) : reçus, abîmés, vendus, jetés du jour | OK |
| D9 Gâteaux | Fraisier 10 personnes à 40 € : acompte de 15 € refusé, 20 € accepté ; retrait à moins de 48 h refusé ; le fraisier est dans la production du pâtissier le jour du retrait ; « Soldée » | OK |
| D10 Restaurants | Castel par taille au prix restaurant dans le catalogue du restaurant ; commande avec inscription ; dans la production du pâtissier ; ligne « Castel · 10 personnes « Bon anniversaire Julie » » à 34 € ; correction admin de la quantité | OK |
| Droits | Refus : vendeuse sur les boutiques et le catalogue admin ; boulanger sur les pâtisseries ; client et super-admin sur le stock | OK |

**Écrans** : 22 écrans sur ordinateur, 6 sur tablette (vendeuse), 22 sur téléphone, pour les six comptes. Tous répondent 200, sans erreur JavaScript ni appel d'API en échec, et chaque compte arrive sur son espace.

## Constats

- **Corrigé dans la foulée** (PR de cette recette) : sur téléphone, le catalogue de l'admin dépassait de 79 px, parce que les prix des tailles d'un gros gâteau tenaient sur une seule ligne. Désormais, une taille par ligne.
- **Pas fait** :
  - le super-administrateur ne crée pas de boutique et ne voit pas le stock (le tableau des droits du document le prévoit) ;
  - prix restaurant personnalisé par client pour une taille de gâteau ;
  - reste de la liste « après » de la relecture d'Orso (voir LOT2-D10 dans la TODO).
- **Données de recette laissées sur `annona-dev`** : l'envoi et la clôture du 19 novembre à « Centre-ville (démo) », une commande de gâteau soldée (« Mme Martin (test) », retrait le 22 novembre), une commande du restaurant client 1 pour le 21 novembre, et deux alertes dans les cloches.
- **Non essayé** : vrais téléphones et tablettes ; application Android avec ces écrans.
