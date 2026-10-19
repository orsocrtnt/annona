# ACK-1 — Préparation et escalade DB-1

Date : 2026-10-09. État : inspection terminée ; implémentation et recette non exécutées.

## Décision minimale proposée

Le démarrage existant ne suffit pas à remplacer la confirmation par e-mail : `missionStartedAt` active effectivement navigation, itinéraire et étapes d'exécution. Un chauffeur doit pouvoir confirmer une mission prévue sans prétendre être déjà parti.

Conserver les statuts logistiques actuels. Distinguer l'affectation (`ASSIGNED` et `driverId`), la prise en charge (`missionAcceptedAt`) et le début réel (`missionStartedAt`). Aucun nouveau statut Prisma n'est nécessaire. Le geste chauffeur « Prendre en charge » précède « Commencer la mission ». L'affectation par l'admin, l'auto-dispatch et le simple affichage d'une mission ne valent jamais confirmation.

Ajouter seulement `Delivery.missionAcceptedAt DateTime? @map("mission_accepted_at")`. Ce champ contient une heure serveur, reste nul pour toutes les données existantes et est remis à null à chaque changement de responsable ou retrait avant départ. L'historique existant garde la trace humaine du responsable précédent, de sa confirmation et du refus. Il ne sert pas de stockage implicite du nouvel état.

## Motif de l'escalade

`Delivery` ne possède pas de champ JSON ou de date de prise en charge. `TrackingEvent` possède seulement libellé, description, date et coordonnées ; il n'a ni type métier stable ni référence à une version d'affectation. Déduire la confirmation de libellés ou masquer des données structurées dans la description serait fragile et rendrait une liste de missions non confirmées difficile à requêter proprement.

Le routeur impose une montée vers GPT-6 Astra en cas de changement de schéma. La TODO place DB-1 avant les évolutions de schéma et exige comparaison de cible, copie isolée et procédure de restauration. La demande ACK-1 interdit une migration implicite : `ESCALADE_MODELE / DB-1` est signalée au coordinateur avant toute mutation. Ni `prisma/schema.prisma`, ni client Prisma, ni base distante n'ont été changés pour ACK-1.

## Règles préparées

- Confirmer : chauffeur courant, entreprise courante, mission `ASSIGNED`, sans début réel. Écrire la date et un seul événement « Prise en charge confirmée » avec le nom/identifiant du chauffeur, dans la même transaction.
- Démarrer : exiger une confirmation explicite nouvelle et conserver sa date. Le début reste distinct et garde les protections DISPATCH-1.
- Refuser ou signaler son indisponibilité : même garde chauffeur/entreprise, motif obligatoire, seulement avant le début ; rendre la livraison et la commande `PENDING`, retirer le responsable et remettre la date de confirmation à null. Conserver auteur et motif dans l'événement. Aucun auto-dispatch immédiat qui réaffecterait silencieusement le même chauffeur.
- Réaffecter avant départ : autorisé comme aujourd'hui, mais nouvelle confirmation obligatoire. Le rejeu vers le même chauffeur ne doit pas effacer sa confirmation.
- Après départ : refus, retrait et réaffectation restent interdits. Utiliser le parcours d'incident/annulation existant, sans transfert implicite.
- Annuler : conserver la date historique de confirmation et de départ ; ne pas présenter ces dates comme une affectation active lorsque le responsable est retiré.
- Anciennes missions démarrées : ne pas recopier `missionStartedAt` dans la nouvelle date. Afficher « Prise en charge non enregistrée » ; permettre leur poursuite sans fabriquer une confirmation historique.
- Libre prise de mission : le bouton existant « Prendre en charge » devra enregistrer affectation et confirmation atomiquement, ou être renommé explicitement « Me l'affecter » et être suivi du même geste de confirmation. La deuxième option minimise le couplage et évite une confirmation partielle en deux transactions.

## Concurrence et périmètre

Réutiliser la comparaison atomique de DISPATCH-1 sur `driverId`, statut, `missionStartedAt`, `updatedAt`, en y ajoutant la date de confirmation attendue. Un seul clic concurrent doit gagner et créer un seul événement. L'autre requête peut recevoir un conflit 409 explicite ; un succès idempotent n'est pas nécessaire si la version a changé.

Pour confirmer/refuser depuis une carte déjà chargée, transmettre aussi son `updatedAt` attendu : un ancien écran ne doit pas confirmer ou refuser une nouvelle affectation après un aller-retour vers le même chauffeur. Refuser une version périmée sans mutation, puis actualiser les missions après succès et conflit.

À contrôler lors de la reprise : `assignDeliveryToDriver` reçoit actuellement `expectUnassigned`, mais ne l'utilise pas comme garde transactionnelle. La libre affectation peut donc observer `PENDING`, puis réaffecter une mission entre-temps confiée à un autre chauffeur. Corriger ce point avant de considérer le libre choix comme une confirmation sûre ; conserver le refus de capacité/pause/zone existant.

