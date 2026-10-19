# Recette V1 TutelLiv — parcours et écarts

## Périmètre arrêté pour la préparation

Réduire le temps de coordination et améliorer l’organisation et la visibilité en remplaçant la chaîne d’e-mails par le parcours : commande dans l’espace client → affectation admin → prise en charge livreur → échanges et exécution → statut et GPS daté → preuve et historique. Conserver les trois espaces et les parcours standard/coursier déjà présents.

Hors promesse du noyau : missions spéciales et facturation comptable avancée. Les récurrences ont été qualifiées en interne par OPS-01, mais leur cron déployé et leurs alertes restent à valider avant vente. Les missions spéciales restent expérimentales, désactivées par défaut et sans devis accepté dans TutelLiv. Prospection, tarification et abonnements automatiques différés. Aucun import automatique d’e-mails ni nouvelle app native décidé.

## État de cette recette

La checklist couvre le parcours V1. Tous les scénarios automatisables localement sont validés au 17 octobre 2026. R07 et R08 restent ouverts uniquement pour les essais GPS sur iPhone et Android physiques décrits dans MOB-01C.

## Préparation commune

Utiliser deux entreprises fictives et, pour A, admin, mini-admin limité, deux clients et deux chauffeurs. Garder séparées les sessions. Aucun compte privilégié nouveau ni test distant d’augmentation de droits sans autorisation spécifique. Les tests locaux peuvent continuer. La base actuelle est autorisée pour données E2E sans données réelles ; préparer une préproduction dédiée avant usage réel. Conserver références, assertions et captures sans mots de passe/cookies. Ne pas lancer de récurrence ou d’envoi réel par défaut.

## Scénarios de recette

- [x] **R01 — Client : Créer une commande standard complète, puis répéter le clic.**

  Attendu : Une seule commande et sa livraison, référence visible au client et à l’admin.

  État final vérifié le 2026-10-17 : le vrai bouton du formulaire a reçu deux clics synchrones dans Chrome. Les deux réponses de création ont conservé une seule commande en base. La référence affichée au client est la même que celle relue ensuite dans l'administration sur cette commande. La recette connectée conserve en plus la preuve de concurrence avec une même clé et le refus 409 d'un contenu différent.

  Travaux liés : OPS-02A/B.

  Sources dans le dépôt : src/app/api/portal/orders/route.ts ; src/domains/order/order.service.ts.

  Preuves : `outputs/ops02b/connected.json`, `outputs/test2/connected.json`, `outputs/v1-go/browser-operational.json`, captures `r01-standard-reference.png` et `r10-failure-admin.png`. Fixture supprimée, zéro résidu.

- [x] **R02 — Client et chauffeur : Créer une course avec collecte, puis tenter de sauter la collecte.**

  Attendu : Collecte obligatoire et livraison finale cohérente ; aucun doublon.

  État final vérifié le 2026-10-17 : le formulaire coursier complet a créé la collecte, son article et la destination dans Chrome. Le saut direct vers la livraison a reçu 409. Le chauffeur a ensuite confirmé la collecte, est parti en livraison et a clôturé avec preuve. La recette connectée protège aussi les créations concurrentes. Fixture et preuve privées supprimées après contrôle.

  Travaux liés : V1-GO, OPS-02A/B.

  Sources dans le dépôt : src/lib/validations/order.ts ; src/domains/delivery/delivery.service.ts.

  Preuves : `outputs/test2/connected.json`, `outputs/v1-go/browser-operational.json`, captures `r06-courier-client.png` et `r06-courier-admin.png`.

- [x] **R03 — Administrateur : Affecter une commande puis tenter deux affectations concurrentes.**

  Attendu : Un responsable identifié ; conflits explicités ; capacité/disponibilité respectées.

  État vérifié le 2026-10-09 : deux sessions administrateur indépendantes ont tenté deux chauffeurs sur la même livraison. Une requête a réussi et l’autre a reçu un conflit 409 ; les deux sessions ont relu le même responsable final. Un seul événement et une seule tâche de notification ont été créés. Le rejeu vers le gagnant n’a pas ajouté d’historique. La dernière place de capacité a été protégée en concurrence ; le dépassement volontaire a exigé `force` et laissé une trace. Un chauffeur en pause est resté refusé avec et sans `force`. Une entreprise étrangère a reçu 404. Réaffectation et concurrence auto/manuelle ont chacune laissé un seul responsable cohérent.

  Travaux liés : DISPATCH-1 terminé.

  Sources dans le dépôt : src/app/api/deliveries/[id]/assign/route.ts ; src/domains/delivery/delivery.service.ts ; src/features/back-office/assign-driver-select.tsx.

  Preuve : `outputs/dispatch1/connected.json`, client HTTP Node 22 vers le site local, base de test autorisée, données fictives identifiables puis supprimées.

