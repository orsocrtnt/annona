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

Contenu gelé à la création, anti-doublon compté depuis l'envoi. Une relance QUEUED dont la tâche a déjà tourné est une reprise ; tâche épuisée = non confirmée et bloquante, sauf erreur prouvant l'absence d'appel. Admin : « Envoi non confirmé… vérifiez avant de relancer », même résultat liste/clic, tâche FAILED avec `lastError` explicite.

## Appelants (`replayWindowStart` obligatoire)

- `invoice-reminder.service.ts` : `null` en première tentative, création de la relance sinon.
- `notify.service.ts` et `signup.service.ts` : `jobEmailReplayWindow` (première tentative inscrite dans le payload ; tâche héritée déjà exécutée : date de création).
- ORDER_MESSAGE sans e-mail ; authentification par Supabase.

## Autres correctifs

Tâche reportée sans perte d'essai, prise vérifiant l'échéance. Limiteur de connexion (défaut trouvé sur PostgreSQL : 10 autorisées sur 12, limite 5) : verrou attendu 2 s au plus, contention = 503 « Service momentanément occupé… », `Retry-After: 5`.

## Tests (`node:test`, dans `npm run check`)

Table des 17 cas ; fournisseur simulé au contrat Resend (200, 400, 409×2, 422, 429, 500, expiration, double clic, reprise à 6 min après minuit, +20 h, > 23 h) ; transition QUEUED héritée → 409 → un seul e-mail ; fenêtre notify/bienvenue ; liste, clic, prise de tâche, route 503.

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

Trois passes, constats corrigés sauf limites ci-dessous.

## Limites

- Aucun envoi Resend réel ; corps `{name}` d'après la documentation.
- Relance héritée close en NOT_SENT_* après un 500 accepté : indétectable.
- **Pas de retour arrière sous 1ad71ec** (SEND_UNCONFIRMED ignoré par l'ancien code).
- Notification/bienvenue déjà tentée, créée > 23 h : plus d'e-mail.
- `createClientOrder` simulé dans le test PostgreSQL (vrai `beforeCreate`).

## Commits

1ad71ec, f15dade, 51caacf, 8eae8eb, puis ce rapport ; `npm run check` : exit 0, 1176/1176.
