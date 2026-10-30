# UX-04 — Inventaire des actions des parcours prioritaires

Relevé du 29 octobre 2026, sur le serveur local (base `tutelliv-dev`, compte de démonstration, personas administrateur, client et livreur), à 1 280 px et à 390 px. Le script compte, dans le contenu principal de chaque écran : les boutons et liens visibles, les contrôles sans nom accessible, les rangées de quatre boutons ou plus, les boutons accompagnés d'une phrase d'aide de plus de 25 caractères et les actions destructrices.

La partie « explications permanentes » (alertes, bandeaux d'aide répétés) a été traitée avec UX-ALERTES et validée par le propriétaire le 29 octobre 2026.

## Résultat par écran

| Rôle | Écran | Boutons / liens | Sans nom | Constat | Suite |
|---|---|---|---|---|---|
| Administrateur | `/dashboard` | 29 / 3 | 0 | Les boutons sont les indicateurs cliquables et les périodes du graphique, plus « Personnaliser le dashboard ». | Rien à changer. |
| Administrateur | `/dispatch` | 17 / 22 | 0 | Une action principale (« Lancer auto-dispatch ») et deux secondaires (« Depuis un message », « Carte ») ; les liens sont les lignes de la file. | Rien à changer. |
| Administrateur | `/dashboard/orders` | 34 / 18 | 0 | Actions de ligne (« Modifier le statut de la commande », « Assigner un chauffeur »), filtres, tri, pagination, export. « Effacer » vide les filtres, sans perte de données. | Rien à changer. |
| Administrateur | `/dashboard/orders/[id]` | 9 | 0 | « Changer » et « Retirer » (chauffeur) trop vagues ; retrait sans confirmation. | **Corrigé** (voir plus bas). |
| Administrateur | `/dashboard/deliveries/[id]` | 7 / 3 | 0 | Même composant chauffeur que la commande. « Annuler la livraison » est déjà confirmée et visible comme destructive. | **Corrigé** (composant chauffeur). |
| Administrateur | `/dashboard/drivers` | 2 / 5 | 0 | Faux positif : le sous-titre sous chaque nom de chauffeur. | Rien à changer. |
| Administrateur | `/users` | 18 / 0 | 0 | Onglets de filtre (Tous, Chauffeurs, Clients, Mini-admins). « Supprimer » par ligne : icône nommée « Supprimer <nom> », avec dialogue de confirmation. | Rien à changer. |
| Administrateur | `/settings` | 2 / 1 | 0 | « Au moins une option doit rester active. » : règle courte et utile au moment d'enregistrer. | Gardée. |
| Client | `/portal`, `/portal/orders`, `/portal/orders/new`, `/portal/deliveries` | 1 à 8 | 0 | Une action principale par écran (« Créer la commande » ou « Demander un devis ») ; « Effacer » vide les filtres. | Rien à changer. |
| Livreur | `/driver`, `/driver/missions`, mission | 7 à 11 | 0 | « Terminer le service » est précédé d'une phrase sur le partage de position : notion sensible (GPS), aide justifiée. | Gardée. |

Aucun contrôle sans nom accessible sur les 30 relevés (15 écrans × 2 largeurs).

## Correction

`src/features/back-office/assign-driver-select.tsx`, utilisé par la fiche commande et la fiche livraison :

- « Changer » devient **« Changer de chauffeur »** ; « Retirer » devient **« Retirer le chauffeur »** ;
- retirer le chauffeur demande une confirmation (« Retirer le chauffeur de cette livraison ? (nom) »), comme l'annulation de livraison ; un refus ne fait aucun appel serveur.

Tests : `tests/ux04-actions.test.ts` (libellés et confirmation avant l'appel). Navigateur : sur une livraison affectée, les deux boutons sont visibles, le clic ouvre la confirmation, et après un refus le chauffeur reste affecté ; aucune erreur de page.

## Limites

- Le relevé est automatique ; il ne remplace pas un essai de découverte par un utilisateur réel de chaque rôle, prévu avec les pilotes (PILOT-1).
- Les écrans d'administration plateforme (`/admin`) et les réglages détaillés (`/settings/*`) ne font pas partie des parcours prioritaires de UX-04.
