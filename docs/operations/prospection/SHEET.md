# Brancher la Google Sheet de prospection sur `/admin/prospection`

Version du 6 novembre 2026 (ADMIN-ESPACE, lot 5). Compter 15 minutes.

La page **Prospection** du super admin lit la Sheet `TutelLiv_Suivi_Prospection_2026` **en lecture seule**, en direct (relue toutes les 5 minutes au plus). Les commerciaux continuent de travailler dans la Sheet : TutelLiv n'y écrit jamais rien.

Tant que les trois variables ci-dessous ne sont pas posées, la section affiche **« À brancher »**. Si la lecture échoue, elle affiche **« Indisponible »** avec la cause, jamais un chiffre inventé.

| Variable | Valeur | Obligatoire |
|---|---|---|
| `GOOGLE_SHEETS_CLIENT_EMAIL` | champ `client_email` du fichier JSON du compte de service | oui |
| `GOOGLE_SHEETS_PRIVATE_KEY` | champ `private_key` du même fichier (secret) | oui |
| `PROSPECTION_SHEET_ID` | identifiant de la Sheet (ou son adresse complète) | oui |
| `PROSPECTION_SHEET_HEADER_ROW` | ligne des en-têtes de colonnes | non, `5` par défaut |

## 1. Créer le compte de service (Google Cloud)

1. Ouvrir <https://console.cloud.google.com/> avec ton compte Google.
2. En haut, cliquer sur le sélecteur de projet, puis **Nouveau projet**. Nom : `tutelliv-prospection`. **Créer**, puis sélectionner ce projet.
3. Menu ☰ → **API et services** → **Bibliothèque**. Chercher **Google Sheets API**, l'ouvrir, cliquer sur **Activer**.
4. Menu ☰ → **IAM et administration** → **Comptes de service** → **Créer un compte de service**.
   - Nom : `tutelliv-lecture-prospection`.
   - **Créer et continuer**. Étape « Rôles » : n'en choisir **aucun** (l'accès vient du partage de la Sheet). **Continuer**, puis **OK**.
