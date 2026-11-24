# Annona — produit

Plateforme de commande et de livraison B2B : des clients professionnels commandent chaque jour à un fournisseur, qui produit ou prépare, puis livre via des tournées calculées à l'avance. Annona s'adresse à tout fournisseur qui livre des professionnels chaque jour : boulangerie, glacier, boucherie, boissons… (décision d'Orso du 24 novembre 2026, UNIV-1 ; vocabulaire affiché : `docs/VOCABULAIRE.md`).

- **Objectif** : supprimer les commandes par téléphone ou message, produire exactement les quantités commandées, livrer selon des tournées optimisées.
- **Modèle** : plateforme multi-entreprises, universelle : mêmes fonctionnalités pour tous les métiers, vocabulaire neutre (pas de réglage par métier). Le premier client est une boulangerie ; des prospects vendent de la glace, de la viande ou des boissons.
- **Premier client au lancement** : 150 à 200 commerçants, 5 livreurs, environ 100 produits, heure limite de commande à 17h la veille, ouvert 7 j / 7.
- **Rôles affichés** : client, production, atelier, point de vente, livreur, gérant (administrateur de l'entreprise), éditeur de la plateforme. Les identifiants internes (`BAKER`, `PASTRY_CHEF`, `SELLER`…) restent ceux du code.
- **Dans le périmètre** : prise de commande, consolidation pour la production, préparation par client, tournées, livraison, facturation par période, notifications.
- **Hors périmètre** : vente aux particuliers, paiement en ligne, stocks de matières premières, paie des livreurs.

Référence : `docs/cahier-des-charges/` (exigences CLI, BOU, LIV, ADM, PLA, NOT, RG, ENF ; tri de la base existante dans `TRI-BASE.md`).