- [x] **R04 — Chauffeur et administrateur : Ouvrir une mission affectée et confirmer sa prise en charge ; simuler indisponibilité/réaffectation.**

  Attendu : Affectation, prise en charge et départ distingués ; responsable et confirmation horodatée communs.

  État vérifié le 2026-10-10, clôture le 2026-10-11 : « En attente de prise en charge » visible avant confirmation ; le chauffeur confirme puis démarre séparément. Même responsable et timestamp ISO dans les espaces client, admin et chauffeur. Double clic : un seul événement, aucun départ implicite. Refus motivé avant/après confirmation remet commande et livraison au dispatch en conservant l'historique. Réaffectation efface l'acceptation active, ancien chauffeur perd l'accès et cartes périmées A → B → A sont refusées. Après départ, refus/retrait/réaffectation bloqués. Anciennes missions commencées sans confirmation restent exploitables sans date inventée.

  Travaux liés : ACK-1 et DISPATCH-1 terminés. DB-1 globale reste ouverte ; migration additive ACK-1 contrôlée sur copie isolée puis appliquée explicitement sur test.

  Sources : src/domains/delivery/acknowledge-delivery-mission.service.ts ; src/domains/delivery/start-delivery-mission.service.ts ; src/features/driver/mission-card.tsx ; src/components/shared/mission-acknowledgement.tsx.

  Preuves : `outputs/ack1/connected-final.json` (26 contrôles connectés et 5 navigateur), captures des trois espaces et rapport `docs/rapports/2026-10-11/ack1.md`. 93 tests locaux et build réussis ; nettoyage fixtures complet. La navigation cartographique a produit une erreur Leaflet suivie dans MAP-1 ; elle n'est pas qualifiée par ce scénario de prise en charge.

- [x] **R05 — Client, admin et chauffeur : Poser une question, répondre puis signaler une instruction modifiée sur la même commande.**

  Attendu : Fil ordonné avec auteur/date ; nouveaux messages signalés ; notes internes cachées au client ; ancien chauffeur sans accès indu après réaffectation.

  État vérifié le 12 octobre 2026 : Question client, instruction/réponse admin et incident chauffeur persistants après rechargement dans les trois espaces. Notes internes réservées au personnel, exclues des corps/compteurs/notifications client et chauffeur. Accès des autres clients/entreprises et de l’ancien chauffeur refusés ; nouveau chauffeur autorisé à l’historique partagé. Doubles envois, notifications, marquage précis, pagination et fin de mission contrôlés.

  Travaux liés : COMM-1 terminée ; SUPPORT-1 conserve son périmètre assistance.

  Sources dans le dépôt : src/components/shared/order-conversation.tsx ; src/domains/order-conversation/order-conversation.service.ts ; src/app/api/order-conversations/[id]/route.ts.

  Preuves : outputs/comm1/connected-final.json (64 contrôles connectés, dont quatre scénarios navigateur), captures des trois espaces, audit-final.json et rapport docs/rapports/2026-10-12/comm1.md. 113 tests locaux et build réussis ; fixtures nettoyées. DB-1 globale et MAP-1 restent ouvertes.

- [x] **R06 — Chauffeur, admin et client : Passer de prise en charge à achat/collecte puis livraison.**

  Attendu : Statuts et chronologie concordent ; changements invalides refusés.

  État final complété le 2026-10-17 : Chrome affiche la prise en charge et le départ, impose collecte puis livraison, exerce les contrôles de proximité serveur sur une position navigateur déterministe et exige une confirmation explicite lorsqu'elle est évaluée hors rayon. Une vraie image PNG est stockée, puis la preuve, les statuts et toute la chronologie sont concordants côté client et administration. Trois contrôles de proximité ont répondu 200, aucune erreur de page n'a été relevée et le nettoyage est complet. Les essais GPS physique restent R07/R08/MOB-01C.

  Travaux liés : TRACK-1, V1-GO.

  Sources dans le dépôt : src/features/driver/mission-card.tsx ; src/domains/delivery/delivery.service.ts ; src/app/(client-portal)/portal/deliveries/[id]/page.tsx.

  Preuves : `outputs/track1/connected-final.json`, `outputs/test2/connected.json`, `outputs/v1-go/browser-operational.json`, captures `r06-courier-client.png` et `r06-courier-admin.png`.

