# UX-03 — inventaire des fiches et des entrées vers une livraison

État au 27 octobre 2026, avant tout changement d'écran. Il s'agit d'une cartographie du code, pas d'une décision de présentation : DESIGN-1 fixe la présentation, UX-03 fixe la hiérarchie et les entrées.

## Fiches existantes par rôle

| Rôle | Route | Clé d'URL | Titre | Contenu principal |
|---|---|---|---|---|
| Administrateur, dispatcher, mini-admin | `/dashboard/orders/[id]` (`src/app/(back-office)/dashboard/orders/[id]/page.tsx`) | id de **commande** | référence de commande (l. 64) | assignation, statut, articles, panneau livraison (`DeliveryAdminPanel`, `DeliveryRouteDisplay`), client ; données `GET /api/orders/[id]` |
| Client | `/portal/orders/[id]` | id de commande | référence de commande (l. 63) | livraisons liées (l. 202), factures |
| Client | `/portal/deliveries/[id]` | id de **livraison** | référence de livraison (l. 79), commande en sous-titre | itinéraire, carte de suivi, suivi détaillé, livreur et téléphone, preuve ; `GET /api/portal/deliveries/[id]` |
| Livreur | `/driver/navigate/[id]` | id de livraison (mission = livraison filtrée par livreur et entreprise, `src/app/api/driver/missions/[id]/route.ts:137`) | — | écran de navigation ; pas de fiche de détail |

Le back-office n'a **pas de fiche livraison** : la livraison n'existe qu'en panneau dans la fiche commande.

## Entrées vers une livraison

| Entrée | Fichier | Cible |
|---|---|---|
| Ligne de la file dispatch | `src/features/back-office/dispatch-columns.tsx:59` | fiche commande |
| Référence ou cellule dans les tableaux de commandes | `src/features/back-office/table-ui.tsx:74`, `:121` | fiche commande |
| Double-clic sur une épingle de la carte dispatch | `src/app/(back-office)/dispatch/map/page.tsx:98` | fiche commande (le clic simple sélectionne) |
| Livraison en focus dans le dispatch | `src/app/(back-office)/dispatch/page.tsx:150`, `:272` | `/dispatch/map?delivery=` |
| Alerte opérationnelle avec livraison | `src/components/shared/operational-alerts.tsx:37` | `/dispatch?delivery=…&focus=late` (`dispatch-focus.ts:31`) |
| Alerte sans livraison | `src/components/shared/operational-alerts.tsx` | commande (`onOpen(orderId)`) |
| Liste de livraisons du tableau de bord | `src/features/back-office/dashboard-delivery-list-dialog.tsx:84` | `/dispatch?delivery=` |
| Ticket support | `src/app/(back-office)/support/page.tsx:84`, `:88` | fiche commande ; la livraison est en texte, sans lien |
| Tableaux de commandes du client | `src/features/client-portal/client-orders-content.tsx:35`, `client-orders-history-content.tsx:36` | fiche commande client |
| Factures du client | `src/features/client-portal/client-invoices-content.tsx:75`, `portal/invoices/[id]/page.tsx:81` | fiche commande client |
| Widget livraisons du client | `src/features/client-portal/portal-dashboard-widget-renderer.tsx:98` | fiche livraison client |
| Carte de mission du livreur | `src/features/driver/mission-card.tsx:46` | navigation |

Non suivis jusqu'à leur cible : les drill-down des widgets du tableau de bord (`dashboard-widget-renderer.tsx:97-135`).

## Incohérences relevées

- Dans le back-office, une même livraison ouvre trois écrans selon l'entrée : la fiche commande (ligne de file, double-clic sur la carte, support), la file `/dispatch?delivery=` (alertes, liste du tableau de bord) ou la carte `/dispatch/map?delivery=` (focus).
- Deux formes de focus dispatch coexistent : `/dispatch?delivery=` et `/dispatch/map?delivery=`.
- Côté client, la livraison a sa fiche, mais les tableaux de commandes et les factures ouvrent la commande.
- La référence de commande domine les deux fiches commande ; seule la fiche livraison client met la référence de livraison en titre.
- Le support affiche la livraison sans lien.

## Décision à prendre avant l'implémentation

La fiche canonique du back-office n'existe pas. Deux voies sont possibles : une page `/dashboard/deliveries/[id]` dédiée, ou la fiche commande réorganisée autour de sa livraison. Décision du propriétaire, 27 octobre 2026 : **page livraison dédiée** `/dashboard/deliveries/[id]`, titrée par la référence de livraison. Statut, délai et prochaine action y apparaissent d'abord, le numéro de commande passe dans « Informations techniques », et la fiche commande reste pour les commandes à plusieurs livraisons. Toutes les entrées du back-office vers une livraison doivent ensuite ouvrir cette page.

## Première tranche livrée (27 octobre 2026)

