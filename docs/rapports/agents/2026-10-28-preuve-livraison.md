# Preuve de livraison complète (POD-2) — rapport de l'agent

Branche `agent/preuve-livraison`, base `9234600` (preproduction). Le worktree avait d'abord été créé sur un ancien commit (`af61494`) ; la branche a été réalignée sur `preproduction` avant tout travail.

## Livré

| # | Livrable | Points clés |
|---|---|---|
| 2 | Photos sans EXIF, URL à la demande | `src/lib/storage/pod-image.ts` (sharp : rotation appliquée aux pixels, aucune métadonnée, JPEG/PNG conservés). URL signées ramenées à 300 s. Plus aucune URL Storage dans les réponses d'API : liens internes `…/proof/photo|signature|pdf` qui signent au clic. |
| 1 | Signature à l'écran | `signature-pad.tsx` (canvas tactile, « Effacer »), nom du réceptionnaire, refus de signer motivé. PNG validé (octets, 40–1600 x 40–800 px, 300 Ko), aplati sur blanc, stocké dans `delivery-pods` sous `companyId/deliveryId-sig-…png`. Hors ligne : la signature voyage dans la file IndexedDB existante. Règle par entreprise `settings.proofRules.signatureRequired` (défaut : facultative) ; `GET/PATCH /api/company/proof-rules`, `GET /api/driver/proof-rules`. |
| 3 | PDF de preuve | `src/lib/pdf/proof-pdf.ts` + `proof.service.ts`. Routes back-office `/api/deliveries/[id]/proof/[kind]` et portail `/api/portal/deliveries/[id]/proof/[kind]` (entreprise et client de la session). Le nom du livreur n'y figure volontairement pas. |
| 4 | Envoi au donneur d'ordre | Réutilise la tâche durable `CLIENT_NOTIFICATION` : l'e-mail livrée/échec porte le lien du portail, même clé d'idempotence qu'avant ; coupable via `proofRules.emailToClient` ; rien n'est envoyé si l'e-mail n'est pas configuré, la notification dans l'application reste. |
| 5 | Relevés par coursier | `GET /api/back-office/courier-statements?from&to[&driverId][&format=csv]`, permission `drivers:read` (admin, mini-admin, dispatcher) : aucune nouvelle permission, donc aucun seed. Pas de page : export CSV (BOM, `;`, formules neutralisées) et JSON. |
| 6 | Conservation | Export DATA-02 : manifeste des signatures (`kind: "signature"`). Archive : téléchargement et SHA256 des signatures. Purge démo : une signature bloque comme la photo. Durée documentée dans `docs/DATABASE.md` (aucune durée validée, aucun purgeur général). |

## À faire par le propriétaire

- Appliquer la migration `prisma/migrations/20261028120000_pod_signature/migration.sql` (colonnes nullables sur `deliveries`, table déjà sous RLS). Non appliquée.
- Aucun bucket à créer : la signature réutilise `delivery-pods`.
- Recette navigateur et téléphone réel (canvas tactile, hors ligne, PDF) : non faite. Spec `tests/e2e/pod-proof.spec.ts` écrite, non lancée.

## Limites connues

- Les règles de signature requise et d'e-mail ne sont pas encore pilotables depuis l'interface (API seulement).
- Hors ligne, si la règle « signature requise » n'a jamais été chargée, le livreur peut enregistrer sans ; le serveur refuse alors à la reprise (action en échec visible).
- Les listes qui renvoient une ligne de livraison brute peuvent exposer le chemin Storage de la signature (clé interne d'un bucket privé, sans lien) ; non exploitable mais à nettoyer avec le reste.
- La position enregistrée est la dernière position connue du livreur : donnée de géolocalisation à aligner sur la décision GPS avant données réelles.
