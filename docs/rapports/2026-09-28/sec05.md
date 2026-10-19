# TutelLiv — SEC-05 : invitations et récupération

28 septembre 2026 — implémentation locale, non déployée. SEC-05 reste ouverte pour la configuration et la recette réelles Supabase/SMTP.

## Changements

- Création client/livreur/mini-admin remplacée par une invitation Supabase, après les contrôles de rôle et d’entreprise de SEC-03. Aucun mot de passe temporaire généré, retourné, affiché ni enregistré. Statut PENDING_VERIFICATION jusqu’au choix du mot de passe.
- Ancienne colonne de mots de passe et persistance supprimées ; l’ancienne clé locale est purgée à l’ouverture de l’application et à la déconnexion, sans lecture de son contenu. Les mots de passe déjà communiqués auparavant ne sont pas modifiés à distance.
- Lien transmis par fragment, lu en mémoire puis retiré de l’URL. Vérification serveur lors de la soumission ; client Supabase isolé, sans cookie ni session partagée. Le jeton est vérifié et consommé par Supabase ; les suspensions sont contrôlées avant changement. Activation du profil par mise à jour conditionnelle pour ne pas annuler une suspension concurrente.
- Récupération avec réponse publique neutre et gestion des refus/429. Nettoyage de la session de vérification, révocation des refresh tokens puis connexion normale demandée. Déconnexion ordinaire : un échec fournisseur est signalé sans prétendre avoir déconnecté l’utilisateur.
- Retrait de l’auto-confirmation au login. Inscription d’entreprise via signUp, sans profil local créé avant confirmation ; le mot de passe n’est pas redemandé à la confirmation. Une session automatique renvoyée par une mauvaise configuration Confirm email est refusée. Les comptes de démonstration préconfigurés restent distincts de cette inscription publique.
- Envois Auth désactivés tant que AUTH_EMAIL_LINKS_ENABLED n’est pas true. L’environnement existant n’a pas été modifié. Les modèles d’e-mail doivent être adaptés avant activation.

## Validation

`npm run check` : types et lint réussis (24 avertissements existants), **52 tests réussis**, dont 13 nouveaux tests SEC-05. `git diff --check` réussi.

Tests du vrai code applicatif avec services externes simulés : configuration requise, invitation sans secret, activation conditionnelle, erreurs d’expiration/rejeu/limite retournées par le fournisseur, récupération, suspensions et concurrence, erreur de changement/révocation, refus HTTP, purge locale, absence d’auto-confirmation, succès/échec de déconnexion, inscription sans profil avant confirmation et confirmation unique.

Les tests simulent les réponses Supabase : ils prouvent leur traitement par TutelLiv, pas le paramétrage ni les garanties effectives du projet hébergé.

Contrôles navigateur sur copie isolée localhost:3105, sans secrets ni base distante : lien absent refusé avec formulaire désactivé ; lien fictif activant le formulaire ; changement de lien dans le même onglet ; formulaire de confirmation d’inscription sans champ mot de passe ; envois désactivés donnant des erreurs explicites 503 pour activation et récupération. Une gestion incorrecte du changement de fragment a été corrigée puis retestée. Pas de scénario complet SMTP/connexion réelle ni build production pendant cette étape.

## Reste à valider

Voir configuration-email.md dans les outputs et docs/AUTH_EMAIL_SETUP.md dans le dépôt : SMTP, trois modèles, Confirm email, expiration, anti-abus et essais avec boîte de test contrôlée. Aucun connecteur de gestion Supabase ni jeton de gestion local disponible ; les réglages distants n’ont pas été inspectés. L’absence de clés Resend locales ne prouve pas l’absence de SMTP dans Supabase.

Les envois peuvent précéder la création du profil en base : une panne de cette seconde étape est signalée et ne supprime pas un compte Auth potentiellement préexistant. Tester les reprises/renvois et la récupération d’une invitation partiellement consommée avant livraison du produit. Les limites par IP du fournisseur peuvent porter sur l’IP du serveur ; la protection anti-abus de l’hébergeur reste à valider. Un ancien JWT peut rester valide jusqu’à expiration malgré la révocation de sa session.

La recette R13/R14 complète reste ouverte. Aucune migration, modification de compte distant, distribution d’identifiants ou publication effectuée.
