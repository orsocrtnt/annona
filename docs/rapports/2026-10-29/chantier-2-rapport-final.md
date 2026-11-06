# Chantier n° 2 — rapport final (28 et 29 octobre 2026)

**Verdict.** Les 11 lots sont en préproduction (933dc49) et le déploiement Vercel répond. Tests unitaires : 1 350 sur 1 350. Build et tests PostgreSQL réels : verts. Parcours critiques dans le navigateur, sur un build de production : connexion par rôle, paiements, preuves, Factur-X et navigation, tous verts. Deux livraisons sont contestées par le propriétaire : la carte unique et la landing (voir « À faire »).

## Livré
- **A — Mode sombre** : back-office, dispatch, `/admin`, app livreur ; dégradés retirés ; Light identique.
- **B — Carte** : carte unique Livreurs / Livraisons au tableau de bord, marqueurs au clavier, carte sombre. *Le propriétaire voit encore deux cartes → MAP-UNIFY-2.*
- **C — Alertes** : l'urgent en haut, l'incident du livreur en tête, les alertes de la commande en haut des fiches.
- **D — Factur-X et messages** : mentions qui feraient échouer l'export refusées à l'enregistrement ; messages de configuration en français, avec la cause et l'action.
- **E et E2 — Finitions et fiabilité** :
  - remontée en haut au changement de page ;
  - points de RECETTE-2810 ;
  - réglages sans perte en concurrence ;
  - relances fiables ;
  - cron sans faux échecs.
- **F — Données de test** : un jeu E2E rejouable, avec un nettoyage limité à l'E2E.
- **G — Dispatch, tranche 1** : les 3 meilleurs livreurs avec la raison du choix, le temps de trajet OSRM, l'affectation en un clic.
- **L1 et L2 — Landing et connexion** : nouvelle landing et connexion « Trois espaces », mode sombre public. *Landing rejetée → LANDING-3.*
- **H — Mobile** : cibles de 44 px, champs de 16 px, tableaux en cartes sur téléphone, ordinateur inchangé.

## Décisions prises à la place du propriétaire
- **Factur-X** :
  - facture électronique activée : n° de TVA obligatoire si le taux est au-dessus de 0, motif d'exonération obligatoire à 0 % ;
  - option écartée : un simple avertissement, ma première décision, fondée sur une hypothèse fausse.
- **Entreprise en PDF seul** : jamais bloquée. Option écartée : bloquer dès qu'une facture a été émise.
- **Landing** : direction « Ligne de mission », connexion « Trois espaces ». Option écartée : la direction A. **Rejetée par le propriétaire** ; désormais, c'est lui qui choisit les directions visuelles.
- **RECETTE-2810** :
  - une relance non envoyée laisse « Relancer » actif ;
  - le nom du réceptionnaire est obligatoire avec une signature ;
  - pas de « Depuis un message » dans le portail ;
  - le client voit le livreur avec les mêmes informations que la fiche livraison.
- **Cartes sur téléphone** : les colonnes masquées sur mobile le restent (pas d'e-mail ni de dernière connexion en plus).
- **Champ `details` des API** (messages techniques) : non bloquant, renvoyé à CONFIG-MSG-2.

## Non vérifié
- Les suggestions de livreurs dans un navigateur (la spec est obsolète) : vérifiées seulement par les tests automatiques, PostgreSQL réel et deux relectures.
- Le rendu sur Edge, Safari et Firefox (CROSS-BROWSER) ; les téléphones réels (MOB-01C).
- 10 specs E2E en échec : toutes obsolètes ou jamais lancées, vérifiées à la main, sans défaut produit (E2E-MAJ).

## À faire de ton côté
1. Envoyer une capture de ton tableau de bord avec les deux cartes (MAP-UNIFY-2).
2. Dire ce qui ne va pas dans la landing, et 2 ou 3 sites que tu aimes (LANDING-3).
3. Si possible, dire ce qui diffère sur Edge (CROSS-BROWSER).
4. Archiver les sessions cloud de test sur claude.ai/code, et supprimer les routines désactivées sur claude.ai/code/routines.
5. Supprimer les branches de test : `git push origin --delete agent/test-cloud-4 agent/test-cloud-5 agent/base-h-1 agent/base-h-2 agent/h-mobile-1 agent/h-mobile-2`.

## Qui a fait quoi, et ce qu'on a appris
- **Répartition** :
  - Claude en local : 10 lots, les relectures et les corrections ;
  - Claude dans le cloud, par routine : Mobile ;
  - Codex : la vérification finale sur liste fermée, avec 2 contre-vérifications.
- **Leçons** : relecture approfondie pour tout ; tests navigateur en script, sur un build de production, limités aux parcours critiques ; directions visuelles décidées par le propriétaire. Voir le skill `annona-orchestre` et `outputs/suivi-agents/erreurs-2026-10-29.md`.

Galerie avant/après : `outputs/recette-agents/galerie/` (local).
