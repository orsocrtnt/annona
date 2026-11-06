# Annona — vision produit, commerciale et de lancement

**Document de transmission pour stratégie marketing et commerciale**
**Date de référence : 18 octobre 2026**

## 1. Objet du document

Ce document décrit le produit final que Annona cherche à devenir. Il ne doit pas être lu comme une annonce de disponibilité commerciale immédiate ni comme une liste de promesses déjà validées sur le marché.

Annona dispose déjà d'un produit logiciel conséquent et de parcours fonctionnels testés. Plusieurs éléments indispensables à une vente réelle restent toutefois à terminer ou à valider : essais terrain sur téléphone, capacité sous charge, environnement de préproduction, e-mails réels, sauvegarde/restauration, conditions contractuelles, rentabilité de la grille tarifaire, abonnement Annona et validation auprès d'entreprises pilotes. Les corrections de navigation, le support intégré, la reprise des actions après coupure et la recette interne des trois rôles sont maintenant vérifiés localement.

Les statuts utilisés dans le document sont les suivants :

- **Développé et vérifié** : présent dans le produit et couvert par des tests ou une recette documentée. Cela ne signifie pas nécessairement « déployé en production ».
- **Développé mais à qualifier** : présent en totalité ou en grande partie, mais dépend encore d'une configuration externe, d'essais terrain ou d'une recette plus complète.
- **Planifié** : inscrit dans la roadmap avec un besoin et des critères connus, mais pas encore terminé.
- **Hypothèse stratégique** : piste possible à valider avec le marché, les coûts ou une décision du propriétaire. Elle ne doit pas être commercialisée comme une fonctionnalité confirmée.

La dernière validation locale compte 266 tests réussis. Le dernier build de production validé génère 101 pages. La recette navigateur opérationnelle couvre double clic, collecte, livraison avec photo et échec motivé, puis comparaison des vues client et administration, sans résidu de test. Le GPS physique et l'exploitation sur une préproduction isolée restent à qualifier. Aucun déploiement commercial n'est revendiqué.

---

## 2. Vision générale

### 2.1 Définition

Annona a vocation à devenir une plateforme SaaS B2B de gestion des opérations de livraison. L'entreprise de livraison s'abonne à Annona et met à disposition de ses propres clients, administrateurs, dispatchers et livreurs un espace commun.

La vision n'est pas celle d'un simple tableau de commandes. Annona doit devenir le dossier opérationnel partagé de chaque livraison : demande initiale, informations utiles, affectation, prise en charge, échanges, incidents, étapes, position datée, preuve, historique et éléments de facturation.

La promesse de travail peut être formulée ainsi :

> Centraliser les commandes, organiser les livreurs et rendre chaque livraison visible de bout en bout, sans dépendre d'une chaîne d'e-mails dispersée.

Cette formulation est une direction produit. Le gain de temps, la baisse des appels et la volonté de payer ne sont pas encore quantifiés auprès d'entreprises indépendantes ; ils devront être mesurés pendant les pilotes.

### 2.2 Problème d'origine

Le fonctionnement observé à l'origine repose principalement sur les e-mails :

1. un client envoie une commande à l'entreprise de livraison ;
2. l'administrateur reformule ou transfère la demande à un livreur ;
3. le livreur confirme également par e-mail ;
4. les changements, questions et incidents continuent dans plusieurs fils ;
5. il devient difficile de savoir qui a pris la mission, à quelle étape elle se trouve, où est le livreur et où retrouver la preuve finale.

Les difficultés déclarées sont le temps de coordination, le manque d'organisation et le manque de visibilité sur l'avancement et la position de la livraison.

### 2.3 Produit final attendu

À maturité, Annona doit fournir :

- un portail client en libre-service pour commander et suivre ;
- un cockpit d'administration et de dispatch pour piloter l'activité ;
- une application web mobile pour les livreurs ;
- un dossier unique par commande regroupant les acteurs, événements, messages, incidents, documents et preuves ;
- une isolation stricte des données de chaque entreprise ;
- une exploitation SaaS avec onboarding, support, abonnements, limites d'usage, supervision et procédures de reprise.

Le produit final reste volontairement centré sur les opérations. L'import automatique des commandes depuis les e-mails, une application mobile native, l'intelligence artificielle, le SMS généralisé et de nombreuses intégrations ne font pas partie du noyau confirmé.

---

## 3. Utilisateurs et entreprises cibles

### 3.1 Acheteur principal et segment retenus

L'acheteur est l'entreprise de livraison, et non le destinataire final d'un colis. Elle paierait un abonnement pour équiper son équipe et offrir un portail à ses donneurs d'ordre.

Le propriétaire a retenu les entreprises françaises de coursiers et de livraison express B2B, avec priorité Paris/Île-de-France et Marseille/Bouches-du-Rhône. Le cœur de cible compte 5 à 20 livreurs ; les structures de 3 à 5 livreurs constituent une cible secondaire. L'acheteur principal est le dirigeant ou responsable d'exploitation et le dispatcher est le prescripteur et utilisateur quotidien. Ces entreprises ont généralement :