## Points d'intégration inspectés

- `src/domains/delivery/start-delivery-mission.service.ts` : garde de prise en charge avant le CAS de départ.
- `src/domains/delivery/delivery.service.ts` : affectation/réaffectation/retrait/refus et listes/détails chauffeur/admin/client.
- `src/domains/order/order.service.ts` : sélection explicite des livraisons pour les listes admin et annulation générique.
- `src/domains/delivery/dispatch-map.service.ts` : sélections moderne/legacy, type et sérialisation de la date.
- `src/app/api/driver/missions/[id]/` : nouvelles actions de confirmation/refus, validation Zod, erreurs 400/403/404/409, garde serveur existante.
- `src/features/driver/{types,api,hooks,mission-card,available-mission-card}.tsx` ou `.ts` : responsable, état/date, deux gestes distincts, motif de refus et rafraîchissement.
- `src/features/back-office/{types,delivery-admin-panel,company-order-columns}.tsx` ou `.ts` et listes dispatch : attente de confirmation visible et date commune.
- `src/features/client-portal/types.ts` et `src/app/(client-portal)/portal/deliveries/[id]/page.tsx` : même date dans le dossier client pour R04 ; aucune visibilité sur une autre entreprise.

## Recette requise avant de cocher ACK-1 / R04

1. Affectation standard : mêmes `driverId`, nom et date null côté admin/chauffeur ; mention visible « En attente de prise en charge ».
2. Confirmation : même horodatage ISO relu depuis les trois espaces ; aucun départ, changement de statut ou activation anticipée de navigation.
3. Double confirmation concurrente : un seul événement et une seule date ; conflit ou rejeu cohérent ; l'interface se rafraîchit.
4. Démarrage sans confirmation : 409, aucune mutation. Après confirmation : début distinct, date de confirmation conservée ; double départ protégé.
5. Refus sans motif : 400, aucune mutation ; refus motivé avant/après confirmation : retour dispatch, responsable/date supprimés, commande `PENDING`, trace du chauffeur et du motif.
6. Réaffectation après confirmation : nouvelle date null ; ancien chauffeur 404 ; nouvelle confirmation seulement par le nouveau chauffeur. Rejeu vers le même responsable conserve la date.
7. Confirmation/refus contre réaffectation/retrait/départ concurrents : un seul état final cohérent ; aucune confirmation portée par le mauvais chauffeur.
8. Carte périmée après affectation A → B → A : ancienne version refusée ; aucun effet sur la nouvelle affectation.
9. Après départ et états terminaux : refus/retrait/réaffectation interdits ; dates/historique inchangés.
10. Libre choix simultané avec affectation admin : aucun vol de mission et aucune confirmation inventée.
11. Mauvais rôle et entreprise étrangère : gardes existantes conservées, aucune information révélée.
12. Browser : attente visible puis confirmation horodatée et départ distinct côté chauffeur/admin/client ; refus et réaffectation visibles après actualisation. Fixtures identifiables et nettoyage vérifié.

Exécuter les tests métier, `npm run check`, le build hors serveur dev, puis la recette connectée et visuelle. Conserver les preuves et limites ; ne pas assimiler la préparation à une validation fonctionnelle.

## Évolution de base préparée, non appliquée

`docs/operations/ack1/apply.sql` ajoute une colonne nullable sans valeur par défaut, backfill, nouvelle table ou changement de droits. `verify.sql` décrit les lectures de contrôle. `rollback.sql` conserve la colonne et les données lors du retour applicatif ; toute suppression ultérieure est une action séparée.

Avant application : confirmer la cible autorisée, relever version PostgreSQL, type/table/colonne et RLS ; tester sur copie isolée et établir la restauration selon DB-1. Ne pas lancer `db:push` ni synchroniser tout le schéma local, qui contient déjà de nombreuses modifications préexistantes.

## Preuves de préparation

- Révision de référence : `af614947844d69be3bc1c34e58afb820f7f35351`, avec nombreuses modifications locales préexistantes conservées.
- Node : v22.18.0.
- Sources lues : AGENTS.md, TODO.md, conventions, recette V1, routeur/exécuteur, rapports DISPATCH-1 et OPS-02B, services et écrans cités ci-dessus.
- Contrôle de référence `npm run check` : réussi, types valides, lint sans erreur avec 24 avertissements historiques, 81/81 tests réussis. Résultat consigné dans `outputs/ack1-baseline-check.log`. Ce contrôle porte sur le code existant ; il ne prouve aucune fonctionnalité ACK-1.
- `git diff --check` : réussi après préparation.
- `.cursor/rules/perf-handoff.mdc` lu et préservé.

Statut : ACK-1 ouverte, R04 ouverte, DB-1 ouverte. Aucun déploiement, push, reset, migration ni donnée E2E créée pour cette préparation.
