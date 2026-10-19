# TEST-2 — Suite de vérification reproductible

Date : 16 octobre 2026. Périmètre : règles métier, intégration connectée multi-entreprise, parcours navigateur des trois rôles, scénarios de réussite et de panne, nettoyage et preuves sans secrets.

## Situation initiale

Le projet possédait déjà 214 tests locaux et plusieurs recettes ponctuelles, mais aucune commande unique ne rejouait une livraison complète, un échec, une facture, les frontières d'entreprise et les trois espaces du produit. Les preuves dépendaient de scripts propres à chaque tâche et la vérification navigateur n'était pas intégrée à une suite réutilisable.

## Mise en place

- Playwright est configuré pour un seul scénario séquentiel et un serveur local réutilisable ou lancé automatiquement.
- Le scénario connecté crée deux entreprises temporaires et six utilisateurs, puis trois commandes isolées. Une mission passe par affectation, acceptation, départ, livraison et preuve fictive ; une autre se termine en échec motivé ; la commande livrée reçoit une facture visible par son client.
- Les lectures étrangères de commande, livraison, facture, mission et conversation sont refusées. Une tentative de facturation depuis l'autre entreprise est aussi refusée.
- Le scénario navigateur couvre les tableaux administrateur, les commandes, le suivi et les factures client, ainsi que les missions chauffeur. Les accès d'un client à une API interne et d'un chauffeur à une API client répondent 403.
- Une panne 503 est injectée sur la liste des missions et l'interface affiche un message explicite au lieu de rester vide ou de planter.
- Le nettoyage est exécuté même après une erreur et la suite vérifie séparément les résidus de chaque type de donnée.
- Les résultats sont filtrés par un contrôle anti-secret. Les traces persistantes et vidéos navigateur sont désactivées.

## Résultats

La commande finale `npm run test:v1` réussit intégralement :

- **214/214 tests locaux** réussis ;
- **2 entreprises**, **6 rôles associés** et **3 commandes temporaires** exercés par l'intégration connectée ;
- livraison `DELIVERED` avec suivi et preuve, échec `FAILED` avec motif, facture `PENDING` visible par le client ;
- six frontières interentreprises vérifiées, dont la lecture et l'écriture de facturation ;
- parcours navigateur administrateur, client et chauffeur réussi, sans erreur JavaScript ;
- deux refus entre rôles à 403 et panne réseau 503 avec repli visible ;
- **zéro résidu** entreprise, utilisateur, commande, livraison, facture ou tâche ;
- contrôle anti-secret réussi et aucune trace persistante.

`npm run check` réussit également : types valides, lint sans erreur bloquante et 214/214 tests. `npm run build` réussit et génère 96 pages. Les avertissements lint déjà inventoriés restent hors du périmètre de TEST-2. `git diff --check` réussit.

Les preuves sont conservées dans `outputs/test2/connected.json`, `outputs/test2/browser.json` et `outputs/test2/summary.json`. La procédure de reproduction se trouve dans `docs/operations/test2/README.md`.

## Limites restantes

Le parcours navigateur utilise les comptes de démonstration en lecture seule ; les mutations métier sont vérifiées par le scénario connecté isolé. Les essais sur iPhone et Android physiques restent dans MOB-01C. TEST-2 fournit la commande prête à brancher, tandis que la création du workflow d'intégration continue, la revue des dépendances et la validation d'un déploiement isolé restent dans CI-1.
