# ONBOARD-1 — Première livraison et reprise du pilote

## Fonctionnement

Le chemin `/onboarding`, réservé à l’administrateur d’entreprise, rassemble neuf étapes : informations entreprise, services proposés, collaborateurs autorisés (facultatif), client, livreur, tarifs, dispatch, première commande et première livraison terminée.

Le formulaire entreprise confirme nom, e-mail, adresse, ville et pays ; le téléphone est facultatif. Ces informations sont validées avant écriture et conservées dans les champs existants de l’entreprise, sans modifier les coordonnées de facturation de SIGNUP-1.

Les étapes métier sont recalculées depuis les données réelles de la société à chaque ouverture. Seuls les comptes **actifs** valident les étapes client/livreur/collaborateurs ; les invitations en attente restent visibles et ne valent pas activation. Les réglages doivent respecter les schémas métier existants ; un objet vide ne suffit pas. Les formulaires existants restent accessibles par les liens de chaque étape.

L’administrateur qui travaille seul peut **Passer cette étape** pour les collaborateurs, puis **Reprendre cette étape**. Ce choix est conservé dans `Company.settings.onboarding.skippedCollaborators`, partagé entre les administrateurs de cette société et relu après reconnexion. Une étape passée n’est pas comptée comme terminée ; la barre inclut les deux compteurs. Un collaborateur ensuite activé remplace le saut sans double comptage.

`PATCH /api/onboarding` accepte seulement `{ step: "collaborators", skipped: boolean }` ou `{ step: "company", profile: { name, email, phone, address, city, country } }`. L’entreprise vient de la session serveur ; aucun identifiant d’entreprise ou saut d’étape obligatoire n’est accepté. Le droit `settings:update`, le rôle `COMPANY_ADMIN` et un abonnement/pilote modifiable sont requis. Les comptes en lecture seule consultent l’avancement mais ne peuvent pas enregistrer de coordonnées ou de saut. L’écriture compare les réglages relus avant leur remplacement et retente au maximum trois fois en cas de conflit, sans écraser une mise à jour concurrente détectée.

## Raccord à SIGNUP-1

Le paiement fictif confirmé ouvre `/onboarding` si la session a pu être établie, ou un lien de connexion avec `redirect=/onboarding`. Les API de connexion et de synchronisation relisent `onboardingRequired` pour l’administrateur créé par SIGNUP-1 : tant que les étapes calculées sont incomplètes, elles renvoient l’assistant ; une fois prêt, elles retrouvent `/dashboard`. Un ancien lien `redirect=/dashboard` ne contourne pas la reprise demandée par le serveur. Les autres rôles gardent leur destination habituelle. Le pilote manuel accède au même assistant par la navigation.

## Invitations

La gestion des comptes existante reste le point d’entrée pour inviter client, livreur, dispatcher ou mini-admin. Le nouveau destinataire choisit son mot de passe via le lien d’invitation ; le profil reste `PENDING_VERIFICATION` jusqu’à activation. Les places et droits SaaS sont contrôlés par le service existant.

Un e-mail déjà présent dans l’application renvoie un conflit sans nouvel envoi ni modification du rôle ou de l’entreprise. Le compte actif conserve son accès existant. Un compte en attente n’est pas renvoyé silencieusement ; la réception et le renvoi réels restent à qualifier avec le transport e-mail. Un utilisateur d’une autre société n’est jamais transféré par cette action. Les échecs du fournisseur ou de création de profil ne sont pas présentés comme un succès ; la réservation de place est libérée.

## Recette reproductible

Prérequis : préproduction identifiée dans `.env.preproduction.local`, avec contrôle d’isolation réussi, e-mails et liens d’authentification désactivés. Aucune valeur de secret ne doit être copiée dans les preuves.

```bash
npm run check
npm run test:onboard1
npm run test:onboard1:e2e
```

La recette connectée crée un **pilote manuel fictif sans options automatiques**, des comptes techniques, puis une commande et une livraison réellement affectée, acceptée, démarrée et terminée avec preuve fictive. Elle vérifie également le choix facultatif conservé, la reprise par une nouvelle lecture serveur et le refus d’une fausse validation d’étape obligatoire. Elle attend ses tâches asynchrones, nettoie seulement ses propres fixtures et exige un résidu nul.

Le test Chrome crée une société et trois comptes Auth éphémères confirmés par l’API d’administration, sans envoyer d’invitation. Il teste une vraie connexion avec le marqueur SIGNUP-1 et un ancien retour dashboard, le refus d’un e-mail entreprise invalide, l’enregistrement/relecture des coordonnées, le clic de passage, rechargement, lien vers les comptes, retour arrière, reconnexion, reprise puis nouveau rechargement, refus du client existant, refus API client/livreur, reconnexion d’un compte déjà prêt vers le dashboard et lecture seule SaaS. La vue à 390 × 844 px est contrôlée et capturée. Les fixtures applicatives et Auth sont supprimées en fin de test.

Pour qualifier le build de production local, construire avec `.env.preproduction.local`, lancer ce build sur `127.0.0.1:3106`, puis utiliser `E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL=http://localhost:3106 npm run test:onboard1:e2e`. Ne jamais lancer build et serveur dev en parallèle, ni arrêter un serveur utilisateur.

## Limites

- Les nouveaux envois sont qualifiés avec un fournisseur simulé dans les tests locaux ; le navigateur confirme le refus d’un utilisateur déjà présent. Ni la réception réelle d’une invitation, ni son renvoi, ni un transfert entre sociétés ne sont validés par cette recette.
- Aucun import n’est exposé : les données sont saisies manuellement. Un import ultérieur devra valider le fichier entier avant la première écriture.
- Le premier essai connecté du 23 octobre avec toutes les options du pilote par défaut a expiré dans la transaction de création de commande (Prisma, 5 secondes, dispatch automatique). Le parcours manuel sans cette option a ensuite réussi. Le dispatch automatique n’est pas qualifié par cette tranche ; aucun correctif de ce timeout n’est revendiqué.
- Les temps sont automatisés, pas humains. ONBOARD-1 reste ouverte pour l’exécution par un vrai pilote, la réception réelle des invitations, le temps humain et les interventions.

Preuves locales : `outputs/onboard1/connected.json`, `outputs/onboard1/signup-handoff.json`, `outputs/onboard1/browser.json` et `outputs/onboard1/pilot-mobile.png`. Rapport : [tranche technique pilote du 23 octobre](../../rapports/2026-10-23/onboard1-pilot-technique.md).
