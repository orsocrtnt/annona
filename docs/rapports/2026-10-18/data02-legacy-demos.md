# DATA-02 — fermeture et inventaire des anciennes sessions démo

18 octobre 2026. Cette tranche corrige l'accès aux anciennes démos et qualifie leur état en lecture seule. Elle ne modifie ni ne supprime aucune entreprise, commande, preuve, identité Auth ou ressource Storage.

## Défaut corrigé

Les nouvelles démos ont une échéance serveur exacte de huit heures. Les 51 sessions créées avant cette règle n'en ont pas. Le nettoyeur les refusait déjà, mais le parcours d'accès considérait encore l'absence d'échéance comme une session réutilisable. Un ancien cookie pouvait donc rouvrir indéfiniment une ancienne démo.

L'accès est maintenant fermé si la session ne possède pas le marqueur de rétention exact ou si son échéance est dépassée. L'appel direct, la résolution de persona et la réutilisation au login appliquent la même règle. À la prochaine connexion démo, un ancien cookie n'est pas réutilisé et une nouvelle session bornée est créée. Les données legacy restent intactes.

## Inventaire connecté

La commande `npm run data02:demo-legacy-inventory` inspecte au maximum 1 000 candidates par ancienneté et écrit uniquement des compteurs dans `outputs/data02/demo-legacy-inventory.json`. Aucun identifiant, e-mail, chemin ou contenu métier n'est publié.

Résultat sur la base de test autorisée :

- 51 candidates inspectées, aucun reliquat ;
- 51 ont `demoSession=true` et manquent uniquement `demoRetention` parmi les marqueurs examinés ;
- 51 ont le roster synthétique exact et le statut actif ;
- aucune référence DB de logo, avatar, photo POD ou PDF ;
- aucun job `PENDING` ou `PROCESSING` ;
- les 51 possèdent un graphe métier, attendu pour une démo construite ;
- aucun objet dans les 51 dossiers Storage, aucune indisponibilité ni expiration de sonde ;
- aucune référence interentreprises dans les relations contrôlées par le nettoyeur ;
- zéro mutation et zéro identifiant divulgué.

Ces résultats classent les 51 graphes comme techniquement cohérents avec les anciennes sessions synthétiques. Ils ne constituent pas une autorisation de suppression : l'échéance et la règle de conservation n'étaient pas persistées lors de leur création. Aucune échéance n'est rétrodatée à partir de `createdAt`, car cette transformation changerait leur statut après coup.

## Fichiers

- `src/domains/demo/demo-session.service.ts` : refus fermé d'une échéance absente ou expirée.
- `src/domains/data-lifecycle/demo-legacy-inventory.service.ts` : agrégation bornée sans identifiant.
- `scripts/data02/inventory-legacy-demos.ts` : commande de lecture et preuve nettoyée.
- `tests/demo-retention.test.ts` et `tests/demo-legacy-inventory.test.ts` : accès legacy, classifications, limites et non-divulgation.

## Validation

- 17 tests ciblés DATA-02 réussis.
- Suite complète : 275/275 tests, TypeScript et lint strict réussis.
- Inventaire connecté approfondi : 51 graphes et dossiers Storage, zéro mutation, zéro identifiant dans la preuve.
- Build de production isolé réussi : 102 pages, sans `.env.local` et sans toucher au serveur de l'utilisateur.
- Documentation : 57 fichiers, zéro lien/commande/variable manquant ; TODO et ses deux copies synchronisées.
- Scanner : 867 fichiers, zéro secret détecté. `git diff --check` réussi.

## Suite sûre

La qualification technique en lecture seule est terminée. Toute adoption ou suppression des 51 anciennes sessions exige maintenant une décision explicite ; aucune action automatique n'est justifiée par l'inventaire. DATA-02 reste ouverte pour cette décision, les sauvegardes, Auth/Storage, la restauration, la politique légale et l'activation observée du planificateur.
