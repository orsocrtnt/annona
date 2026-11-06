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

Rendu complet figé dans le payload à la première tentative émise (`emailSnapshot`, sans migration), réutilisé à chaque reprise, effacé après refus certain d'une première tentative. QUEUED déjà tentée = reprise ; tâche épuisée = non confirmée, bloquante. Admin : « Envoi non confirmé… vérifiez avant de relancer », tâche FAILED, `lastError` explicite.

## Appelants (`replayWindowStart` obligatoire)

- `invoice-reminder.service.ts` : `null` en première tentative, création de la relance sinon.
- `notify.service.ts` et `signup.service.ts` : `jobEmailReplayWindow` (première tentative inscrite dans le payload ; tâche héritée déjà exécutée : date de création).
- ORDER_MESSAGE sans e-mail ; authentification par Supabase.

## Autres correctifs

Report sans perte d'essai. Limiteur (défaut trouvé sur PostgreSQL : 10 autorisées sur 12, limite 5) : verrou attendu 2 s, contention = 503, `Retry-After: 5`.

## Tests (`node:test`, dans `npm run check`)

17 cas d'issue ; rendu figé (montant, adresse, preuve modifiés → même corps) ; fournisseur simulé (200, 400, 409×2, 422, 429, 500, expiration, double clic, reprises 6 min/+20 h/> 23 h) ; transition QUEUED héritée ; notify/bienvenue ; liste, clic, route 503.

## PostgreSQL réel : `npm run test:pg-locks` (annona-dev, pool 5)

```
a  10 clics → 1 relance ; 10 tâches → 1 envoi
a3 issue inconnue → SENDING ; 10 clics → 0 ; 10 reprises → 1 envoi, 1 clé
b  10 requêtes, 2 clients, même clé → 1 commande (5 created, 5 conflict)
c  12 connexions → 4 autorisées, 8 refusées par contention, 0 par limite, 0 fail-open
d  10 inscriptions de première tentative → 1 seule
passed: true ; aucune donnée E2E restante
```

## Contre-revues adverses (Opus)

Quatre passes, constats corrigés sauf limites ci-dessous.

## Limites

- Aucun envoi Resend réel ; corps `{name}` d'après la documentation.
- Relance héritée close NOT_SENT_* après un 500 accepté : non traitée, Resend jamais configuré.
- Adresse figée : une reprise part vers l'adresse de la première tentative.
- **Pas de retour arrière sous 1ad71ec** (SEND_UNCONFIRMED ignoré par l'ancien code).
- Notification/bienvenue déjà tentée, créée > 23 h : plus d'e-mail.
- `createClientOrder` simulé (vrai `beforeCreate`).

## Commits

1ad71ec, f15dade, 51caacf, 8eae8eb, 17e099a, 98f52e0, puis ce rapport ; `npm run check` : exit 0, 1181/1181.