- plusieurs livreurs à coordonner ;
- des clients récurrents ;
- des commandes reçues par e-mail, téléphone ou messagerie ;
- un besoin de suivi partagé et de preuve ;
- une organisation trop petite ou trop spécifique pour un système logistique lourd.

Ce cadrage est une décision produit et commerciale, pas encore une preuve de marché. Les entretiens et pilotes doivent encore mesurer l'intensité du problème, les volumes, les outils concurrents et la volonté de payer. La V1 exclut le médical réglementé, les matières dangereuses, le froid contrôlé, l'international/douanes, le transport lourd et la logistique industrielle complexe.

Annona n'est pas encore positionné pour promettre la gestion complète d'un grand transporteur national, d'un entrepôt, d'une chaîne logistique internationale ou d'une flotte industrielle complexe.

### 3.2 Rôles dans l'entreprise cliente

#### Dirigeant ou administrateur de l'entreprise

Ses besoins sont de voir l'activité, configurer les services, gérer les utilisateurs, contrôler les droits, suivre les retards, consulter les indicateurs et conserver un historique exploitable.

#### Dispatcher ou exploitant

Son besoin principal est d'identifier les commandes à traiter, choisir le bon livreur, connaître sa capacité et sa disponibilité, gérer les conflits, les réaffectations et les incidents, puis agir depuis une vue opérationnelle unique.

#### Mini-administrateur

Annona prévoit un rôle intermédiaire avec des modules délégués. L'objectif est de permettre une gestion quotidienne sans donner tous les pouvoirs du compte entreprise.

#### Livreur

Il a besoin d'une interface mobile directe : voir les missions, accepter ou refuser, démarrer, naviguer, confirmer les étapes, communiquer, signaler un problème et fournir une preuve. Le produit doit rester compréhensible en mobilité et en réseau faible.

#### Client ou donneur d'ordre

Il crée une demande, suit l'affectation et les étapes, consulte une position utile et datée, échange dans le dossier, retrouve la preuve, l'historique et les documents disponibles. Il ne doit jamais accéder aux autres clients ou à toute la flotte.

#### Super-administrateur Annona

À terme, l'opérateur de la plateforme doit gérer les entreprises clientes, leur statut, l'assistance, les droits liés à l'abonnement et la santé générale du service. L'administration technique existe, mais l'exploitation commerciale complète de la plateforme reste à construire.

---

## 4. Fonctionnalités du produit

## 4.1 Socle SaaS, comptes et sécurité

### Développé et vérifié

- Architecture multi-tenant : chaque entreprise constitue un espace distinct et les données métier sont rattachées à son identifiant.
- Rôles et permissions granulaires : super-administrateur, administrateur d'entreprise, mini-administrateur, dispatcher, livreur et client.
- Contrôles côté serveur sur les routes, les ressources, les téléchargements et les frontières entre entreprises.
- Suspension des comptes et des entreprises prise en compte dans les accès.
- Refus des augmentations indues de privilèges des mini-administrateurs.
- Isolation vérifiée sur les commandes, livraisons, factures, support, photos et exports.
- Authentification par Supabase et sessions protégées.

### Développé mais à qualifier

- Invitation et récupération de compte sans mot de passe temporaire persistant : le code est préparé, mais le SMTP, les modèles d'e-mail, les domaines et les liens réels doivent être configurés et testés.
- Inscription et onboarding de l'entreprise : un guide à sept étapes calculées depuis l'état réel a été testé jusqu'à la première livraison fictive. L'usage par un pilote, la réception réelle des invitations et un éventuel import restent à qualifier.
- Statut d'essai au niveau de l'entreprise : le modèle de données sait représenter un essai, mais il ne constitue pas encore une période d'essai commerciale automatisée.

### Planifié

- séparation nette entre développement, préproduction et production ;
- historique versionné des migrations de base et procédure de retour arrière ;
- sauvegarde et restauration complètes incluant base, photos et configuration ;
- branchement opérationnel de la supervision et des alertes : les sondes et journaux sont développés, mais le canal réel, son responsable et la simulation d'incident sur préproduction restent à valider ;
- gestion du cycle contractuel et des droits liés à l'abonnement Annona.

## 4.2 Portail client

### Développé et vérifié

- Tableau de bord client.
- Création de commandes de livraison standard.
- Création de courses avec collecte avant livraison.
- Formulaires atomiques et protégés contre les doubles créations grâce à l'idempotence.
- Carnet d'adresses client.
- Consultation des commandes actives et de l'historique.
- Recherche, filtres, tri stable et pagination côté serveur.
- Export CSV complet et limité à l'entreprise et au client autorisés.
- Détail d'une commande et de ses livraisons.
- Suivi partagé des étapes, du responsable actuel et de la dernière position autorisée.
- Indication honnête d'une position absente, périmée, arrêtée ou indisponible.
- Carte des livraisons, avec pannes de fonds ou d'itinéraire rendues visibles.
- Fil de discussion lié à la commande, notifications et statut de lecture.
- Messages publics séparés des notes internes.
- Alertes opérationnelles visibles selon les droits.
- Consultation de la preuve de livraison privée pour les rôles autorisés.
- Consultation des relevés de prestation de livraison et téléchargement PDF opérationnel ; aucune émission réglementaire de facture électronique.
- Nouvelle commande à partir d'une livraison ou commande précédente.
- Support intégré : demande client, réponse de l'équipe, notification, historique, résolution et réouverture. Le canal affiché est l'espace Annona avec un objectif de première réponse sous un jour ouvré ; l'équipe qui tiendra cet objectif doit être organisée avant usage réel.

