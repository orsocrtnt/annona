# DATA-02 — archive privée des preuves

Date : 18 octobre 2026. Avancement local ; jalon global laissé ouvert.

## Résultat

L’export JSON d’entreprise possédait seulement le manifeste des objets POD. Un service interne et une commande opérateur produisent désormais un dossier d’archive privé avec JSON relationnel, photos originales et manifeste SHA256. Un vérificateur hors ligne contrôle le manifeste à partir de son empreinte conservée séparément, puis chaque fichier et l’absence de fichiers supplémentaires. Aucun endpoint, lien signé, canal de remise, chiffrement ou règle légale n’a été ajouté.

Le dossier parent existant est exigé privé et détenu par l’utilisateur courant ; les nouveaux dossiers sont en 0700 et les fichiers en 0600. Le service contrôle tous les liens entreprise/commande/livraison et l’accord du manifeste avant Storage. Le champ `companyId` des commandes est ajouté à l’export JSON pour permettre cette validation. Une livraison enfant étrangère est refusée même si elle apparaît sous une commande de l’entreprise cible.

Les preuves sont téléchargées séquentiellement en flux authentifiés, sans assemblage des photos en mémoire. Plafonds : 1 000 preuves, 5 Mio par preuve, 256 Mio au total, 30 secondes par téléchargement. La taille annoncée et la taille réelle sont contrôlées. Chaque fichier écrit est relu et son SHA256 comparé au flux. Le JSON est plafonné à 10 Mio **après** la lecture du graphe et sa sérialisation : la consommation mémoire relationnelle et la charge base restent à qualifier sur de gros volumes.

Un dossier `.partial-*` privé sert de staging ; le renommage final intervient uniquement après l’écriture complète du manifeste. Les erreurs traitées nettoient exactement le staging. Les archives préexistantes sont préservées. Une interruption brutale peut laisser un staging privé, jamais présenté comme complet. Ce mécanisme ne promet pas la durabilité après panne matérielle, un snapshot distribué base/Storage, ni une restauration validée.

## Vérifications

- `npm run check` : types, lint strict et **243/243 tests** réussis.
- Huit tests dédiés à l’archive : octets et SHA256, permissions, altération détectée par la commande hors ligne, frontières entreprise/commande/livraison, chemins étrangers ou invalides, manifestes divergents/dupliqués, 404/500/panne réseau/interruption du corps, timeout, taille annoncée/réelle/globale, vide/troncature, seuils exacts, JSON/count excessifs, bucket public, entreprise absente et export sans photo. Aucun succès ni staging restant sur échec ; archive précédente conservée.
- Lint complémentaire des scripts DATA-02 et du nouveau fichier de tests : aucune alerte.
- `npm run test:data02` : export réel de JSON et d’une photo PNG privée de l’entreprise fictive A ; octets et empreintes vérifiés ; aucune donnée de B ou identifiant technique exclu dans l’export de A ; photo absente puis référence de A vers la photo B refusées sans nouveau dossier final ; compteurs et photo B inchangés.
- Nettoyage connecté : **zéro entreprise fixture et zéro objet Storage fixture restants**. La recette ne lit aucun contenu des anciennes entreprises ; seuls les rôles structurels nécessaires à la création des deux fixtures sont lus. Suppressions limitées aux identifiants et aux deux slugs exacts de l’exécution, et aux chemins enregistrés à l’upload. Archive locale de recette supprimée.
- Vérificateur documentaire exécuté directement, sans le préalable qui réécrit la TODO : 40 documents, zéro lien/commande/variable manquant.
- Scanner anti-secret : 818 fichiers, zéro détection, rapport inclus.
- `git diff --check` : réussi.

La première passe connectée a échoué sur une assertion trop spécifique : Storage a renvoyé une erreur HTTP générique pour l’objet absent, classée `ARCHIVE_DOWNLOAD_FAILED`, au lieu du 404 attendu. Aucun export partiel n’a été publié et les fixtures ont été nettoyées. L’attente de recette accepte les deux codes bloquants ; la passe suivante a réussi. Les erreurs fournisseur ne sont pas reproduites dans la preuve de recette afin d’éviter une fuite d’URL ou de configuration.

## Fichiers et preuves

- `src/domains/data-lifecycle/company-archive.service.ts` : archive privée, limites et contrôles.
- `src/domains/data-lifecycle/company-export.service.ts` : entreprise des commandes exportée.
- `scripts/data02/export-archive.ts` : commande opérateur interne.
- `scripts/data02/verify-archive.mjs` : vérification hors ligne sans dépendance applicative.
- `scripts/data02/connected.ts` : recette A/B et nettoyage exact des photos.
- `tests/company-archive.test.ts` : huit tests locaux dédiés.
- `docs/operations/data02/README.md` : procédure, usage privé hors dépôt et limites.
- `outputs/data02/connected.json` : résultats nettoyés de la dernière recette connectée.

Aucune modification de schéma, migration, publication, push ou déploiement. Aucun démarrage ni arrêt du serveur utilisateur sur le port 3106. Pas de build applicatif : changement serveur opérateur, sans branchement UI.

## Restant avant clôture DATA-02

Décisions LEGAL-1 (pays, catégories et durées), suppression/anonymisation réelle Auth/Storage selon ces règles, sauvegardes et restauration sur cible isolée, canal chiffré de remise et contrôle d’identité, expiration des archives et nettoyage des démos. Le SHA256 prouve une copie fidèle des octets lus ; il ne prouve pas l’authenticité métier ou l’absence de corruption antérieure de la source. Aucun de ces critères externes n’est déclaré accompli.
