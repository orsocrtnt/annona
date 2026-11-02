# TODO TutelLiv — du produit existant au SaaS vendable


<!-- TODO_PROGRESS_START -->
## Progression globale

**96 tâches terminées sur 123 — 78 %**

`████████████████░░░░` · 27 tâches restantes

**À faire par Claude**

- LEGAL-1 — Vérifier le respect des exigences applicables et préparer les documents
- V1-GO — Valider la V1 prête à être essayée (après les essais téléphone et la vérification de conformité)
- DATA-02 — Prévoir sortie, export et conservation des données (après la vérification de conformité)
- PROD-04 — Définir les mesures de valeur (après les pilotes)
- SAAS-03 — Permettre la gestion autonome de l'abonnement (après la vérification de conformité)
- SAAS-02 — Mesurer le revenu et la santé du SaaS (après les pilotes)
- COST-1 — Simuler les coûts d'exploitation et la marge contributive (après les pilotes)
- GROWTH-1 — Construire le site commercial relié au parcours autonome (après la vérification de conformité)
- LEGAL-LIENS — Rendre accessibles les mentions légales et la politique de confidentialité depuis le site public (après la vérification de conformité)
- DISPATCH-5 — Imprévus et mesure du dispatch (après les pilotes)
- MOTS-UNIFIES — Employer les mêmes mots partout à l'écran (après la vérification de conformité)
- RELEASE-1 — Réaliser la recette de mise en vente (en dernier, avant la mise en vente)
- SMS — Ajouter seulement les extensions justifiées (seulement si les pilotes le demandent)

**À faire par toi**

- SEC-AUDIT — Durcissement du 28 octobre et correctifs de l'audit Codex
- POD-2 — Preuve de livraison complète : signature, PDF, envoi et relevés
- MOB-01C — Réaliser les essais iPhone et Android
- OPS-FIAB — Fiabiliser les tâches de fond et l'exploitation
- FACTURX-1 — Factur-X EN 16931 des factures de livraison
- PROD-02 — Documenter le travail actuel et sa difficulté principale
- INTAKE-1 — Commande par message IA (coller un message)
- AUDIT-0111 — Corrections de l'audit complet du 1er novembre 2026 avant le premier pilote
- PROPRIO-2810 — Actions du propriétaire avant mise en ligne
- ONBOARD-1 — Guider jusqu’à la première livraison (pendant les pilotes)
- OFFER-1 — Valider la grille cible et l'offre pilote (pendant les entretiens et les pilotes)
- PILOT-1 — Recruter et conduire trois pilotes accompagnés (après les entretiens)
- PILOT-2 — Décider avec les preuves des pilotes (après les pilotes)

**À classer**

- DEMO-SLIDES-6-7 — Modifier la démo entre la slide 6 et la slide 7

_Chaque tâche est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->

## Ce qu'il reste vraiment à faire (vue simple, à jour au 1er novembre 2026)

_Lire ce bloc en premier. Tout le reste du fichier est le détail. Un agent le met à jour à chaque fin de tâche (simples tirets ici : seules les cases des tâches comptent dans la jauge)._

