# MOB-01A — suivi GPS honnête

14 octobre 2026 — implémentation locale et recette connectée sur l'environnement de test, sans déploiement ni changement de schéma.

## Résultat

Le chauffeur dispose maintenant d'un état de suivi visible dans l'espace principal et dans la navigation : recherche GPS, synchronisation confirmée, position périmée, permission refusée, signal indisponible, délai dépassé, navigateur incompatible, appareil hors ligne et erreur serveur. Les erreurs ne sont plus transformées silencieusement en état actif. La reprise relance le GPS ainsi que les lectures du service et des missions.

Une position devient « synchronisée » seulement après une réponse HTTP réussie et une date serveur valide. L'heure de la dernière synchronisation reste affichée en cas de perte. Le retour en ligne déclenche une nouvelle tentative avec la dernière position locale. Le seuil de péremption de l'entreprise fait passer l'interface chauffeur à l'état périmé ; les vues client et administration continuent de masquer les coordonnées périmées côté serveur.

Le navigateur n'active pas le GPS lorsque le service est fermé ou qu'aucune mission n'est démarrée. La fermeture du service arrête l'observateur, supprime la position serveur et empêche une publication tardive. Le chargement dynamique de la carte de navigation empêche désormais Leaflet d'être évalué côté serveur ; l'erreur `window is not defined` reproduite avant MOB-01A ne réapparaît plus au démarrage du build corrigé.

## Vérifications

- `npm run check` : types valides, lint sans erreur avec les avertissements historiques, 157 tests réussis sur 157, dont 5 tests MOB-01A.
- `npm run build` : compilation de production réussie, 96 pages générées.
- Recette connectée : publication anonyme 401 et coordonnées invalides 400 ; service fermé 409 sans écriture ; service ouvert et mission démarrée 200 avec date serveur ; état partagé FRESH, puis STALE sans coordonnées, puis FRESH après nouveau signal ; fermeture du service avec suppression et nouvelle publication 409 ; service rouvert sans mission démarrée 409.
- Interface rendue en test : refus de permission, erreur serveur avec dernière synchronisation, état périmé, arrêt et bouton de reprise présents avec annonces accessibles.
- Nettoyage : entreprise, deux comptes base/Auth, commande, mission et position de recette supprimés. Comptes et empreinte SHA-256 des entreprises, utilisateurs, commandes, livraisons et positions préexistants identiques avant/après.

## Limites

Les erreurs de permission et de réseau sont injectées au niveau client et leurs messages sont rendus ; elles ne remplacent pas la recette sur téléphones physiques. Le verrouillage d'écran, la reprise en arrière-plan et les différences iOS/Android restent MOB-01C. Les erreurs de fournisseur d'itinéraire et de tuiles restent MAP-2. Une coupure pendant une action métier ou une photo relève de MOB-01B.

Preuves : `outputs/mob01a/connected-final.json`, `outputs/mob01a/check-final.log`, `outputs/mob01a/build-final.log`, `outputs/mob01a/final-verification.json`.
