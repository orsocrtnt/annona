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

Les budgets DEMO-2 sont donc tenus dans cet environnement. Le benchmark reproductible attend encore l'URL Vercel Preview pour fermer formellement la tâche.

## Validation

- `npm run check` : 298/298 tests, types et lint réussis ;
- `npm run build` : build Next production réussi ;
- `npm run test:demo2` : concurrence, idempotence, stock vide, A/B, expiration, panne, quarantaine, reprise et modèle permanent réussis ;
- `DEMO_BASE_URL=http://127.0.0.1:3107 npm run test:demo2:http` : quatre budgets réussis ;
- sécurité préproduction : RLS active, lecture refusée à `anon` et `authenticated` sur la table de pool ;
- état final : trois prêts, zéro loué, zéro quarantaine.

## Limite restante

Aucun push ni déploiement Vercel n'a été effectué par cette exécution. L'outil Vercel MCP requis par le workflow de publication n'est pas disponible dans cette session et le dépôt contient plusieurs changements locaux d'autres tâches qu'il ne faut pas pousser aveuglément. DEMO-2 reste donc non cochée jusqu'à publication maîtrisée de la Preview et exécution de `test:demo2:http` sur son URL.
