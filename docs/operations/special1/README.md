# SPECIAL-1 — Missions spéciales expérimentales

La mission spéciale reste désactivée par défaut. Une entreprise peut l'activer dans ses paramètres pour un essai interne, mais elle ne fait pas partie de l'offre pilote tant que Annona ne gère pas un devis chiffré, ses versions et l'acceptation explicite du client.

## Parcours actuellement qualifié

1. Le client décrit sa mission et renseigne une ou plusieurs adresses ordonnées.
2. Annona crée une demande `QUOTE_REQUESTED`, sans livraison et sans montant.
3. L'entreprise prépare, transmet et fait accepter le devis hors Annona.
4. Après cet accord externe, un administrateur passe manuellement la demande à `PENDING`. Cette action crée une livraison de la première adresse vers la dernière et enregistre « Accord confirmé hors Annona ».
5. Le dispatch affecte un livreur autorisé pour la catégorie. Le livreur confirme, démarre et clôt la mission avec une preuve comme pour le parcours principal.
6. Une facture peut être créée après la livraison avec une ligne personnalisée correspondant au montant convenu. Cette facture ne constitue ni le devis initial ni une preuve d'acceptation.

Depuis `QUOTE_REQUESTED`, seules la conservation du statut, la conversion en `PENDING` et l'annulation sont possibles. Annona refuse notamment un passage direct à livré ou en échec.

## Vérification

- `npm run check` couvre la validation du formulaire, l'ordre des adresses, le défaut désactivé et les transitions proposées.
- `npm run test:special1` crée deux entreprises fictives isolées. Il rejoue demande à trois adresses, refus interentreprises, conversion, affectation, confirmation, livraison, preuve et facture, puis supprime toutes les fixtures.
- `npm run build` vérifie l'intégration des écrans.

Le test connecté utilise uniquement les préfixes `special1-`. Aucun devis réel, e-mail, paiement, migration ou déploiement n'est effectué.

## Conditions avant inclusion dans une offre

Il faudra définir le produit de devis : montant et taxes, durée de validité, version, pièces jointes éventuelles, action accepter/refuser du client, identité et horodatage de l'acceptation, annulation, lien avec la facture finale et règles juridiques du pays. Cette décision est liée à BILL-01A et au cadrage commercial ; elle ne doit pas être déduite du socle actuel.
