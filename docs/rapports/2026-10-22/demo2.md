# Rapport DEMO-2 — ouverture rapide de la démonstration

Date : 22 octobre 2026.

## Résultat obtenu

Le chemin lent de DEMO-1 est retiré des nouvelles connexions. La création distante précédemment mesurée à 83 secondes est remplacée par la réservation d'une entreprise fictive déjà construite. La déconnexion n'attend plus la suppression ou la reconstruction.

La préproduction contient trois slots prêts. L'attribution est sérialisable et protégée par une empreinte unique ; une double soumission reprend le même slot et deux visiteurs simultanés ne peuvent pas partager une entreprise. Un stock vide produit une attente explicite de cinq secondes.

Le recyclage est une machine à états persistante. Logout et expiration déposent une demande durable ; une fonction interrompue est reprise. Les références entre entreprises, fichiers externes, objets Storage et jobs actifs ferment le recyclage et mettent le slot en quarantaine. Le modèle permanent et l'ancienne cible mise en pause n'ont pas été modifiés.

## Mesures

La recette base de préproduction a mesuré 1 945 ms pour trois réservations concurrentes, 438 ms pour la mise en file de déconnexion et 612 ms au p95 pour relire une location. La recette HTTP, exécutée avec le build de production local contre la même base, a mesuré sur trois ouvertures :

- ouverture connexion puis tableau de bord p95 : 2 983 ms ;
- ouverture maximale : 2 983 ms ;
- reconnexion au tableau de bord p95 : 7 ms ;
- réponse de déconnexion p95 : 1 224 ms.

Sur la véritable Vercel Preview du commit `f353f58`, trois ouvertures avec un pool prêt ont ensuite mesuré :

- ouverture connexion puis tableau de bord p95 : 3 035 ms ;
- ouverture maximale : 3 035 ms ;
- reconnexion au tableau de bord p95 : 279 ms ;
- réponse de déconnexion p95 : 1 201 ms.

La première exécution juste après le démarrage à froid Vercel avait mesuré 5 290 ms pour l'ouverture p95/max, soit 290 ms au-dessus du budget p95 mais toujours sous le plafond absolu de 10 s. Après stabilisation de la fonction et remise du pool à trois slots prêts, le passage de validation respecte les quatre budgets. Le cookie temporaire de protection Vercel a été injecté en mémoire et n'est présent ni dans les preuves, ni dans le dépôt.

## Validation

- `npm run check` : 298/298 tests, types et lint réussis ;
- `npm run build` : build Next production réussi ;
- `npm run test:demo2` : concurrence, idempotence, stock vide, A/B, expiration, panne, quarantaine, reprise et modèle permanent réussis ;
- `DEMO_BASE_URL=http://127.0.0.1:3107 npm run test:demo2:http` : quatre budgets réussis ;
- benchmark protégé sur la véritable Vercel Preview : quatre budgets réussis sur trois ouvertures ;
- sécurité préproduction : RLS active, lecture refusée à `anon` et `authenticated` sur la table de pool ;
- état final : trois prêts, zéro loué, zéro quarantaine.

## État de clôture

La branche `preproduction` a été publiée sans promotion en production. Le déploiement Preview est resté relié à la base Supabase de préproduction. L'état final contrôlé contient trois slots prêts, zéro loué et zéro en quarantaine. La branche et la base de production ainsi que l'ancienne cible Supabase n'ont pas été modifiées. DEMO-2 est terminée.
