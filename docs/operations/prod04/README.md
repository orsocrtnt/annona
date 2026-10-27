# PROD-04 — protocole de mesure de la valeur

Ce protocole fixe les définitions, la période et la méthode avant toute observation terrain. Il ne contient aucune donnée de pilote, ne conclut à aucun gain et ne remplace ni les entretiens PROD-02 ni la conduite de PILOT-1.

## Périodes comparables

Pour chaque entreprise, relever séparément :

1. une période de référence avant pilote couvrant au moins cinq jours ouvrés consécutifs et un fonctionnement habituel ;
2. chaque semaine complète du pilote, en isolant la semaine de mise en route si elle n'est pas représentative ;
3. la période consolidée de sortie, limitée aux jours et activités comparables à la référence.

Consigner les dates, jours ouvrés, volume, rôles présents, zone, types de livraison, incidents externes et changement d'organisation. Une période partielle, exceptionnelle ou non comparable reste visible et ne sert pas à annoncer un écart avant/après.

## Définitions stables

| Mesure | Début | Fin | Restitution |
|---|---|---|---|
| Temps de dispatch | Demande exploitable reçue dans le canal utilisé | Livreur affecté et prise en charge confirmée | nombre observé, médiane et étendue ; distinguer manuel/automatique et abandons |
| Appels de suivi | Appel entrant ou sortant visant le statut, la position, l'heure estimée ou la preuve d'une livraison | Fin de l'appel | nombre brut et nombre par livraison terminée ; exclure prospection, facturation et support TutelLiv |
| Incident | Premier constat d'un événement bloquant ou d'un résultat incorrect | Résolution confirmée ou contournement accepté | nombre par sévérité, durée et livraisons affectées ; un même incident conserve un identifiant unique |
| Récupération de preuve | Demande explicite de retrouver une preuve existante | Preuve correcte visible ou exportée par la personne autorisée | durée, succès/échec et aide nécessaire ; ne jamais copier la photo dans la fiche |
| Première livraison | Démarrage opérationnel convenu avec les rôles autorisés | Première livraison du périmètre terminée avec statut et preuve consultables | durée calendaire, temps actif estimé et interventions TutelLiv séparées |

Mesures de contexte, sans les transformer en valeur : commandes reçues et terminées, utilisateurs actifs par rôle, preuves attendues/consultables, retours aux e-mails ou outils externes, minutes d'aide TutelLiv et fonctions réellement utilisées.

## Méthode de collecte minimale

- préparer la fiche avant la période et nommer un référent de mesure chez l'entreprise ;
- utiliser les horodatages applicatifs lorsqu'ils correspondent exactement à la définition ; sinon faire une saisie manuelle datée ;
- noter la source de chaque valeur (`journal applicatif`, `observation`, `déclaration du référent`) et ne pas fusionner silencieusement des sources différentes ;
- compter une livraison une seule fois grâce à une référence interne pseudonymisée ;
- relever les appels par catégorie et compteur, sans numéro, contenu d'appel ni donnée client ;
- relever les incidents dans le journal PILOT-1 existant, sans secret, GPS brut ni photo ;
- conserver les valeurs manquantes comme `non mesuré`, jamais comme zéro ;
- faire valider la fiche de référence et l'objectif propre à l'entreprise avant le démarrage du pilote.

Le modèle de saisie reste `docs/operations/pilot1/TEMPLATES.md`. Les définitions ci-dessus précisent sa section « Baseline avant pilote » et ses points hebdomadaires ; elles ne déclenchent aucun contact ni collecte.

## Calculs autorisés après collecte

Pour une période comparable, présenter d'abord les volumes bruts et les valeurs individuelles. La médiane peut résumer les durées ; les appels et incidents peuvent être rapportés au nombre de livraisons terminées. Tout écart avant/après doit indiquer les deux périodes, les dénominateurs, les données manquantes et les changements de périmètre.

Aucun seuil de succès, pourcentage de gain, causalité, extrapolation commerciale ou valeur monétaire n'est fixé dans cette tranche. L'objectif doit être convenu avec chaque entreprise ; la conclusion attend PROD-02, PILOT-1 puis PILOT-2.

## Fiche de contrôle avant usage

- [ ] entreprise et période identifiées sans donnée personnelle inutile ;
- [ ] jours, volumes, rôles, canaux et périmètre consignés ;
- [ ] même définition et même unité avant/pendant pilote ;
- [ ] source et données manquantes visibles pour chaque mesure ;
- [ ] événements exceptionnels documentés ;
- [ ] baseline et objectif validés par l'entreprise ;
- [ ] aucune conclusion produite avant la fin de la période comparable.