- [ ] **R07 — Admin et client autorisé : Consulter carte pendant une mission, couper le réseau puis refuser le GPS.**

  Attendu : Position datée, perte de fraîcheur explicite ; aucune position inventée ni données d’autres clients.

  État vérifié le 2026-10-13 (TRACK-1) : signal serveur daté, états absent/périmé explicites, expiration réelle sans coordonnées, aucune position fabriquée depuis les destinations, droits A/B prouvés. Services de cartes testés en substitution des cartes globales pour préserver les anciennes données non géocodées. Carte client et positions dispatch testées connectées. R07 reste ouvert : coupure réseau, refus GPS, téléphones et réponses du tracker à qualifier dans MOB-01A/MAP-1/2.

  Complément du 2026-10-14 (MOB-01A) : permission refusée, GPS indisponible, délai dépassé, perte réseau, refus serveur et position périmée ont chacun un état chauffeur visible avec reprise. Le succès exige une confirmation serveur datée. La recette connectée prouve FRESH → STALE sans coordonnées → FRESH et l'arrêt hors service. R07 reste ouvert pour téléphones physiques et recette cartographique MAP-1/2.

  Travaux liés : TRACK-1, MOB-01A, MAP-1/2.

  Sources dans le dépôt : src/features/driver/driver-location-tracker.tsx ; src/domains/delivery/dispatch-map.service.ts.

  Preuve requise : Téléphones réels et erreurs 401/500/hors ligne ; comparaison heure serveur/affichage.

- [ ] **R08 — Chauffeur : Finir la mission et le service, verrouiller puis rouvrir le téléphone.**

  Attendu : Arrêt du suivi hors périmètre et limites de fonctionnement explicites.

  État vérifié le 2026-10-13 (TRACK-1) : service explicite et mission démarrée exigés en API ; fermeture service depuis l’interface propagée au client ; fin mission coupe l’exposition ; publication refusée sans mission active. Courses publication/fin service et publication/fin mission prouvées sur fixtures. R08 reste ouvert : téléphone verrouillé, reprise et GPS physique non validés (MOB-01A/C).

  Complément du 2026-10-14 (MOB-01A) : le navigateur n'observe plus la position hors service ou sans mission démarrée. La fermeture supprime le signal serveur et une publication tardive reçoit 409 ; l'interface affiche l'arrêt. R08 reste ouvert pour verrouillage, arrière-plan et reprise sur iPhone/Android dans MOB-01C.

  Travaux liés : MOB-01A/C, TRACK-1.

  Sources dans le dépôt : src/features/driver/driver-location-tracker.tsx ; src/features/driver/use-driver-live-position.ts.

  Preuve requise : iPhone et Android, observation des envois et de la carte avant/après fermeture de service.

- [x] **R09 — Chauffeur : Clôturer sans photo, avec photo invalide, puis avec preuve valide ; interrompre le réseau pendant l’envoi.**

  Attendu : Refus explicite sans preuve valide ; aucune preuve perdue ni livraison doublée au réessai.

  État final vérifié le 2026-10-16 (POD-1 + MOB-01B) : refus sans photo, PNG tronqué, SVG et fichier de plus de 5 Mo ; preuve valide privée retrouvée par chauffeur, client et administration autorisés, refus interentreprises et anonyme. Une réponse abandonnée après traitement est rejouée sans seconde photo ni double clôture ; conflit différent refusé ; upload concurrent perdant et ancien orphelin supprimés. La photo et l'action sont désormais écrites dans IndexedDB avant envoi, restent identiques après une coupure injectée dans Chrome, puis produisent un seul envoi à la reconnexion et une file vide après succès. Note et motif d'échec conservés. Les appareils physiques relèvent de MOB-01C, pas de ce scénario.

  Travaux liés : POD-1, MOB-01B.

  Sources dans le dépôt : src/app/api/driver/missions/[id]/route.ts ; src/lib/storage/pod.ts.

  Preuve requise : Photo privée accessible aux seuls rôles autorisés ; fichier invalide, limite taille et retry.

