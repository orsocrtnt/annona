# TODO Annona — application de commande et livraison B2B (boulangerie)


<!-- TODO_PROGRESS_START -->
## Progression globale

**1 tâches terminées sur 13 — 8 %**

`██░░░░░░░░░░░░░░░░░░` · 12 tâches restantes

**À faire par Claude**

- SCHEMA-1 — Nouveau schéma de données et base de démonstration
- CAT-1 — Catalogue et prix
- CMD-1 — Commande côté commerçant
- LOCK-1 — Heure limite, verrouillage et consolidation
- BOU-1 — Espace boulanger
- TOUR-1 — Tournées : administrateur et livreur
- FACT-1 — Factures par période
- NOTIF-1 — Notifications
- ADM-1 — Comptes, paramètres et plateforme
- MOBILE-1 — Applications iOS et Android (Capacitor)
- RECETTE-V1 — Recette des dix critères (en dernier)

**À faire par toi**

- ACCES-1 — Accès et réponses du propriétaire (les quatre réponses du cahier des charges)

_Chaque tâche est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->

## Ce qu'il reste vraiment à faire (vue simple, à jour au 6 novembre 2026)

_Lire ce bloc en premier. Tout le reste du fichier est le détail. Un agent le met à jour à chaque fin de tâche (simples tirets ici : seules les cases des tâches comptent dans la jauge)._

**1. Toi**
- Répondre aux questions ouvertes du cahier des charges quand tu les as (ACCES-1) : créneaux du premier client, délai du rappel avant 17h, volumes à deux ans, service de cartographie.

