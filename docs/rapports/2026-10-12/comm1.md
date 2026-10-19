# COMM-1 — échanges opérationnels centralisés

Clôturée le 12 octobre 2026. Un fil dédié relie une commande au client propriétaire, au personnel habilité de son entreprise et au chauffeur actuellement affecté. Questions, instructions, modifications et incidents portent un auteur et une date ; les notes internes sont réservées au personnel. Le support conserve son rôle d’assistance distinct.

## Comportement livré

- Fil dans les détails de commande client/admin et dans les cartes de mission chauffeur, avec accès depuis un bandeau de nouveaux échanges dans les trois espaces.
- Notifications internes persistantes via OPS-02B, sans e-mail requis ni contenu du message dans la notification ou la tâche. L’ancienne cloche et son marquage/nettoyage excluent ces notifications.
- Lecture/écriture limitée au client propriétaire et à l’entreprise ; notes absentes des messages, compteurs et notifications client/chauffeur. Permissions mini-admin filtrées ; écriture du personnel soumise à permission.
- Réaffectation : ancien chauffeur refusé à la lecture, publication, marquage et rejeu ; notifications historiques filtrées selon les droits actuels. Nouveau chauffeur autorisé à l’historique partagé.
- Clé de tentative unique, transaction message/tâche, verrous de commande/livraison et reprises bornées. Pagination de 50 messages par date/identifiant. Marquage sur le dernier message réellement vu, sans recul du curseur ni consommation d’un message arrivé ensuite.
- Historique en lecture seule après fin des missions ou annulation. Une facture payée ne ferme pas une mission encore active. Les catégories « modification » et « incident » ne changent pas automatiquement le statut ou les instructions métier.

## Validation

`npm run check` final réussi : types, lint sans erreur (24 avertissements historiques), **113/113 tests**, dont 11 dédiés aux échanges. Build production réussi ; aucun code applicatif changé après ce build. `git diff --check` réussi. Site local : `/login` répond 200 sur le port 3106.

**64/64 contrôles connectés** sur la base de test autorisée : 38 contrôles initiaux puis 26 restants, dont quatre scénarios navigateur. Frontières de deux entreprises, autre client et chauffeur non affecté ; validation des messages ; double envoi simultané et double clic réel (1 message enregistré) ; notes internes et notifications ; watermark avec nouvel envoi ; rejeu du worker ; aller-retour client/admin/chauffeur persistant après rechargement ; réaffectation et course envoi/réaffectation ; 55 messages avec dates égales, pagination exhaustive sans doublon ; clôture trois rôles ; REST anonyme refusé sur les deux nouvelles tables.

Le premier lancement Chrome a été bloqué par la sandbox. Un premier essai navigateur attendait le texte de la saisie avant la fin du POST ; le harnais a été corrigé pour attendre l’article du fil et enregistrer le compteur. La reprise ciblée a réussi. Ces tentatives restent dans les preuves, sans être présentées comme des défauts applicatifs résolus.

Preuves dans le dossier Codex : `outputs/comm1/connected-final.json`, `connected.json`, `connected-remaining.json`, `audit-final.json`, `check-final.log`, `tests-targeted.log`, `build.log` et captures `client-thread.png`, `admin-thread.png`, `driver-thread.png`. Harnais conservés dans `work/comm1` ; ils utilisent des identifiants locaux privés et ne constituent pas encore une suite CI autonome (TEST-2 reste ouverte).

## Base et nettoyage

Migration additive ciblée `docs/operations/comm1/apply.sql` : `order_messages`, `order_thread_reads` et lien nullable depuis les notifications. Copie isolée des trois tables parentes, application, export/restauration puis application explicite à la cible de test PostgreSQL 17.6. Données parentes identiques lors de l’application, RLS actives, aucun grant PUBLIC/anon/authenticated. Procédure et retour applicatif conservant les données : `docs/operations/comm1/README.md` et `rollback.sql`.

Nettoyage des fixtures, tâches, notifications, lectures, utilisateurs et comptes Auth effectué par les harnais. Audit final : 34 commandes, 30 utilisateurs et 12 notifications comme avant ; commandes préexistantes identiques par empreinte ; nouvelles tables vides ; zéro commande/utilisateur/tâche COMM1 résiduel. Les compteurs ne prétendent pas prouver l’immutabilité de chaque champ utilisateur, notamment les connexions de test.

## Limites et suite

La restauration isolée porte sur les trois tables parentes et les nouveaux objets, pas sur le service complet : DB-1 et OPS-03A restent ouvertes. Actualisation toutes les dix secondes ; une réaffectation ne peut effacer des données déjà affichées avant révocation. Pas de pièces jointes, chat temps réel ou envoi d’e-mails ajouté. L’erreur Leaflet `window is not defined` au préchargement chauffeur reste suivie dans MAP-1 ; elle n’a pas empêché la recette du fil.

COMM-1 et R05 sont cochées. Aucune publication, aucun push ni déploiement. Prochaine tâche : ALERT-1.