**1. Toi (le 30 octobre, Claude a fait le reste de ta liste : voir PROPRIO-2810)**
- Cette semaine, le plus important (audit du 1er novembre, PDF dans `outputs/audit-2026-11-01/`) : contacter des sociétés de livraison et tenir dix entretiens (PROD-02) ; le plan complet, les textes, la liste d'entreprises et le pitch avec déroulé de démonstration sont prêts (`docs/operations/prospection/README.md`, `docs/operations/prospection/PITCH.md`). Chaque jour à partir du 2 novembre : trouver les coordonnées, écrire et appeler de 8 h à 11 h à New York (14 h à 17 h en France).
- Avant le premier message du démarchage : créer une vraie boîte mail, par exemple `orso@tutelliv.fr` (les mails actuels partent de `no-reply@`, une réponse serait perdue).
- Lundi 2 novembre, avant le premier message : demander ton SIREN sur le Guichet unique (pas encore de numéro, confirmé le 1er novembre). D'ici là, le démarchage se limite aux entretiens de recherche : aucun prix ni offre de pilote.
- Étude de marché (`outputs/reports/Marché TutelLiv livraison B2B France.md`, environ 840 entreprises visées, hypothèse à mesurer) : trier la liste de prospects (107 lignes sur 282 ont le bon profil), obtenir 50 réponses tirées au hasard sur la part de clients directs, demander un devis à GTLYS et à Toncarton.
- Donner ton accord pour créer une vraie production (AUDIT-0111, point E2) : tutelliv.fr tourne aujourd'hui sur une préversion.
- Plateforme Factur-X : ouvrir le compte Super PDP au nom de la société quand elle existe (choix fait par Claude le 30 octobre, carte blanche : compte gratuit jusqu'à 1 000 factures par mois, API publique, pas de devis nécessaire).
- Plus tard : trouver un téléphone Android (essais MOB-01C).
- Plus tard : passer Supabase en Pro (environ 25 $/mois) avant les vraies données, pour la protection contre les mots de passe compromis.
- INTAKE-1 : fournir une vingtaine de vrais messages de commande anonymisés pour mesurer la qualité d'extraction et le coût ; décider si la fonction entre dans le portail client.
- Si tu relances un jour l'ancien projet Supabase `wlomrzil…` (en pause, plus utilisé) : change d'abord son mot de passe, exposé le 26 octobre.

**2. Claude — peut le faire seul, dans cet ordre**
- LEGAL-1 : vérifier et documenter le respect des exigences applicables (contrats, RGPD, GPS, photos, conservation et fournisseurs), avec les pièces et décisions du propriétaire. Recourir à un juriste reste facultatif ; aucune conformité n’est encore déclarée.
- Relire le résultat de la recette connectée lancée le 2 novembre (GitHub Actions, TutelLiv CI, lancement manuel) et corriger ce qu'elle signale. Non cliqués : replanifier un échec à l'écran, bandeau de prix du portail.
- Démarchage : débloquer la place de démo numéro 1, refusé le 1er novembre par le contrôle de sécurité de l'outil ; à refaire si le propriétaire l'autorise. Empêcher qu'une preuve ajoutée en démo bloque une place. Les liens restants vers l'inscription (accueil, pied de page, Fonctionnalités, Démonstration) suivent S2 d'AUDIT-0111.
- DEMO-SLIDES-6-7 : modifier la démo entre la slide 6 et la slide 7, dès que le propriétaire a précisé quelle démo et quel changement.

**3. En attente de quelqu'un d'autre** (rien à faire tant que ça n'arrive pas)
- Propriétaire et fournisseurs : fournir les justificatifs, contrats et décisions manquants pour la vérification LEGAL-1, DATA-02 et la fiche F10 d’INTAKE-1 avant les données réelles. LEGAL-LIENS suit la vérification des documents.
- Pilotes (ils attendent les entretiens du point 1, qui ne dépendent que de toi pour démarrer) : PILOT-1 et 2, PROD-04, OFFER-1, V1-GO, ONBOARD-1, DISPATCH-5 (mesure).
- Mesures et mise en vente : SAAS-02, SAAS-03, COST-1, RELEASE-1, SMS, GROWTH-1.

**Déjà fait côté agent, la case attend une action du point 1 :** SEC-AUDIT, POD-2, OPS-FIAB, INTAKE-1, FACTURX-1, MOB-01C.

Mise à jour : 29 octobre 2026, en fin de journée (revue de cohérence : matrice réalignée sur les cases ; LANDING-3, MAP-UNIFY-2, MAP-INTERACTION, E2E-MAJ, ICONES-IA et CONFIG-MSG-2 closes). Version précédente du même jour : bilan de l'intégration du 28 octobre (neuf chantiers ; voir DEMO-3, DESIGN-1, FACTURX-1, INTAKE-1, POD-2, OPS-FIAB, SEC-AUDIT, RECETTE-2810 et PROPRIO-2810). Précédente : 26 octobre 2026 (revue de cohérence : tableaux de pilotage, priorités et matrice réalignés sur le code). Source unique des priorités du projet. Cette version consolide l’audit initial, l’audit SaaS autonome, les sondes locales et les tests E2E. La copie dans les outputs de la tâche doit rester synchronisée avec ce fichier.

## Tâches ouvertes

_Tâches closes, anciens tableaux et journal : `docs/TODO-ARCHIVE.md`._

- [ ] **SEC-AUDIT — Durcissement du 28 octobre et correctifs de l'audit Codex.**

  **Qui : Toi.**

  Terminé quand : la CSP passe de Report-Only à bloquante après une recette sans violation sur les cartes, Stripe, Supabase et les polices ; la migration de limitation est appliquée en préproduction ; `CONTACT_HMAC_SECRET` est défini ; la protection Supabase contre les mots de passe compromis est active ; le rattachement par e-mail est arbitré ; aucune donnée de livreur au-delà de la règle décidée n'est lisible côté client.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section SEC-AUDIT.

- [ ] **POD-2 — Preuve de livraison complète : signature, PDF, envoi et relevés.**

  **Qui : Toi.**

  Terminé quand : essai sur téléphone réel de la signature tactile et de la reprise hors ligne ; règles de preuve pilotables depuis l'interface ; décision prise sur le nom obligatoire ou non ; position enregistrée alignée sur la décision GPS ; durée de conservation validée (LEGAL-1/DATA-02) ; e-mail réel du lien de preuve reçu.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section POD-2.

- [ ] **MOB-01C — Réaliser les essais iPhone et Android.**

  **Qui : Toi.**

  Terminé quand : Matrice appareils/scénarios avec preuves ; décider PWA/app native seulement si une limite bloque la promesse.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section MOB-01C.

- [ ] **ONBOARD-1 — Guider jusqu’à la première livraison.**

  **Qui : Toi — pendant les pilotes.**

  Terminé quand : une entreprise fictive puis un pilote réalisent une livraison test sans intervention obligatoire ; progression fiable après reconnexion ; invitations d'utilisateurs existants ou nouveaux cohérentes ; étapes facultatives sautables ; temps et interventions mesurés ; import invalide ne corrompt rien.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section ONBOARD-1.

- [ ] **OPS-FIAB — Fiabiliser les tâches de fond et l'exploitation.**

  **Qui : Toi.**

  Terminé quand : le workflow GitHub planifié a réellement tourné sur la préproduction avec ses secrets ; `after()` est vérifié sur Vercel ; Node 22 est réglé sur Vercel ; la migration d'index est appliquée en préproduction (en production avec `CONCURRENTLY`) ; une tâche en retard déclenche une alerte reçue.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section OPS-FIAB.

- [ ] **V1-GO — Valider la V1 prête à être essayée.**

  **Qui : Claude — après les essais téléphone et la vérification de conformité.**

  Terminé quand : Parcours complet validé avec preuves ; aucun défaut bloquant connu sur ce parcours ; limites documentées ; fonctions non qualifiées explicitement hors promesse. Ce jalon ne vaut ni validation commerciale ni autorisation de production.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section V1-GO.

- [ ] **FACTURX-1 — Factur-X EN 16931 des factures de livraison.**

  **Qui : Toi.**

  Terminé quand : validation officielle (XSD et Schematron : Mustang ou validateur FNFE) passée sur des factures fictives de recette ; décision prise sur le PDF/A-3b strict (police embarquée) ; traitement BT-32 de la franchise en base confirmé ; recette navigateur des écrans administrateur et portail ; choix d'une plateforme agréée tracé (FACTURX-2 si retenu).

  Détail et historique : `docs/TODO-ARCHIVE.md`, section FACTURX-1.

- [ ] **LEGAL-1 — Vérifier le respect des exigences applicables et préparer les documents.**

  **Qui : Claude.**

  Terminé quand : exigences applicables identifiées à partir de sources officielles à jour et vérifiées avec preuves ; contrats et documents cohérents avec le service réel ; RGPD, GPS, photos, conservation, fournisseurs, responsabilités et support examinés ; pièces manquantes et écarts consignés puis traités avant les usages concernés. Les décisions et engagements restent à confirmer par le propriétaire.

  Décision du propriétaire du 1er novembre 2026 : retirer le recours obligatoire à un juriste et le remplacer par une vérification documentée de conformité. Cette décision remplace les anciennes dépendances imposant une validation professionnelle dans les documents de travail ; les obligations applicables, contrats nécessaires et contrôles avant données réelles restent à vérifier. Un avis professionnel peut être sollicité au besoin, sans être un préalable systématique. Aucun contrôle de conformité n’est réalisé par cette simple mise à jour.

  Vérifications de cette mise à jour documentaire : résultats consignés dans le journal de `docs/TODO-ARCHIVE.md`. Suite : effectuer la vérification LEGAL-1 ; tâche maintenue ouverte.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section LEGAL-1.

- [ ] **DATA-02 — Prévoir sortie, export et conservation des données.**

  **Qui : Claude — après la vérification de conformité.**

  Terminé quand : Export exploitable et test de suppression sur fixtures ; aucun effet sur une autre entreprise ; politique appliquée au stockage et sauvegardes.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section DATA-02.

- [ ] **PROD-02 — Documenter le travail actuel et sa difficulté principale.**

  **Qui : Toi.**

  Terminé quand : Synthèse des problèmes récurrents, fréquence, coût et outils actuels ; sélectionner un problème prioritaire avec preuves.

  Préparation du commit et de la publication le 1er novembre 2026 : pitch de prospection (10 secondes, 30 secondes, 2 minutes), choix des supports et déroulé de démonstration ajoutés dans `docs/operations/prospection/PITCH.md`, reliés aux deux index. Vérifications : `npm run check` réussi (1 518 tests, types et lint), `npm run docs:verify` réussi (86 Markdown, aucun lien cassé). Limites : démonstration réelle et PDF non recettés dans cette intervention documentaire ; fichiers `outputs/` exclus de la publication. Suite : mener les entretiens et consigner les preuves ; la tâche reste ouverte.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section PROD-02.

- [ ] **PROD-04 — Définir les mesures de valeur.**

  **Qui : Claude — après les pilotes.**

  Terminé quand : Valeur de départ avant pilote et objectif convenu avec chaque entreprise ; instruments utilisables sans collecte excessive.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section PROD-04.

- [ ] **OFFER-1 — Valider la grille cible et l'offre pilote.**

  **Qui : Toi — pendant les entretiens et les pilotes.**

  Terminé quand : Offre acceptée par prospects ; coûts infrastructure/cartes/stockage/messages/support mesurés ; pas d’illimité non maîtrisé.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section OFFER-1.

- [ ] **PILOT-1 — Recruter et conduire trois pilotes accompagnés.**

  **Qui : Toi — après les entretiens.**

  Terminé quand : Mesures avant/après, incidents, adoption par les trois rôles, coût support et retours consignés chaque semaine.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section PILOT-1.

- [ ] **PILOT-2 — Décider avec les preuves des pilotes.**

  **Qui : Toi — après les pilotes.**

  Terminé quand : Décision poursuivre/resserrer/revoir l’offre documentée ; ne pas ajouter des fonctions pour masquer l’absence de valeur.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section PILOT-2.

- [ ] **SAAS-03 — Permettre la gestion autonome de l'abonnement.**

  **Qui : Claude — après la vérification de conformité.**

  Terminé quand : chaque action passe par le serveur et un journal auditable ; l'état affiché se réconcilie avec le fournisseur ; seuils de commandes/livreurs produisent des alertes sans doublon ; les rétrogradations avec ressources excédentaires sont refusées ou planifiées selon la règle décidée, jamais destructives ; résiliation conserve l'accès/export selon la politique ; seuls les rôles autorisés gèrent l'abonnement.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section SAAS-03.

- [ ] **SAAS-02 — Mesurer le revenu et la santé du SaaS.**

  **Qui : Claude — après les pilotes.**

  Terminé quand : Indicateurs réconciliés avec paiements ; définitions écrites ; quotas et alertes de coûts testés.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section SAAS-02.

- [ ] **COST-1 — Simuler les coûts d'exploitation et la marge contributive.**

  **Qui : Claude — après les pilotes.**

  Terminé quand : hypothèses et sources datées ; volumes par livraison explicités ; frais de paiement et support distingués ; commissions 15/25/35 % simulées séparément ; coût mensuel total, marge contributive et coût marginal approximatif par client pour chaque scénario ; seuils de changement de plan et sensibilité haute/basse ; risque des livreurs Business illimités isolé ; comparaison aux prix HT sans confondre marge contributive, marge brute et résultat ; chiffres exportables vers le prévisionnel. Aucun test facturable lancé sans accord.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section COST-1.

- [ ] **GROWTH-1 — Construire le site commercial relié au parcours autonome.**

  **Qui : Claude — après la vérification de conformité.**

  Terminé quand : un prospect comprend pour qui est le produit, le problème résolu, les trois espaces, le prix HT/TTC indicatif, options et dépassements, la différence démo/pilote/découverte premium et la prochaine étape ; navigation responsive et accessible ; contenu cohérent avec le catalogue actif ; formulaires protégés contre abus ; pages légales publiées seulement après validation.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section GROWTH-1.

- [ ] **LEGAL-LIENS — Rendre accessibles les mentions légales et la politique de confidentialité depuis le site public.**

  **Qui : Claude — après la vérification de conformité.**

  Terminé quand : chaque pied de page public (accueil, Fonctionnalités, Tarifs, Démonstration, Contact, inscription et connexion) mène aux mentions légales et à la politique de confidentialité ; les formulaires qui collectent des données (Contact, inscription) y renvoient au point de collecte ; contenu issu des pièces validées de LEGAL-1, sans identité, SIREN, adresse ni engagement inventés ; recette navigateur Light/Dark, 1440 et 390.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section LEGAL-LIENS.

- [ ] **INTAKE-1 — Commande par message IA (coller un message).**

  **Qui : Toi.**

  Terminé quand : essai réel sur vingt messages anonymisés avec mesure de la qualité d'extraction et du coût ; clé serveur fournie et fonction activée par une entreprise de recette ; fiche F10 qualifiée avant toute donnée réelle ; parcours navigateur « coller, relire, créer » rejoué avec la spécification corrigée ; décision prise sur l'entrée dans le portail client.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section INTAKE-1.

- [ ] **DISPATCH-5 — Imprévus et mesure du dispatch.**

  **Qui : Claude — après les pilotes.**

  Terminé quand : chaque proposition reste explicable et validable par le dispatcher ; aucune coordonnée de livreur exposée au client ; tests métier et `npm run check` verts ; recette navigateur.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section DISPATCH-5.

- [ ] **AUDIT-0111 — Corrections de l'audit complet du 1er novembre 2026 avant le premier pilote.** Audit demandé par le propriétaire en carte blanche ; rapport PDF de 15 pages avec étude de marché, local et confidentiel : `outputs/audit-2026-11-01/TutelLiv-Audit-2026-11-01.pdf` (constats, fichiers et lignes en annexe). Conclusion : produit sérieux, aucune confrontation au marché ; geler les nouvelles fonctions, corriger ce qui suit, mener dix entretiens en parallèle, puis un seul pilote.

  **Qui : Toi.**

  État du 2 novembre 2026 : tout est en préproduction sauf E2 (accord du propriétaire) ; numérotation C2 à confirmer par un comptable ; S4 : la limite contournable en appelant Supabase directement reste ouverte. Inscription en ligne fermée sur tutelliv.fr tant que le paiement n\'est pas réel.

  **Modèle conseillé : GPT‑6 Astra · effort élevé (sécurité, états métier).**

  Terminé quand : chaque point est corrigé avec un test du comportement réel, `npm run check` vert, parcours complets rejoués sur `tutelliv-dev`, et le point E2 tranché par le propriétaire.

  À faire, dans l'ordre :
  1. E1 — Commandes récurrentes et facturation : les tâches quotidiennes de `vercel.json` ne tournent qu'en production Vercel (ancienne version du 7 septembre, base en pause, échec quotidien constaté) ; rien ne les appelle sur tutelliv.fr, 10 récurrences de test sur 23 en retard le 1er novembre.
  2. S1 — Une inscription ne doit pas pouvoir toucher un compte invité non confirmé (`signup.service.ts`, `reuseUnconfirmedAuthUser`).
  3. S2 — Retirer le raccourci de confirmation d'e-mail et désactiver le paiement fictif sur le site public.
  4. C1 — Définir les changements d'état permis des commandes et livraisons côté équipe, avec tests.
  5. C3 — Double commande par lien public : clé d'unicité inopérante sans client.
  6. C4 — Appliquer la lecture seule d'un abonnement expiré aux modifications de commandes et livraisons.
  7. S3 — Bloquer les invitations depuis la démo publique.
  8. C2 — Numéroter les factures en suite continue (à confirmer par un comptable).
  9. C5 — Relancer le dispatch automatique abandonné après trois essais sans livreur actif.
  10. S4 et S5 — Compléter les limites de tentatives, revoir le rattachement par e-mail.
  11. C6 — Faire tourner les parcours complets sur une base dans le contrôle automatique (dernier passage connecté : 20 octobre).
  12. P1 — Réduire cette TODO à une page de pilotage et archiver le journal.
  13. E2 — Créer une vraie production (accord du propriétaire requis), offres Vercel et Supabase payantes.

  Vérifications de l'audit : `npm run check` vert (1 492 tests) ; `npm audit --omit=dev` sans faille ; journaux Vercel sur 7 jours, conseillers Supabase, comptages en base et pages publiques relus. Aucun code ni donnée modifiés. Non vérifié : intérieur de l'application non cliqué, E2E et build non relancés localement, performance non mesurée, failles lues dans le code mais non rejouées, environ 100 routes contrôlées seulement sur la présence de leur garde d'accès.

- [ ] **MOTS-UNIFIES — Employer les mêmes mots partout à l'écran.** Écart relevé le 1er novembre 2026 en écrivant les vidéos de formation ; le propriétaire demande de le régler. Mélanges constatés : « Chauffeur » et « Livreur » ; « Relevé » et « Facture » ; « Équipe » pour « Gestion des comptes » ; « Nouvel utilisateur » pour « Inviter un utilisateur » ; « Analytics avancés » et « Statistiques avancées » ; « Support prioritaire » et « Assistance prioritaire » ; « Dispatch automatique » et « Dispatch intelligent ».

  **Qui : Claude — après la vérification de conformité.**

  « Livreur » et les autres mots sont unifiés ; reste seulement « Relevé » et « Facture ».

  **Modèle conseillé : GPT‑6 Luna · effort moyen.**

  À trancher : recommandation « Livreur » partout, sauf le code interne. « Relevé » a été choisi exprès parce que le document n'est pas une facture électronique réglementaire : ne pas le remplacer par « Facture » sans vérification des exigences applicables (LEGAL-1), en lien avec le point C2 d'AUDIT-0111. Le reste peut avancer sans attendre.

  Terminé quand : un seul mot par notion dans les écrans, e-mails et PDF des trois espaces ; recherche de chaque ancien mot sans résultat visible par l'utilisateur ; tests à jour, `npm run check` vert et clic réel navigateur.

  Source / dépendance / blocage : vérification des exigences applicables pour « Relevé » et « Facture » seulement. À faire avant de capturer les écrans des vidéos de formation.

- [ ] **DEMO-SLIDES-6-7 — Modifier la démo entre la slide 6 et la slide 7.** Demande du propriétaire du 2 novembre 2026, notée telle quelle.

  **Qui : le propriétaire précise, puis Claude.**

  À préciser avant de commencer : de quelle démo il s'agit (la mini-démo de l'accueil, dont les étapes 6 et 7 sont « Facture » et « Paiements », ou la présentation de rendez-vous, dont les diapositives 6 et 7 sont « Vos clients » et « Où en est TutelLiv ») et ce qu'il faut changer. Hypothèse non confirmée : la mini-démo.

  Terminé quand : le changement demandé est visible à cet endroit, vérifié en cliquant, et les supports du kit qui en parlent sont à jour.

  Source / dépendance / blocage : précision du propriétaire. Rien n'a été modifié pour l'instant.

- [ ] **PROPRIO-2810 — Actions du propriétaire avant mise en ligne.**

  **Qui : Toi.**

  Terminé quand : chaque ligne est constatée par un agent (secret présent, migration appliquée avec un schéma sans écart, réglage visible) ; aucun secret n'est affiché ni versionné ; promotion décidée explicitement.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section PROPRIO-2810.

- [ ] **RELEASE-1 — Réaliser la recette de mise en vente.**

  **Qui : Claude — en dernier, avant la mise en vente.**

  Terminé quand : Aucun défaut bloquant connu ouvert ; responsabilités opérationnelles définies ; décision de lancement explicite et surveillance prête.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section RELEASE-1.

- [ ] **SMS — Ajouter seulement les extensions justifiées.**

  **Qui : Claude — seulement si les pilotes le demandent.**

  Terminé quand : Chaque extension a un problème mesuré, un coût, un critère de réussite et une place validée dans la roadmap.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section SMS.
