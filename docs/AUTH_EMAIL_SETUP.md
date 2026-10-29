# TutelLiv — configuration des liens d’authentification

Préparation initiale du 28 septembre 2026. Configuration de préproduction vérifiée le 23 octobre 2026.

État de la préproduction : la Site URL Supabase pointe vers l'alias stable Vercel de la branche `preproduction` et son chemin `/reset-password` est dans la liste des redirections autorisées. Le modèle e-mail Supabase par défaut est utilisé tant qu'aucun SMTP personnalisé n'est configuré. TutelLiv accepte ce modèle ainsi que les futurs modèles personnalisés fondés sur `TokenHash`.

Décision du 18 octobre 2026 : Resend est retenu ; la boîte de réception de test est configurée uniquement dans `.env.local`, ignoré par Git.

Mise à jour du 29 octobre 2026 : le propriétaire indique que le domaine `tutelliv.fr` est vérifié chez Resend et que `RESEND_API_KEY` est posée en local et dans Vercel. La clé locale est restreinte à l'envoi (lecture des domaines refusée en `401 restricted_api_key`, ce qui est voulu). L'expéditeur retenu est `TutelLiv <no-reply@tutelliv.fr>` (`MAIL_FROM`). Sur `tutelliv-preproduction`, le SMTP Resend est actif (journaux Auth, expéditeur `no-reply@tutelliv.fr`) et les trois modèles TutelLiv ont été collés le 29 octobre : les liens utilisent désormais `token_hash`. « Mot de passe oublié » vérifié en réel le même jour (e-mail TutelLiv reçu) ; invitation et confirmation pas encore reçues en réel. `tutelliv-dev` non vérifié.

## SMTP Resend pour Supabase Auth (obligatoire)

Oui, Supabase Auth demande une configuration SMTP spécifique : `RESEND_API_KEY` dans l'application ne change rien aux e-mails d'inscription, d'invitation et de récupération, envoyés par Supabase lui-même. Sans SMTP personnalisé, Supabase n'envoie qu'aux membres de l'organisation Supabase, avec une limite de quelques e-mails par heure : inutilisable pour des pilotes.

Dans le tableau de bord Supabase du projet visé (d'abord `tutelliv-dev`, jamais la production sans décision séparée), **Authentication → Emails → SMTP Settings** :

| Champ | Valeur |
| --- | --- |
| Enable custom SMTP | activé |
| Sender email | `no-reply@tutelliv.fr` |
| Sender name | `TutelLiv` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | une clé Resend dédiée à Supabase, restreinte à l'envoi et au domaine `tutelliv.fr` (révocable sans couper l'application) |

Alternative équivalente : l'intégration Supabase du tableau de bord Resend, qui remplit les mêmes champs. Ensuite, dans Resend, désactiver le suivi des clics et des ouvertures du domaine (réécriture des liens à jeton). Dans **Authentication → Rate Limits**, relever « emails sent per hour » (30 par défaut avec SMTP personnalisé) selon le volume pilote.

Les trois modèles à la DA TutelLiv sont générés par `npx tsx scripts/email/render-supabase-templates.ts` dans `docs/operations/email/supabase/` (`signup.html`, `invite.html`, `recovery.html`) ; coller chaque fichier dans **Authentication → Emails → Templates** (« Confirm signup », « Invite user », « Reset password ») avec le sujet affiché par le script. Ne jamais modifier ces fichiers à la main : changer `src/lib/email/email-template.ts` puis régénérer.

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

Ces modèles demandent un SMTP personnalisé. Ils ne sont pas requis pour tester la préproduction : le lien `ConfirmationURL` par défaut est désormais pris en charge par l'application. Les extraits ci-dessous gardent la structure minimale historique ; les versions à coller sont celles de `docs/operations/email/supabase/`, mêmes liens, même `type`.

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