### Développé mais à qualifier

- Commandes récurrentes : occurrences durables, reprises d'erreur et fins de mois sont testées dans le calendrier UTC retenu. La cadence réelle du cron et sa surveillance sur l'hébergement restent à valider ; aucune couverture de tous les fuseaux n'est annoncée.
- Missions spéciales : le socle demande multi-adresses, conversion manuelle après accord externe, livraison et facture est testé. Le devis chiffré et son acceptation intégrée sont absents ; ce service reste expérimental, désactivé par défaut et exclu du pilote.
- Estimation du prix d'une course : configurable, mais dépend de la qualité du géocodage, de l'itinéraire et des règles tarifaires.
- Émission finale de factures : exclue de la promesse V1. BILL-01A retient les informations tarifaires, les documents opérationnels et l'export comptable ; BILL-01B qualifie cette branche, sans prétendre valider une comptabilité complète.

### Planifié

- onboarding guidé du client jusqu'à sa première commande réussie ;
- amélioration continue de la lisibilité, de l'accessibilité et des performances ;
- règles de conservation, export de sortie et suppression des données selon contrat et réglementation.

## 4.3 Administration et dispatch

### Développé et vérifié

- Tableau de bord d'activité et indicateurs par période.
- Liste et détail des commandes, clients, livreurs et utilisateurs.
- Dispatch manuel d'une livraison vers un livreur.
- Réaffectation, désaffectation et annulation avec règles métier et conservation de l'historique.
- Protection contre deux affectations concurrentes incohérentes.
- Contrôle de la capacité, de la disponibilité, de la pause, des catégories et des zones.
- Possibilité de forcer uniquement certains dépassements de capacité, avec trace explicite.
- Dispatch automatique configurable par priorité, charge ou zone, avec catégories activables.
- Option de libre prise de mission par les livreurs, configurable.
- Cartes des livraisons et des livreurs.
- Vue des tâches opérationnelles en attente, en cours ou échouées et possibilité de relance autorisée.
- Retards et incidents actionnables : prise en compte, action prévue, résolution et journal durable.
- Alertes séparées d'une simple lecture de notification.
- Paramètres de catégories de livraison, dispatch, localisation, tarifs de course et facture.
- Historique complet, recherches, filtres et export.
- Fil opérationnel par commande avec notes internes.

### Améliorations récentes vérifiées et limites

- **PERF-01** : navigation et connexion mesurées et améliorées dans les trois espaces, avec retour visuel immédiat et budgets locaux vérifiés. La capacité sous charge réelle reste à mesurer.
- **MAP-3** : rendu cartographique sobre noir/blanc implémenté et testé techniquement ; revue visuelle finale du propriétaire différée.
- **DISPATCH-2** : un clic sur une commande en retard ouvre le dossier exact, sélectionné et mis en évidence dans le dispatch et sur la carte, y compris après rechargement.
- Onboarding interne à sept étapes : testé jusqu'à la première livraison fictive ; facilité d'utilisation et temps humain à confirmer avec un pilote.
- Démonstration isolée par navigateur : deux sessions indépendantes et réinitialisation limitée testées. Les démos expirées restent à nettoyer selon une future politique.

## 4.4 Application livreur

### Développé et vérifié

- Interface web mobile dédiée.
- Ouverture et fermeture explicites du service du livreur.
- Liste des missions disponibles et affectées selon les règles de l'entreprise.
- Acceptation ou refus motivé d'une mission.
- Distinction entre affectation, acceptation et démarrage réel.
- Protection contre la prise concurrente d'une mission déjà attribuée.
- Début de mission interdit tant que la prise en charge n'est pas confirmée.
- Parcours livraison standard et course avec collecte.
- Navigation cartographique vers collecte ou destination.
- Contrôle de proximité avec confirmation explicite hors zone.
- Retour visuel immédiat et attente GPS/proximité bornée.
- États GPS explicites : recherche, succès confirmé par le serveur, position périmée, permission refusée, réseau perdu, serveur indisponible ou service arrêté.
- Publication GPS uniquement lorsque le service et une mission active l'autorisent.
- Changement d'étape, échanges opérationnels et incidents.
- Validation d'achats pour les courses lorsqu'elle s'applique.
- Preuve de livraison par photo privée, note ou motif d'échec.
- Validation réelle du contenu et de la taille de l'image, rejeu idempotent et nettoyage des fichiers non attachés.
- File locale persistante des actions et photos avant envoi, reprise bornée après reconnexion et refus visibles. Les coupures injectées dans Chrome sont testées ; les essais physiques restent nécessaires.