- Page `/dashboard/deliveries/[id]` (`src/app/(back-office)/dashboard/deliveries/[id]/page.tsx`), lue par `GET /api/deliveries/[id]`. Cette API est réservée à l'administrateur, au mini-admin et au dispatcher, et filtrée par entreprise. L'ordre de la page : référence de livraison en titre et statut ; résumé client, livreur et créneau ou date de fin ; assignation tant que la livraison n'est pas terminée ; panneau de livraison existant (statut, adresse, créneau, preuve, chronologie) ; itinéraire ; contact client ; contenu replié ; échanges ; « Informations techniques » repliées, avec le lien vers la commande.
- Entrées redirigées : ligne de la file dispatch (`dispatch-columns.tsx`), double-clic sur une épingle de la carte dispatch, lien « Livraison » des tickets support.
- Inchangées pour l'instant : les alertes et la liste du tableau de bord ouvrent toujours le dispatch avec la livraison en focus, et les tableaux de commandes ouvrent la commande.
- Retard et prochaine action, même jour : `deliveryTiming` (`src/domains/delivery/delivery-timing.ts`) reprend la règle `isLateDelivery` du tableau de bord et de l'analyse. L'échéance est la date souhaitée de la commande. Le retard est compté jusqu'à maintenant, ou figé à la fin pour une livraison terminée ; une livraison sans échéance (données anciennes) n'est jamais en retard. La prochaine action dépend du statut, de l'affectation, de l'acceptation et de la preuve : affecter un livreur, attendre l'acceptation, attendre le départ, suivre ou relancer en cas de retard, vérifier une preuve manquante, traiter un échec. Rien n'est proposé pour une livraison annulée ou facturée. `GET /api/deliveries/[id]` renvoie `timing`, et la fiche l'affiche en tête. Un identifiant inconnu n'est plus relancé trois fois.
- Restent à faire pour UX-03 : variantes client et livreur, sections repliables du panneau existant, essais par statut (en attente, affectée, en cours, livrée, échouée, annulée, en retard) et par rôle.

Preuves : `tests/ux03-delivery-entries.test.ts` et `tests/e2e/ux03-delivery.spec.ts`, joué sur le serveur de développement déjà lancé. Ce parcours vérifie le titre, la commande repliée, 390 px sans débordement, le retour au dispatch, l'ouverture depuis une ligne du dispatch et un identifiant inconnu refusé.

## Variantes de rôle, alertes et essais (27 octobre 2026)

- **Alertes et tableau de bord** : une alerte liée à une livraison et la liste de livraisons d'un indicateur ouvrent désormais la fiche `/dashboard/deliveries/[id]`. Dans le back-office, toutes les entrées vers une livraison mènent à la même fiche. Seuls les tableaux de **commandes** ouvrent la commande.
- **Client** : `/portal/deliveries/[id]` reste sa fiche. `GET /api/portal/deliveries/[id]` renvoie `timing` (échéance, retard) selon la même règle `deliveryTiming`, **sans** la prochaine action, qui est une consigne interne. La fiche affiche « Prévue le … · en retard de … » sous la référence de livraison ; la commande passe en petit dessous.
- **Livreur** : sa fiche est la carte de mission, puis l'écran de navigation, avec pour clé l'identifiant de livraison. `GET /api/driver/missions` renvoie le même `timing` sans prochaine action ; la carte affiche « À livrer avant … · en retard de … » tant que la mission n'est pas terminée.
- **Essais** : la règle est testée sur chaque statut (`tests/ux03-delivery-timing.test.ts`), les entrées et l'absence de consigne interne côté client et livreur dans `tests/ux03-delivery-entries.test.ts`. Le navigateur (`tests/e2e/ux03-delivery.spec.ts`, démo réelle) ouvre une fiche par statut présent avec la prochaine action du serveur et suit une alerte jusqu'à la fiche. Il vérifie aussi la fiche client, le refus de l'API équipe (403) et d'une livraison d'autrui (404), la carte de mission du livreur et le refus d'une mission d'un autre livreur (404).
- **Rôles et clavier** : `npm run e2e:role-accounts -- setup` crée, sur `annona-dev` seulement, des comptes dispatcher, mini-admin (module Dispatch, puis module Support seul) et super-admin dans l'entreprise modèle « LogiExpress Démo », hors pool de démo. Le mot de passe est tiré au hasard et écrit dans `outputs/e2e-role-accounts.json` (non versionné) ; `cleanup` supprime comptes et manifeste. Sans ce fichier, les essais de rôle sont ignorés. Le dispatcher et le mini-admin Dispatch ouvrent la fiche depuis la file, voient l'assignation tant que la livraison n'est pas terminée, et reçoivent 404 sur une livraison d'une autre entreprise. Le mini-admin Support reçoit 403 et voit « Livraison introuvable », sans relance de la requête. Au clavier : Entrée sur une ligne ouvre la fiche, Tab atteint « Retour au dispatch » puis « Informations techniques » avec un focus visible, Entrée déplie, le lien commande s'ouvre. 8/8 essais navigateur le 27 octobre.
- **Reste** avant de cocher : la revue visuelle avec DESIGN-1.