- [x] **R10 — Chauffeur et administrateur : Signaler un échec sans motif puis avec motif ; simuler un retard.**

  Attendu : Motif obligatoire, incident visible et action de résolution traçable.

  État final complété le 2026-10-17 : TEST-2 refuse l'échec sans motif. Dans Chrome, le chauffeur sélectionne `ABSENT`, saisit une note et enregistre l'échec ; les écrans client et administration affichent le même statut, le même motif, la même note et la même chronologie. Les libellés du motif et de la note sont reliés explicitement à leurs contrôles. Les captures ont été contrôlées et la fixture supprimée. ALERT-1 prouve séparément le retard visible aux trois rôles, la prise en compte, l'action et la résolution durables sans doublon, ainsi que les droits après réaffectation.

  Travaux liés : ALERT-1 terminée ; V1-GO reste ouverte.

  Sources dans le dépôt : src/domains/operational-alerts/ ; src/components/shared/operational-alerts.tsx ; src/domains/delivery/delivery.service.ts ; src/lib/pod/codes.ts.

  Preuves : `outputs/alert1/connected-final.json`, `outputs/test2/connected.json`, `outputs/v1-go/browser-operational.json`, captures `r10-failure-client.png` et `r10-failure-admin.png`, rapport `docs/rapports/2026-10-12/alert1.md`.

- [x] **R11 — Administrateur et client : Facturer une livraison terminée puis relire statuts et compteurs.**

  Attendu : Facturation séparée de l'état logistique et permission dédiée.

  État vérifié le 2026-10-11, clôture le 2026-10-12 : émission/réémission et paiement conservent mission, commande, responsable, dates, preuve et historique. Compteurs des trois rôles strictement identiques avant/après. Mission active facturée/payée encore clôturable ; facture/clôture chauffeur concurrentes sans écrasement. Rôle commandes seul refusé pour émission et règlement, y compris actions masquées dans l'interface ; entreprise étrangère invisible. Paiement dédié avec conflit de version et rejeu sans nouvelle date. Client consulte toujours facture et PDF.

  Travaux liés : BILL-02 terminé. Préparation de reprise historique documentée et validée sur fixture ; anciens objets intacts. BILL-01A décide la branche export V1 ; BILL-01B qualifie le CSV comptable versionné et les relevés opérationnels, sans émission finale réglementaire. Recette connectée de 1 001 documents A + 1 B, périodes/statuts, décimaux, versions, lecture concurrente cohérente et nettoyage sans résidu ; gardes HTTP qualifiées localement avec sessions substituées. Contrat : `docs/operations/bill01b/README.md`. DB-1 globale reste ouverte.

  Sources : src/domains/invoice/invoice.service.ts ; src/app/api/orders/[id]/invoice/route.ts ; scripts/diagnose-billing-statuses.ts ; docs/operations/bill02/README.md.

  Preuve : outputs/bill02/connected-final.json (72 contrôles), counter-evidence.json (avant/après identiques), captures admin/client/chauffeur, rapport docs/rapports/2026-10-12/bill02.md. 102 tests locaux et build réussis ; fixtures nettoyées. La conformité comptable du PDF n'est pas validée par ce scénario.

- [x] **R12 — Client et administrateur : Retrouver une ancienne commande et sa preuve parmi 1 000 commandes.**

  Attendu : Recherche et export complets dans le périmètre autorisé.

  État vérifié le 14 octobre 2026 : pagination, recherche, statut, type et dates sont exécutés côté serveur dans les écrans admin et client. L'admin A et le client A retrouvent la plus ancienne des 1 000 commandes en page 20 sur 20. Le tri répété est stable ; les exports A contiennent exactement les 1 000 résultats et ceux de B seulement ses 7 commandes.

  Travaux liés : DATA-01.

  Sources dans le dépôt : src/lib/query/order-history.ts ; src/lib/validations/order-history.ts ; src/domains/order/order.service.ts ; src/components/shared/order-history-table.tsx.

  Preuve : outputs/data01/connected-final.json ; rapport docs/rapports/2026-10-14/data01.md. 152 tests et build réussis ; aucune donnée étrangère dans les listes ou exports et empreinte initiale restaurée après nettoyage.

