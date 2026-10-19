# DISPATCH-2 — Ciblage d’une commande en retard

## Résultat

Les entrées « en retard » du tableau de bord et les alertes opérationnelles du back-office ouvrent maintenant le dispatch avec l’identifiant exact de la livraison et le motif `focus=late` dans l’URL. Le contexte résiste à l’ouverture directe, au rechargement et au retour navigateur.

Dans la file, le filtre de catégorie est réinitialisé, la pagination rejoint automatiquement la bonne page et une seule ligne reçoit un contour noir, un repère latéral, le défilement et le focus clavier. Le même lien peut ouvrir la carte : la livraison est sélectionnée, le panneau mobile est déplié et la carte conserve la sélection dans son URL.

Si le retard a disparu, si la livraison est terminée ou si l’identifiant ne fait pas partie de l’entreprise connectée, l’interface affiche le même message neutre. L’API ajoute explicitement une cible au-delà de la limite habituelle de 80 lignes seulement après contrôle `companyId` et statut actif. Les liens dispatch ordinaires vers une livraison non en retard restent compatibles.

Les alertes clients et chauffeurs continuent d’ouvrir le dossier d’échanges ; le raccourci vers le dispatch est réservé au back-office.

## Validation

- `npm run check` : types valides, lint sans erreur et 205/205 tests réussis. Les avertissements lint restants sont antérieurs et hors périmètre.
- `npm run build` : build production réussi, 96 pages statiques générées.
- Test connecté en lecture seule : une livraison réellement en retard est retrouvée exactement une fois ; une livraison active d’une autre entreprise n’est jamais ajoutée à la réponse.
- Tests dédiés : ciblage exact, pagination, lien ordinaire, retard disparu, identifiant hors périmètre, points d’entrée du tableau de bord, URL, focus visuel/clavier et sélection de carte.
- Aucun changement de schéma, aucune migration, aucune création ou modification de donnée et aucun déploiement.

## Limite

La revue visuelle groupée demandée par le propriétaire reste possible plus tard. Elle ne bloque pas le comportement ni les critères techniques de DISPATCH-2.
