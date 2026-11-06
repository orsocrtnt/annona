# Annona — cadrage client et périmètre de la V1

Statut : orientation produit établie avec le propriétaire ; validation commerciale indépendante différée à sa demande. Ce document ne constitue pas une étude de marché.

## Problème observé et rapporté par le propriétaire

Les commandes arrivent par plusieurs canaux, mais surtout par e-mail. Après réception, l’administrateur rédige un autre e-mail à destination d’un livreur. Le livreur confirme par e-mail et les échanges suivants continuent de cette manière.

Le propriétaire identifie trois difficultés : le temps consacré à cette coordination, l’organisation et la difficulté à savoir où est la livraison. Il a précisé que le suivi recherché comprend à la fois les étapes de la mission et la position du livreur sur une carte. Aucun volume, coût ou temps perdu n’a été chiffré ; ne pas les inventer.

## Objectif confirmé

Vendre un SaaS par abonnement à plusieurs entreprises de livraison pour gérer les commandes de leurs clients et leurs livreurs. Le portail client existant est le parcours principal de saisie des commandes. Il ne faut pas repartir du principe que les commandes doivent continuer à arriver par e-mail ni créer une intégration de messagerie sans demande.

Promesse de travail : recevoir les commandes, organiser les livreurs et suivre chaque livraison dans un seul espace partagé.

L’entreprise de livraison est le client de Annona ; le donneur d’ordre utilise l’espace client de cette entreprise. Le pays de lancement est la France, avec une priorité commerciale à Paris/Île-de-France et Marseille/Bouches-du-Rhône. Le cœur de cible réunit les entreprises de coursiers et de livraison express B2B de 5 à 20 livreurs ; 3 à 5 livreurs est une cible secondaire. Le dirigeant ou responsable d'exploitation est l'acheteur principal et le dispatcher un prescripteur quotidien. La grille commerciale cible est décidée, mais sa volonté de payer reste à vérifier. Voir `DECISIONS_PRODUIT_COMMERCIALES.md`.

## Parcours prioritaire

1. Le client saisit la demande une seule fois dans son espace.
2. L’administrateur voit les commandes à traiter et affecte un livreur.
3. La prise en charge du livreur est explicite et visible. Inspecter le démarrage existant avant d’ajouter un mécanisme distinct ; ne pas confondre une affectation avec une acceptation effective.
4. Questions, instructions, modifications et incidents restent liés à la commande, avec visibilité adaptée au rôle. Les notes internes ne deviennent pas des messages publics.
5. Administrateur et client autorisé voient les étapes à jour et la position pertinente du livreur, datée ; absence ou ancienneté de la position affichée honnêtement.
6. Le livreur ajoute la preuve ou un motif d’échec ; l’historique reste accessible et cohérent après facturation.

Limiter la localisation aux missions et rôles concernés. Aucun accès à toute la flotte pour un client ni suivi hors service implicite. Ne pas promettre le fonctionnement permanent écran éteint tant qu’il n’a pas été validé sur appareils.

## Décision de séquencement

La prospection est désormais en préparation sur la France entière, avec priorité Paris et Marseille. Priorité immédiate à une V1 fiable prête à être essayée, avec scénarios internes et données fictives. Les dix entretiens et trois pilotes restent nécessaires, mais ne bloquent pas les corrections techniques indépendantes.

Les corrections SEC-01 et SEC-02, les tests et la sauvegarde déjà réalisés restent acquis. La sauvegarde locale après SEC-02 ne couvre pas Supabase/Storage ni la correction SEC-01 ultérieure.

Conserver sécurité, fiabilité des écritures, droits, preuves, historique, sauvegarde/restauration, supervision et support dans le plan. Conserver aussi les récurrences, missions spéciales et facturation avancée : elles ne sont pas supprimées, mais leur présence dans le code n’oblige pas à les promettre dans la V1 avant validation.

Aucune nouvelle fonction d’IA, de SMS généralisé, d’app native ou d’intégrations multiples à engager sans justification. Les trois offres commerciales sont définies comme cible configurable ; leur automatisation attend les validations de coûts et des pilotes. Une limitation terrain bloquante peut justifier de réexaminer la technologie mobile.

## Définition de « V1 prête »

