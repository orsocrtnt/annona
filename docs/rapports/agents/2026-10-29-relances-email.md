# Rapport agent relances e-mail (Codex C5) — 29 octobre 2026

Branche `agent/relances-email`, base 4a99b6b. Ni migration, ni push, ni envoi Resend réel.

## Issues (`src/lib/email/transactional-email.ts`, `name` du corps lu)

Sources : [idempotence Resend](https://resend.com/docs/dashboard/emails/idempotency-keys) (clé gardée 24 h), [erreurs API](https://resend.com/docs/api-reference/errors).

| HTTP + `name` | Issue | Relance : 1re tentative / reprise |
|---|---|---|
| 2xx | sent | SENT |
| 400, 401, 403, 404, 405, 422, 429 | rejected | QUEUED / reste SENDING |
| 409 `concurrent_idempotent_requests`, autre 409, 5xx, code inconnu, expiration, réseau | unknown | SENDING, reprise même clé + même contenu |
| 409 `invalid_idempotent_request` | unconfirmed, permanente | FAILED (clé brûlée sans envoi) / SEND_UNCONFIRMED |
| reprise ≥ 23 h après la fenêtre | unconfirmed, aucun appel | SEND_UNCONFIRMED |

QUEUED ⇔ aucune tentative possiblement acceptée. Contenu gelé à la création de la relance. Anti-doublon compté depuis l'envoi. Réservation en cours : tâche reportée sans perdre d'essai.

**Vu par l'admin** : « Envoi non confirmé : le client a peut-être reçu la relance, vérifiez avant de relancer ». Tâche FAILED, `lastError` explicite (`INVOICE_REMINDER_SEND_UNCONFIRMED:<cause>`, `EMAIL_IDEMPOTENCY_WINDOW_EXPIRED`…). « Relancer » est bloqué 24 h, puis l'admin décide.

## Appelants (`replayWindowStart` obligatoire)

- `invoice-reminder.service.ts:381` : `null` à la première tentative, création de la relance pour une reprise.
- `notify.service.ts:340` (livraison, acceptation, facture émise) et `signup.service.ts:1110` (bienvenue) : `jobEmailReplayWindow` (`operation-job.service.ts:58`), première tentative émise inscrite dans le payload.
- ORDER_MESSAGE n'envoie pas d'e-mail. L'authentification passe par Supabase.

## Tests

- `transactional-email` : 17 cas, fenêtre.
- `c5-invoice-reminder-outcomes` : fournisseur simulé au contrat Resend ; 200, 400, 409×2, 422, 429, 500, expiration ; double clic, reprise à 6 min après minuit à Paris puis à +20 h ; dépassement de 23 h.
- `c1`, `demo3`, `operation-jobs`, `sec-login-rate-limit`.

## PostgreSQL réel : `npm run test:pg-locks` (tutelliv-dev, pool 5)

```
a  clics 10 → 1 relance ; tâches 10 → 1 envoi
a3 issue inconnue → SENDING ; 10 clics → 0 relance ; 10 reprises → 1 envoi, 1 clé, SENT
b  10 requêtes, 2 clients, même clé → 1 commande (5 created, 5 conflict)
c  12 connexions → 4 autorisées, 8 refusées (dont 55P03), 0 fail-open, 4 lignes
d  10 inscriptions de première tentative → 1 seule, horodatage stable
passed: true ; nettoyage : 0 donnée E2E restante
```

Défaut réel trouvé : sous concurrence, le limiteur de connexion autorisait par défaillance (10 sur 12, limite 5). Correctif : verrou attendu 2 s au plus, contention refusée 5 s.

## Contre-revue adverse

Première passe Opus : tout corrigé (fenêtre des tâches, anti-doublon, 409 en première tentative, essai perdu, limiteur). Seconde passe sur ces corrections non reçue à la remise.

## Limites

- Aucun appel Resend réel ; corps `{name}` d'après la documentation.
- Fenêtre de reprise conservatrice : 23 h depuis la création.
- `createClientOrder` simulé, avec le vrai `beforeCreate`.

## Commits

1ad71ec (correctif), f15dade (contre-revue), commit de ce rapport ; `npm run check` : exit 0, 1164/1164 tests.
