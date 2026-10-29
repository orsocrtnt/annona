# Décisions produit et commerciales TutelLiv

Date de référence : 21 octobre 2026.

Ce document distingue les décisions confirmées par le propriétaire, les validations encore nécessaires et les fonctions volontairement différées. Il ne vaut ni contrat, ni avis juridique, ni validation du marché.

## Positionnement confirmé

TutelLiv est destiné en priorité aux entreprises françaises de coursiers et de livraison express B2B ayant des clients professionnels récurrents.

- marché initial : France entière ; priorité commerciale à Paris/Île-de-France et Marseille/Bouches-du-Rhône ;
- cœur de cible : 5 à 20 livreurs ;
- cible secondaire : 3 à 5 livreurs ;
- structures plus importantes : accessibles par l'offre Business, après validation de la capacité réelle ;
- acheteur principal : dirigeant ou responsable d'exploitation ;
- utilisateur quotidien et prescripteur : dispatcher ;
- autres utilisateurs : livreurs et clients donneurs d'ordre.

La promesse produit reste la centralisation d'une chaîne aujourd'hui dispersée dans les e-mails : réception d'une commande, organisation, affectation, confirmation du livreur, échanges, suivi, preuve et historique.

## Exclusions de la V1

La V1 ne promet pas les garanties particulières nécessaires au transport médical réglementé, aux matières dangereuses, au transport frigorifique avec contrôle de température, au transport international avec formalités douanières, au transport lourd ou à la logistique industrielle complexe.

Ces exclusions portent sur le service spécialisé. Elles n'interdisent pas à une entreprise de livraison classique d'utiliser TutelLiv pour ses missions ordinaires.

## Facturation des prestations de livraison

La V1 fournit la consultation des prestations, les informations tarifaires, un export comptable exploitable et des documents de suivi opérationnel. Elle ne se présente pas comme un logiciel de comptabilité, une plateforme agréée de facturation électronique ou un système complet d'émission réglementaire.

