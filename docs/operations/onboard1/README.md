# ONBOARD-1 — Première livraison interne

## Objectif

Le chemin `/onboarding` rassemble les sept étapes nécessaires pour préparer une première livraison fictive : services proposés, comptes client et livreur, tarifs, dispatch, première commande et première livraison terminée.

L'avancement est recalculé depuis les données de l'entreprise à chaque ouverture. La page ne modifie aucun réglage : chaque action renvoie vers l'écran métier existant.

## Recette reproductible

Prérequis : environnement local configuré avec la base de test autorisée.

```bash
npm run test:onboard1
npm run test:onboard1:e2e
```

La recette connectée crée une entreprise fictive dont le nom et les identifiants commencent par `ONBOARD-1` ou `onboard1-`. Elle ajoute trois comptes fictifs, crée une commande, l'affecte, la fait accepter et la termine avec une preuve fictive. Elle attend la fin des tâches asynchrones, supprime ensuite toutes ses données et exige un résidu nul.

Le test navigateur vérifie l'écran administrateur, les sept étapes, les limites affichées et les refus API pour le client et le livreur.

## Limites

- Les comptes connectés sont des fixtures techniques : la réception réelle d'une invitation attend la configuration e-mail suivie dans SEC-05 et EMAIL.
- Aucun import initial n'est exposé. Les données du premier essai sont saisies manuellement ; un futur import devra valider le fichier entier avant la première écriture.
- Les temps produits par le script mesurent des appels automatisés et la base de test distante. Ils ne mesurent ni le temps humain, ni l'effort d'apprentissage, ni un gain commercial.
- ONBOARD-1 reste ouverte jusqu'à l'exécution par un pilote réel, avec temps humain et interventions consignés.
