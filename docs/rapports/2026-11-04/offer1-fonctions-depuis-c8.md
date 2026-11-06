# OFFER-1 — Fonctions ajoutées depuis le catalogue du 23 octobre 2026

Demande du propriétaire du 4 novembre 2026 : lister les fonctions ajoutées depuis le catalogue V1.1 du 23 octobre (dans le dépôt : catalogue `C8-2026-10-23`, aujourd'hui `C10-2026-10-29`) et proposer dans quelle offre ou quelle option chacune va. Le document Drive « catalogue V1.1 » n'a pas été ouvert : la comparaison part du catalogue du dépôt et de `git log` depuis le 23 octobre.

## Ce que le catalogue contrôle aujourd'hui

Cinq fonctions seulement, vérifiées côté serveur (`src/domains/saas/saas.service.ts`) :

| Clé | Nom | Starter | Pro | Business |
|---|---|---|---|---|
| `auto_dispatch` | Dispatch intelligent | Option 39 € | Inclus | Inclus |
| `admin_gps` | Carte GPS administrateur | Option 39 € | Inclus | Inclus |
| `client_gps` | Carte GPS client | Option 49 € | Option 49 € | Inclus |
| `advanced_analytics` | Statistiques avancées | Option 29 € | Option 29 € | Inclus |
| `priority_support` | Assistance prioritaire | Option 29 € | Option 29 € | Incluse |

Tout le reste est ouvert à toutes les offres.

## Fonctions ajoutées depuis le 23 octobre

| Famille | Fonction | Tâche | Contrôle actuel | Coût variable | Proposition |
|---|---|---|---|---|---|
| Réception des commandes | Lien de commande public et suivi sans connexion | MAIL-COMMANDE | Aucun | Nul | Socle, toutes offres |
| | Formulaire « Nouvelle commande » côté back-office | ADMIN-COMMANDE | Aucun | Nul | Socle |
| | Créneau et poids à la commande | DEMO-3 | Aucun | Nul | Socle |
| | E-mails de commande renvoyés vers Annona, tri, brouillons, confirmation au client, fiche client sans accès | MAIL-PONT | Activation par entreprise | Faible (réception e-mail, analyse IA) | **Nouvelle option « Réception automatique des commandes »** |
| | Commande par message collé, lue par l'IA | INTAKE-1 | Clé serveur + activation par entreprise, 60 analyses/h et 300/jour | Faible (Haiku, moins d'un centime par analyse) | Même option |
| | Commandes WhatsApp transférées au numéro Annona | WHATSAPP-1 | Activation par entreprise | Quasi nul (messages reçus gratuits chez Meta) + analyse IA | Même option |
| Dispatch | Suggestions des 3 meilleurs livreurs, score expliqué | DISPATCH-4 | `auto_dispatch` | Calcul d'itinéraire | Déjà dans Dispatch intelligent |
| | Tournées proposées puis validées | DISPATCH-4 | `auto_dispatch` | Calcul d'itinéraire | Déjà dans Dispatch intelligent |
| | Proximité GPS au point de retrait | DISPATCH | `auto_dispatch` (réglages) | Nul | Déjà dans Dispatch intelligent |
| | Imprévus et remplacement validé | DISPATCH-5 | Aucun | Nul | Socle |
| | Notification « Nouvelle mission » au livreur | DEMO-3B | Aucun | Nul | Socle |
| Preuve de livraison | Signature, réceptionnaire, refus de signer, photos sans EXIF | POD-2 | Règles par entreprise | Stockage | Socle |
| | PDF de preuve horodaté et envoi automatique au donneur d'ordre | POD-2 | Réglage par entreprise | E-mail | Socle |
| | Relevés par coursier (CSV, JSON) pour paie et sous-traitance | POD-2 | Aucun | Nul | Socle |
| Factures des livraisons | Facture créée à la livraison, onglet Paiements, retard, relance tracée | BILL | Réglage par entreprise | E-mail | Socle |
| | Factur-X EN 16931 (PDF/A-3 + XML) | FACTURX-1 | Aucun | Nul | Socle : obligation légale à venir, pas une option |
| Côté client final | Arrivée estimée, prénom du livreur, téléphone selon réglage, avis de prise en charge | DEMO-3, portail | Aucun (la carte reste `client_gps`) | Nul | Socle |
| Confort | Mode sombre, écrans téléphone, accessibilité, carte unifiée | DESIGN, MOBILE-2 | Aucun | Nul | Socle |

Hors offre : les réponses aux e-mails de Annona vers `orso@annona.fr` (MAIL-REPONSE) concernent le support de Annona, pas une fonction vendue.

## Raisonnement

- Le socle doit permettre de faire tout le travail de base : recevoir une commande, livrer, prouver, facturer. Preuve de livraison et Factur-X sont attendus par tout donneur d'ordre ; les vendre en option affaiblirait Starter.
- La réception automatique (e-mail, WhatsApp, message lu par l'IA) supprime la ressaisie, la difficulté principale visée par PROD-02. C'est la seule nouveauté qui mérite d'être mise en avant comme montée en gamme, sur le modèle du Dispatch intelligent : option en Starter, incluse en Pro et Business.
- Son coût direct est faible ; le prix se justifie par la valeur (temps de saisie gagné), à confirmer en entretien.
- Une option de plus reste lisible : six options au lieu de cinq.

## Effet technique si la proposition est retenue

Nouvelle clé `order_automation` dans `SAAS_FEATURES`, contrôle serveur sur la réception d'e-mails, l'analyse de message et WhatsApp, nouveau catalogue `C11` par migration (recopie de C10 + l'option), comparatif des offres, page Tarifs, documents et supports commerciaux. Le sort des entreprises déjà actives (`LEGACY`, pilotes) est à régler au même moment pour ne couper aucun accès.

## Décision du propriétaire (4 novembre 2026)

Proposition retenue telle quelle : option Starter à 29 € HT par mois, incluse en Pro et Business ; preuve de livraison, factures, relances et Factur-X dans toutes les offres. Consignée en C15 dans `docs/DECISIONS_PRODUIT_COMMERCIALES.md`, appliquée par le catalogue `C11-2026-11-04`.
