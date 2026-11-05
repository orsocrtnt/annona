# Plan de démarchage TutelLiv — départ le lundi 2 novembre 2026

Version du 1er novembre 2026. Plan de travail, pas un avis juridique : aucun juriste ne l'a relu.

## 1. L'essentiel

**Le démarchage peut démarrer lundi, mais pas pour vendre.** Tu n'as pas encore de SIREN (confirmé le 1er novembre) : jusqu'à ce qu'il arrive, on fait seulement des **entretiens de recherche**. Aucun prix, aucune offre de pilote. Quand le numéro arrive, le plan complet s'ouvre (repère « Après le SIREN » dans ce document).

| Possible dès lundi | Pas encore possible |
|---|---|
| Écrire et appeler des entreprises de coursiers pour comprendre leur travail | Encaisser un abonnement : le paiement du site est fictif |
| Faire 10 entretiens sur leur façon de travailler | Mettre de vraies données dans TutelLiv : juriste et contrat pas faits |
| Montrer le logiciel si la personne le demande (données fictives) | Parler prix ou proposer un pilote avant le SIREN |
| Noter les entreprises qui se disent intéressées | Promettre une date. Citer un client, un gain de temps ou un pourcentage : aucune mesure réelle |

**Objectif des deux premières semaines (du 2 au 13 novembre) :**
- 80 entreprises contactées ;
- 10 entretiens réalisés (tâche PROD-02) ;
- 3 entreprises intéressées, à recontacter pour le pilote (tâche PILOT-1) ;
- après le SIREN : une première réaction aux prix (tâche OFFER-1).

Ces chiffres sont des objectifs de travail, pas une prévision : aucun résultat réel n'existe encore.

## 2. À régler avant le premier message

Dans l'ordre. Les points 1 à 3 bloquent l'envoi.

| # | Problème constaté le 1er novembre | Ce qu'il faut faire | Qui |
|---|---|---|---|
| 1 | **Pas encore de SIREN** (confirmé le 1er novembre). | Faire la demande sur le Guichet unique lundi, avant le premier message. Voir ci-dessous. | Toi |
| 2 | **Les mails partent de `no-reply@tutelliv.fr`.** Une réponse de prospect serait perdue et Resend porte aussi les mails de connexion. | Créer une vraie boîte, par exemple `orso@tutelliv.fr` chez OVH, et envoyer à la main depuis elle. | Toi |
| 3 | **Les modèles de mail n'indiquent ni qui écrit, ni l'origine de l'adresse.** La CNIL demande l'identité de l'émetteur et un refus simple. | Utiliser les textes de la partie 7, qui contiennent ces mentions. | Fait dans ce plan |
| 4 | **`tutelliv.fr` tourne avec un paiement fictif** (audit AUDIT-0111). | Boutons de `/tarifs` remplacés par « Demander un pilote » vers Contact. **Reste à faire :** l'accueil, le pied de page, Fonctionnalités et Démonstration mènent encore à l'inscription. Ne jamais envoyer ces liens à un prospect. | Fait pour `/tarifs` ; le reste avec S2 d'AUDIT-0111 |
| 5 | **Peu de démos disponibles.** Le 1er novembre : 6 places, dont 2 libres, 3 occupées, 1 bloquée. Une place reste prise 8 h sauf déconnexion. Si plus aucune n'est libre, la démo répond « occupé ». | Limiter à 10 nouveaux contacts par jour. **La place bloquée le reste :** son déblocage a été refusé par le contrôle de sécurité de l'outil. Les 5 autres suffisent pour démarrer. | À refaire avec ton accord |
| 6 | **Aucune alerte quand quelqu'un remplissait le formulaire Contact.** | Un mail part maintenant vers ta boîte de recette à chaque message. Regarder quand même `/admin/contact` chaque matin. | Fait |
| 7 | **La page Confidentialité ne parlait pas de prospection.** | Paragraphe ajouté : source, usage, durée, droit de refus. Texte provisoire, sans juriste. | Fait |
| 8 | **Le PDF de présentation (`outputs/commercial/`) est un guide interne** : « pourquoi ils vont dire oui », « 11 actions contre 1 » sans mesure. | Ne pas l'envoyer à un prospect. | Toi |

### Le point SIREN

