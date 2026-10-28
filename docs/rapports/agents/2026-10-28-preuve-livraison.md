# Preuve de livraison complète (POD-2) — rapport de l'agent

Branche `agent/preuve-livraison`, base `9234600` (preproduction). Le worktree avait d'abord été créé sur un ancien commit (`af61494`) ; la branche a été réalignée sur `preproduction` avant tout travail.

## Livré

| # | Livrable | Points clés |
|---|---|---|
| 2 | Photos sans EXIF, URL à la demande | `src/lib/storage/pod-image.ts` (sharp : rotation appliquée aux pixels, aucune métadonnée, JPEG/PNG conservés). URL signées ramenées à 300 s. Plus aucune URL Storage dans les réponses d'API : liens internes `…/proof/photo|signature|pdf` qui signent au clic. |
| 1 | Signature à l'écran | `signature-pad.tsx` (canvas tactile, « Effacer »), nom du réceptionnaire, refus de signer motivé. PNG validé (octets, 40–1600 x 40–800 px, 300 Ko), aplati sur blanc, stocké dans `delivery-pods` sous `companyId/deliveryId-sig-…png`. Hors ligne : la signature voyage dans la file IndexedDB existante. Règle par entreprise `settings.proofRules.signatureRequired` (défaut : facultative) ; `GET/PATCH /api/company/proof-rules`, `GET /api/driver/proof-rules`. |
| 3 | PDF de preuve | `src/lib/pdf/proof-pdf.ts` + `proof.service.ts`. Routes back-office `/api/deliveries/[id]/proof/[kind]` et portail `/api/portal/deliveries/[id]/proof/[kind]` (entreprise et client de la session). Le nom du livreur n'y figure volontairement pas. |
| 4 | Envoi au donneur d'ordre | Réutilise la tâche durable `CLIENT_NOTIFICATION` : l'e-mail livrée/échec porte le lien du portail, même clé d'idempotence qu'avant ; `proofRules.emailToClient=false` retire seulement le lien de preuve (l'e-mail de statut part toujours) ; rien n'est envoyé si l'e-mail n'est pas configuré, la notification dans l'application reste. |
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

## Corrections après relecture (2026-10-28)

- Migration renommée `20261028120000_pod_signature`.
- Plus aucun chemin Storage dans les réponses d'API (`omitStoragePaths`, test d'inventaire des routes).
- Photo ou signature illisible au ré-encodage : 400/413 non relançable (plus de 502).
- `PATCH /api/company/proof-rules` partiel, fusion SQL ciblée (`jsonb_set`), sans écraser les autres réglages.
- Lien PDF seulement si `podOutcome` existe ; rejeux idempotents évalués avant les règles de l'entreprise.
- Canevas : `ResizeObserver`, coordonnées indépendantes de l'animation, export bloqué si vide ou trop petit.
- Taille de la photo contrôlée après ré-encodage (repli JPEG) ; archive DATA-02 : plafonds distincts, `kind`, `photoCount`, `signatureCount` au manifeste.
- PDF reproductible (horodatage = date de la preuve) ; helpers de stockage uniques.
- Revue `security-review` (sous-agent) : aucune vulnérabilité de confiance élevée. Remarque hors périmètre : `getClientDeliveryById` renvoie déjà le livreur (nom, téléphone) au portail.

## Checklist de preuves

