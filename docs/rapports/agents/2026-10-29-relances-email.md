# Rapport agent relances e-mail (Codex C5) — 29 octobre 2026

Branche `agent/relances-email`, base 4a99b6b. Ni migration, ni reprise de données, ni push, ni envoi Resend réel.

## Issues (`src/lib/email/transactional-email.ts`, `name` du corps lu)

Sources : [idempotence Resend](https://resend.com/docs/dashboard/emails/idempotency-keys) (clé gardée 24 h), [erreurs API](https://resend.com/docs/api-reference/errors).

| HTTP + `name` | Issue | Relance |
|---|---|---|
| 2xx | sent | SENT |
| 400, 401, 403, 404, 405, 422, 429 | rejected | 1re tentative : QUEUED ; reprise : SENDING |
| 409 `concurrent_idempotent_requests`, autre 409, 5xx, code inconnu, expiration, réseau | unknown | SENDING, reprise même clé + même contenu |
| 409 `invalid_idempotent_request` | unconfirmed, permanente | SEND_UNCONFIRMED (peut-être déjà parti) |
| reprise ≥ 23 h après la fenêtre | unconfirmed, aucun appel | SEND_UNCONFIRMED |

- Contenu gelé à la création de la relance ; anti-doublon compté depuis l'envoi.
- Une relance QUEUED dont la tâche a déjà tourné est traitée comme une reprise. Si sa tâche est épuisée, elle est affichée non confirmée et bloque « Relancer », sauf erreur prouvant l'absence d'appel au fournisseur.
- Admin : libellé « Envoi non confirmé… vérifiez avant de relancer », identique dans la liste et au clic. La tâche passe FAILED avec un `lastError` explicite. « Relancer » suit exactement la règle du serveur.

## Appelants (`replayWindowStart` obligatoire)

- `invoice-reminder.service.ts` (`deliverInvoiceReminderJob`) : `null` à la première tentative, création de la relance pour une reprise.
- `notify.service.ts` (livraison, acceptation, facture émise) et `signup.service.ts` (bienvenue) : `jobEmailReplayWindow` (`operation-job.service.ts`). Il inscrit la première tentative émise dans le payload. Une tâche déjà exécutée sans marqueur (héritée) prend sa date de création.
- ORDER_MESSAGE n'envoie pas d'e-mail ; l'authentification passe par Supabase.

## Autres correctifs

- Tâche reportée sans perte d'essai ; la prise d'une tâche vérifie son échéance.
- Limiteur de connexion. Défaut réel trouvé par le test PostgreSQL : 10 connexions autorisées sur 12, limite 5. Désormais, attente de verrou bornée à 2 s. Une contention répond 503 « Service momentanément occupé… », `Retry-After: 5`.

## Tests (`node:test`, dans `npm run check`)

- E-mail : table des 17 cas.
- Relances : fournisseur simulé au contrat Resend ; 200, 400, 409×2, 422, 429, 500, expiration ; double clic, reprise à 6 min après minuit à Paris puis à +20 h, dépassement de 23 h.
- Transition : relance QUEUED héritée → 409 → aucun second e-mail.
- Tâches notify et bienvenue : fenêtre et tâches héritées.
- Affichage, liste, prise de tâche, route 503.

## PostgreSQL réel : `npm run test:pg-locks` (tutelliv-dev, pool 5)

```
a  10 clics → 1 relance ; 10 tâches → 1 envoi
a3 issue inconnue → SENDING ; 10 clics → 0 ; 10 reprises → 1 envoi, 1 clé
b  10 requêtes, 2 clients, même clé → 1 commande (5 created, 5 conflict)
c  12 connexions → 4 autorisées, 8 refusées par contention, 0 par limite, 0 fail-open
d  10 inscriptions de première tentative → 1 seule
passed: true ; aucune donnée E2E restante
```

## Contre-revues adverses (Opus)

Trois passes ; leurs constats sont corrigés, à l'exception des limites ci-dessous.

## Limites

- Aucun envoi Resend réel ; corps `{name}` d'après la documentation.
- Relance héritée terminée par l'ancien code en NOT_SENT_* après un 500 accepté : non détectable (tâche réussie, sans erreur).
- **Pas de retour arrière sous 1ad71ec** : l'ancien code ignore SEND_UNCONFIRMED.
- Notification ou bienvenue déjà tentée et créée il y a plus de 23 h : plus envoyée par e-mail.
- `createClientOrder` simulé dans le test PostgreSQL, avec le vrai `beforeCreate`.

## Commits

1ad71ec, f15dade, 51caacf, 8eae8eb, puis ce rapport ; `npm run check` : exit 0, 1176/1176.
