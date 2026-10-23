# TutelLiv — configuration des liens d’authentification

Préparation initiale du 28 septembre 2026. Configuration de préproduction vérifiée le 23 octobre 2026.

État de la préproduction : la Site URL Supabase pointe vers l'alias stable Vercel de la branche `preproduction` et son chemin `/reset-password` est dans la liste des redirections autorisées. Le modèle e-mail Supabase par défaut est utilisé tant qu'aucun SMTP personnalisé n'est configuré. TutelLiv accepte ce modèle ainsi que les futurs modèles personnalisés fondés sur `TokenHash`.

Décision du 18 octobre 2026 : Resend est retenu en principe ; la boîte de réception de test est configurée uniquement dans `.env.local`, ignoré par Git. Les expéditeurs visés sont `no-reply@…` et `support@…`, mais aucun domaine TutelLiv n'est encore acheté ou confirmé. Ne pas inventer de domaine, modifier le DNS ou activer les envois avant sa validation.

## Avant activation

1. Utiliser un projet Supabase de test et une boîte e-mail contrôlée. Configurer SMTP dans Authentication ; les variables Resend des notifications métier ne configurent pas automatiquement les e-mails Supabase Auth.
2. Définir Site URL sur l’origine exacte de l’application (sans chemin, par exemple l’origine de préproduction), et autoriser uniquement son `/reset-password` dans les Redirect URLs. Aligner NEXT_PUBLIC_APP_URL.
3. Activer **Confirm email**. Configurer l’expiration Email OTP à **3 600 secondes maximum** ; relever la valeur réellement appliquée et tester un délai raccourci sur la cible isolée.
4. Vérifier les limites des envois, récupérations, vérifications et connexions. Les routes utilisent le SDK anonyme pour récupération/vérification : Supabase peut compter l’IP du serveur, commune à plusieurs utilisateurs. Régler et tester une protection anti-abus adaptée à l’hébergeur avant mise en service ; ne pas faire confiance à un en-tête IP arbitraire envoyé par le navigateur.
5. Avec un SMTP personnalisé, désactiver le suivi de clics du prestataire d’e-mail, susceptible de réécrire les liens. Les trois modèles ci-dessous pourront alors remplacer les modèles par défaut.
6. Seulement après contrôle, définir `AUTH_EMAIL_LINKS_ENABLED=true` dans l’environnement de test et redémarrer. Le drapeau n’applique aucun réglage Supabase : il atteste que cette configuration a été faite. Il est absent de l’environnement actuel, donc les nouveaux envois restent désactivés.

Les notifications métier ne suivent pas ce drapeau. Elles utilisent EMAIL_DELIVERY_MODE avec les valeurs disabled, test ou live et restent désactivées par défaut. Pour la recette, test redirige toutes les copies vers EMAIL_TEST_RECIPIENT ; voir [la procédure EMAIL](operations/email/README.md). Le mode live ne doit pas être activé pendant la recette.

Les liens utilisent une destination fixe contrôlée. Le fragment contient un jeton sensible : ne pas le partager, journaliser, copier dans les rapports ou laisser un outil d’analytics enregistrer le corps de la requête de confirmation. L’application lit puis retire immédiatement ce fragment. Avec le modèle Supabase par défaut, le premier clic consomme le lien à usage unique avant la redirection ; un second clic est donc normalement refusé.

L'écran d'attente de l'inscription permet de renvoyer le lien de confirmation. Le bouton affiche un compte à rebours et redevient disponible trente secondes après chaque envoi. Le même délai est réservé atomiquement côté serveur afin qu'un double clic ou deux requêtes concurrentes ne produisent qu'un seul e-mail. Supabase conserve ses propres limites de fournisseur : un refus `429` n'est pas contourné et relance également le délai local. Avec un futur SMTP personnalisé, régler l'intervalle fournisseur à trente secondes si l'offre le permet, puis vérifier le comportement sur la préproduction avant commercialisation.

## Modèles personnalisés futurs

Ces modèles demandent un SMTP personnalisé. Ils ne sont pas requis pour tester la préproduction : le lien `ConfirmationURL` par défaut est désormais pris en charge par l'application.

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

Lorsque ces modèles seront activés, vérifier les trois parcours après le changement. L'application conserve volontairement la compatibilité avec `ConfirmationURL` afin qu'un retour temporaire aux modèles Supabase ne casse pas les confirmations.

## Recette réelle restant à faire

- Invitation d’un client et d’un livreur fictifs : réception, statut Invité, impossibilité de connexion avant activation, choix du mot de passe, connexion correcte dans le bon espace.
- Invitation mini-admin : mêmes contrôles avec autorisation spécifique des comptes/rôles concernés ; conserver la limitation SEC-03.
- Ouvrir un lien sans soumettre : aucun compte activé. Soumettre : compte actif ; deuxième soumission : refus. Jeton expiré : refus, nouvelle demande puis succès.
- Invitation consommée mais changement de mot de passe échoué : demander un lien de récupération ; vérifier que le compte en attente peut terminer son activation, sans contourner une suspension.
- Inscription entreprise : aucun profil/entreprise avant confirmation ; confirmation puis connexion. Vérifier le compte à rebours de trente secondes, le renvoi après expiration, le double clic et le refus fournisseur. Lien expiré : renvoyer un lien depuis le brouillon ; adresse déjà inscrite : réponse sans révéler l’existence du compte.
- Récupération : adresse inconnue et connue donnent la même réponse publique ; mot de passe changé, reconnexion réussie, ancien mot de passe refusé.
- Refaire les contrôles avec compte et entreprise suspendus, et avec limitation Supabase atteinte sur environnement isolé.
- Déconnexion et liens ouverts sur un autre appareil ; mesurer la durée résiduelle d’un ancien JWT. La révocation des refresh tokens ne supprime pas instantanément un JWT déjà émis.
- Simuler une erreur Prisma après invitation : aucun compte Auth préexistant ne doit être supprimé ; documenter le rattrapage et l’éventuel renvoi d’invitation. L’envoi SMTP et Prisma ne constituent pas une transaction atomique.

Sources officielles vérifiées : [modèles d’e-mail Supabase](https://supabase.com/docs/guides/auth/auth-email-templates), [invitation](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [vérification OTP](https://supabase.com/docs/reference/javascript/auth-verifyotp), [limites Auth](https://supabase.com/docs/guides/auth/rate-limits), [expiration des liens](https://supabase.com/docs/guides/auth/auth-email-passwordless).