Le code du travail présume lucrative une activité qui recherche des clients par la publicité (articles L8221-3 et L8221-4, travail dissimulé si l'activité n'est pas déclarée). Démarcher pour vendre sans être immatriculé est donc un vrai risque. À confirmer avec le juriste.

**Ce qui est décidé :**

1. Lundi, avant tout message : faire la demande sur le Guichet unique.
2. En attendant le numéro : entretiens de recherche seulement. Pas de prix, pas de pilote, pas de lien vers le site dans les mails.
3. Quand le numéro arrive : l'ajouter au pied des mails et aux mentions légales, puis ouvrir les textes marqués « Après le SIREN ».

**Risque qui reste :** le site public affiche déjà les prix ; l'inscription en ligne est fermée depuis le 2 novembre. Le mode entretiens réduit le risque sans le supprimer. Pose la question à ton comptable dès que possible.

## 3. Qui contacter

**On garde :** entreprises françaises de coursiers ou de livraison express pour des clients professionnels récurrents, de 5 à 20 livreurs (3 à 5 en second choix), à Marseille et en Île-de-France.

**On écarte :** médical réglementé, matières dangereuses, froid contrôlé, international avec douane, transport lourd, logistique industrielle, repas aux particuliers, grands groupes. Une entreprise classique qui fait un peu de ces activités reste possible pour ses courses normales.

**Interlocuteur :** le dirigeant ou le responsable d'exploitation décide ; le dispatcher utilise l'outil chaque jour. Parler aux deux si possible.

**Liste de départ :** `outputs/prospection/prospects-2026-11-01.csv` (fichier local, jamais envoyé sur GitHub).
- Source : registre public SIRENE, le 1er novembre 2026. Les entreprises opposées à la prospection commerciale y sont déjà retirées.
- 282 entreprises. Priorité A (65) : nom ou code d'activité très proche de la course. B (207) : proche. C (10) : plus petites et moins sûres.
- Vague 1 : 34 entreprises, en tête du fichier. **Seules 2 ont des coordonnées vérifiées** sur leur site (La Courserie et Urban Cycle). Pour les 32 autres, la recherche automatique n'a rien donné de fiable : il faut chercher à la main.
- Chercher ainsi : nom et ville dans Google Maps, puis le site de l'entreprise. Compter 3 minutes par entreprise. Noter le standard, l'adresse générique et d'où elle vient. Aucun site ni téléphone : passer à la suivante.
- Le numéro de La Courserie est un 06 : vérifier que c'est bien la ligne de l'entreprise avant d'appeler.
- Le nombre de salariés du registre n'est pas le nombre de livreurs : beaucoup travaillent avec des indépendants, et un nom peut tromper. **Le vérifier au premier échange.**
- Commencer par Marseille : c'est ton terrain et il y a moins d'entreprises à traiter.

## 4. Le parcours d'une entreprise

Trois messages au maximum, puis on arrête.

| Jour ouvré | Action | But |
|---|---|---|
| J0 | Mail 1, personnalisé | Obtenir 20 minutes |
| J+2 | Appel au standard | Parler au dirigeant ou au dispatcher |
| J+5 | Mail 2, très court | Dernière question simple |
| J+9 | Mail 3, clôture | Laisser la porte ouverte, puis fin |

Une réponse, même négative, arrête la suite automatique. Un « stop » arrête tout, définitivement.

**La version visuelle du mail** (`docs/operations/email/prospection/`, validée le 30 octobre) reste utile, mais pas au premier contact : un mail mis en forme et sans personnalisation ressemble à de la publicité et finit plus facilement en indésirables. Elle part après un premier échange, si la personne demande une présentation, une fois ajoutés l'identité et la bonne adresse de réponse.

**LinkedIn :** en complément, message manuel au dirigeant s'il a un profil, sans outil automatique.

## 5. Calendrier

Tu es à New York : **6 h de décalage avec la France depuis ce matin** (passage à l'heure d'hiver américaine). Tout tient dans un bloc : **de 8 h à 11 h à New York, soit de 14 h à 17 h en France.** Le matin français est sans doute le moment le plus chargé des dispatchers : à confirmer dès les premiers appels.