### Développé mais à qualifier

- L'application est une interface web responsive, pas une application native.
- Le fonctionnement sur iPhone et Android physiques, écran verrouillé, arrière-plan et déplacements réels doit être testé.
- La reprise avec verrouillage, fermeture du navigateur et contraintes des systèmes mobiles doit être évaluée sur appareils physiques ; une file locale ne garantit pas une exécution permanente en arrière-plan.
- Le suivi permanent en arrière-plan ne doit pas être promis dans l'état actuel.

## 4.5 Cartographie, géocodage et itinéraires

### Développé et vérifié

- Fond OpenStreetMap configurable et zoom borné.
- Attribution obligatoire visible.
- Cartes administrateur, client et livreur compatibles avec rendu mobile et ordinateur.
- États explicites lorsque les tuiles, le géocodage ou l'itinéraire sont indisponibles.
- Suppression des faux trajets en ligne droite, des durées à zéro et des coordonnées inventées.
- Géocodage via l'API IGN et itinéraires de démonstration via OSRM, avec délais et validation des réponses.
- Une adresse non localisée reste dans la liste au lieu d'être remplacée par un faux point.

### Limites et décisions à prendre

- Les services publics utilisés pour le développement ne constituent pas une infrastructure commerciale garantie.
- L'instance OSRM publique n'est pas qualifiée pour un SaaS payant.
- Avant vente, il faut choisir un fournisseur sous contrat ou une solution auto-hébergée, puis fixer capacité, budget, confidentialité, quotas et alertes de coûts.
- La direction sobre et monochrome est implémentée ; la revue visuelle finale du propriétaire reste différée.

## 4.6 Coordination, incidents et support

### Développé et vérifié

- Fil partagé par commande entre les acteurs autorisés.
- Auteur, rôle, date, catégorie et statut de lecture.
- Notes internes invisibles au client.
- Notifications de nouveaux échanges.
- Conservation de l'historique après réaffectation ou fin de mission.
- Alertes de retard basées sur la date demandée réellement enregistrée.
- Incidents opérationnels, prise en compte, action prévue et résolution.
- Mise en évidence directe de la commande en retard dans le dispatch et sur la carte.
- Boucle d'assistance client → équipe → client avec historique, notification, résolution et réouverture, distincte du fil opérationnel.

### Planifié ou à qualifier

- e-mails transactionnels réels pour invitation, récupération et alertes utiles ; le transport métier local distingue désormais les modes désactivé, recette vers une boîte unique et réel, mais domaine, SMTP et réception restent à qualifier ;
- SMS uniquement si les pilotes démontrent un besoin répété et rentable.

## 4.7 Historique, données, facturation et analytics

### Développé et vérifié

- Historique logistique cohérent et séparé de la facturation.
- Les actions de facturation ne changent plus le statut réel de la livraison.
- Recherche et pagination sur des volumes testés jusqu'à 1 000 commandes.
- Exports cloisonnés par entreprise et client.
- Tableaux de bord et indicateurs d'activité.
- Relevé opérationnel PDF paginé, vérifié sur 160 lignes et neuf pages, avec qualification explicite du document.
- Export comptable privé versionné des prestations, période UTC et statut explicites, 29 colonnes DOCUMENT/LINE, Decimal et versions traçables ; recette de 1 001 documents A + 1 B et lecture concurrente cohérente réussies, sans résidu. Le rapprochement et l'imputation restent dans l'outil comptable externe.
- Paramètres simples : TVA, échéance, préfixe, pied de page, prix de base, prix kilométrique et suppléments.
- Export opérateur privé d'une entreprise avec données relationnelles, photos et manifeste d'intégrité SHA256, vérifiable hors ligne. Le canal de remise, le chiffrement, la conservation et la restauration restent à qualifier ; aucun téléchargement public en libre-service n'est proposé.

### Décisions ouvertes

- La V1 retient l'export comptable et les documents opérationnels. Le choix d'un outil comptable ou d'une plateforme agréée pour une future intégration reste ouvert ; contrat et limites historiques : [BILL-01B](operations/bill01b/README.md).
- Si Annona émet des factures finales, il faudra traiter numérotation, instantanés immuables, avoirs, arrondis, taxes, mentions, documents longs et validation réglementaire.
- La facturation des livraisons réalisées par l'entreprise ne doit jamais être confondue avec la facturation de l'abonnement Annona.

---

## 5. Parcours utilisateur complet attendu

## 5.1 Acquisition et création de l'entreprise

1. L'entreprise découvre une offre correspondant à son activité.
2. Elle demande une démonstration, démarre un pilote ou crée un compte selon le modèle retenu.
3. Un administrateur crée ou active l'espace de son entreprise.
4. Il choisit les catégories de service réellement proposées : livraison standard et course. La mission spéciale reste une option expérimentale désactivée par défaut, hors offre pilote tant que le devis et son acceptation ne sont pas intégrés.
5. Il configure ses règles principales : zones, capacités, stratégie de dispatch, disponibilité des livreurs, tarifs indicatifs, règles de localisation et informations de facturation.
6. Il invite ses collaborateurs, livreurs et premiers clients.

