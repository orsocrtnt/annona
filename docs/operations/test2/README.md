# TEST-2 — Suite de recette reproductible

Date de référence : 16 octobre 2026. Cette suite combine les règles métier locales, une intégration connectée sur deux entreprises temporaires et les parcours navigateur des trois rôles. Elle ne déploie rien et ne modifie pas le schéma.

## Préparer une machine

1. Installer les dépendances avec `npm ci`.
2. Installer le navigateur Playwright avec `npx playwright install chromium` si aucun Chrome compatible n'est disponible.
3. Renseigner `.env.local` avec la base de test autorisée et les variables décrites dans `.env.example`. Ne jamais utiliser une base contenant des données réelles pour la recette connectée.
4. Démarrer la suite complète avec `npm run test:v1`.

Sur macOS, la recette navigateur utilise Chrome par défaut. `PLAYWRIGHT_CHANNEL` permet de choisir un autre canal. Pour tester un serveur déjà lancé, définir `E2E_BASE_URL`, puis `E2E_SKIP_WEB_SERVER=1`. Utiliser `http://localhost:3106` pour un build de production local : les cookies de démonstration y restent dans un contexte sécurisé, contrairement à une adresse IP HTTP brute selon le navigateur.

## Contenu de la suite

- `npm test` rejoue les règles métier, les permissions, les transitions et les régressions locales.
- `npm run test:connected` crée deux entreprises `test2-*`, leurs rôles client, administrateur et chauffeur, puis vérifie les doubles créations standard/coursier, une livraison standard réussie, une course avec collecte obligatoire, une livraison échouée avec motif concordant, une facture et les refus entre entreprises.
- `npm run test:e2e` parcourt en navigateur les espaces administrateur, client et chauffeur. Il vérifie le suivi, la facture, deux refus d'API et l'affichage d'une panne réseau simulée.
- `scripts/test-v1/verify-output.mjs` contrôle les résultats, l'absence de résidu et l'absence de secret dans les preuves.

Le point d'entrée à utiliser en intégration continue est `npm run test:v1`. La tâche CI-1 devra l'exécuter avec une base de test isolée avant tout déploiement.

## Fixtures, nettoyage et preuves

La recette connectée fabrique seulement des entités préfixées `test2-` avec des identifiants aléatoires. Son bloc `finally` supprime les tâches opérationnelles, factures, commandes, utilisateurs et entreprises créés. La suite échoue si le contrôle final ne trouve pas exactement zéro résidu.

Les fichiers `outputs/test2/connected.json`, `outputs/test2/browser.json` et `outputs/test2/summary.json` ne contiennent ni identifiants internes, ni e-mails, ni cookies, ni chaîne de connexion. Les traces Playwright et les vidéos sont désactivées ; seules des captures temporaires d'échec peuvent être écrites sous `/private/tmp/tutelliv-test2-playwright`.

En cas d'échec connecté, conserver le résultat généré, vérifier le bloc `fixtureResidue`, puis relancer le nettoyage ciblé du scénario. Ne jamais réinitialiser toute la base. En cas d'échec navigateur, corriger l'écran ou l'attente concernée et relancer `npm run test:e2e`, puis toute la commande `npm run test:v1`.
