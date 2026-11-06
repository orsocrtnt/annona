# COST-1 — modèle de coûts documentaire

Ce modèle estime les coûts mensuels de Annona sans appeler un fournisseur et sans créer de charge distante. Il sert à tester la cohérence des offres avant les mesures de `PERF-02`.

## Recalcul

```bash
npm run cost1:model
```

La commande écrit :

- `outputs/cost1/model.json` : hypothèses, volumes, paliers, coûts et marges ;
- `outputs/cost1/scenarios.csv` : les 36 scénarios exportables vers le prévisionnel.

Elle couvre Starter, Pro et Business pour 1, 10, 50 et 100 entreprises, dans trois variantes : basse, centrale et haute. Chaque ligne contient les commissions de 15 %, 25 % et 35 % séparément.

## Ce qui vient du code

- une position GPS peut être publiée toutes les 4 secondes pendant une mission active ;
- la carte administrateur interroge le serveur toutes les 20 secondes ;
- l'itinéraire chauffeur est recalculé toutes les 30 secondes ;
- seule la dernière position d'un livreur est conservée dans `driver_locations` ;
- aucune souscription Supabase Realtime n'est utilisée actuellement ;
- une preuve JPEG/PNG est limitée à 5 Mio et stockée dans Supabase Storage ;
- le code utilise par défaut les tuiles publiques OpenStreetMap, le serveur de démonstration OSRM et le géocodage Géoplateforme.

## Hypothèses centrales à remplacer par des mesures

| Hypothèse | Starter | Pro | Business |
|---|---:|---:|---:|
| Livreurs | 5 | 10 | 25 |
| Commandes/mois | 1 000 | 3 000 | 6 000 |
| GPS actif par livreur et jour ouvré | 4 h | 6 h | 8 h |
| Support humain chargé | 0,5 h/mois | 1 h/mois | 2 h/mois |

Hypothèses communes centrales : 22 jours ouvrés, 60 calculs d'itinéraire par commande, trois e-mails par commande, photo sur 70 % des livraisons, photo moyenne de 1 Mio conservée douze mois, 25 Kio de base par commande conservés douze mois et coût interne du support de 30 €/h.

La convention de change est volontairement prudente : **1 USD de tarif fournisseur est budgété comme 1 EUR**, hors TVA fournisseur. Il faut remplacer cette convention par le taux et la fiscalité du prévisionnel financier.

## Limites

Les paliers de calcul Supabase sont des budgets de capacité, pas des mesures de saturation. Les durées CPU/mémoire Vercel, le taux de preuves, l'usage de la navigation, les e-mails et le support sont des hypothèses. Les lignes cartographiques au-delà de 250 000 crédits/jour retiennent seulement le plan public « Custom à partir de 860 $ » : elles sont donc un **plancher** et nécessitent un devis.

La phase mesurée de COST-1 doit remplacer ces paramètres après `PERF-02` et les premiers pilotes. Aucun chiffre de ce modèle ne constitue une promesse de marge.

## Phase 2 — rattachement local PERF-02

La phase locale ne modifie pas `model.mjs` : elle contrôle et importe seulement les observations du harnais PERF-02 dans une sortie séparée.

```bash
npm run cost1:model
npm run test:perf02
npm run cost1:perf02
```

`cost1:perf02` lit `outputs/perf02/local.json` et `outputs/cost1/model.json`, puis écrit `outputs/cost1/perf02-local-validation.json`. Il exige exactement les 12 paires Starter/Pro/Business × 1/10/50/100, les associe aux trois variantes documentaires (`low`, `central`, `high`) et vérifie les volumes mensuels du modèle (1 000, 3 000, 6 000 par entreprise).

La sortie reprend uniquement les p50/p95, débit, erreurs, matérialisation, extrapolation signalée, isolation, saturation/reprise et plafond local réellement présents dans PERF-02. Elle échoue avant toute écriture en cas de fichier absent, JSON invalide, schéma incompatible, cible non locale, scénario manquant/dupliqué, profil/volume divergent, pool ou reprise incohérents.

Elle ne remplace **aucun** coût, marge, commission, CPU/mémoire/invocation Vercel, palier Supabase, preuve, e-mail, navigation/cartographie ou support. Le pool mémoire PERF-02 ne représente pas Prisma, PostgreSQL, Next, réseau, stockage ni un fournisseur Realtime. Les mesures sur une cible isolée autorisée et les trois pilotes restent indispensables avant de modifier les hypothèses économiques.