Le guide d'onboarding est développé et vérifié sur entreprise fictive. Son exécution par un pilote, le contrat, l'essai commercial et l'abonnement restent à finaliser.

## 5.2 Création d'une commande par le client

1. Le client se connecte au portail de son entreprise de livraison.
2. Il choisit le service autorisé.
3. Il sélectionne une adresse enregistrée ou saisit une nouvelle adresse.
4. Pour une course, il renseigne la ou les collectes avant la destination.
5. Il ajoute les articles, instructions, date souhaitée et informations utiles.
6. Une estimation peut être affichée si l'entreprise l'a activée et si l'itinéraire est disponible.
7. La validation crée une seule commande, même après double clic ou répétition réseau.
8. La référence apparaît dans l'espace client et dans l'espace administrateur.

Ce parcours standard est largement développé et testé. Les récurrences sont qualifiées en interne, sous réserve du cron déployé et de sa surveillance. Pour les missions spéciales, seul le socle demande multi-adresses → conversion manuelle → livraison → facture est vérifié ; le devis chiffré et son acceptation restent externes, donc hors offre pilote.

## 5.3 Traitement par le dispatch

1. La nouvelle commande apparaît dans la file à traiter.
2. Le dispatcher voit la catégorie, la zone, l'échéance, les contraintes et les livreurs éligibles.
3. Il affecte manuellement ou laisse le dispatch automatique proposer un livreur selon les règles de l'entreprise.
4. Les contraintes de pause, capacité, zone et catégorie sont appliquées.
5. Les tentatives concurrentes aboutissent à un seul responsable.
6. Une tâche opérationnelle durable conserve les notifications ou actions différées, même si leur exécution échoue temporairement.

Le clic sur une commande en retard depuis une alerte permet déjà de retrouver le dossier exact mis en évidence dans le dispatch et sur la carte.

## 5.4 Prise en charge par le livreur

1. Le livreur ouvre son service.
2. Il reçoit ou voit la mission autorisée.
3. Il l'accepte explicitement ou la refuse avec un motif.
4. L'administrateur et le client voient qui est responsable et à quel moment la mission a été acceptée.
5. Le livreur démarre réellement la mission ; l'acceptation ne vaut pas démarrage.
6. Le suivi GPS ne commence que dans le périmètre autorisé.

## 5.5 Exécution et coordination

1. Le livreur suit l'itinéraire disponible vers la collecte ou la destination.
2. Les étapes sont confirmées selon le type de mission.
3. Un contrôle de proximité aide à éviter une validation accidentelle ; une action hors zone exige une confirmation explicite.
4. Le client, le dispatch et le livreur utilisent le fil de la commande pour les questions, changements et incidents.
5. Les notes internes restent réservées à l'équipe de livraison.
6. Une position datée est affichée uniquement aux personnes autorisées. Une position absente ou périmée est signalée honnêtement.
7. Un retard ou incident devient une alerte avec un responsable, une action et une résolution.

## 5.6 Clôture, preuve et après-livraison

1. Le livreur confirme la livraison ou indique un échec motivé.
2. Une photo, une note et l'heure de capture peuvent constituer la preuve selon les règles retenues.
3. La preuve reste privée et accessible uniquement aux rôles autorisés.
4. Le client retrouve la commande, le déroulé, les échanges et la preuve dans l'historique.
5. L'entreprise peut préparer un document de facturation ou exporter les données.
6. Les étapes logistiques restent intactes lorsque la facture est émise ou payée.
7. Les données peuvent ensuite être exportées ou conservées selon le contrat et la politique à définir.

---

## 6. Différenciation recherchée

La différenciation de Annona doit reposer sur la cohérence du parcours, pas sur une accumulation de fonctions.

### 6.1 Remplacer la chaîne d'e-mails par un dossier opérationnel

Le produit relie la commande, l'affectation, le livreur, les messages, l'incident, la position, la preuve et l'historique. Cette continuité est plus importante qu'une simple liste de livraisons.

### 6.2 Relier les trois acteurs dans un même système

De nombreux outils privilégient soit l'équipe interne, soit le chauffeur, soit le suivi client. Annona cherche à offrir trois espaces cohérents utilisant le même état métier, avec des vues et des droits adaptés.

### 6.3 Distinguer affectation, acceptation et exécution réelle

Une mission assignée n'est pas présentée comme acceptée. Une mission acceptée n'est pas présentée comme démarrée. Cette précision réduit les faux états rassurants et aide le dispatch à savoir quand agir.

### 6.4 Afficher honnêtement les limites du suivi

Une position est datée. Si elle est périmée, indisponible, masquée ou arrêtée, le produit le dit. Annona ne doit pas vendre un « temps réel permanent » non prouvé, en particulier lorsque le téléphone est verrouillé ou hors réseau.

### 6.5 Transformer les retards et incidents en actions

