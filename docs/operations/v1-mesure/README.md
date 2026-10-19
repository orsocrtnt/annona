# Protocole V1-MESURE

## Objet

Ce protocole mesure séparément quatre éléments du parcours principal :

1. persistance d’une commande standard et de sa livraison ;
2. affectation manuelle au chauffeur ;
3. question client, réponse dispatch et relecture du fil ;
4. lecture du statut, de la chronologie et d’une position GPS fictive fraîche par le client et l’administration.

Ces valeurs sont des latences techniques internes. Elles ne mesurent pas le temps qu’un opérateur ou un client met à comprendre, saisir et vérifier les informations. Elles ne démontrent aucun gain par rapport aux e-mails et ne doivent pas être utilisées dans une promesse commerciale.

## Exécution reproductible

Préconditions : utiliser uniquement la base de test autorisée, avec les variables de `.env.local`, sans serveur nécessaire. Ne pas exécuter sur une base de production.

Commande :

```bash
npx dotenv -e .env.local -- tsx scripts/v1-measure/measure.ts outputs/v1-mesure/internal-baseline.json
```

Le harnais crée une entreprise fictive isolée, un admin, un client, un chauffeur et cinq scénarios identiques. Il utilise les services métier réels pour la création, l’affectation, les échanges et la lecture du suivi. La position et le passage en livraison sont préparés comme fixtures avant la mesure de lecture. Tous les objets portent un identifiant aléatoire réservé à l’exécution ; le nettoyage est limité à cette entreprise et le fichier de sortie doit confirmer `clean: true` et zéro résidu.

À chaque campagne, conserver dans le fichier de sortie : date, machine, runtime, type de réseau, taille d’écran ou appareil, volume, nombre de répétitions, aide utilisée, valeurs individuelles, médiane, minimum, maximum et résultat du nettoyage. Ne comparer deux campagnes que si le scénario, le volume et le réseau sont identiques.

## Mesure humaine à réaliser avant un pilote

Rejouer le même dossier avec un client, un dispatcher et un chauffeur fictifs. Chronométrer séparément :

- début de saisie → confirmation visible de la commande ;
- commande visible → chauffeur affecté ;
- question envoyée → réponse retrouvée dans le dossier ;
- ouverture de la commande → statut et heure de position correctement cités par le participant.

Noter les erreurs, retours arrière, écrans d’aide, questions posées à l’accompagnateur et nombre d’appels/e-mails utilisés. Effectuer au moins trois répétitions par profil sur desktop, puis la mission chauffeur sur iPhone et Android. Cette campagne humaine relève de V1-GO/MOB-01C et des futurs pilotes ; elle ne peut pas être remplacée par le harnais automatisé.
