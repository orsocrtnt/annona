# EMAIL — transport transactionnel et recette

État du 18 octobre 2026. Le transport métier est préparé pour Resend, mais aucun domaine, secret ni envoi réel n'a été activé.

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

## Activation de la recette

1. Utiliser la future préproduction isolée d'ENV-1.
2. Vérifier un domaine et les adresses no-reply@… / support@… chez Resend, sans inventer leur domaine.
3. Configurer `EMAIL_DELIVERY_MODE=test`, la clé, l'expéditeur vérifié et `EMAIL_TEST_RECIPIENT` dans l'environnement isolé.
4. Garder le SMTP Supabase désactivé jusqu'à l'installation et au contrôle de ses trois modèles.
5. Créer uniquement des utilisateurs et événements fictifs. Vérifier invitation, récupération, livraison, facture, préférence désactivée, panne fournisseur, reprise et absence de doublon.
6. Vérifier les journaux et preuves : aucune clé, aucun jeton de lien, aucun corps métier et aucune adresse autre que la boîte contrôlée.
7. Revenir à disabled après la recette.

Le passage à live exige une décision séparée après la recette. EMAIL reste ouverte jusque-là.
