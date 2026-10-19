# ALERT-1 — traitement opérationnel V1

## Règle et périmètre

Un retard est calculé quand `Order.requestedDeliveryDate` est strictement dépassée et que la livraison est active (`PENDING`, `ASSIGNED`, `PURCHASING`, `IN_DELIVERY`) sans `completedAt`. Cette date existe déjà dans le formulaire et les indicateurs. `estimatedArrival`, l’âge de la commande et l’absence de confirmation ne créent aucun délai implicite. Une commande sans date demandée n’a donc pas d’alerte automatique de retard. Ce calcul signale une date demandée dépassée ; il ne crée aucun engagement contractuel ou SLA.

Une alerte correspond à une livraison et son échéance exacte. Un incident correspond à un message COMM-1 de catégorie `INCIDENT`. Les incidents internes et leur traitement sont réservés au personnel. Client propriétaire et chauffeur courant consultent les incidents partagés de leur commande et l’état du traitement. Le chauffeur voit uniquement les retards de ses propres livraisons ; le fil de coordination reste partagé au niveau commande, conformément à COMM-1.

Le personnel ayant lecture commandes/livraisons et au moins un droit `orders:update`, `deliveries:update` ou `deliveries:dispatch` peut prendre en compte, avec action prévue obligatoire, puis résoudre, avec action menée/résultat obligatoire. Un rôle de lecture peut consulter. Client et chauffeur ne traitent pas les alertes. Le résultat et les noms/dates des actions sont visibles aux mêmes destinataires que la source.

## État durable et concurrence

Les retards sont calculés à la lecture, sans cron ni matérialisation supplémentaire. Ils s’actualisent toutes les dix secondes lorsque l’application est ouverte, ou à l’ouverture du dossier. Une cible déterministe `late:<deliveryId>:<date ISO>` ou `incident:<messageId>` évite les doublons de calcul. Les actions sont des messages `INSTRUCTION` du fil existant, avec une clé réservée `alert1:<SHA256 de la cible>:ack|resolve`. L’état est dérivé de cette clé structurée, jamais du texte du motif. La route publique de message exige UUID et ne permet pas de fabriquer une clé réservée. Aucune migration, colonne, table, permission ou règle RLS nouvelle.

L’action verrouille les livraisons triées puis la commande, dans le même ordre que les mutations livraison, dans une transaction sérialisable avec reprises bornées sur conflit Prisma P2034/P2002. Le verrou conserve explicitement les versions `updatedAt`. La recherche d’une action existante porte sur la cible/action, tous auteurs confondus. Deux administrateurs ou deux clics rendent la même entrée : la première action validée fait foi, même si les motifs proposés diffèrent. Pour apporter une précision, publier un échange distinct. Un rejeu connu après clôture restitue cette action ; une nouvelle action après résolution/clôture est refusée.

Une date demandée corrigée/remplacée retire l’ancienne cible calculée. Son journal reste dans le fil de commande. Si la nouvelle date est ensuite dépassée, elle crée une nouvelle cible à traiter. Une résolution manuelle retire l’alerte du panneau, même si la date initiale reste dépassée ; les indicateurs statistiques de retard conservent leur règle factuelle. Une mission/livraison terminée clôt les alertes restantes avec l’état **Clôturée**, distinct de **Résolue** : aucune action menée ni résolution humaine n’est inventée. Les incidents se clôturent à la fin de la commande, le retard à la fin de sa livraison.

## Notifications et exploitation

La cloche portail reste la boîte des notifications client existantes. Son libellé est « Notifications » ; lire ne signifie ni acquitter ni résoudre. Le panneau opérationnel dans les espaces habituels ouvre le dossier partagé et affiche les alertes actives. Les vues carte plein écran/navigateur de mission ne constituent pas une console d’alertes ; revenir au tableau de bord ou ouvrir le dossier pour traiter. Les erreurs de chargement sont visibles ; les rôles dépourvus de lecture commandes/livraisons n’affichent pas de faux bandeau d’indisponibilité.

La liste globale couvre au plus 100 dossiers actifs récents, avec limite explicitement affichée. Les autres dossiers restent accessibles individuellement. Ce périmètre n’est pas une validation volumique DATA-01. Aucun SMS, e-mail, pièce jointe ou canal temps réel n’est ajouté.

Chaque action et sa tâche de notification COMM-1 sont créées dans la même transaction. Le runner OPS-02B délivre les notifications sans doublon. En cas de conflit transitoire, les tentatives sont bornées, avec reprise différée et visibilité dans les opérations existantes. Ne pas modifier les jobs d’autres entreprises pour dépanner un dossier. Contrôler le `jobKey` `order-message:<messageId>`, l’entreprise, le statut et le nombre de tentatives ; utiliser les relances existantes autorisées de l’entreprise. Le harnais prévoit la reprise ciblée avec horloge simulée uniquement sur fixtures identifiées. Un P2034 avec planification de reprise a été constaté au premier passage ; le passage suivant a réussi sans reprise différée observée. `.env` et données préexistantes conservés.

## Vérification

- `npm run check` : types/lint et tests locaux policy/services/routes ; droits, clé réservée, idempotence, motifs, échéance, multi-livraisons et clôture.
- `npm run build`, serveur de développement arrêté au préalable.
- Recette connectée A/B et navigateur : références `ALERT1-`, preuves sous les outputs de la tâche Codex ; fixtures, notifications, jobs, utilisateurs et comptes Auth supprimés après les contrôles.
- REST anonyme des tables COMM-1 toujours refusé ; DB-1 globale et MAP-1 restent ouvertes.

La panne de carte Leaflet connue (`window is not defined` dans driver/navigate) reste hors qualification ALERT-1. Les parcours dashboard/portail/accueil chauffeur utilisés pour les alertes restent à vérifier indépendamment par les captures de recette.
