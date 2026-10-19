# ONBOARD-1 — Jalon interne

Date : 16 octobre 2026. Ce rapport couvre le jalon interne sur données fictives. Il ne clôt pas ONBOARD-1, qui exige encore un vrai pilote.

## Réalisation

- Un nouvel écran `/onboarding`, réservé à l'administrateur d'entreprise, regroupe le chemin vers la première livraison.
- Les sept étapes sont calculées depuis l'entreprise courante : services, client, livreur, tarifs, dispatch, première commande et première livraison terminée.
- Chaque étape renvoie vers l'écran existant approprié, sans dupliquer les formulaires ni modifier silencieusement des réglages.
- L'avancement est rechargé à chaque retour sur la page.
- L'écran précise que la réception des invitations e-mail n'est pas encore validée et qu'aucun import initial n'est proposé.

## Recette connectée

Une entreprise fictive isolée a été créée dans la base de test, avec administrateur, client et livreur techniques. La progression observée est passée de 2/7 après configuration, à 5/7 après les comptes, 6/7 après la commande et 7/7 après affectation, acceptation, démarrage et preuve de livraison.

Temps automatisés de cette exécution : configuration 2 700 ms, préparation des comptes 1 601 ms, création de commande 8 639 ms, affectation jusqu'à preuve 30 152 ms, total 45 372 ms. Ces valeurs incluent les appels à la base distante ; elles ne représentent pas un temps humain.

Les tâches asynchrones ont été attendues avant nettoyage. Contrôle final : zéro entreprise, utilisateur, commande, livraison ou tâche ONBOARD-1 résiduelle.

## Validation

- 3 tests locaux ONBOARD-1, puis suite complète à **220/220 tests** ;
- types valides et lint strict sans avertissement ;
- recette connectée réussie, progression 2 → 5 → 6 → 7 et résidu nul ;
- test Chrome réussi : écran, sept étapes, limites et refus client/livreur ;
- build de production réussi avec **100 pages** et suite E2E globale réussie à **3/3 scénarios**.

Procédure : `docs/operations/onboard1/README.md`. Preuve : `outputs/onboard1/connected.json`.

## Reste à valider

ONBOARD-1 reste ouverte. Un pilote réel doit encore suivre ce parcours, recevoir réellement ses invitations, mesurer le temps humain et les interventions, puis confirmer le besoin et le format d'un éventuel import. Aucun résultat commercial n'est déduit de la recette interne.