| Date | Heure de New York | À faire |
|---|---|---|
| **Lun. 2 nov.** | 7 h – 8 h | Demande de SIREN sur le Guichet unique, puis création de la boîte mail. Mail de test vers Gmail et Outlook. Trouver les coordonnées des 8 entreprises marseillaises de la vague 1 (partie 3). |
| | 8 h – 11 h | **Mail 1 aux 5 premières entreprises** qui ont une adresse. Appeler celles qui n'ont qu'un standard, pour se roder : le seul but est de tester le script. |
| | Fin de bloc | Remplir le tableau. Noter les phrases qui ont marché ou bloqué. Trouver 10 coordonnées de plus pour mardi. |
| Mar. 3 | 8 h – 11 h | 10 nouveaux mails. Revoir les mails si une adresse est refusée. Chaque soir : 10 coordonnées pour le lendemain. |
| Mer. 4 | 8 h – 11 h | 10 nouveaux mails. Appels aux contacts de lundi. |
| Jeu. 5 | 8 h – 11 h | 10 nouveaux mails. Appels aux contacts de mardi. Ton rappel de 18 h ne gêne pas. |
| Ven. 6 | 8 h – 11 h | 10 nouveaux mails. Appels. **Première revue** (partie 9). |
| Lun. 9 | 8 h – 11 h | 10 à 15 nouveaux mails. Mail 2 aux contacts sans réponse. Entretiens. |
| Mar. 10 | 8 h – 11 h | Idem. |
| **Mer. 11** | — | **Férié en France : aucun envoi, aucun appel.** |
| Jeu. 12 | 8 h – 11 h | Idem. Décider : garder ou résilier LinkedIn Premium (rappel dans ton agenda). |
| Ven. 13 | 8 h – 11 h | Mail 3 aux premiers contacts. **Bilan des deux semaines** (partie 9). |

Ton agenda porte un bloc « MARIE » du 13 au 27 novembre. Je ne sais pas s'il te rend indisponible : le plan s'arrête donc au 13. Sinon, pendant ce bloc, garder seulement les rendez-vous pris et les réponses.

## 6. Ce que tu peux dire, et ce qu'il ne faut pas dire

| Sujet | À dire | À ne pas dire |
|---|---|---|
| Maturité | « On cherche nos premières entreprises, tu parles à celui qui construit le produit. » | « Nos clients », « des dizaines d'entreprises » |
| Gain | « Tout est au même endroit : commande, livreur, messages, preuve. On veut mesurer le gain avec vous. » | « 11 actions contre 1 », « X % de temps gagné » |
| GPS | « Position datée pendant la mission. Sur iPhone, elle s'envoie quand l'écran est allumé et l'application ouverte. » | « Suivi en continu », « marche écran verrouillé ». Android : pas encore testé |
| Commandes | « Le client passe sa commande dans son espace. » | Que les mails entrants deviennent des commandes : fonction pas encore ouverte aux vrais clients. Les commandes récurrentes automatiques : en panne sur tutelliv.fr selon l'audit du 1er novembre |
| Factures | « Export comptable et factures Factur-X en cours de validation. » | « Conforme », « certifié », « plateforme agréée » |
| Données | « Base hébergée à Paris. Aucune vraie donnée tant que le cadre juridique n'est pas signé. » | « 100 % conforme RGPD » |
| Support | « Réponse visée sous un jour ouvré. » | Un délai garanti |
| Pilote (après le SIREN) | « 4 semaines, accompagné, sans obligation de s'abonner, données exportées à la fin. Gratuit, à confirmer dans l'accord. » | Une date de démarrage |
| Prix (après le SIREN) | Starter 79 €, Pro 179 €, Business 349 € HT par mois, si la personne demande. Avant : « Je ne vends rien pour l'instant, je veux d'abord comprendre votre travail. » | Une remise inventée |

## 7. Les textes

Remplacer tout ce qui est entre crochets. **Si tu ne peux pas écrire une phrase vraie à la place de `[détail]`, supprime-la.**

### Mail 1

Objet : `Vos courses à [ville] : une question`