Recette des trois rôles réussie du début à la fin, avec prise en charge, échanges, incidents, statut, GPS daté, preuve et historique ; cas d’erreur réseau et refus d’accès testés ; configuration et aide compréhensibles ; défauts bloquants traités et limites documentées. Les essais terrain sur téléphones sont nécessaires pour qualifier la promesse GPS.

Ce jalon technique ne prouve ni l’adoption ni le gain économique et ne vaut pas autorisation de production. L’usage de vraies données et la vente exigent aussi les conditions d’exploitation, de contrat et de données prévues dans la TODO.

## Mesures

Préparer maintenant un protocole interne : temps de saisie et d’affectation, actions nécessaires à la coordination, délai pour retrouver statut/position/preuve, erreurs et besoin d’assistance. Consigner appareil, réseau et volume. Mesurer plus tard le gain avant/après avec des entreprises comparables ; ne pas présenter un résultat interne comme un gain client établi.

## Traçabilité dans la TODO

- PROD-03 / V1-RECETTE : scénario V1 et écarts par rapport à l’existant.
- ACK-1 / DISPATCH-1 : organisation et prise en charge.
- COMM-1 / ALERT-1 : échanges et incidents ; SUPPORT-1 reste l’assistance.
- TRACK-1 / MOB-01A/B/C / MAP-1/2 : statuts partagés et GPS fiable.
- V1-MESURE : mesures internes ; PROD-04 conserve la validation terrain commerciale ultérieure.
- V1-GO : recette interne ; RELEASE-1 conserve la mise en vente.
- PROD-01 : cible France confirmée ; PROD-02 conserve les entretiens de validation.
- OFFER-1 : grille cible et proposition de pilote définies ; acceptation et rentabilité à valider.
- PILOT-1/2 et automatisation des abonnements : conservés après les portes techniques et contractuelles.

Source : observations et choix exprimés par le propriétaire dans cette conversation ; audit SaaS et tests pour les seules capacités techniques. Aucun entretien externe réalisé ou contact envoyé.

## Guide d’entretiens conservé pour plus tard

Le protocole ci-dessous reste disponible à la reprise de la recherche client. Il ne constitue plus la prochaine action requise pour poursuivre le développement.

## Entretien de découverte — 20 à 30 minutes

Commencer sans démonstration ni argumentaire. Demander un épisode récent plutôt qu'une opinion sur une fonctionnalité.

1. Décrivez votre dernière journée habituelle : types de livraisons, volumes et personnes impliquées.
2. Prenons une commande récente : par où est-elle arrivée et qui a fait quoi jusqu'à sa clôture ?
3. Quels outils, messages ou documents avez-vous utilisés à chaque étape ?
4. À quel moment avez-vous dû attendre, ressaisir, téléphoner ou vérifier une information ?
5. Racontez la dernière erreur ou difficulté : que s'est-il passé, qui a été touché, comment l'avez-vous résolue ?
6. Combien de fois est-ce arrivé récemment ? Quelle durée, dépense ou conséquence pouvez-vous réellement attribuer à ce problème ?
7. Qu'avez-vous déjà essayé pour le résoudre ? Qu'est-ce qui marche et qu'est-ce qui vous manque ?
8. Qu'est-ce qui empêcherait votre équipe et vos clients d'utiliser un nouvel outil ?
9. Qui déciderait d'un changement et quelles conditions devraient être réunies ?
10. Accepteriez-vous ensuite de tester un scénario sur vos propres cas fictifs et de mesurer le résultat ?

Éviter « Vous aimeriez une carte en temps réel ? » ou « Vous paieriez 199 € ? » avant d'avoir compris le besoin. Une réponse aimable n'est pas un engagement. Ne demander ni secrets ni données personnelles réelles ; utiliser des documents anonymisés si nécessaires.

## Fiche à remplir pour chaque entretien

Conserver : date et contexte, activité, rôle de l'interlocuteur, taille et volume déclarés, outils actuels, récit concret, fréquence, coût ou temps avec sa méthode de calcul, solution actuelle, décideur, contraintes de changement et prochaine étape acceptée. Séparer les propos exacts de l'interprétation. Marquer une information inconnue comme inconnue, sans la compléter par estimation silencieuse.
