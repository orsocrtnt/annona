# PERF-02 — première qualification locale bornée

**Date :** 24 octobre 2026  
**Périmètre :** processus Node local, données fictives en mémoire, zéro réseau, zéro base, zéro migration, zéro seed, zéro service utilisateur démarré ou arrêté.  
**Statut :** tranche locale terminée ; PERF-02 reste ouverte pour la charge PostgreSQL/Next et une préproduction explicitement autorisée.

## Résultat

Le harnais `npm run test:perf02` produit les douze scénarios demandés dans `outputs/perf02/local.json`. Il refuse toute cible non loopback (`PERF02_REMOTE_TARGET_FORBIDDEN`), matérialise au plus 12 commandes par entreprise et sépare ce qui est réellement mesuré de l'extrapolation analytique.

Exécution de référence : 12 scénarios, 0 erreur nominale, isolation A/B vérifiée pour tous les scénarios multi-entreprises. Sous saturation contrôlée, 5 opérations sur 12 sont admises, 7 échouent explicitement avec `POOL_SATURATED`, puis 5 opérations de reprise réussissent après libération du pool.

Le pool local synthétique atteint son maximum de 5. La recommandation volontairement prudente pour ce seul harnais est donc de ne pas dépasser **4 opérations concurrentes** (80 %) avant une mesure avec le pool Prisma/PostgreSQL réel. Ce nombre n'est pas un dimensionnement d'hébergement.

## Mesures locales de la référence

| Scénario | Commandes représentées | Commandes matérialisées | p50 ms | p95 ms | Débit op/s | Erreurs |
|---|---:|---:|---:|---:|---:|---:|
| Starter × 1 | 1 000 | 12 | 0,540 | 1,101 | 6 837,116 | 0 |
| Starter × 10 | 10 000 | 120 | 1,444 | 1,706 | 44 033,659 | 0 |
| Starter × 50 | 50 000 | 600 | 2,176 | 3,010 | 122 031,842 | 0 |
| Starter × 100 | 100 000 | 1 200 | 2,771 | 4,517 | 158 554,522 | 0 |
| Pro × 1 | 3 000 | 12 | 0,036 | 0,053 | 129 642,834 | 0 |
| Pro × 10 | 30 000 | 120 | 0,258 | 0,438 | 165 360,320 | 0 |
| Pro × 50 | 150 000 | 600 | 1,515 | 2,263 | 155 558,796 | 0 |
| Pro × 100 | 300 000 | 1 200 | 2,650 | 5,867 | 125 580,496 | 0 |
| Business × 1 | 6 000 | 12 | 0,027 | 0,037 | 181 818,182 | 0 |
| Business × 10 | 60 000 | 120 | 0,343 | 0,532 | 125 646,293 | 0 |
| Business × 50 | 300 000 | 600 | 2,503 | 4,119 | 82 996,161 | 0 |
| Business × 100 | 600 000 | 1 200 | 2,168 | 4,005 | 164 005,843 | 0 |

Les unités et le volume de commandes matérialisées sont essentiels : ces chiffres sont des mesures effectives de calcul et d'ordonnancement Node sur cet ordinateur, pas des latences applicatives en base. Les écarts entre lignes courtes reflètent notamment l'ordonnancement local et ne doivent pas être lus comme une montée en débit linéaire.

## Méthode et preuves

- Cibles : `127.0.0.1`, `localhost` ou `::1` uniquement; la garde est testée et toute autre URL est refusée avant exécution.
- Données : entreprises et commandes fictives seulement en mémoire; 12 commandes matérialisées par entreprise, tous les autres volumes sont représentés dans le JSON, sans allocation de 600 000 lignes.
- Opérations : connexion, tableau de bord, création/affectation, GPS, diffusion locale, preuve, export, job/webhook. Chaque opération est chronométrée avec `performance.now()`; p50/p95 sont les percentiles de cet échantillon réellement exécuté.
- Isolation : les objets incluent `companyId`; A/B confirme qu'une lecture de B demandée comme A lève `TENANT_FORBIDDEN`. Pour les scénarios à une entreprise, B est un contrôle local explicitement exclu de la population. Aucun accès externe ni donnée préexistante n'est impliqué.
- Dégradation/reprise : le pool de 5 est surchargé par 12 opérations retenues 12 ms; 7 refus sont mesurés, puis la reprise à 5 opérations est réussie.

Les tests ciblés vérifient les 12 scénarios, la garde loopback et le calcul p95. La sortie JSON contient de plus `networkRequests: 0`, `databaseWrites: 0` et `migrationsOrSeeds: 0`.

## Extrapolation explicitement limitée

La sortie isole, pour chaque scénario, `extrapolatedOrders` et une formule indicative : `mesures locales × (commandes représentées / commandes matérialisées)`. Cette formule ne prédit pas les p50/p95 sous charge : elle sert seulement à rendre visible le volume non matérialisé et à empêcher de présenter l'échantillon comme une validation à 100 entreprises.

Le pool est lui aussi un modèle asynchrone mémoire. Il prouve la réaction du harnais à une saturation et sa reprise, non celle de Prisma, PostgreSQL, Supabase, Vercel, les fichiers, la cartographie ou les webhooks fournisseurs. Realtime n'est pas mesurable ici : aucun canal fournisseur n'est actuellement ouvert par l'application.

## Commandes exécutées

```bash
npm run test:perf02
node --import tsx --test tests/perf02.test.ts
PERF02_TARGET_URL=https://preprod.example.invalid npm run test:perf02
npm run check
```

Les trois premières vérifications ont réussi selon l'attendu : la dernière commande de garde a échoué explicitement avec `PERF02_REMOTE_TARGET_FORBIDDEN`. `npm run check` a réussi : types et lint sans erreur, **361/361 tests**.

## Décision avant pilotes

Conserver au maximum 4 opérations concurrentes dans ce harnais local et ne rien conclure pour l'hébergement. Avant toute charge pilote, il manque une cible PostgreSQL/Prisma isolée, une mesure avec le serveur Next local, une charge préproduction autorisée et bornée, ainsi que des mesures réelles de preuve, GPS, Realtime, jobs et webhook. Ces conditions maintiennent la case PERF-02 ouverte.
