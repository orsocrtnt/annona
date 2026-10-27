# MOB-01A — suivi GPS honnête côté chauffeur

## États affichés

Le chauffeur voit un état distinct pour la recherche du signal, la synchronisation confirmée, la position périmée, le refus de permission, le GPS indisponible, le délai GPS dépassé, l'absence de support, la perte réseau et le refus du serveur. Un bouton de reprise relance la géolocalisation et les lectures du service et des missions.

Une coordonnée obtenue localement ne signifie pas qu'elle est partagée. L'interface affiche « synchronisée » uniquement après une réponse HTTP réussie contenant l'heure serveur `updatedAt`. Une erreur réseau, une réponse non 2xx ou une confirmation malformée reste visible et conserve l'heure de la dernière synchronisation connue.

## Début, fraîcheur et arrêt

- Aucun observateur GPS n'est démarré lorsque le service est fermé ou qu'aucune mission n'est démarrée.
- Le suivi est actif uniquement pendant un service ouvert et une mission en cours. La fréquence et le seuil de fraîcheur utilisent les réglages validés de l'entreprise.
- Sans nouvelle confirmation avant le seuil, l'état chauffeur devient « position périmée ». Les vues partagées appliquent la même règle serveur : depuis TRACK-2, position estimée puis dernière position connue, signalées comme telles.
- La fermeture du service arrête l'observateur côté navigateur, supprime la position serveur et fait refuser toute publication tardive. La fin de mission applique la même protection serveur.
- Le retour du réseau tente immédiatement de republier la dernière position locale ; un nouvel échec reste affiché.

## Navigation et rendu serveur

La carte Leaflet de navigation est chargée dynamiquement uniquement dans le navigateur. Le serveur ne doit plus évaluer le module qui dépend de `window`. L'état GPS complet est aussi affiché dans l'écran de navigation.

## Vérification

Lancer `npm run check`, puis `npm run build`. Au démarrage de production, vérifier l'absence de `ReferenceError: window is not defined`. La recette connectée doit contrôler : publication refusée service fermé, acceptée service ouvert avec mission démarrée, signal frais puis périmé, retour à frais, arrêt effectif, suppression de la position, publication tardive refusée et service seul sans mission refusé. Toutes les fixtures doivent être supprimées et l'empreinte initiale restaurée.

Les essais iPhone/Android, écran verrouillé et fonctionnement en arrière-plan restent MOB-01C. Les pannes du fournisseur d'itinéraire et des tuiles restent MAP-2.