```text
Bonjour,

Je m'appelle Orso Carotenuto-Marchetti. Je construis TutelLiv, un logiciel pour les entreprises de coursiers et de livraison express.

[Détail vrai : « J'ai vu sur votre site que vous livrez à vélo dans Paris. »]

Une question : aujourd'hui, comment arrivent vos commandes, et comment vos livreurs reçoivent-ils leurs courses ? Téléphone, mail, WhatsApp ?

Je cherche à comprendre comment travaillent une dizaine d'entreprises comme la vôtre. Je ne vends rien pour l'instant. Auriez-vous 20 minutes cette semaine ?

Orso Carotenuto-Marchetti
TutelLiv

--
Orso Carotenuto-Marchetti, entrepreneur individuel (immatriculation en cours), 10 traverse de la Gaye, 13009 Marseille.
Adresse trouvée sur [votre site / l'annuaire X]. Pour ne plus recevoir de message, répondez « stop » : je retire votre adresse aussitôt.
```

**Après le SIREN :** remplacer « immatriculation en cours » par le numéro, ajouter `https://tutelliv.fr`, et finir par : « Si le sujet vous parle, je vous montre le logiciel. »

### Mail 2 (J+5)

Objet : répondre au mail 1.

```text
Bonjour,

Je me permets une relance, juste une question : qu'est-ce qui vous prend le plus de temps entre la commande et la livraison ?

Une ligne de réponse me suffit.

Orso

[même pied de mail]
```

### Mail 3 (J+9)

Objet : répondre au fil.

```text
Bonjour,

Je ne vous relancerai plus. Si un jour le sujet de l'organisation de vos courses revient, vous pouvez me répondre ici.

Bonne continuation,
Orso

[même pied de mail]
```

### Appel au standard

```text
Bonjour, Orso Carotenuto-Marchetti, de TutelLiv. Je cherche à joindre la personne qui organise les courses : [nom du dirigeant] ou le responsable d'exploitation. C'est possible ?
```

Si on demande pourquoi :

```text
Je construis un logiciel pour les entreprises de coursiers. J'ai une question sur votre façon d'organiser les courses. C'est court.
```

### Appel à la bonne personne

```text
Bonjour [nom], Orso Carotenuto-Marchetti, de TutelLiv. Je vous appelle sans rendez-vous : vous avez deux minutes, ou je rappelle à un meilleur moment ?

Je construis un logiciel pour les entreprises de coursiers. Je ne vends rien aujourd'hui : j'essaie de comprendre comment vous travaillez.

Votre dernière commande de ce matin, elle est arrivée comment, et comment le livreur l'a reçue ?
```

Puis écouter. Finir par une seule demande :

```text
Merci, c'est précis. Est-ce qu'on peut prendre 20 minutes [jour] à [heure] ? Je vous pose quelques questions, et je vous montre le logiciel si vous voulez le voir.
```

Si la personne refuse d'être rappelée : « Entendu, je ne vous rappellerai pas. Bonne journée. » Puis cocher « Ne plus contacter ».

### Messagerie

```text
Bonjour, Orso Carotenuto-Marchetti, de TutelLiv, un logiciel pour les entreprises de coursiers. J'ai une question courte sur votre façon d'organiser les courses. Je vous envoie un mail à ce sujet. Bonne journée.
```

### Réponses types

**« Stop » ou « Ne me contactez plus » :**

```text
C'est noté, votre adresse est retirée. Désolé pour le dérangement. Orso
```

**« Envoyez-moi de la documentation » :**

```text
Je n'ai pas encore de documentation à vous envoyer : le logiciel se comprend mieux en 10 minutes à l'écran. Si cela vous va, je vous le montre [jour] à [heure]. Combien de livreurs avez-vous, et comment arrivent vos commandes aujourd'hui ?
```

**« Ça m'intéresse, on peut l'essayer ? » (avant le SIREN) :**

```text
Merci, cela me fait plaisir. Je ne peux rien ouvrir pour l'instant : mes démarches et le cadre juridique sont en cours, et je préfère le faire correctement. Je note votre intérêt et je vous recontacte dès que c'est prêt, si cela vous va. En attendant, je peux vous montrer le logiciel sur des données fictives : [jour] à [heure] ?
```

**Même question, après le SIREN :**

```text
Merci. Je prépare mes premiers pilotes : 4 semaines, accompagnés, sans obligation de vous abonner ensuite, vos données exportées à la fin. Je ne peux pas encore y mettre de vraies données : le cadre juridique est en cours de validation et je préfère le faire correctement. Je vous garde une place et je vous préviens dès que c'est prêt. Prenons 20 minutes pour regarder si cela correspond à votre activité : [jour] à [heure] ?
```