L'objectif n'est pas seulement d'afficher une alerte rouge, mais d'identifier la commande, la personne qui prend le sujet, l'action prévue et la résolution. La future mise en évidence directe dans le dispatch renforcera ce principe.

### 6.6 Adapter le dispatch à une petite structure

Les règles de capacité, catégories, zones, priorité et disponibilité peuvent être configurées sans imposer d'emblée une optimisation de tournées complexe. Annona vise une prise en main plus simple qu'un TMS lourd, tout en protégeant les cas de concurrence et d'historique.

### 6.7 Conserver sécurité et traçabilité au cœur du produit

L'isolation multi-tenant, les droits granulaires, les actions atomiques, l'idempotence, les tâches durables et l'historique ne sont pas des arguments visuels, mais ils conditionnent la confiance nécessaire à un produit opérationnel.

Ces différenciateurs sont des choix de conception. Leur valeur commerciale relative doit encore être comparée aux alternatives utilisées par les entreprises ciblées.

---

## 7. Architecture commerciale envisagée

## 7.1 Modèle de revenu

Le modèle envisagé est un abonnement SaaS B2B payé par l'entreprise de livraison. Ses clients et ses livreurs accéderaient aux espaces fournis dans le cadre de cet abonnement.

La grille cible confirmée comprend Starter à 79 € HT/mois, Pro à 179 € et Business à 349 €, avec un annuel correspondant à dix mensualités, des plafonds, options et dépassements configurables. Cette décision remplace l'ancienne hypothèse à 199 €. Elle fixe ce que le produit doit pouvoir représenter, mais les prix restent à confronter aux coûts réels et à la volonté de payer.

## 7.2 Séquence de commercialisation prévue

1. Finir un noyau V1 fiable et mesurable.
2. Conduire des entretiens dans le segment français confirmé, centrés sur des situations réelles.
3. Proposer à trois entreprises un pilote accompagné de quatre semaines, envisagé gratuitement et géré manuellement.
4. Conduire plusieurs pilotes, mesurer l'adoption des trois rôles, les incidents, le temps de coordination et le coût de support.
5. Ajuster la grille, les limites et la politique d'usage avec ces preuves.
6. Automatiser ensuite l'abonnement, le paiement et les limites d'usage.

## 7.3 Multi-tenant

Le multi-tenant est déjà une caractéristique structurelle du produit : chaque entreprise a ses utilisateurs, commandes, livraisons, factures et paramètres. Les contrôles interentreprises sont développés et largement testés.

Avant lancement, il faut compléter les outils d'exploitation : création et suspension commerciale d'un tenant, quotas, suivi des consommations, export de sortie, suppression, sauvegarde et assistance.

## 7.4 Formules et limites

La grille Starter/Pro/Business, ses prix, options et plafonds est confirmée comme cible configurable. Elle est détaillée dans `DECISIONS_PRODUIT_COMMERCIALES.md`. Les axes à mesurer avant lancement sont :

- nombre de livreurs actifs ;
- nombre de comptes administrateurs ou dispatchers ;
- volume mensuel de commandes ;
- stockage de preuves ;
- rétention de l'historique ;
- fréquence et coût des cartes, itinéraires, e-mails ou SMS ;
- niveau d'assistance ;
- fonctions avancées comme dispatch automatique, analytics, récurrences ou intégrations.

Business prévoit des livreurs illimités, mais cet affichage exige une politique d'usage raisonnable, des mesures et des alertes de coût. Le premier pilote gratuit peut être géré avec un contrat et des droits temporaires avant toute automatisation complexe.

## 7.5 Abonnement et paiement Annona

- **Planifié en premier** : catalogue configurable, registre de pilote/contrat, période, droits, quotas et statut de l'entreprise, avec séparation entre abonnement et prestations de livraison.
- **Planifié après validation des pilotes** : fournisseur de paiement, renouvellement, changement de formule/options, impayé, annulation, remboursement éventuel et webhooks idempotents.
- **Confirmé comme règle produit** : 60 jours de découverte premium pour Starter et Pro payants, sans relever les plafonds ; gestion autonome de l'abonnement à terme.
- **Non confirmé** : fournisseur de paiement définitif et règles fiscales/contractuelles, Stripe étant prioritaire à l'étude.

## 7.6 Marque blanche

Le modèle de données peut stocker un logo d'entreprise, mais une véritable offre en marque blanche n'est pas confirmée. Les domaines personnalisés, e-mails entièrement personnalisés, couleurs par tenant, applications dédiées et suppression de la marque Annona ne sont ni terminés ni validés commercialement.

La marque blanche peut devenir une option future si elle influence réellement l'achat. Elle ne doit pas être présentée aujourd'hui comme une capacité disponible.

## 7.7 Deux facturations à ne pas confondre

Annona contient un module de facture lié aux prestations de livraison de l'entreprise. Pour la V1, il reste un document opérationnel accompagné d'un export comptable ; Annona ne promet pas l'émission réglementaire. Une intégration future avec un outil comptable ou une plateforme agréée doit rester possible.