1. **Skills invoqués** (via l'outil Skill) : `tutelliv-model-router`, `superpowers:test-driven-development`, `karpathy-guidelines`, `security-review`, `superpowers:verification-before-completion`. Revue de sécurité exécutée par un sous-agent Sonnet en lecture seule sur le diff `src` et `prisma` : aucune vulnérabilité de confiance élevée.

2. **Test rouge puis vert, par point**

| Point | Rouge puis vert |
|---|---|
| Photos sans EXIF (9e0e165) | Test et code écrits ensemble, pas de rouge préalable. |
| Signature à l'écran (fbfd90f) | Test et code écrits ensemble, pas de rouge préalable. |
| PDF et routes de preuve (c7ed8ba) | Code écrit avant les tests. Mutation : sans le filtre `customerId`, `pod-proof-pdf` passe à 1 échec, puis vert une fois restauré. |
| Envoi au donneur d'ordre (27b590b) | 2 échecs puis 8 verts (`notification-idempotency`). |
| Relevés par coursier (83ee43a) | Module absent, puis 7 verts (`courier-statement`). |
| Export, archive, purge démo (8646c1c) | 4 échecs puis 18 verts ; purge démo : 1 échec puis vert. |
| Chemins Storage absents des réponses (991c4c7) | 3 échecs puis vert (`pod-storage-path-leak`). |
| 400/413 non relançable au ré-encodage (879ce40) | 1 échec puis vert (`pod-access`). |
| `emailToClient=false` retire seulement le lien (75a1483) | 1 échec puis vert. |
| PATCH partiel par fusion SQL (09de324) | 3 échecs puis 4 verts (`proof-settings`). |
| Lien PDF si preuve (13f8685) | 1 échec puis vert. |
| Canevas de signature (52c9974) | Module absent, puis 4 verts (`signature-geometry`). |
| Rejeux avant règles (ad35d08) | 1 échec puis vert. |
| Taille photo après ré-encodage (a5f41f4) | 4 échecs puis 4 verts (`pod-photo-size`). |
| Plafonds d'archive et `kind` (0a92d82) | 2 échecs puis verts. |
| PDF reproductible (59919a9) | 2 échecs puis verts. |
| Helpers uniques (31202bb) | Refactor couvert par les tests existants, vert avant et après. |

3. **États voisins testés** : signature absente alors que requise, refus de signer motivé et sans motif, signature et refus ensemble, signature sans nom, signature sur un échec ; livraison en échec (PDF sans bloc de réception) ; double envoi (replay sans second stockage, autre nom en 409, rejeu après changement de règle) ; reprise hors ligne (photo, signature et nom dans la file IndexedDB, un seul envoi) ; livreur réaffecté (404 sans stockage) ; autre entreprise et autre client de la même entreprise (404 sur PDF, photo, signature) ; photos PNG et JPEG avec EXIF et GPS, octets corrompus ; fichier trop gros (413) ou type invalide (SVG, 400) ; e-mail coupé par l'entreprise ou URL d'application absente ; rôles des relevés (admin, mini-admin, dispatcher autorisés ; livreur et client refusés) ; `companyId` de l'URL ignoré.

4. **`npm run check` final** : exit 0, 800 tests, 800 réussis, 0 échec, le 2026-10-28, lancé après le SHA `31202bb` (dernier commit de code), via `lourd.sh`. Le commit `d2b8924` (rapport) n'a modifié que de la doc ; la même commande a été relancée après lui avec le même résultat (800/800).

5. **SHA des commits** : 9e0e165, fbfd90f, c7ed8ba, 27b590b, 83ee43a, 8646c1c, 084a31a, 0d05a80, 991c4c7, 879ce40, 75a1483, 09de324, 13f8685, 52c9974, ad35d08, a5f41f4, 0a92d82, 59919a9, 31202bb, d2b8924.

6. **Périmètre** : `git diff --stat preproduction...HEAD | tail -1` donne `76 files changed, 2902 insertions(+), 127 deletions(-)` (mesuré sur la branche après intégration des autres chantiers).

7. **Non vérifié** : navigateur ; téléphone réel et tactile du canevas ; mode avion réel ; e-mail réel ; téléchargement du PDF dans un vrai navigateur ; `tests/e2e/pod-proof.spec.ts` écrit mais non lancé (parcours de signature en `test.fixme`) ; migration `20261028120000_pod_signature` non appliquée.

8. **Auto-relecture** : j'ai retiré le nom du livreur du PDF et ajouté un test ; remplacé les variables inutilisées par `withoutSignaturePath` ; simplifié la validation du dialogue. La relecture de l'orchestrateur a ensuite fait corriger les dix points ci-dessus. Remarque hors périmètre : `getClientDeliveryById` renvoie déjà le nom et le téléphone du livreur au portail (comportement antérieur à cette branche), ce qui contredit l'intention CNIL de ne pas le transmettre au donneur d'ordre ; à traiter séparément.
