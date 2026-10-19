# Rapport MOB-01B — réseau faible et preuves

Date : 16 octobre 2026

## Résultat

Les actions de statut chauffeur sont maintenant écrites localement avant l'envoi. La file IndexedDB conserve aussi la photo, reprend automatiquement au retour du réseau, empêche deux actions simultanées sur une mission et laisse un refus serveur visible. Le chauffeur voit l'attente dans un bandeau global et dans la mission ; il peut relancer ou retirer une action refusée.

Le serveur traite comme un succès sans effet supplémentaire le rejeu d'un palier déjà enregistré. La clôture conserve la protection POD-1 : un rejeu identique après réponse perdue ne téléverse pas une seconde photo et ne clôture pas deux fois ; un contenu différent renvoie un conflit.

## Preuves

- `npm run check` : types et lint valides, 209 tests réussis ; 24 avertissements historiques.
- `npm run build` : build Next.js réussi, 96 pages générées.
- Chrome avec profil temporaire : IndexedDB disponible, huit octets de Blob conservés après la coupure, une tentative enregistrée, un seul envoi après reconnexion, zéro entrée restante.
- Tests ciblés : coupure/reprise de preuve, refus non perdu, unicité par mission, panne `fetch`, rejeu non terminal sans mutation, rejeu POD après réponse perdue.
- `git diff --check` : réussi après documentation.

Preuve navigateur : `outputs/mob01b/browser-indexeddb.json`. Procédure : `docs/operations/mob01b/README.md`.

## Périmètre et limites

Aucune base distante, donnée métier, migration, seed, stockage projet, service payant ou déploiement n'a été touché. Le test navigateur emploie un profil et une base IndexedDB temporaires. La fermeture complète de l'application suspend les tentatives jusqu'à sa réouverture. Les téléphones physiques et l'arrière-plan restent MOB-01C.