L'abonnement payé à Annona par l'entreprise cliente est un flux distinct, encore à construire. Les revenus et statuts des deux systèmes doivent rester séparés.

---

## 8. Évolutivité et marchés futurs

Les extensions ci-dessous sont des directions possibles. Elles ne sont pas toutes engagées.

### Extensions proches, déjà partiellement présentes

- commandes récurrentes ;
- missions multi-adresses ou spéciales ;
- règles de dispatch plus avancées ;
- analytics opérationnels et commerciaux ;
- exports et intégrations comptables ;
- support structuré et e-mails transactionnels ;
- abonnements et limites par formule.

### Extensions métier possibles après validation

- optimisation de tournées ;
- gestion de flotte, véhicules et maintenance ;
- intégrations avec e-commerce, ERP, CRM ou outils comptables ;
- API partenaire ;
- SMS et notifications push ciblés ;
- application mobile native si les limites du web bloquent le terrain ;
- marque blanche ;
- portail destinataire final distinct du donneur d'ordre ;
- couverture multilingue et nouveaux pays.

### Marchés adjacents possibles

Le socle pourrait servir des coursiers urbains, prestataires du dernier kilomètre, livraisons B2B récurrentes ou services locaux avec collecte et preuve. Toute expansion vers le transport lourd, la logistique internationale, les soins, l'alimentaire réglementé ou des secteurs sensibles demanderait des validations métier, contractuelles et techniques spécifiques.

La règle de roadmap est de ne pas ajouter une extension seulement parce qu'elle est techniquement possible. Elle doit répondre à un problème répété, mesuré et associé à une disposition à payer.

---

## 9. Principales limites et obstacles au lancement

## 9.1 Performance

PERF-01 est terminé sur l'environnement de référence : lectures redondantes retirées, compteurs regroupés, pool borné, préchargement ciblé et autorisations fraîches. Les mesures locales de production ont observé des pages directes hors carte en 1,63–2,68 s et des retours internes chauds en 71–102 ms. Ces mesures techniques dépendent de l'environnement et ne constituent pas une garantie contractuelle.

La stratégie expérimentale de jointure a ensuite été retirée après une panique sous concurrence. Les contrôles d'accès et la recette interne restent verts ; la capacité, les percentiles de latence sous charge représentative et le dimensionnement multi-instance restent à établir avant toute promesse commerciale.

## 9.2 Terrain mobile et réseau faible

Le produit doit encore être essayé sur de vrais iPhone et Android en déplacement, avec permission GPS refusée, réseau intermittent, écran verrouillé et retour dans l'application. La persistance locale et le rejeu des actions/photos après coupure sont testés dans Chrome ; les limites des systèmes mobiles et de l'arrière-plan restent ouvertes.

## 9.3 Services externes

- Supabase héberge l'authentification, PostgreSQL et le stockage des preuves.
- Les e-mails dépendent d'une configuration SMTP ou Resend non encore validée de bout en bout. Le transport métier est sécurisé localement par défaut désactivé et mode recette vers une boîte unique ; aucun domaine ni envoi réel n'est encore validé.
- Les cartes reposent actuellement sur OSM, l'IGN et un démonstrateur OSRM public.
- Un planificateur doit exécuter les tâches opérationnelles et récurrentes à une cadence compatible avec l'offre d'hébergement.

Les fournisseurs cartographiques publics ne donnent pas automatiquement un SLA ou un droit à une forte charge commerciale. Fournisseurs, contrats, quotas, budgets et protection des données doivent être décidés avant vente.

## 9.4 Données, déploiement et exploitation

- Les environnements développement, préproduction et production ne sont pas encore suffisamment séparés.
- L'historique de migrations et la procédure de retour arrière doivent être établis.
- La restauration complète de la base et des photos n'a pas été chronométrée sur une cible isolée.
- Les diagnostics de santé, journaux nettoyés et procédures d'incident sont développés. Le moniteur externe, son responsable et la réception d'alertes réelles sur préproduction restent à valider.
- Le workflow de contrôles automatisés est préparé et testé localement ; sa publication, ses secrets protégés et la recette de déploiement/retour arrière restent à faire sur une cible isolée.
- L'archive de sortie inclut désormais les photos et leur intégrité. Elle ne remplace ni une sauvegarde de service ni un exercice de restauration.
- La charge simultanée et les volumes nettement supérieurs aux tests actuels restent à mesurer.

## 9.5 Conformité et contrats

Avant utilisation réelle, il faudra définir et faire valider :

- contrat SaaS ou CGV ;
- politique de confidentialité ;
- accord de traitement des données ;
- liste des sous-traitants et régions d'hébergement ;
- règles de conservation et de suppression ;
- finalités et limites du GPS des livreurs ;
- gestion des photos de preuve ;
- responsabilités, support et notification d'incident ;
- conformité des documents de facturation si Annona les émet.

Le projet ne doit pas se présenter comme juridiquement ou fiscalement certifié avant cette validation professionnelle.

## 9.6 Validation commerciale

