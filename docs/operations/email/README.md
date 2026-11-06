# EMAIL — transport transactionnel et recette

État du 18 octobre 2026, mis à jour le 29 octobre 2026 : domaine `annona.fr` vérifié chez Resend (selon le propriétaire), clé restreinte à l'envoi en local et dans Vercel, expéditeur `Annona <no-reply@annona.fr>` dans `.env.local`. Le mode reste `disabled` tant que le propriétaire n'a pas autorisé un envoi de recette.

## Modèle HTML

Chaque e-mail métier part en texte brut **et** en HTML (`src/lib/email/email-template.ts`, direction « Menthe soignée » validée le 30 octobre 2026). Carte blanche sur fond clair, logo officiel horizontal avec texte alternatif `Annona`, boutons encre avec liens de secours, badges menthe et accents ambre/rouge selon le statut. La présentation pure de `email-presentation.ts` couvre les sept notifications de livraison, la bienvenue, la facture et la relance ; les trois modèles Auth partagent la même mise en page. Les récapitulatifs affichent uniquement les valeurs reconnues dans le texte métier figé ; un message inconnu garde son titre et son contenu.

Le 30 octobre 2026, protection ajoutée contre la perte de contraste du logo transparent en mode sombre : un bandeau blanc sur toute la largeur de l’en-tête combine `bgcolor`, `background-color` et `background-image:linear-gradient(#ffffff,#ffffff)`. Le logo est centré avec `align="center"`, `text-align:center` et `margin:0 auto`, avec 28 px de marge verticale et 24 px de marge horizontale. Aucun contour ni séparation sous le bandeau : il se fond dans la carte blanche en clair. Le fond protégé est limité à l’en-tête ; aucune inversion du PNG ni permutation de logo par media query. Technique documentée par [Litmus](https://www.litmus.com/blog/background-colors-html-email#dont-forget-dark-mode). Les couleurs du logo restent noires et vertes, avec un fond clair pour les rendre lisibles. Le repli uni dépend du client ; ce contournement ne garantit pas tous les clients de messagerie. Contrôle local sur fond sombre simulé, pas de validation Gmail mobile réel à ce stade. Les messages déjà reçus ne sont pas modifiés.

Le logo est la seule image distante : `https://annona.fr/brand/logo-horizontal-fond-clair.png` (ressource publique, aucun jeton ni paramètre par destinataire). Aucun pixel de suivi ; les textes et le nom alternatif restent lisibles si les images sont bloquées. Le contenu et les récapitulatifs sont échappés ; seules les URL http(s) du texte deviennent des liens. La première ligne « Libellé : URL » fournit le bouton. Le mode test conserve son bandeau ambre. Les préférences de preuve et de notification, la file et les clés d’idempotence restent applicables ; aucun lien de preuve n’est ajouté lorsqu’il est désactivé.

`npx tsx scripts/email/render-supabase-templates.ts` régénère les modèles Auth versionnés et les 13 aperçus réels sous `outputs/email/preview/index.html` (données fictives, navigation des cadres bloquée par sandbox). Les outputs restent locaux. Pour appliquer la nouvelle présentation aux mails Auth hébergés, installer les trois fichiers générés dans Supabase selon [AUTH_EMAIL_SETUP.md](../../AUTH_EMAIL_SETUP.md) après la publication autorisée. La modification du dépôt seule ne modifie pas les modèles Supabase déjà configurés. La réception Gmail/Outlook et le mode sombre des clients mail demandent une recette réelle séparée.

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

## Brouillons de prospection conservés

- [Version courte — HTML](prospection/demarchage-court.html) et [texte](prospection/demarchage-court.txt).
- [Version visuelle — HTML](prospection/demarchage-visuel.html) et [texte avec objet](prospection/demarchage-visuel.txt), texte clarifié et bandeau blanc centré validés le 30 octobre 2026.

Ces fichiers sont des modèles réutilisables, sans liste de destinataires ni mécanisme d’envoi automatique. Les preuves des tests réels restent uniquement dans `outputs/` et ne sont pas publiées.
