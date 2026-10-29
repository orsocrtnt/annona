# EMAIL — transport transactionnel et recette

État du 18 octobre 2026, mis à jour le 29 octobre 2026 : domaine `tutelliv.fr` vérifié chez Resend (selon le propriétaire), clé restreinte à l'envoi en local et dans Vercel, expéditeur `TutelLiv <no-reply@tutelliv.fr>` dans `.env.local`. Le mode reste `disabled` tant que le propriétaire n'a pas autorisé un envoi de recette.

## Modèle HTML

Chaque e-mail métier part en texte brut **et** en HTML (`src/lib/email/email-template.ts`, DA Menthe Light) : sujet en titre, paragraphes séparés par une ligne vide, première ligne « Libellé : URL » transformée en bouton vert avec lien de secours, bandeau ambre en mode test. Le contenu est échappé, seules les URL http(s) deviennent des liens, aucune image distante ni pixel de suivi. Le HTML est dérivé du rendu figé par une fonction pure : une reprise sous la même `Idempotency-Key` envoie le même corps. Les modèles Supabase Auth utilisent la même mise en page (voir [AUTH_EMAIL_SETUP.md](../../AUTH_EMAIL_SETUP.md)).

## Envoi de recette

`npx tsx scripts/email/send-test.ts --confirm [--to delivered@resend.dev]` envoie trois exemples fictifs (bienvenue, livraison avec preuve, relance de facture), toujours en mode test. Destinataires acceptés : `EMAIL_TEST_RECIPIENT` ou une adresse simulée `@resend.dev` (aucune boîte réelle) ; sans `--confirm`, refus. Aucune clé ni adresse affichée. À lancer uniquement avec l'accord du propriétaire.

Les e-mails d'authentification (invitation, confirmation et récupération) passent par le SMTP de Supabase et suivent [AUTH_EMAIL_SETUP.md](../../AUTH_EMAIL_SETUP.md). Les copies des alertes de livraison et de facture passent par le transport métier Resend. Ces deux circuits doivent être configurés et testés séparément.

## Modes d'envoi

La variable EMAIL_DELIVERY_MODE rend l'intention explicite :

- **disabled** : aucun appel au fournisseur, même si une clé est présente ;
- **test** : tous les e-mails métier sont redirigés vers EMAIL_TEST_RECIPIENT. Le sujet et le texte rappellent l'adresse initialement visée ;
- **live** : le message part vers l'adresse du compte. Ce mode est interdit avant validation du domaine, de la préproduction et de la recette réelle.

Le mode test exige RESEND_API_KEY, MAIL_FROM ou EMAIL_FROM, et EMAIL_TEST_RECIPIENT. La boîte décidée pour la recette reste une configuration locale ignorée par Git et n'est pas injectée automatiquement par le dépôt.

Le portail affiche si le transport est désactivé, en recette ou réel. En recette, il précise que les copies ne partent pas vers les clients.

## Garanties locales

- Le mode par défaut est désactivé et une configuration incomplète reste inactive.
- Les retours à la ligne sont retirés des sujets et de la clé d'idempotence.
- Le fournisseur reçoit une clé stable par événement. Un rejeu conserve cette clé.
- L'appel fournisseur est borné à dix secondes.
- Les erreurs exposées aux traitements automatiques contiennent seulement le statut HTTP, jamais le corps, la clé, le destinataire ou le contenu du message.
- Les échecs des alertes de livraison et facture utilisent la file durable existante : trois tentatives bornées, état visible dans le dispatch et reprise manuelle.
- Les préférences du client peuvent couper l'alerte complète ou seulement sa copie e-mail.
- Les contrôles d'entreprise sont effectués avant la création de la notification et l'envoi.

## Preuve locale ciblée (24 octobre 2026)

Exécuter `npm run test:email-sec05`. La commande ne charge ni `.env`, ni réseau, ni base : elle exerce les services applicatifs avec un client Supabase et un transport Resend simulés.

- invitation et récupération expirées, puis seconde utilisation des deux types de lien : refus sans écriture ni activation ;
- échec HTTP fournisseur rendu visible, reprise avec la même clé d'idempotence, et file durable qui conserve cette clé entre deux tentatives ;
- double déclenchement : une notification et une tâche durable logiques ; le fournisseur simulé ne matérialise qu'une livraison pour la clé stable ;
- `disabled` : zéro appel fournisseur, y compris après rejeu.

Cette preuve ne configure ni SMTP Supabase, ni Resend, ni domaine, ni boîte de réception. Elle ne remplace donc pas la recette isolée de réception, d'expiration et de limites appliquées par les fournisseurs.

## Activation de la recette

1. Utiliser la future préproduction isolée d'ENV-1.
2. Vérifier un domaine et les adresses no-reply@… / support@… chez Resend, sans inventer leur domaine.
3. Configurer `EMAIL_DELIVERY_MODE=test`, la clé, l'expéditeur vérifié et `EMAIL_TEST_RECIPIENT` dans l'environnement isolé.
4. Garder le SMTP Supabase désactivé jusqu'à l'installation et au contrôle de ses trois modèles.
5. Créer uniquement des utilisateurs et événements fictifs. Vérifier invitation, récupération, livraison, facture, préférence désactivée, panne fournisseur, reprise et absence de doublon.
6. Vérifier les journaux et preuves : aucune clé, aucun jeton de lien, aucun corps métier et aucune adresse autre que la boîte contrôlée.
7. Revenir à disabled après la recette.

Le passage à live exige une décision séparée après la recette. EMAIL reste ouverte jusque-là.
