# TutelLiv — configuration des liens d’authentification

Préparation locale du 28 septembre 2026. Aucun réglage distant ni envoi effectué.

Décision du 18 octobre 2026 : Resend est retenu en principe ; la boîte de réception de test est configurée uniquement dans `.env.local`, ignoré par Git. Les expéditeurs visés sont `no-reply@…` et `support@…`, mais aucun domaine TutelLiv n'est encore acheté ou confirmé. Ne pas inventer de domaine, modifier le DNS ou activer les envois avant sa validation.

## Avant activation

1. Utiliser un projet Supabase de test et une boîte e-mail contrôlée. Configurer SMTP dans Authentication ; les variables Resend des notifications métier ne configurent pas automatiquement les e-mails Supabase Auth.
2. Définir Site URL sur l’origine exacte de l’application (sans chemin, par exemple l’origine de préproduction), et autoriser uniquement son `/reset-password` dans les Redirect URLs. Aligner NEXT_PUBLIC_APP_URL.
3. Activer **Confirm email**. Configurer l’expiration Email OTP à **3 600 secondes maximum** ; relever la valeur réellement appliquée et tester un délai raccourci sur la cible isolée.
4. Vérifier les limites des envois, récupérations, vérifications et connexions. Les routes utilisent le SDK anonyme pour récupération/vérification : Supabase peut compter l’IP du serveur, commune à plusieurs utilisateurs. Régler et tester une protection anti-abus adaptée à l’hébergeur avant mise en service ; ne pas faire confiance à un en-tête IP arbitraire envoyé par le navigateur.
5. Désactiver le suivi de clics du prestataire d’e-mail, susceptible de réécrire les liens. Installer les trois modèles ci-dessous.
6. Seulement après contrôle, définir `AUTH_EMAIL_LINKS_ENABLED=true` dans l’environnement de test et redémarrer. Le drapeau n’applique aucun réglage Supabase : il atteste que cette configuration a été faite. Il est absent de l’environnement actuel, donc les nouveaux envois restent désactivés.

Les notifications métier ne suivent pas ce drapeau. Elles utilisent EMAIL_DELIVERY_MODE avec les valeurs disabled, test ou live et restent désactivées par défaut. Pour la recette, test redirige toutes les copies vers EMAIL_TEST_RECIPIENT ; voir [la procédure EMAIL](operations/email/README.md). Le mode live ne doit pas être activé pendant la recette.

Les modèles utilisent SiteURL pour une destination fixe. Le fragment contient un jeton sensible : ne pas le partager, journaliser, copier dans les rapports ou laisser un outil d’analytics enregistrer le corps de la requête de confirmation. L’application lit puis retire ce fragment ; seule la soumission volontaire du formulaire consomme le jeton.

## Modèle « Invite user »

Sujet : Votre invitation TutelLiv

```html
<h2>Vous êtes invité sur TutelLiv</h2>
<p>Choisissez votre mot de passe pour accéder à votre espace.</p>
<p><a href="{{ .SiteURL }}/reset-password#token_hash={{ .TokenHash }}&amp;type=invite">Choisir mon mot de passe</a></p>
<p>Ce lien est personnel, temporaire et à usage unique. Si vous n’attendiez pas cette invitation, ignorez cet e-mail.</p>
```

## Modèle « Reset password »

Sujet : Réinitialiser votre mot de passe TutelLiv

```html
<h2>Réinitialiser votre mot de passe</h2>
<p><a href="{{ .SiteURL }}/reset-password#token_hash={{ .TokenHash }}&amp;type=recovery">Choisir un nouveau mot de passe</a></p>
<p>Ce lien est personnel, temporaire et à usage unique. Sans demande de votre part, ignorez cet e-mail.</p>
```

## Modèle « Confirm signup »

Sujet : Confirmer votre adresse e-mail TutelLiv

```html
<h2>Confirmer votre adresse e-mail</h2>
<p><a href="{{ .SiteURL }}/reset-password#token_hash={{ .TokenHash }}&amp;type=signup">Confirmer mon adresse</a></p>
<p>Votre espace entreprise sera créé après confirmation. Vous pourrez ensuite vous connecter avec le mot de passe choisi lors de l’inscription.</p>
```

Ne pas conserver le lien `ConfirmationURL` par défaut pour ces trois parcours : cette version attend un TokenHash et ne reçoit aucune session depuis l’URL. L’ancien modèle nécessite donc une mise à jour avant activation.

## Recette réelle restant à faire

- Invitation d’un client et d’un livreur fictifs : réception, statut Invité, impossibilité de connexion avant activation, choix du mot de passe, connexion correcte dans le bon espace.
- Invitation mini-admin : mêmes contrôles avec autorisation spécifique des comptes/rôles concernés ; conserver la limitation SEC-03.
- Ouvrir un lien sans soumettre : aucun compte activé. Soumettre : compte actif ; deuxième soumission : refus. Jeton expiré : refus, nouvelle demande puis succès.
- Invitation consommée mais changement de mot de passe échoué : demander un lien de récupération ; vérifier que le compte en attente peut terminer son activation, sans contourner une suspension.
- Inscription entreprise : aucun profil/entreprise avant confirmation ; confirmation puis connexion. Lien expiré : reprendre l’inscription ; adresse déjà inscrite : réponse sans révéler l’existence du compte.
- Récupération : adresse inconnue et connue donnent la même réponse publique ; mot de passe changé, reconnexion réussie, ancien mot de passe refusé.
- Refaire les contrôles avec compte et entreprise suspendus, et avec limitation Supabase atteinte sur environnement isolé.
- Déconnexion et liens ouverts sur un autre appareil ; mesurer la durée résiduelle d’un ancien JWT. La révocation des refresh tokens ne supprime pas instantanément un JWT déjà émis.
- Simuler une erreur Prisma après invitation : aucun compte Auth préexistant ne doit être supprimé ; documenter le rattrapage et l’éventuel renvoi d’invitation. L’envoi SMTP et Prisma ne constituent pas une transaction atomique.

Sources officielles vérifiées : [modèles d’e-mail Supabase](https://supabase.com/docs/guides/auth/auth-email-templates), [invitation](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [vérification OTP](https://supabase.com/docs/reference/javascript/auth-verifyotp), [limites Auth](https://supabase.com/docs/guides/auth/rate-limits), [expiration des liens](https://supabase.com/docs/guides/auth/auth-email-passwordless).
