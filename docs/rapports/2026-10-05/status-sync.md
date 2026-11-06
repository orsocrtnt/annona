# Audit de synchronisation des statuts Annona

Date : 5 octobre 2026

## Résultat

La TODO du dépôt et sa copie visible sont maintenant identiques. La recette V1 du dépôt et sa copie visible sont également identiques.

- TODO principale : 65 éléments, dont 14 terminés et 51 ouverts.
- Parmi les 14 terminés : 6 acquis de préparation/recette et 8 tâches du plan actif.
- Tâches actives terminées : PROD-03, V1-RECETTE, SEC-01, SEC-02, SEC-03, SEC-04, SEC-06 et OPS-02A.
- Recette V1 : 14 scénarios, dont R13 terminé et 13 encore ouverts.
- SEC-05 reste volontairement ouverte : l’implémentation locale existe, mais la configuration et la recette e-mail réelles manquent.

## Preuves contrôlées

- PROD-03 : `docs/CADRAGE_CLIENT.md`.
- V1-RECETTE : `docs/RECETTE_V1.md` et ses 14 scénarios.
- SEC-01 : rapport, 31 assertions API/base réussies et tests de rattachement.
- SEC-02 : rapport, 23 vérifications HTTP réussies et tests support.
- SEC-03 : rapport et 28 tests réussis lors de sa clôture.
- SEC-04 : rapport et 39 tests réussis lors de sa clôture.
- SEC-06 : rapport, 58 tests, matrice connectée 41/41 et nettoyage du compte temporaire.
- OPS-02A : rapport, 63 tests, pannes injectées, deux créations connectées puis zéro résidu.
- R13 : preuves SEC-01 à SEC-06, matrice connectée et contrôles Storage.

## Corrections de cohérence effectuées

- Date générale de la TODO actualisée.
- Copie `outputs/TODO-Annona-vente.md` synchronisée.
- Copie `outputs/v1/recette-v1.md` synchronisée.
- Paragraphes qui présentaient encore SEC-06 et OPS-02A comme prochaines tâches corrigés.
- Nombre actuel de tests et état de la fuite support actualisés dans les acquis.
- Ordre de traitement de la recette actualisé : OPS-02B est la prochaine tâche technique de cette chaîne.
- Règle ajoutée dans `AGENTS.md` pour comparer les copies après chaque mise à jour de statut.

Les fichiers sous `work/` sont des archives intermédiaires et peuvent conserver d’anciens états. Ils ne constituent pas la source de vérité.

## Contrôle d’identité

- SHA-256 TODO dépôt et copie : `79e23287036ec20c291565561727972103ead074d17df112df0097d71faee926`.
- SHA-256 recette dépôt et copie : `e7feb78bec1d04c4134b6cda2de83ff575499fafbbd498340717c16ce28e9b59`.
