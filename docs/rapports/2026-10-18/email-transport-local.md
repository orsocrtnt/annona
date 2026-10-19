# EMAIL — sécurisation locale du transport métier

## Résultat

Le transport Resend des copies de livraison et de facture possède désormais trois états explicites : désactivé, recette vers une boîte unique et réel. Le dépôt reste en mode désactivé par défaut. Le mode recette redirige tout vers la boîte contrôlée et rend le destinataire initial lisible dans le message ; il évite qu'une configuration de préproduction contacte des utilisateurs fictifs ou importés.

La configuration est refusée si le mode, la clé, l'expéditeur ou la boîte de recette requis manquent. Les sujets sont neutralisés contre l'injection d'en-têtes, l'appel est borné, le message fournisseur conserve une clé d'idempotence stable et les erreurs ne remontent ni contenu ni secret.

Le portail distingue maintenant mode recette et mode réel. Les préférences d'alerte et de copie e-mail restent respectées. Les échecs continuent de passer par les tâches durables existantes, visibles et rejouables depuis le dispatch.

## Validation locale

- 266 tests réussis, dont les tests ciblés du transport, du rejeu, des frontières d'entreprise et des préférences ;
- typecheck et lint stricts réussis ;
- build isolé réussi avec 101 pages, sans utiliser les secrets ni toucher au serveur local du propriétaire ;
- 55 documents contrôlés sans lien, script ou variable manquants ; scanner de 855 fichiers sans détection ;
- aucun appel réseau, envoi, changement distant, secret, schéma ou migration ;
- aucune donnée métier créée ou modifiée.

## Limites

Les invitations, confirmations et récupérations dépendent encore du SMTP et des modèles Supabase. Aucun domaine n'est confirmé, aucune clé Resend n'est fournie et aucun message n'a été reçu dans la boîte de test. La recette réelle, la gestion des limitations fournisseur et le passage éventuel en mode réel restent nécessaires avant de cocher EMAIL.

Procédure : [transport et recette](../../operations/email/README.md).
