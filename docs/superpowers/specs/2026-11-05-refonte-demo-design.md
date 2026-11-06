# Refonte de la démonstration — design

Date : 5 novembre 2026 · Statut : validé par le propriétaire le 5 novembre 2026 ; lots 1 (remise à l'heure au prêt) et 2 (l'histoire, sans les clients entreprises) faits. Écart assumé : les 4 livrées du jour sont entre T−4 h et T−1 h, pour qu'aucune échéance ne tombe avant 7 h quand la démo est ouverte vers 11 h

## Objectif

La démonstration publique (`/demonstration`, compte `demo@annona.fr`) doit raconter une journée claire
d'une société de coursiers. Elle sert à deux usages : un commercial la montre pendant un appel, et un
prospect l'ouvre seul depuis le site. On garde la base actuelle : trois vues (Administrateur, Client,
Livreur), espaces isolés préparés à l'avance (pool), bouton « Réinitialiser la démo ».

## Constat (recette Chrome sur annona.fr, 5 novembre 2026)

- Une session neuve affiche 12 à 14 alertes, presque tout « En retard », 0 livrée aujourd'hui et sur 7 jours,
  des échéances entre 2 h et 6 h du matin.
- Cause principale : `prepareDemoPool` appelle `resetDemoScenario(companyId, new Date())` au moment de la
  préparation (`src/domains/demo/demo-pool.service.ts:166`). Les dates du scénario sont relatives à cet
  instant. L'espace est prêté plus tard sans remise à l'heure : tout a vieilli.
- Même neuf, le scénario actuel (`buildScenario`, 15 éléments) ne contient aucune livraison terminée
  aujourd'hui et trois éléments déjà en retard (offsets −48 h, −4 h, −3 h).
- Un onglet resté connecté après l'expiration du bail (8 h, `DEMO_POOL_LEASE_MS`) tombe dans l'espace de
  base : « Réinitialiser » répond 409 « Session de démonstration absente » et l'espace contient des résidus,
  dont deux courses au nom du propriétaire avec son adresse Gmail.

## Décisions validées (5 novembre 2026)

- Usage : les deux (commercial et prospect seul).
- Taille : une journée riche, environ 15 éléments.
- Remise à l'heure : décaler les dates d'un espace préparé au moment du prêt (ouverture instantanée).
- Guide : petite liste « À essayer » dans la barre de démo, pas de visite guidée à bulles.

## Partie 1 — l'histoire (réécriture de `buildScenario`)

Toutes les dates sont relatives à l'instant d'ancrage T (préparation, puis décalées au prêt), arrondies
au quart d'heure.

| Nombre | État | Détail |
|---|---|---|
| 4 | Livrées aujourd'hui | entre T−5 h et T−1 h, preuve (photo, nom, signature) ; l'une avec facture payée |
| 3 | En route | une suivie en direct sur la carte (position récente), une course à plusieurs collectes, une en achat |
| 2 | Affectées, non démarrées | échéance T+2 h et T+3 h |
| 2 | Sans livreur | échéance T+3 h et T+4 h ; support de l'étape 1 de « À essayer » |
| 1 | En retard | échéance T−25 min, en route : la seule alerte rouge attendue |
| 2 | Prévues demain | 10 h et 14 h 30 le lendemain (heure de Paris) |
| 1 | Commande récurrente | chaque lundi |

En plus :
- Historique : 2 à 4 livraisons terminées par jour sur les 7 jours précédents (graphiques non vides),
  avec au plus une en retard sur la période.
- Clients : des entreprises (ex. Pharmacie du Marais, Cabinet Lefèvre Avocats, Fleurs de Belleville,
  Agence Bastille Immobilier, Atelier Nation). « Marie Client Démo » disparaît ; la vue Client reste un
  seul compte (contact Marie, Pharmacie du Marais). E-mails lisibles sur un domaine non routable
  (`contact@pharmacie-du-marais.demo`), téléphones au format `06 12 34 56 78`.
- Un seul ticket de support ouvert (question sur l'heure d'arrivée).
- Aucun texte « démo », « E2E » ou « test » dans les notes visibles.
- Limite assumée : une démo ouverte la nuit montre des heures de nuit.

Critère : sur une session neuve, le tableau de bord affiche exactement 1 alerte de retard, 4 livrées
aujourd'hui, et aucune échéance d'aujourd'hui hors de 7 h–20 h (heure de Paris) si T est en journée.

## Partie 2 — remise à l'heure, sessions expirées, ménage

1. **Ancrage.** `resetDemoScenario` enregistre l'instant d'ancrage dans `Company.settings`
   (clé `demoScenarioAnchorAt`), sans migration de schéma.
2. **Décalage au prêt.** `leaseDemoPoolEnvironment` calcule Δ = maintenant − ancrage et décale, dans une
   transaction, toutes les dates des données de l'espace (commandes, livraisons, étapes de suivi,
   positions des livreurs, factures, tickets et messages de support, commandes récurrentes, e-mails de
   commande reçus), puis met l'ancrage à maintenant. Δ < 1 min : rien à faire.
3. **Test de complétude.** Un test lit les modèles Prisma (DMMF) des tables touchées par le scénario et
   échoue si un champ `DateTime` n'est ni décalé ni explicitement exclu (`createdAt` technique,
   `updatedAt`, champs de bail).
4. **Réinitialiser** reste tel quel : recrée la partie 1 à l'heure du clic.
5. **Session expirée.** Si la session de démo n'a plus de bail valide, les routes démo et l'entrée sur
   l'espace renvoient vers `/demonstration?expiree=1`, qui affiche « Votre démonstration a expiré, ouvrez-en
   une nouvelle. » Plus de chute silencieuse dans l'espace de base.
6. **Ménage de l'espace de base.** Lister puis supprimer les données transactionnelles résiduelles de
   l'entreprise de base (dont les deux courses au nom du propriétaire), après validation de la liste.

## Partie 3 — liste « À essayer »

Bouton « À essayer (n/4) » dans la barre de démo (`src/features/demo/demo-mode-bar.tsx`), liste fermée par
défaut :

1. Affecter une livraison en attente (Administrateur) — cochée quand une des deux livraisons sans livreur
   reçoit un livreur.
2. Suivre le livreur sur la carte (Client) — cochée à l'ouverture de la carte des livraisons.
3. Livrer une mission avec preuve (Livreur) — cochée quand une mission passe à « Livrée » avec preuve.
4. Ouvrir la facture et la preuve (Client) — cochée à l'ouverture d'une facture ou du PDF de preuve.

Chaque ligne change de vue et ouvre la bonne page. État gardé dans `sessionStorage`, remis à zéro par
« Réinitialiser la démo ». Les 4 faites : « Vous avez fait le tour. Demander un pilote ». Aucun suivi
envoyé au serveur.

## Hors périmètre

Visite guidée à bulles ; nouvelle page ; changement des droits ou des vues ; mini-démo de la landing ;
statuts et références unifiés (tâche MOTS-UNIFIES).

## Vérifications prévues

- Tests unitaires : forme du scénario (comptes par état, une seule alerte, heures arrondies), décalage
  complet (DMMF), cochage de la liste.
- `npm run check`, build dans une copie isolée.
- Recette navigateur sur `annona-dev` : préparer un espace, avancer l'horloge d'ancrage de 20 h, le prêter,
  vérifier 1 alerte et 4 livrées ; parcourir les 4 étapes « À essayer » ; onglet expiré renvoyé vers
  `/demonstration`.
- Après mise en ligne : contrôle sur annona.fr.
