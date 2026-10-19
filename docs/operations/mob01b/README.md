# MOB-01B — reprise des actions chauffeur

## Comportement livré

Les changements de statut chauffeur et les clôtures avec preuve sont enregistrés dans IndexedDB avant le premier envoi. Une entrée contient l'identité du chauffeur, la mission, le statut, les prix éventuels, la décision de proximité, les coordonnées déjà utilisées et la preuve compressée. Une seule action peut attendre par mission.

Si le navigateur est hors ligne, si `fetch` est interrompu, ou si le serveur répond 408, 425, 429 ou 5xx, l'entrée reste locale. Elle est retentée à la reconnexion et selon une reprise bornée à 5 s, 30 s, 2 min puis 5 min. Une réponse métier 4xx reste visible comme action refusée ; le chauffeur peut la retenter explicitement ou la retirer pour corriger la mission.

Le bandeau chauffeur et la carte de mission distinguent envoi, attente et refus. Les boutons de la mission sont bloqués pendant qu'une action existe, ce qui empêche une seconde validation avec un autre contenu.

## Garantie serveur

La clôture avec preuve accepte déjà le rejeu sémantiquement identique sans nouvel upload ni nouvelle transition. MOB-01B étend cette garantie aux paliers `PURCHASING` et `IN_DELIVERY` : si la transaction a réussi mais que la réponse a été perdue, le rejeu rend la mission courante sans créer un deuxième événement ou une deuxième notification. Un état plus avancé ou un contenu terminal différent reste un conflit.

## Vérification reproductible

```text
npm run check
npm run build
```

Les tests `tests/driver-offline-actions.test.ts` et `tests/pod-access.test.ts` couvrent : conservation du Blob, coupure et reprise, refus durable, unicité par mission, classification d'une panne `fetch`, rejeu d'un palier et rejeu de clôture après réponse perdue.

La preuve `outputs/mob01b/browser-indexeddb.json` vient d'un profil Chrome temporaire qui exécute le module réel : photo écrite dans IndexedDB, échec réseau injecté, relecture octet par octet, reconnexion, un envoi et file vide après succès.

## Limites

- IndexedDB appartient au navigateur et à l'appareil. Effacer les données du site avant synchronisation efface aussi l'action et sa photo.
- La file est isolée par identifiant chauffeur. Une action conservée ne part que lorsque le même compte revient.
- Le travail en arrière-plan quand le navigateur est entièrement fermé dépend du système ; la reprise démarre à la prochaine ouverture ou à l'événement `online`.
- Les essais avec de vrais iPhone/Android, écran verrouillé et changement d'application restent dans MOB-01C.
