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

## Suite autorisée

Avant les pilotes, rejouer le même protocole sur un PostgreSQL/Prisma réellement isolé et expressément autorisé, avec serveur Next local contrôlé, puis sur préproduction seulement après autorisation écrite et dans un plafond de charge défini. Mesurer alors les mêmes p50/p95, le pool réel, les fichiers, les jobs et l'absence de fuite A/B. Ces mesures manquent encore : PERF-02 reste ouverte.
