# OPS-02A — Création de commande atomique

Date de validation : 2026-10-05

## Résultat

OPS-02A est terminée. La création d'une commande standard ou coursier regroupe désormais la commande, les articles, les étapes de collecte et la livraison dans une seule transaction Prisma. Une erreur annule l'ensemble de la chaîne. Les parcours internes de génération de données client et de scénario de démonstration utilisent la même garantie pour leurs objets associés.

La mission spéciale reste atomique grâce à une création Prisma imbriquée unique ; sa livraison n'est créée qu'après acceptation du devis, conformément au parcours existant.

## Vérifications

- Pannes injectées à la création de la commande, des articles coursier et de la livraison : aucune commande, étape, article, livraison ou adresse partielle.
- Succès simulés standard et coursier : la chaîne complète est validée avant les effets annexes.
- Recette connectée sur la base de test : réponses 201 pour une commande standard et une course ; chacune possède exactement une livraison, la course possède une collecte et un article relié à cette collecte.
- Nettoyage connecté : deux commandes fictives supprimées, zéro résidu.
- `npm run check` : TypeScript valide, lint sans erreur avec 24 avertissements déjà présents, 63 tests réussis sur 63.
- `git diff --check` : réussi.

## Limite volontaire

L'enregistrement optionnel d'une adresse et l'affectation automatique sont exécutés après la transaction. Leur échec ne rend plus la commande principale incomplète. La déduplication des doubles clics et la reprise durable de ces effets différés relèvent d'OPS-02B.

Aucun changement de schéma, migration ou déploiement n'a été effectué.

## Preuves

- `tests/order-atomicity.test.ts`
- `outputs/ops02a/check.log`
- `outputs/ops02a/connected.json`
- `outputs/ops02a/final-verification.json`
