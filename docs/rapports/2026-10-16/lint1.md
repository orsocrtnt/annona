# LINT-1 — Dette de vérification

Date : 16 octobre 2026. Périmètre : avertissements ESLint du code applicatif, remplacement de la commande Next.js dépréciée et validation de non-régression.

## Situation initiale

Le backlog conservait le relevé historique de 24 avertissements. Au début de cette exécution, 20 avertissements restaient dans 15 fichiers source : imports et paramètres inutilisés, dépendances de Hooks instables ou incomplètes, ainsi que deux images HTML non optimisées. La commande `next lint` utilisée par le projet est dépréciée dans la version actuelle de Next.js.

## Réalisation

- `npm run lint` appelle désormais directement ESLint sur `src` et refuse tout avertissement avec `--max-warnings=0`.
- Les valeurs dérivées utilisées dans des Hooks sont stabilisées et leurs dépendances complétées.
- Les imports et paramètres inutilisés sont retirés.
- Les deux aperçus de preuve de livraison utilisent le composant Image avec dimensions explicites ; l'URL d'aperçu locale est libérée à la fermeture.
- Le sélecteur de période d'un widget reprend maintenant la période choisie dans le tableau de bord lorsqu'aucune période propre au widget n'est configurée.

Aucune règle ESLint n'a été désactivée globalement et aucun fichier source n'est exclu pour masquer une erreur. Le périmètre `src` reproduit le contrôle applicatif de l'ancienne commande sans analyser les sorties générées, les scripts de recette ou leurs fixtures.

## Validation

- `npm run lint` : zéro erreur et zéro avertissement ;
- `npm run check` : types valides, lint strict et **217/217 tests locaux** ;
- `npm run test:e2e` : **2/2 parcours navigateur** réussis ;
- `npm run build` : build Next.js réussi et **98 pages statiques** générées ;
- `npm run docs:verify` : 29 documents contrôlés, zéro référence cassée ;
- `git diff --check` : aucune anomalie d'espace.

Le build conserve un avertissement connu de compatibilité Edge émis par `@supabase/ssr`; il n'empêche ni la compilation ni l'exécution. Il relève du durcissement des dépendances suivi dans CI-1, pas d'un avertissement ESLint masqué.

Preuve synthétique partageable : `outputs/lint1/summary.json`.