### Mail « Il en est où ? » (version finale du 5 novembre 2026)

Mail court aux couleurs de TutelLiv, validé en version finale par le propriétaire le 5 novembre 2026 : objet « Il en est où ? », aperçu « Bonjour, mon colis, il en est où ? Ça vous dit quelque chose ? » (clin d'œil assumé, jamais déguisé en message de client), « Vous en avez marre de ce genre de question ? », parcours de A à Z en cinq étapes (commande par e-mail, WhatsApp… au même endroit ; dispatch intelligent ; livreur sans appel ni message ; carte client en direct désactivable ; facture envoyée et relances automatiques), bouton « Je veux en être » vers le formulaire de liste d'attente, lien vers le site, signature « Carotenuto-Marchetti Orso », pied de mail CNIL (identité, origine de l'adresse, STOP). Modèle de référence : `docs/operations/email/prospection/teaser-il-en-est-ou.html` ; le mail réellement envoyé est produit par `src/domains/growth/prospect/prospect-email.ts`, logo joint au mail pour Outlook. Écart décidé par le propriétaire : le lien vers le site part avant le SIREN.

### Envoyer et suivre une campagne (`/admin/campaigns`)

Avant la première campagne (une seule fois) : migration `20261106100000_prospect_campaigns` appliquée en préproduction, variable Vercel `PROSPECT_SMTP_PASSWORD` (mot de passe de `orso@tutelliv.fr`, environnement Preview, branche `preproduction`), puis déploiement. Sans mot de passe, la page affiche « Envoi pas encore configuré ». La réception WhatsApp annoncée dans le mail n'est pas encore ouverte (WHATSAPP-1) : le dire franchement à un prospect qui pose la question.

1. Créer la campagne : nom, ville (le code des liens en découle, par exemple `il-en-est-ou-paris`) et origine des adresses.
2. Coller les adresses : doublons et adresses STOP écartés.
3. « M'envoyer un essai » : le mail arrive dans la boîte du super-administrateur, liens au code `test`.
4. « Lancer l'envoi » : un mail toutes les 30 secondes depuis `orso@tutelliv.fr`, page ouverte ; « Pause » à tout moment.
5. Chaque STOP reçu : coller l'adresse dans « Adresses STOP ». Chaque réponse : bouton « + » de la colonne Réponses.

Chiffres par campagne : envoyés, clics « Je veux en être », clics vers le site, visites du formulaire, candidatures, réponses. Pas de comptage des ouvertures (pixel bloqué par Outlook, faussé par l'iPhone, encadré par la CNIL). Les robots évidents et les vérifications de liens des messageries ne sont pas comptés ; certains antivirus d'entreprise peuvent tout de même gonfler un peu les clics.

## 8. Le rendez-vous de 20 à 30 minutes

Pitch en 10 secondes, 30 secondes et 2 minutes, supports et démonstration minute par minute : [`PITCH.md`](PITCH.md).

**D'abord écouter (15 minutes).** Reprendre le guide d'entretien existant de [`docs/CADRAGE_CLIENT.md`](../../CADRAGE_CLIENT.md). Les quatre questions à ne pas sauter :

1. Prenons la dernière commande : par où est-elle arrivée, qui a fait quoi jusqu'à la fin ?
2. Quand avez-vous dû attendre, ressaisir, téléphoner ou vérifier une information ?
3. Dernier problème : que s'est-il passé, et combien de fois récemment ?
4. Qui déciderait d'un changement, et qu'est-ce qui l'en empêcherait ?

Ne pas demander « Vous aimeriez une carte en direct ? » ni « Vous paieriez 179 € ? ». Une réponse polie n'est pas un engagement.

**Ensuite montrer (10 minutes), seulement si la personne veut le voir.** Partager ton écran sur la démo :

1. le client passe une commande ;
2. le dispatcher voit la commande et affecte un livreur ;
3. le livreur confirme et démarre ;
4. le client voit l'état de la livraison.

**Ne jamais ajouter de photo ni de signature dans la démo :** c'est ce qui a bloqué une place le 28 octobre, et le blocage est définitif tant que personne n'intervient. La preuve se raconte, ou se montre dans la visite animée de la page d'accueil, à jouer depuis le début.

**Se déconnecter à la fin de la démo** : cela libère une place pour le suivant. Vérifier avant chaque rendez-vous que la démo s'ouvre. Ne pas montrer les invitations, ni taper une vraie adresse dans la démo : ce blocage reste à corriger (AUDIT-0111).

**Pour finir, demander une chose :**
- bon profil : « Puis-je vous recontacter quand le logiciel sera prêt à être essayé ? » ;
- doute : « À quelle condition cela vous servirait-il ? » ;
- après le SIREN seulement : « Je vous garde une place de pilote » et, pour le prix, montrer la formule qui correspond puis demander : « À quel prix diriez-vous non, et pourquoi ? »

### Objections

| Ce qu'on te dit | Réponse honnête |
|---|---|
| « Je n'ai pas le temps. » | « Je comprends. Je vous pose une seule question par mail, ou je rappelle à quelle heure ? » |
| « On a déjà un outil. » | « Lequel ? Qu'est-ce qui marche bien, qu'est-ce qui manque ? » Noter le nom : on ne connaît pas encore les outils du marché. |
| « WhatsApp nous suffit. » | « D'accord. Qu'est-ce qui se passe quand un client demande une preuve vieille de trois semaines ? » |
| « Mes clients ne passeront pas par un portail. » | « C'est important pour moi. Aujourd'hui, le portail est l'entrée principale. Comment commandent-ils chez vous ? » Noter : c'est peut-être le frein numéro un. |
| « Mes livreurs n'utiliseront pas ça. » | « Pourquoi ? Quel téléphone ont-ils ? » Noter Android ou iPhone. |
| « Vous êtes qui ? Vous avez des clients ? » | « Non, pas encore. Je suis seul sur le produit et je cherche à comprendre le métier avant d'ouvrir. Vous me parleriez directement. » |
| « Et si vous disparaissez ? » | « Vous n'êtes engagé à rien. Le pilote prévoit l'export de vos données à la fin. » |
| « C'est combien ? » (avant le SIREN) | « Je ne vends pas encore : combien cela vaudrait-il pour vous si cela réglait ce problème ? » Noter sans discuter. |
| « C'est trop cher. » (après le SIREN) | « Par rapport à quoi ? À quel prix cela deviendrait-il évident ? » Noter sans discuter. |
| « Et la facture électronique ? » | « Je produis déjà un fichier Factur-X, pas encore validé. TutelLiv n'est pas une plateforme agréée : le dépôt reste chez vous ou chez votre comptable. » |

## 9. Le suivi

**Une seule ligne par entreprise** dans le fichier de prospects. À remplir tout de suite après chaque contact.

Les chiffres de ce fichier (étapes, rappels du jour, revue du vendredi) s'affichent dans `/admin/prospection`, une fois la Sheet branchée : [SHEET.md](SHEET.md).

Étapes : `À qualifier` → `Contacté` → `En discussion` → `Entretien fait` → `Démo faite` → `Intéressé` → `Pilote signé`, ou `Perdu`, ou `Ne plus contacter`.

**Chaque matin (10 minutes) :**
1. Lire la boîte mail et les réponses.
2. Regarder `/admin/contact`.
3. Vérifier que la démo s'ouvre.
4. Traiter les « stop » en premier.

**Revue du vendredi 6 novembre, puis du 13.** Compter : entreprises contactées, réponses, conversations, entretiens, démos, entreprises intéressées, « stop », adresses refusées.

| Ce qu'on observe | Décision |
|---|---|
| Plus de 3 adresses refusées sur 20 | Arrêter les envois et nettoyer la liste |
| Un message marqué comme indésirable ou une plainte | Arrêter, relire le mail et la source de l'adresse |
| Moins de 2 conversations sur 30 entreprises | Changer l'objet et la question, ou appeler d'abord |
| Beaucoup de réponses à côté (pas des coursiers) | Revoir la liste, pas le message |
| La même objection trois fois | La remonter : elle compte plus qu'une idée isolée |
| 10 entretiens faits | Écrire la synthèse pour PROD-02 et choisir le problème numéro un |

## 10. Ce qui reste à faire pour lancer un vrai pilote

Le démarchage peut trouver les entreprises, mais le pilote reste bloqué tant que ces points ne sont pas fermés ([protocole complet](../pilot1/README.md)) :

- SIREN et identité de l'éditeur ;
- corrections de l'audit du 1er novembre et vraie production : aujourd'hui, tutelliv.fr tourne sur une préversion (AUDIT-0111) ;
- juriste choisi, accord de pilote signé, RGPD, GPS, photos et durées de conservation validés (LEGAL-1, DATA-02) ;
- essai sur un téléphone Android (MOB-01C) ;
- passage de Supabase en Pro avant les vraies données ;
- référent chez le pilote, support et plan de retour aux mails en cas de panne.

**Le plus urgent en parallèle : le SIREN, puis le juriste.** C'est lui qui permettra de fixer une date à annoncer.

## 11. Règles légales suivies

Lecture faite le 1er novembre 2026, à faire confirmer par le juriste.

- **Mail vers un professionnel :** pas besoin d'accord préalable si le message concerne son métier, ce qui est le cas ici. Chaque message doit donner l'identité de l'émetteur et un moyen simple de refuser ([CNIL](https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique)).
- **Adresses génériques** (`contact@`, `info@`) : ce sont des adresses d'entreprise, donc à privilégier.
- **Adresses devinées** (`prenom.nom@`) : **on ne le fait pas.** La CNIL exige une analyse et une information sur la source, avec des garanties ([fiche du 16 octobre 2026](https://www.cnil.fr/fr/reconstitution-adresses-professionnelles-vos-droits)). Une adresse nominative n'entre dans le fichier que si la personne la donne ou la publie pour son activité.
- **Téléphone :** depuis le 11 août 2026, l'interdiction vise le démarchage d'un *consommateur* sans accord (article L. 223-1). Les professionnels semblent exclus mais gardent le droit de refuser ([analyse d'avocat](https://consultation.avocat.fr/blog/fabienne-menu/article-2981244-demarchage-telephonique-ce-qui-change-radicalement-le-11-aout-2026.html), [Selectra](https://selectra.info/telecom/actualites/marche/cnil-adresse-mail-pro-devinee-prospection)). **Point non vérifié :** [la page du ministère](https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/professionnels-comment-respecter-la-reglementation-sur-le-demarchage) n'a pas pu être lue et le résumé disponible ne distingue pas les professionnels. Par prudence : appeler uniquement les lignes d'entreprise, jamais un portable privé, de 14 h à 17 h heure française, et respecter tout refus.
- **Petites entreprises (5 salariés ou moins) :** un contrat signé hors de leurs locaux habituels, sur un sujet étranger à leur activité principale, peut leur ouvrir les protections du consommateur, dont la rétractation (article [L. 221-3](https://www.dalloz-actualite.fr/document/civ-1re-31-aout-2022-f-b-n-21-11455)). **Ne rien faire signer lors d'une visite sur place** avant l'avis du juriste.
- **Immatriculation :** [article L8221-4 du code du travail](https://code.travail.gouv.fr/code-du-travail/l8221-4) ; voir partie 2.
- **Fichier de prospects :** noter la source de chaque adresse, ne garder que l'utile, retirer aussitôt les refus en conservant seulement ce qu'il faut pour ne pas recontacter. Durée : 3 ans après le dernier échange, selon le [projet de conservation](../data02/RETENTION_POLICY_DRAFT.md), à valider.

## 12. Décisions prises dans ce plan

| Décision | Écartée | Pourquoi |
|---|---|---|
| Mails un par un depuis une vraie boîte | Envoi groupé par Resend depuis `no-reply@` | Réponses possibles ; ne met pas en danger les mails de connexion |
| Premier contact en texte simple | Version visuelle | Le message doit lancer une conversation, pas ressembler à une publicité |
| Entretiens de recherche jusqu'au SIREN | Prix et pilote dès lundi | Choix du propriétaire le 1er novembre ; risque lié à l'absence d'immatriculation |
| Formules de `/tarifs` vers Contact | Laisser le bouton d'inscription | Paiement fictif sur `tutelliv.fr` ; choix du propriétaire le 1er novembre |
| But : un entretien | But : une vente | Le paiement réel et le contrat n'existent pas encore |
| 10 nouveaux contacts par jour | Plus large | Temps de personnalisation, boîte neuve, places de démo limitées |
| Trois messages au maximum | Relances sans limite | Petit marché : mieux vaut ne pas se griller |
| Adresses génériques et téléphone | Adresses devinées | Règle CNIL plus simple et moins risquée |
