# Hypothèses de modules futurs

Ce document n'est pas une feuille de route engagée. `TODO.md` est la seule source de priorité. Une idée listée ici doit répondre à un besoin répété et recevoir une tâche avec critères de sortie avant toute implémentation.

## Fonctions déjà présentes

Les commandes, livraisons, dispatch, suivi GPS daté, cartographie, factures de livraison, conversations, alertes, support, notifications intégrées, récurrences et preuves existent déjà à des niveaux de qualification différents. Ne pas les recréer sous un nouveau module sans inspecter `src/domains/`, `src/features/` et les rapports associés.

## Extensions envisagées, non confirmées

- optimisation de tournées et regroupement de livraisons ;
- flotte et maintenance de véhicules ;
- fournisseur cartographique avec SLA ou auto-hébergement ;
- intégrations comptables après décision sur le périmètre des factures ;
- SMS ou notifications push pour quelques événements qualifiés ;
- import de commandes depuis des outils clients ;
- application native si les essais terrain démontrent une limite bloquante de la web app ;
- analytics commerciaux et opérationnels au-delà des tableaux actuels ;
- automatisation des abonnements et quotas après pilotes payants.

Ces éléments ne doivent apparaître ni comme disponibles, ni comme promis commercialement. Les tâches SPECIAL-1, BILL-01A/B, SAAS-01B, SMS et les décisions de V1-GO encadrent une partie de ces hypothèses.

## Conditions d'ajout

Avant de créer un module :

1. décrire le problème et l'utilisateur concerné ;
2. vérifier que le code actuel ne couvre pas déjà le besoin ;
3. définir le parcours, les limites et les métriques de valeur ;
4. préciser les rôles et frontières d'entreprise ;
5. évaluer schéma, concurrence, idempotence, coûts externes et reprise ;
6. ajouter une tâche priorisée à `TODO.md` ;
7. tester avec deux entreprises et les rôles concernés.

L'architecture générale à respecter est décrite dans `ARCHITECTURE.md` et les changements de données dans `DATABASE.md`.
