# V1-GO — recette avant essai pilote

Cette procédure rassemble les preuves locales avant un essai pilote. Elle ne vaut ni validation commerciale, ni validation terrain du GPS, ni autorisation de production.

## Partie automatisée

1. Démarrer le build de production local sur `127.0.0.1:3106`.
2. Pour tester ce serveur déjà lancé, exécuter la recette navigateur générale avec `E2E_SKIP_WEB_SERVER=1 npm run test:e2e`, puis le parcours opérationnel détaillé avec `E2E_SKIP_WEB_SERVER=1 npx playwright test tests/e2e/v1-operational.spec.ts`. La base configurée par défaut est `http://localhost:3106` afin de respecter les cookies sécurisés du build de production.
3. Exécuter les règles locales, la recette connectée puis le vérificateur de preuves selon `docs/operations/test2/README.md`.
4. Exécuter le build, le scanner de secrets, le contrôle documentaire et `git diff --check`.

La recette connectée crée deux entreprises `test2-*`, couvre doubles créations standard/coursier, collecte obligatoire, transition invalide refusée, livraison réussie et échouée, motif obligatoire et concordant client/admin, preuve, facture, conversation et frontières d'entreprise, puis exige zéro résidu. La recette navigateur générale couvre onboarding interne, boucle support et parcours des trois rôles avec panne 503 visible. Le parcours opérationnel clique réellement deux fois sur la création, vérifie une seule commande, déroule une course collecte → livraison avec une vraie image PNG, contrôle la proximité serveur et relit preuve, échec, note et chronologie dans les espaces client et administration.

La position injectée dans ce parcours est une fixture déterministe du navigateur. Elle qualifie les écrans et les règles serveur, mais ne remplace pas les essais de déplacement, verrouillage et reprise sur téléphones physiques.

Le montage d'une session de démonstration traite les livraisons par lots de deux. Cette limite laisse des connexions disponibles aux lectures d'authentification sur le pool local borné. Une régression doit rejouer au moins trois connexions de démonstration consécutives.

## Contrôles reportés qui exigent une intervention

- iPhone et Android physiques : déplacement, refus GPS, écran verrouillé, reprise et arrêt de service ;
- expéditeur e-mail réel : invitation, récupération, erreur et rejeu ;
- préproduction isolée avec secrets distincts ;
- restauration chronométrée de la base et du stockage privé sur une cible isolée.

Tant que ces quatre validations ne sont pas obtenues, V1-GO reste ouvert et les limites correspondantes restent hors promesse.

## Preuves

- `outputs/test2/connected.json`
- `outputs/test2/browser.json`
- `outputs/test2/summary.json`
- `outputs/v1-go/browser-operational.json`
- `outputs/v1-go/r01-standard-reference.png`
- `outputs/v1-go/r06-courier-client.png`
- `outputs/v1-go/r06-courier-admin.png`
- `outputs/v1-go/r10-failure-client.png`
- `outputs/v1-go/r10-failure-admin.png`
- `outputs/v1-go/readiness.json`
- `docs/rapports/2026-10-17/v1-go-local.md`
