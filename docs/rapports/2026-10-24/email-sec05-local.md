# EMAIL + SEC-05 — preuves locales complémentaires

Date : 24 octobre 2026. Portée : code applicatif local seulement, avec Supabase et Resend simulés. Aucun secret, réseau, base, migration, seed, domaine, SMTP, compte fournisseur ou e-mail réel n'a été utilisé.

## Résultat

La commande `npm run test:email-sec05` exécute 32 tests ciblés dans les services réels : liens de mot de passe, transport transactionnel, notifications client et file durable.

- Invitation et récupération expirées : `AUTH_LINK_INVALID`, sans écriture de mot de passe ni activation.
- Invitation et récupération consommées : la seconde utilisation est refusée ; une seule écriture/activation éventuelle est conservée.
- Transport `test` : une réponse HTTP 503 simulée est visible, puis la reprise réussit avec exactement la même clé d'idempotence.
- File : la première panne de notification revient à l'état `PENDING` avec erreur assainie ; la tentative due suivante réussit avec le même `jobKey`.
- Rejeux : une seule ligne de notification et une seule tâche logique ; les deux appels transport portent la même clé et le fournisseur simulé matérialise une seule livraison.
- Transport `disabled` : deux appels/rejeux retournent `disabled` et n'appellent jamais le fournisseur.

## Commandes de preuve

```sh
npm run test:email-sec05
npm run check
git diff --check
```

Résultats : `npm run test:email-sec05` 32/32 ; `npm run check` (types, lint, tests) 366/366 ; `git diff --check` réussi.

## Limites maintenues

Ces doubles valident les contrats applicatifs, pas le comportement distant : expiration/limites Supabase, SMTP et modèles Auth, configuration Resend, domaine/expéditeur vérifié, réception dans une boîte contrôlée, délai/réessai réel et déduplication effective du fournisseur restent à exercer sur ENV-1 isolé. SEC-05 et EMAIL restent donc ouvertes.
