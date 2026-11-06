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

## Séance iPhone seul, à pied (préparée le 27 octobre 2026)

Le propriétaire dispose d'un iPhone et réalise l'essai seul, à pied. L'Android reste à trouver : la case MOB-01C ne peut pas être cochée avec cette seule séance.

### Outillage

- `MOB01C_ADDRESSES="rue|code postal|ville;rue|code postal|ville" npm run mob01c:setup` crée sur la préproduction une entreprise `mob01c-<clé>` (hors démo, donc sans positions simulées), un livreur et un administrateur connectables, et trois livraisons STANDARD assignées vers ces adresses. Le script vérifie la connexion des deux comptes et les trois missions du livreur. Identifiants : `outputs/mob01c/acces.txt` (lecture propriétaire seule, jamais affichés). Hors de France, le géocodeur IGN ne trouve pas l'adresse : ajouter un 4e champ `|lat,lng` qui impose la position (`rue|code postal|ville|40.76,-73.97`).
- `npm run mob01c:watch` relève toutes les 5 s la dernière position du livreur. La base n'en garde qu'une par livreur (`DriverLocation`) : sans ce relevé, les trous pendant le verrouillage ne se mesurent pas. Le journal `outputs/mob01c/journal-*.jsonl` contient l'âge de la position, sa précision, la distance parcourue depuis la précédente et l'état des livraisons, sans coordonnées. La synthèse (`*-synthese.json`, trous de plus de 30 s) est réécrite à chaque relevé. Le Mac doit rester branché et ouvert (`caffeinate` empêche seulement la veille d'inactivité).
- `npm run mob01c:cleanup` supprime uniquement ce que désigne `outputs/mob01c/fixture.json`, photos et comptes Auth compris, puis vérifie zéro résidu.
- Vérifié le 27 octobre 2026 sur la préproduction, avec deux adresses publiques de Paris : création, connexion, missions, relevé et nettoyage à zéro résidu.

### Préparation

1. Choisir deux lieux publics (commerce, place, mairie) à 400–800 m l'un de l'autre, sur une boucle d'environ 30 minutes. Pas l'adresse du domicile : les livraisons doivent pouvoir être validées à moins de 150 m.
2. L'agent lance `mob01c:setup` avec ces adresses, puis le propriétaire lance `npm run mob01c:watch` sur le Mac.
3. Sur l'iPhone : se connecter à Vercel dans Safari (la préproduction est protégée par l'authentification de l'équipe), puis ouvrir l'adresse de `acces.txt`.
4. Faire une capture d'écran à chaque étape : son heure sert à aligner l'observation avec le journal.

### Déroulé

| # | Lieu, réseau | Manipulation | À observer |
|---|---|---|---|
| 1 | Domicile, Wi-Fi | Se connecter avec le compte livreur, ajouter à l'écran d'accueil | Connexion, affichage, 3 missions |
| 2 | Domicile, Wi-Fi | Refuser la localisation, tenter de démarrer le service | Refus expliqué, possibilité de réessayer |
| 3 | Domicile, Wi-Fi | Autoriser la localisation (Safari → aA → Réglages du site web → Position), démarrer le service, accepter les missions | Service actif, position reçue (journal : âge < 10 s) |
| 4 | Dehors, réseau mobile | Marcher 5 minutes, écran allumé | Rythme normal des positions ; passage Wi-Fi → mobile sans perte |
| 5 | Dehors | Verrouiller l'écran 5 minutes en marchant, puis revenir | Trou mesuré dans le journal ; état réconcilié au retour |
| 6 | Dehors | Passer 3 minutes dans une autre application | Comportement en arrière-plan |
| 7 | Avant le lieu 2 | Tenter de livrer la mission vers le lieu 2 | Blocage hors zone avec la distance |
| 8 | Lieu 1 | Passer « en livraison » en touchant deux fois le bouton | Une seule transition |
| 9 | Lieu 1 | Livrer avec une photo sans donnée personnelle (sol, ciel) ; mode avion juste après l'envoi, puis le couper | Envoi repris, une seule preuve (`DELIVERED+photo`) |
| 10 | Dehors | Couper le Service de localisation 2 minutes (Réglages → Confidentialité), puis le rétablir | Position marquée ancienne, pas de faux suivi, reprise |
| 11 | Dehors | Fermer Safari complètement, puis rouvrir l'application | Mission et service retrouvés |
| 12 | Dehors | Activer le mode économie d'énergie, verrouiller 5 minutes | Trou mesuré, comparé à l'étape 5 |
| 13 | Lieu 2 | Livrer la deuxième mission | Validation dans la zone de 150 m |
| 14 | Domicile | Déclarer la troisième mission en échec, arrêter le service | Arrêt du suivi (journal : service arrêté, plus de position) |

À la fin : arrêter le relevé (Ctrl+C), transmettre les captures, puis l'agent rédige le rapport et lance `mob01c:cleanup`.

## Preuves à conserver

Pour chaque ligne : appareil, OS, navigateur, réseau, heure, résultat attendu/observé, durée de reprise, capture sans donnée sensible et identifiant de fixture. Noter séparément le comportement écran actif, navigateur en arrière-plan et téléphone verrouillé.

Le rapport final doit dire explicitement ce que Annona garantit et ce que l'OS peut suspendre. Une PWA ou une application native ne sera décidée que si une limite observée bloque la promesse retenue.

## Nettoyage

Supprimer uniquement les entreprises, comptes, commandes, positions et preuves préfixés pour cette recette. Vérifier zéro fixture résiduelle dans PostgreSQL, Supabase Auth et Storage. Ne jamais utiliser ce protocole sur la production.