- [x] **R13 — Tous les rôles : Tenter accès aux commandes/messages/PDF/photos d’un autre client ou d’une autre entreprise.**

  Attendu : Refus serveur même avec URL connue ; aucun contenu ou référence révélé.

  Étapes préalables : SEC-01/02 corrigées et testées ; SEC-03 validée localement par services et routes simulés (28 tests totaux), y compris auto-modification et délégation mini-admin refusées. SEC-04 validée localement (39 tests totaux) : suspension et retrait à la requête suivante sur deux instances simulées. SEC-05 : invitations/récupération/confirmation implémentées localement, 52 tests totaux ; paramètres et e-mails réels non validés.

  SEC-06 finalisée le 2026-10-05 : 58 tests locaux réussis. L’accès REST anonyme confirmé a été verrouillé sur les 17 tables : réponses 401, zéro droit direct public et Prisma opérationnel. Matrice connectée 41/41 sur A/B × admin/mini-admin/client/chauffeur : lectures permises en 200, mauvais rôle en 403, ressources et écritures étrangères en 404, PDF/messages/photos contrôlés. URL publique de photo refusée ; lien signé lisible avant expiration puis refusé après. Mini-admin temporaire supprimé de la base et de Supabase Auth. La 18e table métier ajoutée par OPS-02B, `operation_jobs`, a été contrôlée séparément le 2026-10-08 : RLS active, aucun droit public et REST anonyme refusé en 401.

  Travaux liés : SEC-03/04/05/06.

  Sources dans le dépôt : tests/client-data.test.ts ; tests/support.test.ts ; src/lib/api/auth-guard.ts.

  Preuve : tests/tenant-boundaries.test.ts, tests/pod-access.test.ts et docs/rapports/2026-10-01/sec06.md ; résultats connectés archivés dans les outputs de la tâche Codex.

- [ ] **R14 — Nouvel administrateur et équipe fictive : Configurer l’entreprise, inviter client/livreur et réaliser une première livraison.**

  Attendu : Parcours compréhensible, aide disponible ; reprise et diagnostic possibles en cas de panne.

  État constaté : Anciens parcours d’inscription/connexion vérifiés E2E ; nouveau parcours SEC-05 implémenté et testé localement, mais réception e-mail/activation réelle pas encore qualifiées. Restauration et expérience complète sans aide non qualifiées.

  Travaux liés : ONBOARD-1, SEC-05, EMAIL, OPS-03A/B, CI-1.

  Sources dans le dépôt : docs/CADRAGE_CLIENT.md ; docs/rapports/2026-09-27/rapport-tests.md.

  Preuve requise : Chronométrage interne et assistance consignés ; sauvegarde base+photos restaurée sur cible isolée.

## Ordre de traitement

1. Sécurité : SEC-03/04/06 validées ; SEC-05 reste ouverte pour la configuration et la recette e-mail réelles. Poursuivre les tests d’isolation au fil des changements.
2. OPS-02A, OPS-02B, DISPATCH-1 et ACK-1 validées. Confirmation explicitement distincte du départ ; migration additive contrôlée. DB-1 globale reste ouverte. BILL-02 également validée : facture et règlement indépendants des statuts logistiques ; COMM-1 également validée avec R05 ; ALERT-1 également validée pour retards et incidents actionnables ; TRACK-1 également validée pour règles service/API et suivi commun ; POD-1 également validée pour stockage privé, validation serveur, retry et orphelins ; prochaine tâche recommandée DATA-01.
3. Échanges opérationnels liés à la commande et visibilité par rôle : manque fonctionnel principal par rapport à la centralisation recherchée.
4. Cohérence des statuts et facturation, fraîcheur/erreurs du GPS, arrêt hors service et essais terrain. Affichage honnête avant toute promesse de suivi permanent.
5. Recette complète, historique volumique, onboarding et exploitation. Une sauvegarde du code seule ne valide pas la restauration des données du service.

## Mesures et sortie

Pour chaque scénario exécuté, noter version testée, date, appareil/navigateur, réseau, références fictives, résultat et incidents ; mesurer temps de création/affectation, délai d’actualisation du suivi et aide nécessaire. Ces valeurs internes ne sont pas des gains commerciaux prouvés.

V1-MESURE est terminée le 16 octobre 2026 avec cinq scénarios automatisés identiques sur une entreprise fictive isolée. Médianes techniques : création commande/livraison 3 775,4 ms, affectation 3 039 ms, question client 2 105,3 ms, réponse dispatch 2 108,3 ms, relecture du fil 1 260,3 ms, lecture statut/position client 644,2 ms et administration 629,3 ms. Mac M1, Node 22.18.0, services locaux vers PostgreSQL Supabase distant de test, connexion non bridée, aucun téléphone ; zéro résidu. Protocole : `docs/operations/v1-mesure/README.md`. Preuve : `outputs/v1-mesure/internal-baseline.json`. La mesure humaine avec aide observée reste à réaliser dans V1-GO/MOB-01C.

V1-RECETTE correspond à l’établissement de cette checklist et de ses écarts. V1-GO correspond à son exécution complète réussie. Ne pas cocher V1-GO ni les tâches fonctionnelles sur la seule rédaction de ce document.