L'architecture devra permettre une future intégration avec un logiciel comptable ou une plateforme agréée. En France, toutes les entreprises doivent pouvoir recevoir des factures électroniques depuis le 1er septembre 2026 ; l'obligation d'émission s'applique aux PME et microentreprises à compter du 1er septembre 2027. Source officielle : [impots.gouv.fr](https://www.impots.gouv.fr/professionnel/questions/partir-de-quand-suis-je-concerne-par-la-reforme-de-la-facturation).

Décision du 28 octobre 2026 : le propriétaire lance Factur-X. Portée de la première tranche (détail et limites : [`FACTURX.md`](FACTURX.md)) :

- TutelLiv produit, à la demande, un PDF Factur-X profil EN 16931 (relevé intitulé « Facture » avec les mentions légales du XML + XML CII embarqué) pour une facture de livraison émise, depuis le back-office et le portail client ; le relevé PDF classique reste inchangé ;
- la société de coursiers saisit ses mentions légales et l'identité de facturation de ses clients professionnels ; sans les données obligatoires, le Factur-X est refusé avec un message clair et le PDF classique reste disponible ;
- **TutelLiv n'est pas une plateforme agréée** et ne dépose rien : le dépôt reste fait par l'entreprise ou son expert-comptable sur sa plateforme ;
- le fichier n'a pas encore été validé par un outil officiel (Mustang, validateur FNFE) et n'est pas PDF/A-3b strict (polices non embarquées) : il ne doit pas être présenté comme conforme ou certifié avant ces validations.

## Grille commerciale cible

Les tarifs ci-dessous sont des décisions de configuration et de positionnement. Leur acceptation par le marché et leur rentabilité restent à vérifier pendant les entretiens et pilotes.

| Formule | Starter | Pro | Business |
|---|---:|---:|---:|
| Mensuel HT | 79 € | 179 € | 349 € |
| Annuel HT | 790 € | 1 790 € | 3 490 € |
| Livreurs inclus | 5 | 10 | 20 |
| Maximum de livreurs | 10 | 30 | 50 |
| Commandes incluses/mois | 1 000 | 3 000 | 6 000 |
| Administrateurs inclus | 1 | 1 | 2 |
| Dispatchers inclus | 0 | 1 | 1 |
| Carte GPS administrateur | Option | Incluse | Incluse |
| Carte GPS client | Option | Option | Incluse |
| Dispatch automatique | Option | Inclus | Inclus |
| Analytics avancés | Option | Option | Inclus |
| Assistance prioritaire | Option | Option | Incluse |

Options mensuelles HT (catalogue C9 du 24 octobre 2026) :

| Option | Prix |
|---|---:|
| Dispatch automatique (devenu « Dispatch intelligent » le 29 octobre 2026, voir C12) | 29 € Starter ; 39 € Pro ; 49 € Business. Inclus dans Pro et Business, donc non refacturé. Achetable seulement en Starter, à 29 € (39 € depuis le catalogue C10, C12). |
| Carte GPS client | 49 € |
| Carte GPS administrateur | 39 € |
| Analytics avancés | 29 € |
| Assistance prioritaire | 29 € |
| Livreur supplémentaire Starter | 12 € |
| Livreur supplémentaire Pro | 10 € |
| Livreur supplémentaire Business (21 à 50) | 9 € |
| Administrateur supplémentaire, toutes offres | 12 € |
| Dispatcher supplémentaire, toutes offres | 8 € |

Les commandes supplémentaires sont ciblées à 0,10 € HT en Starter, 0,08 € HT en Pro et 0,06 € HT en Business. L'abonnement annuel correspond à douze mois pour le prix de dix.

Décisions complémentaires confirmées les 20 et 21 octobre 2026 :

- les options et utilisateurs supplémentaires ne bénéficient pas des deux mois offerts de la formule annuelle ; leur prix annuel correspond à douze mensualités ;
- les dépassements de commandes sont facturés sur la période de facturation, sans achat préalable de packs ;
- le dispatcher est le rôle opérationnel limité porté techniquement par le mini-administrateur : il peut créer et organiser les commandes, affecter les livreurs, suivre les livraisons et traiter les incidents, sans accès aux abonnements, paiements ni paramètres sensibles ;
- Starter inclut zéro dispatcher, Pro en inclut un et Business en inclut un ; tout dispatcher supplémentaire coûte 8 € HT/mois, dans les trois offres ;
- sur une formule annuelle, les dispatchers supplémentaires sont facturés douze mensualités, sans remise de deux mois ;
- les prix TTC calculés avec 20 % de TVA constituent l'affichage indicatif du cas France standard, mais le système final devra déterminer et tracer la taxe réellement applicable à chaque transaction.

Starter et Pro prévoient 60 jours de découverte des fonctions premium après souscription payante. Cette découverte ne modifie pas les plafonds d'utilisateurs ou de commandes et ne doit pas être confondue avec les pilotes gratuits de validation.

Les prix, quotas, inclusions et options doivent être configurables et historisés. Une modification future ne doit pas réécrire les droits ou montants déjà convenus pour une période antérieure.

## C7 — Cycle de vie commercial

Les sept familles de règles C7 sont confirmées par le propriétaire le 21 octobre 2026. Elles peuvent être intégrées au catalogue, aux droits et aux scénarios de SAAS-01A/01B. Leur mise en œuvre en environnement fictif n'autorise ni paiement réel ni déploiement en production.

| Sujet | Règle confirmée | Application |
|---|---|---|
| Augmentation de formule ou ajout d'option | Effet immédiat après paiement du prorata ; aucun nouveau droit avant confirmation serveur du paiement. | Paiement préalable obligatoire |
| Diminution ou suppression d'option | Effet au prochain renouvellement ; conserver l'accès actuel jusqu'à cette date. | Changement planifié |
| Mensuel vers annuel | Effet immédiat avec crédit du temps déjà payé et non utilisé. | Paiement préalable obligatoire |
| Annuel vers mensuel | Effet à l'échéance annuelle. | Changement planifié |
| Dépassements de commandes | Ne pas bloquer ; facturer mensuellement le dépassement, y compris pour l'annuel ; alerter à 80 %, 100 % et 120 % avec estimation visible. | Compteur mensuel idempotent |
| Impayés d'un abonnement actif | J0 avertissement et nouvelle tentative, J3 relance, J7 avertissement renforcé, J14 blocage des nouvelles commandes, J30 lecture seule avec accès à l'export ; livraisons engagées terminables et aucune suppression automatique. | Restriction progressive réversible après régularisation |
| Première souscription impayée | Ne pas activer l'entreprise ni les droits payants. | Activation refusée |
| Résiliation | Demande possible à tout moment, effective à la fin de la période payée ; dépassements consommés dus sauf erreur. | Aucun remboursement automatique du temps restant |
| Remboursement | Corriger une erreur de facturation ; examiner une situation exceptionnelle justifiée et conserver décision et trace d'audit. | Remboursement ou avoir décidé au cas par cas |
| Support standard | Tickets intégrés avec objectif interne de première réponse sous un jour ouvré pour Starter et Pro. | Objectif interne, pas un SLA contractuel |
| Assistance prioritaire | Incluse dans Business ou option à 29 € HT/mois ; traitement privilégié sans délai court garanti. | Aucun engagement contractuel de 2 ou 4 heures |
| Formule annuelle | Base facturée dix mois pour douze ; options, utilisateurs et dispatchers supplémentaires facturés douze mensualités ; quotas et dépassements de commandes traités chaque mois. | Réinitialisation mensuelle confirmée |

Les définitions techniques suivantes doivent être figées et testées avant facturation réelle sans rouvrir ces choix commerciaux : événement exact qui rend une commande facturable, annulation ou correction d'un usage, fuseau et frontière de mois, traitement d'une rétrogradation lorsque l'entreprise dépasse déjà ses futures limites, rapprochement des factures impayées lors d'une résiliation et habilitation interne pour accorder un remboursement exceptionnel.

## Pilote de validation

L'hypothèse pilote retenue est :

- trois entreprises ;
- quatre semaines ;
- gratuit ;
- nombre de livreurs convenu par entreprise ;
- usage réel encadré ;
- accompagnement direct ;
- aucun paiement automatisé ;
- aucune obligation de souscription après le pilote ;
- export en fin de pilote.

Le caractère gratuit reste à confirmer dans le protocole signé avec chaque pilote. Aucune donnée réelle ne peut être accueillie avant les portes de sécurité, de préproduction et contractuelles.

Les mesures à recueillir couvrent commandes, livreurs actifs, fonctions utilisées, erreurs, besoins non couverts, retours des trois rôles et disposition à payer.

## Attribution commerciale et commissions

L'architecture devra associer une souscription initiale à un apporteur ou commercial et à un niveau de commission : 15 % apporteur d'affaires, 25 % commercial accompagné, 35 % commercial autonome.

La durée maximale envisagée est de douze mois. La base de calcul porte uniquement sur les montants HT effectivement encaissés pour les éléments vendus lors de la souscription initiale. Les achats et changements ultérieurs ne créent pas de commission supplémentaire. Ces règles restent soumises à validation contractuelle.

La V1 doit conserver une attribution auditable et permettre un calcul explicable. Elle ne doit pas devenir un CRM complet.

## C10 — Décisions du propriétaire du 27 octobre 2026

Réponses données au questionnaire de l'agent ; elles débloquent SAAS-02/03/04, SALES-1, GROWTH-1 et la recette locale.

| Sujet | Décision | Tâche |
|---|---|---|
| Impayé pendant les 60 jours de découverte premium | La découverte s'arrête au premier échec de paiement : les fonctions premium d'essai sont retirées immédiatement. Les règles d'impayé habituelles (J14 restreint, J30 lecture seule) continuent de s'appliquer au compte. | SAAS-04 |
| Résiliation pendant la découverte (complément du même jour) | La découverte s'arrête dès la demande de résiliation, même si la période payée continue ; elle ne revient pas si la résiliation est annulée. L'abonnement et les fonctions de la formule restent actifs jusqu'à la fin de la période payée. | SAAS-04 |
| Changement de formule pendant la découverte | La découverte garde sa date de fin (J60) en cas de montée ou de baisse ; un passage à Business la rend sans objet puisque tout y est inclus. | SAAS-04 |
| Baisse de formule avec ressources en excès | Refusée tant que des livreurs, administrateurs ou dispatchers dépassent les limites de la formule visée. Le client voit les comptes à désactiver lui-même ; rien n'est supprimé ni désactivé automatiquement. | SAAS-03 |
| Journal d'abonnement | Migration additive autorisée, appliquée à la seule préproduction. Jamais en production sans nouvelle décision. Constat du 27 octobre : les actions d'abonnement sandbox sont déjà journalisées avec leur auteur dans `SaasBillingOperation`, donc aucune migration n'a été créée. | SAAS-03 |
| Codes commerciaux | Un code permanent par commercial, créé par le super-administrateur, lié à son niveau (apporteur, accompagné, autonome), sans date de fin et désactivable à tout moment. | SALES-1 |
| Commission et remboursement (complément du même jour) | Un remboursement reprend la commission théorique au prorata du montant remboursé, par une écriture négative. Choix technique : la reprise est arrondie au centime supérieur, pour que le commercial ne conserve jamais plus que son dû. | SALES-1 |
| Ventilation des factures d'abonnement (complément du même jour) | Une facture de création ou de renouvellement est ventilée selon les lignes figées à l'inscription. Une facture qui ne correspond plus exactement au contrat initial (après un changement de formule, par exemple) est écartée avec un motif, sans commission inventée. La fenêtre de douze mois part de la période de la première facture. | SALES-1 |
| Formulaire Contact | Les messages sont stockés et lus dans le back-office plateforme (super-administrateur), sans dépendre du domaine e-mail. | GROWTH-1 |
| Alertes de consommation plateforme | 80 %, 100 % et 120 % des commandes incluses ; pour Business, alerte dès deux fois les commandes incluses ou 40 livreurs actifs. | SAAS-02 |
| Pool de démonstration | Garder 6 espaces, mais libérer automatiquement les sessions de test après une heure au lieu de huit. | DEMO-2 (suivi ENV-2) |
| Abonnement sans compte de facturation en ligne (complément du même jour) | Pilote, accès historique ou paiement manuel : « Mon abonnement » affiche formule, options, période et consommation en lecture seule, et renvoie vers l'équipe TutelLiv (page Contact) pour tout changement ou résiliation. Aucune action en ligne. | SAAS-03 |
| Export DATA-02 depuis « Mon abonnement » (complément du même jour) | Reporté : le canal de remise chiffré n'est pas choisi ; il suit la politique de conservation LEGAL-1. | SAAS-03, DATA-02 |
| Mesure de performance « Next » (complément du même jour) | Autorisée en local sur les routes publiques (build de production, PostgreSQL jetable) ; les routes connectées attendent ENV-2. | PERF-02 |

Le choix d'un Contact stocké implique sa propre table : additive, préproduction seulement, comme le journal d'abonnement. Complément du même jour : la migration additive des codes commerciaux est autorisée, appliquée à la préproduction seulement après relecture et fusion de la branche ; un compte super-administrateur temporaire peut être créé sur la préproduction pour les recettes navigateur, puis supprimé.

## C11 — Décision du propriétaire du 28 octobre 2026

| Sujet | Décision | Tâche |
| --- | --- | --- |
| Création de commande côté back-office | Acceptée pour le compte d'un client choisi, depuis le flux « commande par message » uniquement, après relecture et validation du dispatcher. Rôles : `COMPANY_ADMIN`, `MINI_ADMIN` (module Commandes) et `DISPATCHER`, avec la permission `orders:create`. La commande porte `source = ADMIN`. Elle passe par le service de création existant (géocodage, contrôles d'abonnement, idempotence). Le client doit être un compte actif de l'entreprise. La fonction reste désactivée tant que la clé serveur et l'activation par l'entreprise manquent. | INTAKE-1 |