**2. Claude (en autonomie, dans l'ordre)**
- NET-1 fait le 6 novembre (ancien produit retiré, `npm run check` vert). En cours : SCHEMA-1, puis CAT-1, CMD-1, LOCK-1, BOU-1, TOUR-1, FACT-1, NOTIF-1, ADM-1, MOBILE-1, RECETTE-V1.

**3. Attente extérieure**
- Comptes Apple Developer et Google Play pour publier les applications (MOBILE-1, plus tard).

## Cadre

- Référence : `docs/cahier-des-charges/Cahier des charges - version developpeur.pdf` (identifiants CLI, BOU, LIV, ADM, PLA, NOT, RG, ENF, à citer dans le code et les tests) et `docs/cahier-des-charges/TRI-BASE.md` (ce qu'on garde, supprime, modifie et crée).
- Décisions du 6 novembre 2026 : nom **Annona** ; applications mobiles par **Capacitor** ; tickets de support gardés pour les réclamations ; nouveau schéma Prisma propre avec une seule migration initiale ; nouvelle base.
- Branche de travail : `base`. Un commit par lot, **aucun push** sans demande : `preproduction` et annona.fr portent encore l'ancien produit.
- Base de développement : projet Supabase `annona-dev` (`fqzlfszgyeyfeshllqtj`, Paris, créé le 6 novembre 2026). L'ancienne base `tutelliv-dev` a été mise en pause pour libérer la place gratuite (réactivable depuis le tableau Supabase) ; `tutelliv-preproduction` (annona.fr) n'est pas touchée.
- L'ancienne TODO (106 tâches closes, produit coursier) reste dans l'historique git : `git show 0475b8d:TODO.md`.

## Tâches ouvertes

_Tâches closes et journal : `docs/TODO-ARCHIVE.md`._

- [ ] **ACCES-1 — Accès et réponses du propriétaire.**

  **Qui : Toi — les quatre réponses du cahier des charges.**

  - `.env.local` : fait le 6 novembre 2026 (mot de passe de la base remis à zéro et clé `service_role` collés par le propriétaire avec `remplir-env.sh`, sans passer par l'agent). Vérifié par Claude : client Prisma par le pooler `aws-1-eu-west-3` port 6543 → `select` réussi ; connexion directe (`prisma db execute`) réussie ; API d'administration Supabase avec la clé `service_role` → 200.
  - Questions ouvertes du cahier des charges (section 9) : liste des créneaux du premier client ; délai du rappel avant 17h ; volumes à deux ans ; service de cartographie (les services gratuits OSRM et IGN suffisent pour les essais, pas pour 200 arrêts par jour). En attendant, valeurs par défaut réglables : créneaux 5h-6h, 6h-7h, 7h-8h ; rappel à 15h.

  Terminé quand : les quatre réponses sont notées ici (`.env.local` déjà fait).

- [ ] **SCHEMA-1 — Nouveau schéma de données et base de démonstration.**

  **Qui : Claude.**

  **Modèle conseillé : Claude Opus · effort élevé (schéma, isolation).**

  Schéma Prisma propre selon la section 7 du cahier des charges et `TRI-BASE.md` §3 et §4 : Entreprise (heure limite, fuseau, délai du rappel), Utilisateur (rôles SUPER_ADMIN, ADMIN, BAKER, DRIVER, MERCHANT), Commerçant, Catégorie, Produit, Prix spécifique, Créneau, Commande (DRAFT → VALIDATED → LOCKED → PREPARED → DELIVERED, origine MANUAL ou RECURRING, unique par commerçant, date et créneau), Ligne, Commande récurrente et ses lignes, Tournée, Arrêt, Facture, Règlement, Journal ; tous avec `companyId`. Une seule migration initiale appliquée sur `annona-dev`. Données de démonstration : une boulangerie, 100 produits, 20 commerçants, 5 livreurs.

  Terminé quand : `prisma validate` et `npm run check` verts ; migration appliquée sur `annona-dev` ; démo chargée et relue.

- [ ] **CAT-1 — Catalogue et prix.**

  **Qui : Claude.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  ADM-02, ADM-03, RG-05, PLA-04 : catégories ordonnées, produits (nom, photo, unité, prix de base, actif), prix spécifique par commerçant ; un seul calcul du prix appliqué, utilisé partout.

  Terminé quand : tests du prix appliqué (critère 3) ; écrans d'administration cliqués dans le navigateur.

- [ ] **CMD-1 — Commande côté commerçant.**

  **Qui : Claude.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  CLI-01 à CLI-09, RG-02, RG-08, ENF-03 : connexion, profil, catalogue par catégorie avec + / − et saisie directe, panier, date (J+1 ou plus) et créneau, modification et annulation jusqu'à l'heure limite, historique, « Recommander » à l'identique ou dans le panier, commande récurrente (jours, créneau, suspendre).

  Terminé quand : critère 1 (recopier une commande en moins d'une minute) chronométré dans le navigateur ; tests du refus serveur ; `npm run check` vert.

- [ ] **LOCK-1 — Heure limite, verrouillage et consolidation.**

  **Qui : Claude.**

  **Modèle conseillé : Claude Opus · effort élevé (heures de Paris, tâche planifiée).**

  RG-01, RG-04, RG-09, RG-10, ADM-05 : refus côté serveur à partir de 17h00:00 heure de Paris (paramétrable) ; tâche planifiée qui verrouille, fige les prix, génère les récurrentes seulement sans commande manuelle, calcule les totaux et les tournées du lendemain ; correction administrateur après l'heure limite journalisée (qui, quand, avant, après).

  Terminé quand : tests des critères 2 (16h59 modifiable, 17h00 verrouillée, changements d'heure compris) et 4 ; tâche idempotente testée.

- [ ] **BOU-1 — Espace boulanger.**

  **Qui : Claude.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  BOU-01 à BOU-06 : total à produire par produit, détail par commerçant, groupement par tournée dans l'ordre de chargement, impression des bons et étiquettes, case « préparée », manquant ou quantité réduite reporté sur la quantité livrée.

  Terminé quand : critère 5 testé ; impression vérifiée dans le navigateur (format tablette).

- [ ] **TOUR-1 — Tournées : administrateur et livreur.**

  **Qui : Claude.**

  **Modèle conseillé : Claude Opus · effort élevé (hors réseau, ordre des arrêts).**

  ADM-04, ADM-06 à ADM-08, LIV-01 à LIV-06 : tournée par créneau calculée avec le calcul existant, réordonner, déplacer un arrêt, changer de livreur, attribution ; suivi en direct ; côté livreur : arrêts dans l'ordre (colis, consignes), liste de chargement, « Livré » en un appui, arrêt suivant puis « Ouvrir dans Plans », « Ouvrir dans Waze », « Y aller seul » ; problème avec commentaire et photo ; hors réseau avec la file existante.

  Terminé quand : critères 6, 7 et 8 vérifiés (dont un « livré » hors réseau resynchronisé, cliqué dans le navigateur).

- [ ] **FACT-1 — Factures par période.**

  **Qui : Claude.**

  **Modèle conseillé : Claude Opus · effort élevé (montants, numérotation).**

  CLI-10, ADM-10, RG-06, RG-07, ENF-05 : une facture par commerçant et par période (jour, semaine, mois, année) sur les quantités livrées, numérotation continue, PDF et Factur-X conservés, envoi, règlements saisis (virement, prélèvement, espèces), téléchargement côté commerçant.

  Terminé quand : critère 9 testé ; PDF relu ; `npm run check` vert.

- [ ] **NOTIF-1 — Notifications.**

  **Qui : Claude.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  NOT-01 (rappel avant l'heure limite sans commande pour le lendemain, délai paramétrable), NOT-02 (confirmation à chaque commande validée ou modifiée), NOT-03 (« livreur en approche » quand l'arrêt précédent est livré).

  Terminé quand : tests des déclencheurs ; un envoi réel reçu sur une adresse de test.

- [ ] **ADM-1 — Comptes, paramètres et plateforme.**

  **Qui : Claude.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  ADM-01, ADM-09, PLA-01 à PLA-04, ENF-07 : comptes commerçants, boulangers, livreurs, administrateurs ; heure limite, créneaux, catégories, délai du rappel ; super-administrateur (créer, configurer, suspendre une entreprise) ; nom et logo de l'entreprise ; textes centralisés en français (« client », « livreur », « tournée », « arrêt »).

  Terminé quand : critère 10 testé (aucune donnée d'une entreprise B visible depuis A, routes comprises) ; écrans cliqués.

- [ ] **MOBILE-1 — Applications iOS et Android (Capacitor).**

  **Qui : Claude.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  ENF-01 : emballer les espaces commerçant et livreur avec Capacitor ; notifications natives ; ouverture de Plans et Waze. Publication : comptes Apple Developer et Google Play à ouvrir par le propriétaire.

  Terminé quand : les deux applications s'installent sur un vrai téléphone et passent les critères 1, 7 et 8.

- [ ] **RECETTE-V1 — Recette des dix critères.**

  **Qui : Claude — en dernier.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  Rejouer les dix critères de la section 10 du cahier des charges sur `annona-dev`, dans le navigateur, avec un rapport et des captures.

  Terminé quand : les dix critères passent et le rapport est dans `docs/rapports/`.
