# MOB-01C — Protocole de recette sur téléphones physiques

Ce protocole prépare la recette iPhone/Android. Il ne valide aucun appareil tant que les manipulations n'ont pas été réalisées sur la préproduction HTTPS isolée.

## Préconditions

- préproduction ENV-1 opérationnelle, sans donnée réelle non autorisée ;
- un compte entreprise fictif, un livreur fictif et un client fictif ;
- un iPhone avec Safari et un Android avec Chrome, modèles et versions consignés ;
- deux réseaux disponibles : Wi-Fi stable et réseau mobile ;
- une image de preuve sans donnée personnelle ;
- heure des appareils synchronisée ;
- autorisation de localisation réglable pendant la séance.

## Matrice minimale

Chaque scénario est exécuté sur iPhone/Safari et Android/Chrome, d'abord en Wi-Fi puis sur réseau mobile.

| Scénario | Manipulation | Résultat attendu |
|---|---|---|
| Installation/navigation | Ouvrir, ajouter à l'écran d'accueil si proposé, se connecter et naviguer | Aucun blocage, débordement ou perte de session anormale |
| GPS autorisé | Autoriser pendant l'utilisation, démarrer une mission et se déplacer | Position datée, fraîcheur visible, arrêt à la fin du service |
| GPS refusé | Refuser puis tenter le démarrage | Refus expliqué, possibilité de réessayer ou confirmer le mode dégradé prévu |
| Signal perdu | Couper localisation ou passer dans une zone sans signal | Dernière position marquée ancienne ; aucun faux suivi temps réel |
| Réseau interrompu | Activer le mode avion pendant une action puis rétablir | Action mise en attente, reprise explicite, aucun doublon |
| Écran verrouillé | Verrouiller cinq minutes pendant la mission puis revenir | Limite du suivi de fond mesurée ; état serveur et écran réconciliés |
| Application quittée | Fermer le navigateur puis rouvrir | Mission récupérée, aucune transition inventée |
| Preuve photo | Photographier ou choisir l'image de test, couper le réseau pendant l'envoi | Reprise contrôlée, une seule preuve, progression et erreur compréhensibles |
| Double action | Toucher deux fois confirmation, départ et livraison | Une seule transition métier |
| Changement de réseau | Passer Wi-Fi → mobile pendant la mission | Pas de perte silencieuse ; position et actions reprennent |
| Batterie/économie | Activer l'économie d'énergie si disponible | Limites consignées ; aucune promesse de suivi permanent si l'OS suspend l'app |

## Preuves à conserver

Pour chaque ligne : appareil, OS, navigateur, réseau, heure, résultat attendu/observé, durée de reprise, capture sans donnée sensible et identifiant de fixture. Noter séparément le comportement écran actif, navigateur en arrière-plan et téléphone verrouillé.

Le rapport final doit dire explicitement ce que TutelLiv garantit et ce que l'OS peut suspendre. Une PWA ou une application native ne sera décidée que si une limite observée bloque la promesse retenue.

## Nettoyage

Supprimer uniquement les entreprises, comptes, commandes, positions et preuves préfixés pour cette recette. Vérifier zéro fixture résiduelle dans PostgreSQL, Supabase Auth et Storage. Ne jamais utiliser ce protocole sur la production.
