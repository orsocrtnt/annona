# ONBOARD-1 — Tranche technique pilote

Date : 23 octobre 2026. Branche : `preproduction`. La tranche technique est qualifiée ; ONBOARD-1 reste ouverte pour le pilote humain. Aucun push ni déploiement.

## Comportement livré

L’assistant `/onboarding` contient neuf étapes : informations entreprise, services, collaborateurs facultatifs, client, livreur, tarifs, dispatch, commande et livraison terminée. Un formulaire minimal enregistre les coordonnées de l’entreprise après validation complète, sans migration ni modification des informations de facturation déjà saisies à l’inscription.

L’avancement est relu depuis les données réelles après retour et reconnexion. Les invitations en attente ne valident plus un compte actif, et des réglages vides ne suffisent plus. Les collaborateurs peuvent être passés puis repris ; le choix est conservé côté société, distinct du compteur d’étapes terminées. L’écriture détecte un changement concurrent des réglages et retente au maximum trois fois avant de signaler le conflit. Aucune étape obligatoire ne peut être cochée par une requête de préférence.

SIGNUP-1 ouvre maintenant l’assistant après activation, avec repli vers la connexion si la session automatique n’a pas pu être ouverte. Login et synchronisation consomment le marqueur `onboardingRequired`, reprennent les étapes incomplètes et retrouvent le tableau de bord quand le parcours calculé est prêt. Un ancien lien vers le dashboard ne contourne pas cette reprise. Le pilote manuel et le compte activé utilisent le même service, les mêmes données et les mêmes droits.

Les écritures sont réservées à l’administrateur d’entreprise avec `settings:update` et un abonnement/pilote modifiable. L’entreprise provient de la session serveur. Les entrées supplémentaires, identifiants de société transmis, coordonnées invalides et sauts obligatoires sont refusés. Un compte en lecture seule conserve la consultation et reçoit un refus serveur en écriture.

L’invitation existante reste le point d’entrée unique. Les nouveaux clients, livreurs et dispatchers sont qualifiés avec un fournisseur simulé : profil en attente, réservation libérée sur échec et absence de faux succès. Un compte actif, en attente ou rattaché à une autre société reçoit un conflit sans transfert ni réécriture de droits. Le navigateur vérifie aussi le conflit pour un client déjà présent. Aucune invitation réelle n’a été envoyée.

## Preuves

- `node --import tsx --test tests/onboarding*.test.ts` : 17 tests ciblés réussis (dont API exécutée depuis sa source réelle, transport d’invitation simulé, isolation, état actif/en attente/suspendu, reprise, conflit, coordonnées et aiguillage de connexion).
- `npm run check` : types, lint strict et **345/345 tests** réussis.
- `node_modules/.bin/dotenv -e .env.preproduction.local -- npm run build` : build réussi, **106 pages**.
- `npm run test:onboard1` : entreprise fictive avec pilote SaaS manuel sans options automatiques ; progression **3 → 6 → 7 → 8 étapes terminées + 1 passée sur 9**, livraison réellement affectée, acceptée, démarrée et terminée avec preuve fictive. **36 626 ms automatisées**, reprise serveur identique, requête de saut obligatoire refusée sans mutation, zéro entreprise/utilisateur/commande/livraison/job résiduel.
- `E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL=http://localhost:3106 npm run test:onboard1:e2e` : **1 scénario Chrome réussi** sur le build local, **108 541 ms**. Connexion via formulaire malgré l’ancien retour dashboard, coordonnées invalides puis sauvegardées, rechargement, passage facultatif, navigation comptes/retour, reconnexion/reprise, doublon client, refus client/livreur, compte terminé vers dashboard et lecture seule. À **390 × 844 px**, aucun débordement global ; capture relue. Zéro erreur JavaScript, profils applicatifs et Auth éphémères nettoyés.
- La recette connectée SIGNUP-1 vérifie l’activation mensuelle/annuelle, le rejeu idempotent, l’isolation et le raccord des données à l’assistant. Sa preuve finale est `outputs/onboard1/signup-handoff.json` ; les notifications de bienvenue restent différées avec le transport désactivé.
- `git diff --check` réussi. La documentation et les copies de TODO sont synchronisées avec les sources du dépôt.

Les comptes navigateur sont des fixtures Auth confirmées par l’API d’administration : cela permet les clics réels sans envoyer d’e-mail et ne prouve pas la réception des invitations. Les temps ci-dessus incluent le réseau et les opérations automatiques ; aucune mesure humaine n’en est déduite.

Preuves locales : `outputs/onboard1/connected.json`, `outputs/onboard1/browser.json`, `outputs/onboard1/pilot-mobile.png`, `outputs/onboard1/signup-handoff.json`. Procédure : [ONBOARD-1](../../operations/onboard1/README.md).

## Limites et suite

Le premier essai connecté avec toutes les options du pilote par défaut a rencontré une expiration Prisma de 5 secondes lors de la création de commande avec dispatch automatique. Ses fixtures ont été nettoyées ; un contrôle séparé de toutes les sociétés/utilisateurs/commandes/jobs au préfixe ONBOARD-1 a confirmé zéro résidu. Le parcours manuel sans option automatique a ensuite réussi. Ce timeout n’a pas été corrigé ni présenté comme qualifié par cette tranche.

Le pilote réel doit encore recevoir ses invitations et réaliser la livraison avec temps humain et interventions consignés. Le transport et le renvoi d’une invitation en attente restent à qualifier avec SEC-05/EMAIL. Aucun import n’a été retenu ni exposé ; un format réel éventuel devra être validé entièrement avant toute écriture. ONBOARD-1 reste donc décochée et la progression globale reste à **51/78 (65 %)**.

Le fichier utilisateur préexistant `docs/rapports/2026-10-23/offre-recette-c8.md` a été préservé. Aucun secret n’a été copié dans les preuves, aucune donnée préexistante n’a été supprimée, aucun e-mail ni paiement réel n’a été déclenché.
