# SIGNUP-1 — Inscription autonome avec paiement fictif

Date de clôture : 22 octobre 2026.

## Résultat

Une entreprise fictive peut désormais partir de `/register`, choisir Starter, Pro ou Business en mensuel ou annuel, ajouter uniquement les options et sièges autorisés, consulter le prix HT/TTC et le coût des dépassements, puis saisir son identité professionnelle et ses coordonnées de facturation. Le parcours comprend cinq étapes lisibles sur mobile et reprend un brouillon pendant trente jours grâce à un jeton opaque conservé dans un cookie `HttpOnly` ; seule son empreinte est stockée en base.

Le serveur recalcule toujours le devis depuis le catalogue C7 actif. Il refuse les options déjà incluses, les doublons, les quantités invalides et les plafonds dépassés. Le mot de passe n'entre jamais dans PostgreSQL : Supabase Auth le reçoit directement et la confirmation d'e-mail rattache le compte au brouillon uniquement si l'identité, l'adresse et le jeton correspondent. L'ancien endpoint de création directe ne provisionne plus d'entreprise.

Depuis le correctif du 23 octobre, l'écran en attente propose aussi de renvoyer le lien. Le bouton affiche les secondes restantes et redevient disponible après trente secondes. Cette limite est enregistrée et réservée atomiquement en base : elle résiste au rechargement, aux doubles clics et aux requêtes concurrentes. Un refus de limite Supabase reste un refus et ne supprime pas la protection locale.

L'adaptateur de paiement de SIGNUP-1 est déterministe et fictif. Il est activé uniquement en local ou sur la Preview `preproduction`, et la route le refuse lorsque `VERCEL_ENV=production`. Un retour du navigateur ne suffit jamais : l'activation exige un événement serveur `CONFIRMED` du bon montant et de la bonne devise. Les événements en attente, refusés, dupliqués ou reçus après une confirmation ne peuvent pas dégrader un paiement confirmé.

L'activation verrouille le brouillon et crée dans une seule transaction sérialisable l'entreprise, l'administrateur, la souscription, l'offre et ses options. Une collision d'e-mail, de compte Auth, de SIREN ou de SIRET ne laisse aucune entreprise partielle. Le rejeu renvoie l'activation existante. L'e-mail de bienvenue est enregistré dans la même transaction comme tâche durable et utilise une clé d'envoi idempotente ; sa panne n'annule donc pas le compte et le worker peut le rejouer. Après connexion, l'utilisateur reprend sur ONBOARD-1.

## Base et sécurité

Cinq migrations additives créent les brouillons et événements de paiement, ajoutent les coordonnées légales nécessaires, indexent le catalogue, isolent le secret à usage unique de confirmation, mémorisent le dernier envoi et retirent l'exécution publique d'une fonction interne de trigger. Les nouvelles tables ont RLS active et aucun droit direct pour `PUBLIC`, `anon` ou `authenticated`. Toutes les opérations passent par les services serveur.

La préproduction Supabase isolée contient dix migrations Prisma et ne présente aucun drift. La garde d'environnement confirme la cible attendue et interdit la cible historique. Les variables Vercel `AUTH_EMAIL_LINKS_ENABLED=true` et `SIGNUP_PAYMENT_ADAPTER=fake` sont limitées à Preview et à la branche `preproduction`. Aucune variable Production n'a été changée.

## Recette

La recette connectée a validé :

- mensuel avec paiement en attente, refusé, confirmé puis rejoué ;
- annuel avec options annuelles facturées à douze mensualités, conformément à C7 ;
- activation idempotente et bienvenue durable ;
- deux inscriptions concurrentes avec le même SIREN : une seule entreprise créée ;
- entreprises distinctes et données isolées ;
- passage à ONBOARD-1, sept étapes complétées et première livraison fictive avec preuve ;
- nettoyage complet : 8 entreprises, 64 utilisateurs, 0 brouillon et 0 événement avant comme après.

Preuves finales :

- `npm run check` après la recette du retour arrière : TypeScript, ESLint strict et 315 tests réussis ;
- test métier local du renvoi : compteur de trente secondes et deux requêtes concurrentes produisant un seul appel fournisseur ;
- `npm run build` : build de production réussi, 106 pages ;
- `npm run test:signup1` : tous les scénarios connectés réussis ; preuve `outputs/signup1/connected.json` ;
- `prisma migrate status` sur préproduction : dix migrations, schéma à jour ;
- `npm run ci:preprod-env` avec les variables de préproduction : garde verte ;
- `git diff --check` : aucune erreur de format.

## Correctif — retour arrière avant paiement

Depuis le 23 octobre, l'inscription n'est plus à sens unique. Tant que le paiement fictif n'est pas confirmé, l'utilisateur peut revenir à la formule, aux options ou aux informations d'entreprise. Après confirmation d'e-mail, l'adresse reste verrouillée et le mot de passe n'est pas redemandé ; un changement d'offre recalcule le devis côté serveur. Dès que le paiement est confirmé ou le compte activé, ces corrections sont refusées.

La recette navigateur a vérifié un aller-retour Entreprise → Options → Entreprise avec conservation des champs saisis. La barre d'étapes n'autorise que les étapes déjà atteintes : elle ne peut plus contourner le bouton de validation des options et produire un devis qui ignorerait un choix visible seulement dans le navigateur.

Correctif du même jour : si Supabase a déjà confirmé l'adresse (lien cliqué, ou compte de test réutilisé) alors que le brouillon restait en attente, « J’ai confirmé, actualiser » rattache désormais cette confirmation. Un compte Auth confirmé sans utilisateur Annona peut aussi être retiré pour revenir corriger l'identité. Un compte déjà lié à une entreprise reste verrouillé.

## Limites conservées

Le paiement réel n'existe pas encore ; Stripe sandbox relève de SAAS-01B. Le transport métier reste désactivé tant que le domaine et l'expéditeur ne sont pas configurés : la tâche de bienvenue est durable, mais l'envoi externe attend EMAIL/SEC-05. Le bouton de renvoi Annona redevient actif après trente secondes, mais le fournisseur Supabase gratuit conserve actuellement sa fenêtre de confirmation par défaut de soixante secondes : un clic à trente secondes peut donc recevoir un refus temporaire explicite. Un véritable envoi toutes les trente secondes devra être qualifié après branchement du SMTP personnalisé et réglage de sa limite. La protection Supabase contre les mots de passe compromis reste à activer avant données réelles si l'offre du fournisseur la rend disponible.

Le parcours remet correctement l'utilisateur à ONBOARD-1. Les invitations réelles, l'import éventuel et la validation par une entreprise pilote restent dans ONBOARD-1 ; ils ne remettent pas en cause l'activation autonome qualifiée ici. Aucun paiement réel, donnée réelle, déploiement Production ou dépense n'a été effectué.
