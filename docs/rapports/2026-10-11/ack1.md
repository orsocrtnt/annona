# ACK-1 — prise en charge explicite

Clôture documentaire : 11 octobre 2026. Implémentation et recette exécutées les 9–10 octobre. ACK-1 et R04 validées ; DB-1 globale et MAP-1 restent ouvertes.

## Résultat

Une affectation ne vaut plus confirmation. La mission ASSIGNED affiche « En attente de prise en charge ». Le chauffeur assigné confirme explicitement, ce qui écrit `missionAcceptedAt` et un événement atomiquement, sans démarrer la mission. Admin, client et chauffeur voient le même responsable et le même horodatage. Le départ demeure une action distincte et exige la confirmation.

Le chauffeur peut refuser avant le départ avec motif : commande et livraison reviennent au dispatch dans la même transaction, l'acceptation active est effacée et l'historique garde le responsable et le motif. Une réaffectation efface aussi l'acceptation précédente. Après départ, refus/retrait/réaffectation restent interdits. Les anciennes missions commencées sans acceptation enregistrée restent exploitables, sans date inventée.

Les mises à jour comparent la version de la mission pour refuser cartes périmées et cycles A → B → A. Un double clic crée une seule acceptation et un seul événement. Le libre choix ne peut plus remplacer une affectation intervenue entre-temps (`expectUnassigned`) ; l'auto-dispatch traite cette perte de concurrence comme une issue terminale normale.

## Base

Ajout SQL explicite et versionné de `mission_accepted_at timestamp(3)` nullable, sans défaut ni backfill : `docs/operations/ack1/apply.sql`. Vérification sur copie locale PostgreSQL 15.14 de 32 livraisons, export/restauration identiques, puis application explicite sur la cible de test PostgreSQL 17.6. Aucun reset ou synchronisation implicite.

Le contrôle final retrouve les 32 lignes initiales strictement identiques et préserve deux lignes supplémentaires préexistantes aux essais de reprise. RLS active, zéro privilège public, 7 anciennes missions commencées et zéro acceptation fabriquée. Le retour applicatif consiste à conserver la colonne additive et revenir au code précédent ; il ne supprime aucune confirmation. Cette copie ciblée ne valide pas une restauration globale avec toutes les relations, politiques et photos : DB-1 et ENV-1 restent ouvertes.

## Validation

- `npm run check` : 93/93 tests réussis, dont 12 ACK ; types valides, lint sans erreur et 24 avertissements historiques.
- `npm run build` : réussi sur la version testée.
- Recette connectée : 26 contrôles réussis (affectation, confirmation, refus, réaffectation, frontières d'accès, cartes périmées, concurrence et compatibilité historique).
- Chrome sur site local : 5/5 scénarios réussis (attente explicite, double clic et date commune aux trois espaces, refus, réaffectation, départ après nouvelle confirmation).
- Nettoyage contrôlé : zéro commande, livraison, événement, chauffeur, job ou notification de ces fixtures.

Les premières exécutions ont exposé deux attentes de test trop restrictives : un départ après perte d'affectation peut rendre 404, et « Naviguer » est un lien. Les attentes ont été corrigées à partir de l'état et de l'historique observés ; la partie navigateur a ensuite été rejouée avec succès. Les fichiers des essais précédents sont conservés comme preuves historiques et ne servent pas de résultat final.

## Preuves

Dans les outputs de la session Codex : `outputs/ack1/connected-final.json` agrège 26 contrôles API et 5 navigateur, avec leurs sources `connected-api-browser-partial.json` et `connected-browser.json`. Logs : `check.log`, `targeted.log`, `build.log`. Migration : `db-preflight.json`, `db-isolated.json`, `db-final.json`, `db-apply.log`. Captures : `driver-waiting.png`, `driver-accepted.png`, `driver-started.png`, `driver-declined.png`, `admin-waiting.png`, `admin-accepted.png`, `admin-declined.png`, `client-accepted.png`.

## Fichiers principaux

Schéma Prisma et scripts `docs/operations/ack1/` ; service `acknowledge-delivery-mission.service.ts`, démarrage, affectation et auto-dispatch ; route chauffeur `missions/[id]/acknowledgement` ; API/hooks/types chauffeur ; carte mission et composant partagé `mission-acknowledgement.tsx` ; affichage admin/client ; tests `mission-acknowledgement.test.ts`.

## Limites et suite

Le parcours de prise en charge est validé. L'erreur Leaflet `window is not defined` a été reproduite au préchargement de `/driver/navigate/[id]` et reste à traiter dans MAP-1 ; l'ouverture et l'usage de la carte ne sont pas qualifiés par ACK-1. Aucun essai GPS terrain ni envoi e-mail n'est revendiqué. Aucun déploiement effectué. Prochaine tâche recommandée : BILL-02, pour préserver l'état logistique lors de la facturation.