## C12 — Décisions du propriétaire du 29 octobre 2026 (dispatch)

| Sujet | Décision | Suite |
| --- | --- | --- |
| Option de dispatch | Une seule option « Dispatch intelligent » remplace le « Dispatch automatique » : 39 € HT par mois en Starter au lieu de 29 €, toujours incluse en Pro et Business. | Mise à jour du catalogue et des pages Tarifs à faire dans DISPATCH-4 ; acceptation par le marché à confronter dans OFFER-1. |
| Création des tournées | TutelLiv regroupe les livraisons et propose la tournée ; le dispatcher valide ou modifie, ou l'affectation est automatique si l'entreprise a choisi ce mode. | DISPATCH-4, piste 3. |
| Limites d'une tournée | Créneaux promis aux clients, capacité du véhicule, zone géographique et durée de la journée du livreur. | DISPATCH-4, piste 3. |
| Départ et fin | Une tournée part de la position du livreur et finit au dernier arrêt. | DISPATCH-4, piste 3. |

## Éléments encore non confirmés

- identité juridique, SIREN, TVA et adresse de l'éditeur ;
- nom de domaine ;
- fournisseur de paiement définitif, Stripe étant seulement prioritaire à l'étude ;
- validation juridique des contrats, commissions et durées de conservation ;
- acceptation des prix et de l'offre pilote par des entreprises ;
- coût réel du support, des cartes, du stockage et des volumes Business ;
- capacité de l'infrastructure à garantir un RPO d'une heure et un RTO de quatre heures ;
