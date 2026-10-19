# POD-1 — règles d'exploitation des preuves de livraison

## Contrat serveur

- Le bucket `delivery-pods` doit exister en mode privé. Le serveur refuse lecture et écriture si le bucket est public.
- Seuls JPEG et PNG sont acceptés, à concurrence de 5 Mo. Le MIME, la structure complète, les dimensions et la présence des marqueurs de fin sont contrôlés avant tout stockage.
- Le client ne fournit jamais `podPhotoPath`. Le serveur génère un chemin unique sous `<companyId>/<deliveryId>-<horodatage>-<uuid>.<extension>` et n'écrase aucun objet.
- Une preuve ne peut être jointe qu'à `DELIVERED` ou `FAILED`. `DELIVERED` exige une photo ; `FAILED` exige un motif et accepte une photo facultative.
- Les réponses API ne contiennent jamais le chemin Storage. Une URL signée d'une heure est créée seulement après contrôle du rôle, de l'entreprise, du propriétaire ou du chauffeur affecté.

## Réessai et nettoyage

Après une clôture réussie, le même statut terminal, la même note, le même motif et la même présence de photo forment un rejeu idempotent. Le serveur renvoie la mission déjà clôturée et sa preuve existante sans téléverser le fichier reçu une seconde fois. Un contenu métier différent renvoie `409 POD_REPLAY_CONFLICT`.

Si l'écriture métier échoue après l'upload, le fichier qui vient d'être créé est supprimé. Après une réussite, les anciens objets au format TutelLiv du même couple entreprise/livraison sont supprimés, sauf le chemin attaché en base. Le nettoyage est borné à ce préfixe exact ; un nom inconnu ou un chemin étranger n'est jamais supprimé.

La reprise couverte ici traite le cas où le serveur a terminé mais le client n'a pas reçu ou consommé la réponse. Une file locale pendant une coupure au milieu de l'envoi et la reconnexion sur téléphone relèvent de MOB-01B.

## Vérification

Lancer `npm run check`, puis `npm run build`. La recette connectée POD-1 doit contrôler : fichiers tronqué, SVG et supérieur à 5 Mo ; zéro objet après refus ; rejeu identique sans second objet ; rejeu différent refusé ; orphelin supprimé ; double envoi borné à une preuve ; URL signée lisible par les trois rôles autorisés ; 404 interentreprises ; 401 anonyme ; URL publique inutilisable ; note et motif conservés. Toutes les fixtures Auth, base et Storage doivent être supprimées et l'empreinte des données préexistantes restaurée.
