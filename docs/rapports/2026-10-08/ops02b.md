# OPS-02B — Idempotence et effets différés durables

Date de validation : 2026-10-08

## Résultat

OPS-02B est terminée. Une tentative de création de commande client porte désormais une clé d’idempotence stable. Deux requêtes identiques rendent la même commande ; la réutilisation de la clé avec un contenu différent est refusée en 409. La commande, sa livraison et la tâche d’auto-dispatch sont enregistrées dans la même transaction.

Les affectations automatiques et notifications passent par `operation_jobs`. Les tâches sont réclamées atomiquement, disposent d’un bail de 5 minutes, sont reprises après 1, 5 puis 30 minutes et deviennent définitivement en échec après trois tentatives. Le résultat d’un ancien worker expiré ne peut pas écraser celui du worker suivant. Les états et la relance manuelle sont exposés dans le dispatch avec permission et périmètre entreprise.

Les notifications utilisent l’identifiant immuable de l’événement comme clé. Le rejeu ne crée ni seconde notification locale ni second envoi Resend ; le même en-tête d’idempotence est transmis au fournisseur. Le worker vérifie encore l’utilisateur, l’entreprise et l’existence de la livraison ou facture avant l’envoi. Les changements de statut génériques refusent « affectée » tant que l’affectation n’est pas réalisée par le centre de dispatch.

## Vérifications

- `npm run check` : TypeScript valide, lint sans erreur avec 24 avertissements historiques, 75 tests réussis sur 75.
- Tests de tâches : déduplication, réclamation concurrente unique, reprise d’un bail expiré, clôture après trois erreurs, absence de quatrième essai et protection contre l’écriture tardive d’un ancien worker.
- Tests de notifications : un seul enregistrement au rejeu, même clé Resend, isolation par entreprise, ressource supprimée ignorée et événements distincts conservés.
- Facture et acceptation de mission spéciale concurrentes : un seul objet et une seule tâche de notification ou dispatch.
- Recette connectée du 2026-10-08 : deux créations concurrentes 201 avec le même identifiant ; une commande, une livraison et une tâche ; contenu différent sous la même clé refusé en 409 ; statut répété, facture répétée et mission spéciale répétée sans doublon ; tâche abandonnée reprise par le cron ; routes commande et livraison refusant « affectée » sans chauffeur en 409.
- Nettoyage connecté : zéro commande marquée OPS02B et zéro tâche de reprise fictive.
- Base de test : colonnes `idempotency_key` et `request_fingerprint`, index unique client + clé, table `operation_jobs`, RLS active, aucun droit anon/authenticated/PUBLIC et accès REST anonyme refusé en 401.
- `npm run build` et `git diff --check` : réussis.

## Exploitation

`/api/cron/operations` est protégé par `CRON_SECRET` et programmé chaque minute dans `vercel.json`. Si l’hébergement ne permet pas cette cadence, un planificateur externe doit appeler le même point d’entrée. Sans planificateur, les tâches restent persistées et visibles mais ne redémarrent pas seules.

La modification de base a été appliquée sur la base distante autorisée pour les tests. Les scripts SQL d’application et de retour arrière sont conservés dans `docs/operations/ops02b/`. Elle n’est pas encore intégrée à un historique de migrations complet ; DB-1 reste ouverte.

## Limites conservées

Le vrai double clic dans un navigateur et la comparaison visuelle client/admin restent dans R01. La répétition du formulaire coursier complet reste dans R02. Les e-mails Resend réels dépendent toujours de la configuration SEC-05. DISPATCH-1 couvrira les affectations concurrentes, capacités et réaffectations ; ACK-1 couvrira la prise en charge explicite.

Aucun déploiement n’a été effectué.

## Preuves

- `tests/order-atomicity.test.ts`
- `tests/operation-jobs.test.ts`
- `tests/notification-idempotency.test.ts`
- `outputs/ops02b/check.log`
- `outputs/ops02b/build.log`
- `outputs/ops02b/connected.json`
- `outputs/ops02b/schema-verification.json`
- `outputs/ops02b/final-verification.json`
