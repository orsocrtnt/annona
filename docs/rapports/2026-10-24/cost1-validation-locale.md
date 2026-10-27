# COST-1 — rattachement local de PERF-02

**Date :** 24 octobre 2026  
**Périmètre :** lecture d'artefacts locaux `outputs/perf02/local.json` et `outputs/cost1/model.json`, sans réseau, base, fournisseur, dépense, migration ni seed.  
**Statut :** intégration locale terminée ; COST-1 et sa phase 2 restent ouverts.

## Résultat

`npm run cost1:perf02` génère `outputs/cost1/perf02-local-validation.json`. L'intégrateur valide un schéma PERF‑02 local précis, ses 12 scénarios uniques et les 36 scénarios du modèle documentaire. Chaque paire profil×entreprises est appariée aux trois variantes documentaires sans modifier `scripts/cost1/model.mjs`.

L'artefact n'importe que les mesures locales disponibles : p50/p95, débit, erreurs, données matérialisées, extrapolation signalée, isolation A/B, saturation/reprise et plafond local. Il ne contient ni `costsEur`, ni contribution, marge, commission ou palier fournisseur.

## Appariements contrôlés

| Profil × entreprises | Commandes modèle | Matérialisées PERF‑02 | Extrapolées | p50 ms | p95 ms | Débit op/s | Erreurs |
|---|---:|---:|---:|---:|---:|---:|---:|
| Starter × 1 | 1 000 | 12 | 988 | 0,312 | 0,438 | 15 275,688 | 0 |
| Starter × 10 | 10 000 | 120 | 9 880 | 0,584 | 0,777 | 94 908,514 | 0 |
| Starter × 50 | 50 000 | 600 | 49 400 | 1,779 | 2,576 | 118 062,291 | 0 |
| Starter × 100 | 100 000 | 1 200 | 98 800 | 3,233 | 5,016 | 144 793,104 | 0 |
| Pro × 1 | 3 000 | 12 | 2 988 | 0,037 | 0,055 | 127 914,042 | 0 |
| Pro × 10 | 30 000 | 120 | 29 880 | 0,241 | 0,426 | 169 821,454 | 0 |
| Pro × 50 | 150 000 | 600 | 149 400 | 1,811 | 2,645 | 135 723,607 | 0 |
| Pro × 100 | 300 000 | 1 200 | 298 800 | 2,847 | 5,197 | 141 053,049 | 0 |
| Business × 1 | 6 000 | 12 | 5 988 | 0,034 | 0,054 | 131 958,763 | 0 |
| Business × 10 | 60 000 | 120 | 59 880 | 0,217 | 0,397 | 187 664,793 | 0 |
| Business × 50 | 300 000 | 600 | 299 400 | 1,088 | 2,853 | 116 401,731 | 0 |
| Business × 100 | 600 000 | 1 200 | 598 800 | 2,456 | 4,365 | 165 166,985 | 0 |

Chaque ligne est associée à `low`, `central` et `high` du modèle COST‑1 ; leurs coûts et marges restent cependant inchangés. Les 12 commandes par entreprise sont la partie effectivement matérialisée. Le reste est une projection analytique explicitement séparée, pas une mesure de latence ou de coût.

## Observations importées, sans interprétation économique

- Isolation A/B : lecture étrangère refusée (`TENANT_FORBIDDEN`) pour les 12 scénarios ; les lignes mono-entreprise utilisent un contrôle B local exclu de la population.
- Pool local synthétique : capacité et maximum observé de 5 lors des scénarios nominaux, 0 erreur nominale.
- Dégradation : 12 opérations concurrentes, 5 acceptées, 7 `POOL_SATURATED`; les 5 opérations de reprise réussissent.
- Plafond prudent du seul harnais : 4 opérations concurrentes (80 % du pool de 5). Il n'est pas une capacité d'hébergement.

## Rejets vérifiés

Les tests ciblés couvrent l'appariement des 12 scénarios, l'absence de tout champ de coût dans l'artefact et les rejets d'un inventaire incomplet ou d'un volume représenté divergent. La commande a aussi été exécutée avec un fichier PERF absent et a échoué explicitement avec `COST1_PERF02_INPUT_MISSING`.

## Ce qui reste inchangé et non mesuré

Cette tranche ne remplace aucune valeur documentaire : coûts/marges/commissions, CPU/mémoire/invocations Vercel, paliers Supabase, taille/taux/egress des preuves, e-mails, navigation/cartographie, support humain et prix/devis fournisseurs.

Les mesures nécessaires avant toute modification économique sont : pool Prisma/PostgreSQL et serveur Next sur cible isolée autorisée, CPU/mémoire/invocations Vercel et paliers Supabase observés, taux/taille/egress des preuves, cadence et coût contractuel cartographie, e-mails effectivement délivrés et support mesuré avec les trois pilotes. La phase 2 et COST‑1 restent donc ouverts.

## Commandes exécutées

```bash
npm run cost1:model
npm run cost1:perf02
node --import tsx --test tests/cost1-perf02.test.ts
npm run check
```

Les deux premières commandes ont produit respectivement 36 scénarios documentaires et 12 appariements locaux. Les tests ciblés ont réussi 2/2. `npm run check` a réussi : types et lint sans erreur, **363/363 tests**.