5. Cliquer sur le compte créé → onglet **Clés** → **Ajouter une clé** → **Créer une clé** → **JSON** → **Créer**. Un fichier `.json` se télécharge.
   - Ce fichier est un **secret** : ne pas l'envoyer par mail, ne pas le mettre dans Drive ni dans le dépôt. Le supprimer de l'ordinateur une fois les variables posées sur Vercel.
   - Si Google refuse de créer la clé (« règle d'organisation »), c'est une restriction du compte Google Workspace : utiliser un compte Google personnel pour le projet, ou lever la règle `iam.disableServiceAccountKeyCreation`.
6. Ouvrir le fichier JSON avec un éditeur de texte. Noter deux valeurs :
   - `client_email`, par exemple `tutelliv-lecture-prospection@tutelliv-prospection.iam.gserviceaccount.com` ;
   - `private_key`, un long texte qui commence par une ligne « BEGIN PRIVATE KEY » entourée de cinq tirets et finit par une ligne « END PRIVATE KEY » entourée de cinq tirets.

## 2. Partager la Sheet en lecture avec le compte de service

1. Ouvrir `TutelLiv_Suivi_Prospection_2026`.
2. **Partager** → coller l'adresse `client_email`.
3. Rôle : **Lecteur**. Décocher « Envoyer une notification ». **Partager**.
4. Noter l'identifiant de la Sheet : dans l'adresse `https://docs.google.com/spreadsheets/d/`**`IDENTIFIANT`**`/edit`, c'est la partie entre `/d/` et `/edit`. On peut aussi coller l'adresse entière dans la variable.

## 3. Poser les variables sur Vercel (Preview, branche `preproduction`)

1. Vercel → projet TutelLiv → **Settings** → **Environment Variables**.
2. Pour chaque variable : **Add New**, environnement **Preview** seulement, branche **`preproduction`**, cocher **Sensitive** pour la clé.
   - `GOOGLE_SHEETS_CLIENT_EMAIL` : la valeur `client_email`.
   - `GOOGLE_SHEETS_PRIVATE_KEY` : la valeur `private_key` **telle quelle**, de `-----BEGIN` à `END PRIVATE KEY-----`, sans les guillemets du JSON. Les `\n` peuvent rester écrits `\n` : TutelLiv les remet en retours à la ligne.
   - `PROSPECTION_SHEET_ID` : l'identifiant noté à l'étape 2.
   - `PROSPECTION_SHEET_HEADER_ROW` : seulement si les en-têtes ne sont plus en ligne 5.
3. Les variables ne servent qu'aux nouveaux déploiements : **Deployments** → dernier déploiement de `preproduction` → **⋯** → **Redeploy**.

En ligne de commande, la même chose (le terminal demande la valeur ; cocher ensuite Sensitive pour la clé dans le tableau de bord) :

```bash
vercel env add GOOGLE_SHEETS_CLIENT_EMAIL preview preproduction
vercel env add GOOGLE_SHEETS_PRIVATE_KEY preview preproduction
vercel env add PROSPECTION_SHEET_ID preview preproduction
```

Pour essayer en local, les mêmes lignes vont dans `.env.local` (jamais versionné), la clé entre guillemets sur une ligne.

## 4. Vérifier

1. Ouvrir `https://tutelliv.fr/admin/prospection` avec le compte super admin.
2. La section **Fichier de prospection** doit afficher « N entreprises dans N onglets · lu à HH:MM ».
3. Comparer avec la Sheet : le nombre d'entreprises « Contacté » et les rappels du jour doivent correspondre.

| Message affiché | Ce qu'il faut faire |
|---|---|
| À brancher | Une des trois variables manque sur Preview `preproduction`, ou le redéploiement n'a pas été fait. |
| Clé du compte de service illisible | Recopier `private_key` entière, `-----BEGIN` et `-----END` compris. |
| Google refuse le compte de service | `client_email` et `private_key` ne viennent pas du même fichier, ou la clé a été supprimée dans Google Cloud. |
| Accès refusé | Partager la Sheet avec `client_email` (étape 2) et vérifier que Google Sheets API est activée (étape 1.3). |
| Sheet introuvable | Vérifier `PROSPECTION_SHEET_ID`. |
| En-têtes introuvables sur la ligne 5 : … | Les colonnes nommées n'existent dans aucun onglet sur cette ligne : corriger le nom de l'en-tête ou `PROSPECTION_SHEET_HEADER_ROW`. |
| Quota Google dépassé / ne répond pas | Attendre une minute : la page réessaie seule. |

## Ce que la page attend de la Sheet

- **En-têtes en ligne 5** (réglable). Les colonnes sont trouvées par leur nom, sans tenir compte des majuscules ni des accents : on peut les déplacer.

| Information | Noms d'en-tête reconnus | Obligatoire |
|---|---|---|
| Entreprise | Entreprise, Société, Raison sociale, Nom de l'entreprise | oui |
| Étape | Statut, Étape | oui |
| Ville | Ville, Commune, Localité (sinon : nom de l'onglet) | non |
| Commercial | Commercial, Commerciale, Responsable, Suivi par | non |
| Rappel | Date de rappel, Rappel, Relance, Date de relance, Prochain rappel, Prochaine relance, À rappeler le | non |
| Dernier contact | Dernier contact, Date du dernier contact | non |

- **Onglets** : tous les onglets qui ont au moins Entreprise et Statut sur la ligne des en-têtes sont lus (un onglet par ville, par exemple `MARSEILLE`). Les autres (« Mode d'emploi ») sont ignorés et signalés.
- **Étapes** (plan de démarchage, partie 9) : À qualifier, Contacté, En discussion, Entretien fait, Démo faite, Intéressé, Pilote signé, Perdu, Ne plus contacter. Toute autre valeur est comptée dans « Autre » avec son libellé.
- **Dates** : cellules au format date, ou texte `jj/mm/aaaa` ou `aaaa-mm-jj`. Rappels comptés au jour de Paris ; jamais pour Perdu ni Ne plus contacter.

## Sécurité

- Lecture seule (portée `spreadsheets.readonly`), aucun rôle Google Cloud : le compte ne voit que les fichiers partagés avec lui.
- Le navigateur ne reçoit que des totaux et la liste courte des rappels (entreprise, ville, commercial, date), jamais le fichier entier.
- La clé ne figure dans aucun message ni journal. Pour couper l'accès : retirer le partage de la Sheet, ou supprimer la clé dans Google Cloud (**Comptes de service** → **Clés**).