Le problème décrit est crédible et le produit est construit autour de lui, mais aucune étude de marché indépendante n'est terminée. Restent inconnus ou insuffisamment validés :

- intensité du problème dans le segment France 5–20 livreurs désormais retenu ;
- processus d'achat autour du dirigeant ou responsable d'exploitation identifié ;
- fréquence et coût réel du problème ;
- outils concurrents effectivement utilisés ;
- freins au changement ;
- acceptation de la grille 79/179/349 € et de ses options ;
- coût d'acquisition et coût de support ;
- volonté de payer après pilote.

La V1 technique est une condition nécessaire, pas une preuve de marché.

## 9.7 Fonctions complexes à ne pas surpromettre

- GPS permanent en arrière-plan ;
- optimisation automatique de tournées ;
- application native ;
- devis chiffrés et acceptation client des missions spéciales ;
- récurrences sans erreur dans tous les fuseaux et fins de mois ;
- facturation comptable complète ;
- abonnement et paiement automatisés ;
- marque blanche complète ;
- SMS, IA et intégrations multiples ;
- capacité ou stockage illimités.

---

## 10. Messages utilisables par le marketing et messages à éviter

### Formulation de travail raisonnable

> Annona réunit l'entreprise de livraison, ses clients et ses livreurs dans un même espace pour recevoir les commandes, organiser l'affectation, suivre l'exécution et conserver les échanges et preuves dans le bon dossier.

Cette formulation décrit la vision et correspond au noyau déjà développé, sans inventer de gain quantifié.

### Bénéfices à tester pendant les pilotes

- moins de ressaisie et de transferts d'e-mails ;
- moins de recherches manuelles pour connaître l'état d'une livraison ;
- attribution et prise en charge plus explicites ;
- échanges et incidents rattachés au bon dossier ;
- preuve plus facile à retrouver ;
- meilleure autonomie du client.

Ils doivent être mesurés avant d'être transformés en chiffres ou garanties.

### Promesses à éviter dans l'état actuel

- « réduit les coûts de X % » ou « fait gagner X heures » ;
- « suivi GPS en temps réel permanent » ;
- « optimise automatiquement toutes les tournées » ;
- « fonctionne hors ligne sans perte » ;
- « conforme à toutes les réglementations » ;
- « facturation complète et certifiée » ;
- « entièrement en marque blanche » ;
- « import automatique de toutes les commandes e-mail » ;
- « infrastructure illimitée » ;
- « prêt pour la production » ou « déjà adopté par plusieurs entreprises » sans preuve correspondante.

---

## 11. Priorités recommandées avant stratégie de lancement active

1. Conserver les budgets de performance locaux vérifiés et mesurer la charge représentative avant toute garantie.
2. Réaliser la revue visuelle différée des cartes ; conserver le lien retard → dispatch déjà vérifié.
3. Réaliser les essais iPhone/Android, en complément de la file de reprise déjà testée dans Chrome.
4. Compléter les validations externes de V1-GO ; la recette interne automatisable des trois rôles est verte.
5. Finaliser préproduction, migrations, restauration, moniteur réel et activation de la CI préparée localement.
6. Configurer les invitations, la récupération et les e-mails transactionnels.
7. Conserver le périmètre prestations/export décidé et qualifier toute future intégration comptable avant émission finale.
8. Préparer contrats, données personnelles, GPS et photos.
9. Mener les entretiens dans le segment confirmé, sur des journées réelles.
10. Faire accepter l'offre pilote déjà préparée, avec limites et support explicites.
11. Conduire plusieurs pilotes, mesurer la valeur et les coûts.
12. Automatiser les abonnements seulement après confirmation de l'offre.

---

## 12. Questions stratégiques à résoudre par l'agent marketing et le propriétaire

- Parmi les entreprises françaises de coursiers/livraison express B2B ciblées, laquelle souffre le plus du processus par e-mail décrit ?
- Comment se répartissent réellement décision d'achat, prescription et usage entre dirigeant, responsable d'exploitation et dispatcher ?
- Quel volume quotidien et quel nombre de livreurs rendent le problème assez coûteux ?
- Quels outils concurrents ou assemblages d'outils sont réellement utilisés aujourd'hui ?
- Quelle partie crée le plus de valeur : portail client, dispatch, suivi, preuve ou historique ?
- Quelle offre pilote peut être essayée sans automatiser prématurément la facturation ?
- Quelles limites doivent être liées aux coûts réels : livreurs, commandes, stockage, messages ou support ?
- La marque blanche influence-t-elle réellement l'achat ?
- Quel niveau de support l'entreprise attend-elle pendant les premières semaines ?
- Quelles mesures permettront de décider honnêtement de poursuivre, resserrer ou repositionner le produit ?

La stratégie marketing doit partir de ces inconnues plutôt que de les remplacer par des suppositions. La meilleure base actuelle est un produit opérationnel déjà riche, construit autour d'un problème concret, mais qui doit encore prouver sa rapidité, sa fiabilité terrain, son exploitabilité et sa valeur économique auprès de vrais clients.
