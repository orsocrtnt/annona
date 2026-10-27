# PERF-02 — harnais local borné

État de référence : 24 octobre 2026. Ce harnais mesure localement un flux synthétique et isolé ; il ne démarre aucun serveur, ne contacte aucun fournisseur, ne lit aucune variable de base distante et ne crée ni migration ni seed.

## Exécution

Depuis la racine du dépôt :

```bash
npm run test:perf02
```

La sortie reproductible est `outputs/perf02/local.json` (ignorée par Git). La commande refuse `PERF02_TARGET_URL` si son hôte n'est pas `127.0.0.1`, `localhost` ou `::1` : elle sort avec `PERF02_REMOTE_TARGET_FORBIDDEN`. Par défaut, la cible déclarative est `http://127.0.0.1/perf02-local`; aucune requête HTTP n'est effectuée, ce qui rend la garde vérifiable sans serveur utilisateur.

Pour contrôler le refus sans toucher à une cible réelle :

```bash
PERF02_TARGET_URL=https://preprod.example.invalid npm run test:perf02
```

Cette seconde commande doit échouer clairement. Ne jamais la remplacer par une URL de préproduction ou de production dans cette tranche.

## Scénarios et mesures

Les douze combinaisons sont présentes dans le JSON : Starter (5 livreurs, 1 000 commandes/mois), Pro (10, 3 000) et Business (25, 6 000), chacune pour 1, 10, 50 et 100 entreprises.

Pour chaque entreprise, le harnais matérialise exactement 12 commandes fictives uniquement en mémoire. Il exerce, avec des mesures `performance.now()` réelles du processus Node, connexion, tableau de bord, création/affectation, position GPS, diffusion locale, preuve, export et job/webhook idempotent. La sortie contient p50, p95, débit, erreurs et maximum de pression du pool pour chaque scénario.

L'identité de chaque objet comprend son entreprise. Tous les cas exécutent un contrôle A/B : une lecture de B dans A lève `TENANT_FORBIDDEN`. Pour le seul scénario à une entreprise, B est un objet de contrôle local exclu de la population et indiqué dans le JSON. Le harnais échoue si l'une de ces preuves échoue.

## Saturation et reprise contrôlées

Le pool asynchrone local est volontairement fixé à 5 emplacements, cohérent avec la borne applicative actuelle. Une rafale de 12 opérations concurrentes retient les 5 premières, produit 7 `POOL_SATURATED`, puis exécute cinq opérations de reprise une fois le pool libéré. Le JSON est invalide si la saturation n'est pas observée ou si la reprise échoue.

Le plafond prudent tiré de cette seule recette est **4 opérations concurrentes** (80 % de 5). Ce plafond est une garde locale de harnais, pas une capacité PostgreSQL, Prisma, Next.js ou d'hébergement.

## Échantillon et extrapolation — à ne pas confondre

Les 12 commandes par entreprise sont les seules données matérialisées. Le reliquat jusqu'aux 1 000, 3 000 ou 6 000 commandes mensuelles est signalé dans chaque scénario sous `analyticalExtrapolation`, avec la formule `mesures locales × (commandes représentées / commandes matérialisées)`.

Cette extrapolation est bornée et séparée des p50/p95 : elle n'établit aucune capacité de base de données, de réseau, de stockage, de fournisseur cartographique, de Realtime ou de serveur Next. L'application ne crée actuellement aucun canal Realtime fournisseur; le flux associé est donc seulement un fan-out mémoire local.

## PostgreSQL local jetable (2026-10-27)

```bash
npm run test:perf02:postgres
```

La commande démarre un PostgreSQL 15 Homebrew isolé (`127.0.0.1:55441`, base `perf02`, répertoire temporaire), y pousse le schéma Prisma, mesure, puis arrête et supprime la base. La mesure refuse toute autre base (`PERF02_REMOTE_DATABASE_FORBIDDEN`, test `tests/perf02-postgres-guard.test.ts`) et pointe le géocodage vers un port local fermé : aucun appel réseau. Sortie `outputs/perf02/postgres-local.json`.

Elle exerce le vrai code applicatif avec le pool de 5 connexions. Elle crée 10 entreprises fictives, chacune avec un pilote `auto_dispatch` et 5 livreurs. À chaque niveau de concurrence (1, 4, 8, 16), elle lance 48 créations de commande (`createClientOrder`, transaction et job compris), 48 lectures du tableau de commandes (`getCompanyOrders`) et 48 lectures de la carte dispatch (`getDispatchDriversMap`). Elle contrôle ensuite que chaque entreprise relit exactement ses propres commandes.

Mesure du 27 octobre 2026 (MacBook, PostgreSQL 15.14 Homebrew), sans aucune erreur :

| Concurrence | Création p50 / p95 | Débit création | Tableau p95 | Carte dispatch p95 |
|---:|---|---:|---:|---:|
| 1 | 6,9 / 13,0 ms | 119/s | 2,2 ms | 2,7 ms |
| 4 | 13,3 / 24,0 ms | 277/s | 3,0 ms | 4,2 ms |
| 8 | 25,2 / 30,5 ms | 303/s | 4,0 ms | 16,6 ms |
| 16 | 59,2 / 91,7 ms | 230/s | 6,3 ms | 9,0 ms |

Au-delà de 5 opérations simultanées, la latence de création croît à peu près proportionnellement : les opérations attendent une connexion libre du pool, sans erreur. Base locale sans réseau : ces chiffres mesurent le coût Prisma/PostgreSQL et la file du pool, pas l'aller-retour vers Supabase. Une création de commande enchaîne une dizaine d'allers-retours séquentiels, donc sa durée réelle approche 10 × la latence réseau vers la base. Exemples : environ 5,5 s depuis le poste local (≈ 550 ms par requête, DISPATCH-3), environ 1 s si les fonctions Vercel tournaient hors de Paris (≈ 90 ms, hypothèse non vérifiée, voir ENV-2). Ce sont des ordres de grandeur, pas des mesures d'hébergement.

## Suite autorisée

Avant les pilotes, rejouer le même protocole sur un PostgreSQL/Prisma réellement isolé et expressément autorisé, avec serveur Next local contrôlé, puis sur préproduction seulement après autorisation écrite et dans un plafond de charge défini. Mesurer alors les mêmes p50/p95, le pool réel, les fichiers, les jobs et l'absence de fuite A/B. Ces mesures manquent encore : PERF-02 reste ouverte.
