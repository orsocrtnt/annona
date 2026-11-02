# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Les utilisateurs principaux sont les dirigeants, administrateurs et dispatchers d’entreprises françaises de coursiers et de livraison express B2B. Ils coordonnent quotidiennement les commandes, les chauffeurs, les incidents et l’avancement des missions. TutelLiv comporte aussi un portail client et un espace chauffeur distincts.

## Product Purpose

TutelLiv centralise la demande de livraison, l’affectation, la prise en charge, le suivi daté, les échanges, les incidents, la preuve et l’historique. Le succès produit consiste à donner à chaque rôle une vue fiable et immédiatement exploitable de ce qui doit être fait, sans dépendre d’une chaîne d’e-mails dispersée.

## Positioning

TutelLiv sert de dossier opérationnel partagé de chaque livraison : la demande initiale, le responsable, les étapes, les échanges, la position utile et datée, la preuve et l’historique restent reliés au même objet métier.

## Operating Context

L’espace administration et dispatch est utilisé sur ordinateur pendant l’exploitation quotidienne. Le tableau de bord doit permettre de repérer rapidement les missions en retard, sans livreur, assignées, en cours et terminées, puis d’ouvrir les commandes, le dispatch ou les cartes existantes.

## Capabilities and Constraints

- SaaS Next.js multi-entreprise avec rôles et permissions contrôlés côté serveur.
- Données réelles disponibles pour les volumes par période, les statuts, les retards, les listes détaillées et les cartes de missions ou de chauffeurs.
- Aucune série temporelle quotidienne n’est fournie au dashboard actuel ; aucune courbe chronologique ne doit être inventée.
- La création de commande se fait d’abord dans le portail client. Depuis la décision C11 du 28 octobre 2026, le back-office peut aussi créer une commande pour le compte d’un client choisi depuis le flux « commande par message », après validation du dispatcher (`orders:create`, `source = ADMIN`). Depuis le 2 novembre 2026, il peut aussi le faire avec le formulaire « Nouvelle commande », mêmes droits et même source, sans dépendre de l’activation de la commande par message. Le client doit avoir un compte actif de l’entreprise.
- La refonte ne modifie ni règles métier, ni dispatch, ni contrats API, ni schéma de données.
- Les autres espaces client, chauffeur et plateforme restent hors du périmètre de cette première refonte.

## Brand Commitments

Nom : TutelLiv. Palette imposée : vert principal `#00D46A`, noir profond `#0E1310`, blanc cassé `#F8F9F7`, gris clair `#E4E8E5`. Typographie de référence : Sora. Direction demandée : Apple Glass Light, Bento Dashboard et Minimal SaaS, avec verre réservé au chrome et aux overlays. Aucun logo officiel exploitable n’est présent dans le dépôt courant ; ne pas fabriquer de symbole de remplacement.

## Evidence on Hand

- Vérités produit : `README.md`, `docs/RECETTE_V1.md`, `docs/VISION_PRODUIT_COMMERCIALE.md`.
- Données du dashboard : `src/domains/dashboard/dashboard.service.ts` et `src/lib/dashboard/dashboard-types.ts`.
- Cartes existantes : `src/features/back-office/dashboard-map-widgets.tsx`.
- La maquette visuelle mentionnée dans le brief n’est pas jointe au dépôt ni à l’attachement reçu ; le brief écrit est l’autorité visuelle de cette tranche.

## Product Principles

- Montrer uniquement un état opérationnel fondé sur les données disponibles.
- Permettre de passer du résumé au détail sans perdre le contexte.
- Garder chaque espace et chaque entreprise strictement isolés.
- Privilégier la lisibilité et la vitesse d’action à la décoration.
- Ne jamais présenter une limite technique ou commerciale comme une capacité livrée.

## Accessibility & Inclusion

Navigation clavier, contrastes lisibles, cibles tactiles d’au moins 44 px, états de chargement/erreur/vides compréhensibles et respect de `prefers-reduced-motion` et `prefers-reduced-transparency`.
