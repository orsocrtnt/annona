# BILL-02 — séparer livraison et facturation

Recette : 11 octobre 2026. Clôture et vérification documentaire : 12 octobre 2026. BILL-02 et R11 validées.

## Résultat

Émettre ou régler une facture ne modifie plus les états, dates, responsable, preuve ou historique de la commande/livraison. La facture conserve son propre statut (`PENDING`, `PAID`) et sa date de paiement. L'interface affiche séparément « Livré » et « Facture émise/Payée » ; le règlement possède une action dédiée.

L'émission exige `invoices:create`, le règlement `invoices:update`. Les routes et services de changement logistique refusent `INVOICED` et `PAID`, retirés des choix de statut modifiable. Les anciennes valeurs restent lisibles pour compatibilité. Le règlement compare la version de facture attendue, refuse les versions périmées et ne change pas `paidAt` en cas de rejeu. Un verrou de commande sérialise les opérations facture/règlement ; clôture chauffeur et facturation concurrentes conservent chacune leur état.

Les périodes de statistiques de livraison utilisent la date métier de clôture. Le générateur démo conserve également un statut logistique, sans recréer une commande `PAID`. Aucun changement de schéma ni migration.

## Validation

- `npm run check` final : 102/102 tests réussis, types valides, lint sans erreur, 24 avertissements historiques. Aucun code modifié après ce contrôle.
- `npm run build` final : réussi après la dernière correction du générateur démo.
- 51 contrôles API : droits dédiés, frontières d'entreprise, émission/réémission, paiement/rejeu, rejet des statuts comptables génériques, états/historique/dates et compteurs des trois rôles.
- 15 contrôles navigateur/reprise : émission et paiement affichés séparément de Livré, paiement via bouton Chrome, compteurs client/chauffeur/admin stables, rôle commandes sans actions, facture et PDF accessibles au client, reprise d'une donnée fictive.
- 6 contrôles de poursuite/concurrence : facturer/régler une mission active ne bloque pas sa clôture ; émission et clôture chauffeur simultanées sans écrasement ni faux événement logistique.
- Nettoyage : zéro commande, facture, job, notification ou mini-admin résiduel de ces essais ; les anciens objets contrôlés sont inchangés.

`outputs/bill02/connected-final.json` agrège ces 72 contrôles et cite les catégories. `counter-evidence.json` contient deux relevés strictement identiques avant/après émission et règlement, avec une livraison terminée et une active. Captures : `admin-invoiced.png`, `admin-paid.png`, `client-delivered.png`, `driver-count.png`. Logs : `check.log`, `build.log`, `connected-run.log`, `browser-run.log`, `concurrency-run.log`.

Un premier essai a échoué à ouvrir Chrome dans la sandbox après réussite des 51 contrôles API. Les contrôles navigateur ont été rejoués avec autorisation et ont réussi. Un délai de transaction d'authentification a aussi nécessité des connexions séquentielles et le pooler session pour les essais, sans modifier `.env.local` ni la cible. Ces essais intermédiaires restent archivés ; le résultat final est `connected-final.json`.

## Reprise historique

Diagnostic en lecture seule : deux commandes ont un état comptable ancien, dont une livraison `INVOICED` avec une clôture datée et une preuve de succès. Le diagnostic prépare une proposition `DELIVERED` en conservant la date métier ; rien n'est appliqué aux données préexistantes. L'autre livraison est déjà `DELIVERED` mais sa commande reste `PAID`. Toute reprise doit comparer historique, preuve, dates et ensemble des livraisons de la commande, puis être validée explicitement.

Outil livré : `scripts/diagnose-billing-statuses.ts` et `src/domains/invoice/legacy-billing-recovery.ts`. Procédure : `docs/operations/bill02/README.md`. La reprise avec conservation de date a été testée uniquement sur une nouvelle fixture puis nettoyée. Sources : `historical-diagnostic.json`, `recovery-proposals.json`, contrôles de reprise dans `connected-browser.json`.

## Fichiers principaux

Service facture ; route `api/orders/[id]/invoice` ; validations facture/commande/livraison ; services commande/livraison ; formulaires et sélecteurs admin ; permissions de la page commande ; constantes de statuts ; statistiques par période ; scénario démo ; outil de diagnostic et tests BILL-02.

## Limites et suite

Les données historiques détectées peuvent encore afficher les anciens états tant que leur reprise n'est pas autorisée ; cette tâche prépare leur correction sans prétendre l'avoir appliquée. Les critères de BILL-02 sont validés sur nouveaux cycles et fixtures. La conformité comptable des documents, calculs avancés, numérotation et avoirs restent dans BILL-01A/B. DB-1 globale, ENV-1 et le défaut Leaflet MAP-1 restent ouverts. Aucun envoi réel, migration, push ou déploiement. Prochaine tâche recommandée : COMM-1, échanges opérationnels par commande.
