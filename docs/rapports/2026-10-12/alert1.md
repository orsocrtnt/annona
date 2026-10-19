# ALERT-1 — retards et incidents actionnables

Date : 12 octobre 2026. Une seule tâche traitée. Version locale non publiée ; modifications préexistantes conservées.

## Résultat

ALERT-1 est terminée après relecture des preuves par le coordinateur. Un dépassement de la date demandée apparaît dans le panneau opérationnel du personnel habilité, du client propriétaire et du chauffeur courant. Le personnel indique l’action prévue pour prendre en compte, puis l’action menée/résultat pour résoudre. Les actions, noms et dates restent dans le dossier. Les incidents COMM-1 suivent le même traitement ; les sources/actions internes restent strictement réservées au personnel.

Le retard est calculé sur `Order.requestedDeliveryDate`, strictement dépassée pour une livraison active sans `completedAt`. Cette date était déjà utilisée par les indicateurs et la planification. Aucune échéance inventée pour les commandes sans date, aucune utilisation de l’estimation démo `estimatedArrival`, aucun nouveau SLA. La date est lisible en fr-FR dans l’interface, l’identité conserve ISO.

Le chauffeur voit seulement les retards de ses propres livraisons ; les incidents et le journal public restent partagés au niveau commande, comme COMM-1. Réaffectation réévalue les droits : ancien chauffeur sans autre affectation perd dossier/panneau, nouveau chauffeur retrouve le traitement courant. Une mission/livraison terminale affiche **Clôturée**, distinct de **Résolue**. Une échéance corrigée retire l’ancienne cible active mais conserve ses actions dans le fil. Résoudre manuellement ne modifie pas les indicateurs statistiques factuels de retard.

## Implémentation

- Domaine `src/domains/operational-alerts/` : calcul, périmètre, droits, actions et liste bornée explicite.
- Routes `GET /api/operational-alerts` et `GET/POST /api/operational-alerts/[orderId]` : authentification, Zod stricte, motifs obligatoires et refus cohérents.
- `src/components/shared/operational-alerts.tsx` : panneau commun, détail, actions et historique intégrés à l’inbox/fil COMM-1. Cloche portail libellée **Notifications** ; lecture distincte du traitement.
- Aucun schéma modifié. Les actions utilisent `OrderMessage.kind=INSTRUCTION` existant et une clé réservée `alert1:<hash cible>:ack|resolve`. L’état dépend de la clé structurée, jamais du texte libre. La route messages exige UUID et ne permet pas d’injecter ces clés.
- Transaction sérialisable, livraisons triées verrouillées puis commande, versions `updatedAt` conservées. Deux auteurs ou clics retournent la même première action validée ; tâche de notification créée dans la même transaction. Runner et déduplication OPS-02B/COMM-1 réutilisés.
- `transaction` et `authorizedOrder` exportés du service COMM-1 ; référence livraison ajoutée à son select. Aucun autre comportement COMM-1 modifié.

## Vérifications et preuves

`npm run check` : **128 tests réussis**, types valides, lint avec **24 avertissements historiques**. `npm run build` : réussi, serveur dev précédent arrêté par le coordinateur ; nos serveurs de test arrêtés avant les reconstructions suivantes. Logs : `outputs/alert1/check-final.log` et `build-final.log`.

Recette connectée : **76 assertions réussies dans les phases principales**, puis **12 assertions ciblées de régression finale** (88 exécutions au total, certaines répètent volontairement le même comportement après correction ; ce ne sont pas 88 scénarios indépendants). Synthèse complète : `outputs/alert1/connected-final.json`.

Ont été vérifiés en API sur deux entreprises fictives et plusieurs rôles : même retard unique, aucune alerte sans échéance fiable/future, droits lecture/action, autres clients et chauffeurs, notes internes y compris corps/compteurs/notifications, clé réservée, motifs, deux auteurs concurrents pour prise en compte et résolution, tâche unique, version logistique conservée, cloche/fil lus sans résolution, nouvelle date et ancien journal, réaffectation et clôture. Dernière version : courses action/clôture et action/réaffectation sans erreur serveur, accès cohérents après course ; worker notification rejoué sans doublon. REST anonyme des tables COMM-1 toujours refusé en 401.

Navigateur Chrome : panneau admin, double clic sans doublon, client et chauffeur voient le traitement sans boutons d’action, cloche existante accessible, résolution persistée après recharge, date fr-FR. Captures : `admin-open.png`, `admin-acknowledged.png`, `client-acknowledged.png`, `driver-acknowledged.png`, `client-resolved.png`, `admin-resolved.png`, `admin-resolved-final.png`. Cette dernière a été relue visuellement : date, résolution et deux auteurs lisibles.

## Incidents de recette et limites de preuve

1. Premier passage : 47 assertions réussies, puis attente notifications limitée à 15 secondes. Des conflits P2034 de workers ont été remis en PENDING par OPS-02B pour un essai à +1 minute. L’attente du harnais était insuffisante. Preuve conservée `connected-attempt1.json/.log`. Le helper a été étendu pour utiliser le runner uniquement sur les jobs fixtures identifiés, avec horloge simulée si nécessaire. Le passage suivant a terminé ses notifications sans nouvelle reprise différée observée : aucune reprise différée réussie n’est prétendue à tort.
2. Après 18 assertions supplémentaires, Chrome a été bloqué par le sandbox (SIGABRT/EPERM). La seule partie navigateur a été relancée avec l’escalade système autorisée et a réussi 11 assertions. Preuves `connected-remaining.json`, `connected-browser.json` et logs.
3. Les 12 régressions finales ont toutes réussi, y compris l’égalité d’empreinte des commandes/livraisons/messages préexistants avant/après scénario, avant nettoyage. Après les suppressions ciblées, une fermeture de connexion P1017 a interrompu l’ultime fingerprint avant sauvegarde JSON. Les contrôles finaux sont reconstruits explicitement depuis `final.log`. L’audit reconnecté en lecture seule (`audit-final.json`) confirme zéro résidu commandes, livraisons, utilisateurs, comptes Auth, messages/notifications fixtures et jobs message orphelins. Le hash baseline n’était qu’en mémoire et a été perdu : l’égalité post-cleanup indépendante n’est pas affirmée. Les suppressions ont été relues et ne visaient que les IDs fixtures, avec `notes=tag` supplémentaire sur commandes. Les phases antérieures ont chacune sauvegardé zéro résidu et égalité préexistants.
4. Le serveur garde l’erreur Leaflet connue `window is not defined` dans driver/navigate, suivie par MAP-1. Les écrans d’alertes utilisés ont réussi ; la navigation cartographique n’est pas qualifiée ici.

## Exploitation et statut

Procédure : `docs/operations/alert1/README.md`. Liste globale limitée aux 100 dossiers actifs récents avec avertissement explicite ; les autres dossiers restent consultables individuellement. Actualisation dix secondes lorsque l’application est ouverte. Les vues carte plein écran/navigation ne constituent pas une console d’alertes. Pas de SMS, e-mail ajouté, pièce jointe ou temps réel.

Aucune migration, table, droit direct ou règle RLS nouvelle : la procédure de migration/copie-restauration n’a donc pas été sollicitée. DB-1 globale et MAP-1 restent ouvertes. R10 reste ouvert : sa partie retard/incidents et traitement est prouvée, sa recette intégrale échec/motif/concordance reste à rejouer dans son périmètre. Aucun push, reset ou déploiement. Base actuelle autorisée pour données fictives ; `.env` non modifié.
