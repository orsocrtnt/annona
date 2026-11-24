# Vocabulaire d'Annona (UNIV-1)

Décision d'Orso du 24 novembre 2026 : Annona s'adresse à tout fournisseur qui livre des professionnels chaque jour (boulangerie, glacier, boucherie, boissons…). Les fonctionnalités sont les mêmes ; seuls les mots changent. **Un seul vocabulaire neutre partout**, sans réglage par métier.

## Rôles et lieux (texte affiché)

| Ancien mot (boulangerie) | Mot à employer |
|---|---|
| Gérant de la boulangerie, boulangerie (l'entreprise) | Gérant ; votre entreprise |
| Boulanger (rôle `BAKER`), espace boulanger | Production ; espace production |
| Pâtissier (rôle `PASTRY_CHEF`), espace pâtissier | Atelier ; espace atelier |
| Vente en boutique, vendeuse (rôle `SELLER`) | Point de vente ; vendeur ou vendeuse → « l'équipe du point de vente » |
| Boutique (magasin de l'entreprise) | Point de vente |
| Commerçant (client professionnel) | Client |
| Livreur | Livreur (inchangé) |
| Labo, laboratoire, fournil | Production |
| Pâtisseries (produits de l'atelier) | Produits de l'atelier ; « Mes pâtisseries » → « Mes produits » |
| Gâteaux sur commande, commandes de gâteaux (des particuliers) | Commandes sur mesure |
| Cagette | Caisse (ou « colis ») |

## Ce qui ne change pas

- Identifiants internes : rôles `BAKER`, `PASTRY_CHEF`, `SELLER`, familles `BREAD`, `PASTRY`, dossiers `/bakery`, `/pastry`, `/shop`, services `domains/shop`. Les renommer demanderait une migration Prisma : hors de UNIV-1.
- Les produits du catalogue de démo (baguettes, croissants…) : la démo garde une entreprise exemple. Ses textes d'accompagnement deviennent neutres.
- Les exemples dans les champs (« ex. : baguette ») deviennent multi-métiers : « ex. : pain de campagne, sorbet citron, caisse de 12 ».

## Règles d'écriture

- Le français reste celui de `docs/CONVENTIONS.md`.
- Ne pas écrire « boulangerie » dans un texte affiché, sauf comme exemple parmi d'autres métiers.
- Icônes : préférer des icônes neutres (paquet, liste, magasin) à croissant, gâteau ou toque.
