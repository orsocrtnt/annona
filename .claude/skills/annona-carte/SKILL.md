---
name: annona-carte
description: Carte des connexions de Annona — qui importe quoi, quelles pages appellent quelles routes /api, quelles routes lisent ou écrivent quelles tables Prisma, quels paquets npm sont utilisés où. À utiliser quand on demande « quoi dépend de quoi », « si je modifie X, qu'est-ce qui est touché », « qui utilise cette table / route / ce fichier », « pourquoi A dépend de B », avant une modification à impact large, ou pour ouvrir la carte visuelle des connexions.
---

# Carte des connexions Annona

Un script lit le code (`src/` + `prisma/schema.prisma`) et construit le graphe :
page → feature/composant → appel `/api/...` → route → domaine/service → table Prisma.
Le graphe est recalculé à chaque lancement (quelques secondes), donc jamais périmé.

## Ouvrir la carte visuelle (pour le propriétaire)

```bash
node .claude/skills/annona-carte/carte.mjs && open outputs/carte/carte.html
```

Onglet « Cartographie » : le schéma de toute l'app par module (pages → features → routes API → domaines → tables). Le survol montre les liens directs, le clic allume toute la chaîne du module. Chaque fiche d'élément a aussi sa carte locale (deux niveaux de chaque côté).

Dans la page : chercher un élément (touche `/`), puis voir ce qu'il utilise, ce qui l'utilise, et « tout ce qui casse si on le modifie ». Le bouton « pourquoi ? » montre le chemin. L'accueil liste les tables (nombre de lecteurs/écrivains), les appels `/api` sans route et les fichiers jamais importés.

## Répondre à une question (pour l'agent)

Lancer depuis la racine du dépôt, lire la sortie, répondre en langage simple :

```bash
node .claude/skills/annona-carte/carte.mjs utilise-par <cible>   # impact : tout ce qui dépend de la cible
node .claude/skills/annona-carte/carte.mjs depend-de <cible>     # tout ce que la cible utilise
node .claude/skills/annona-carte/carte.mjs chemin <de> <vers>    # pourquoi <de> dépend de <vers>
```

- Cibles : chemin (`src/domains/billing/…`), table (`Delivery`), route (`/api/orders/[id]`), page (`/dispatch`), paquet (`paquet:stripe`) ou un morceau de nom. Si c'est ambigu, le script liste les candidats.
- Options : `--avec-types` (compte aussi les `import type` ; par défaut ils sont ignorés car ils disparaissent à l'exécution), `--max N` (éléments par couche, 40 par défaut).
- Pour une question d'impact, citer d'abord les **pages** et les **tables** touchées : c'est ce que le propriétaire comprend.

## Ce que la carte voit, et ce qu'elle ne voit pas

Voit : `import`/`export … from`, `import()` et `require` (alias `@/` compris), chaînes `"/api/…"` et gabarits `` `/api/orders/${id}` `` (rapprochés de `route.ts`), appels `prisma.<modèle>.<op>(` ou `tx.<modèle>.<op>(` (lecture/écriture).

Ne voit pas : URL `/api` construites à partir de variables, accès Supabase directs (`.from('table')`), liens `href` entre pages, SQL brut, dépendances par configuration (variables d'environnement, `next.config`). Une absence de lien n'est donc pas une preuve d'indépendance : vérifier avec `grep` avant de supprimer quoi que ce soit.

## Règles

- `outputs/carte/` est local (ignoré par Git) : ne pas le diffuser.
- La carte constate, elle ne corrige rien. Un « fichier jamais importé » ou un « appel sans route » est une piste à vérifier, pas une suppression autorisée.
