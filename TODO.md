# TODO TutelLiv — du produit existant au SaaS vendable


<!-- TODO_PROGRESS_START -->
## Progression globale

**99 tâches terminées sur 127 — 78 %**

`████████████████░░░░` · 28 tâches restantes

**À faire par Claude**

- V1-GO — Valider la V1 prête à être essayée (après les essais téléphone et la vérification de conformité)
- DATA-02 — Prévoir sortie, export et conservation des données (après la vérification de conformité)
- PROD-04 — Définir les mesures de valeur (après les pilotes)
- SAAS-03 — Permettre la gestion autonome de l'abonnement (après la vérification de conformité)
- SAAS-02 — Mesurer le revenu et la santé du SaaS (après les pilotes)
- COST-1 — Simuler les coûts d'exploitation et la marge contributive (après les pilotes)
- GROWTH-1 — Construire le site commercial relié au parcours autonome (après la vérification de conformité)
- DISPATCH-5 — Imprévus et mesure du dispatch (après les pilotes)
- MOTS-UNIFIES — Employer les mêmes mots partout à l'écran (après la vérification de conformité)
- MAIL-PONT — Relier la boîte de commandes de l'entreprise à TutelLiv (écrire la spécification, puis Toi la relire)
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
- LEGAL-1 — Vérifier le respect des exigences applicables et préparer les documents (fournir les pièces et décider, puis Claude)
- OFFER-1 — Valider la grille cible et l'offre pilote (pendant les entretiens et les pilotes)
- PILOT-1 — Recruter et conduire trois pilotes accompagnés (après les entretiens)
- PILOT-2 — Décider avec les preuves des pilotes (après les pilotes)
- LEGAL-LIENS — Rendre accessibles les mentions légales et la politique de confidentialité depuis le site public (SIREN, e-mail, téléphone ; puis Claude)
- MAIL-ECARTS — Corriger les défauts trouvés en testant les e-mails reçus (ouvrir Chrome (ou activer la réception de l'espace de démo), puis Claude)

_Chaque tâche est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->

## Ce qu'il reste vraiment à faire (vue simple, à jour au 3 novembre 2026)

_Lire ce bloc en premier. Tout le reste du fichier est le détail. Un agent le met à jour à chaque fin de tâche (simples tirets ici : seules les cases des tâches comptent dans la jauge)._

**1. Toi (le 30 octobre, Claude a fait le reste de ta liste : voir PROPRIO-2810)**
- OPS-FIAB, tout de suite : lancer la commande unique qui copie `CRON_SECRET` de Vercel vers le coffre Supabase (`docs/OPERATIONS.md`, section « Relais des tâches de fond »). L'outil de sécurité a refusé que Claude le fasse. Sans elle, le relais toutes les 5 minutes ne démarre pas.
- Avant le premier pilote : faire confirmer par un comptable le mot « Facture » à l'écran pour un document sans toutes les mentions légales (le PDF classique reste « Relevé de prestation »).
- Cette semaine, le plus important (audit du 1er novembre, PDF dans `outputs/audit-2026-11-01/`) : contacter des sociétés de livraison et tenir dix entretiens (PROD-02) ; le plan complet, les textes, la liste d'entreprises et le pitch avec déroulé de démonstration sont prêts (`docs/operations/prospection/README.md`, `docs/operations/prospection/PITCH.md`). Chaque jour à partir du 2 novembre : trouver les coordonnées, écrire et appeler de 8 h à 11 h à New York (14 h à 17 h en France).
- Avant le premier message du démarchage : créer une vraie boîte mail, par exemple `orso@tutelliv.fr` (les mails actuels partent de `no-reply@`, une réponse serait perdue).
- Lundi 2 novembre, avant le premier message : demander ton SIREN sur le Guichet unique (pas encore de numéro, confirmé le 1er novembre). D'ici là, le démarchage se limite aux entretiens de recherche : aucun prix ni offre de pilote.
- Étude de marché (`outputs/reports/Marché TutelLiv livraison B2B France.md`, environ 840 entreprises visées, hypothèse à mesurer) : trier la liste de prospects (107 lignes sur 282 ont le bon profil), obtenir 50 réponses tirées au hasard sur la part de clients directs, demander un devis à GTLYS et à Toncarton.
- Avant le premier pilote ou la première vente (décidé le 2 novembre) : passer Vercel en Pro et créer la vraie production (AUDIT-0111, point E2).
- Plateforme Factur-X : ouvrir le compte Super PDP au nom de la société quand elle existe (choix fait par Claude le 30 octobre, carte blanche : compte gratuit jusqu'à 1 000 factures par mois, API publique, pas de devis nécessaire).
- Avant le dépôt au Guichet unique : vérifier la reprise de ton ancien SIREN, et ta capacité à exercer depuis les États-Unis sous visa J-1 avec ta résidence fiscale (checklist J5, non tranché).
- LEGAL-1 (sections 4 et 6 de `docs/legal/VERIFICATION_2026-11-02.md`) : fournir SIREN, e-mail et téléphone, décider des durées de conservation et des clauses des CGV (plafond de responsabilité, préavis).
- Plus tard : trouver un téléphone Android (essais MOB-01C).
- Plus tard : passer Supabase en Pro (environ 25 $/mois) avant les vraies données, pour la protection contre les mots de passe compromis.
- MAIL-ECARTS : ouvrir Chrome (extension Claude connectée) pour que Claude finisse l'essai en ligne des e-mails reçus.
- MAIL-PONT : relire la spécification quand Claude l'aura écrite (boîte dédiée aux commandes, décidée le 3 novembre ; plus de compte Google Cloud ni Azure à créer pour l'instant).
- INTAKE-1 : fournir une vingtaine de vrais messages de commande anonymisés pour mesurer la qualité d'extraction et le coût ; décider si la fonction entre dans le portail client.
- Si tu relances un jour l'ancien projet Supabase `wlomrzil…` (en pause, plus utilisé) : change d'abord son mot de passe, exposé le 26 octobre.

**2. Claude — peut le faire seul, dans cet ordre**
- LEGAL-1, écarts qui ne dépendent pas de toi : file hors ligne du livreur sans expiration, analyse d'impact type, analyse de la décision automatisée du Dispatch intelligent, mise à jour des textes J5 une fois tes décisions prises (sur Drive : à reprendre dans le dépôt, Drive non modifié). Première vérification faite le 2 novembre (`docs/legal/VERIFICATION_2026-11-02.md`), aucune conformité déclarée.
- OPS-FIAB : contrôler le relais et la réception d'une vraie alerte, dès que tu as lancé la commande ci-dessus.
- MAIL-ECARTS : corrigé, testé et en ligne (3 novembre) ; reste l'essai avec le vrai modèle sur `tutelliv.fr`, dès que tu as ouvert Chrome.
- MAIL-PONT : écrire la spécification de la boîte de commandes dédiée (renvoi automatique, tri, nouveau client à la validation, confirmation au client).

**3. En attente de quelqu'un d'autre** (rien à faire tant que ça n'arrive pas)
- Propriétaire et fournisseurs : fournir les justificatifs, contrats et décisions manquants pour la vérification LEGAL-1, DATA-02 et la fiche F10 d’INTAKE-1 avant les données réelles. LEGAL-LIENS suit la vérification des documents.
- Pilotes (ils attendent les entretiens du point 1, qui ne dépendent que de toi pour démarrer) : PILOT-1 et 2, PROD-04, OFFER-1, V1-GO, ONBOARD-1, DISPATCH-5 (mesure).
- Mesures et mise en vente : SAAS-02, SAAS-03, COST-1, RELEASE-1, SMS, GROWTH-1.

**Déjà fait côté agent, la case attend une action du point 1 :** SEC-AUDIT (protection des mots de passe : Supabase Pro), POD-2, OPS-FIAB (alertes, cadence), INTAKE-1 (vingt vrais messages), FACTURX-1 (franchise à confirmer par la plateforme), MOB-01C.

Mise à jour : 29 octobre 2026, en fin de journée (revue de cohérence : matrice réalignée sur les cases ; LANDING-3, MAP-UNIFY-2, MAP-INTERACTION, E2E-MAJ, ICONES-IA et CONFIG-MSG-2 closes). Version précédente du même jour : bilan de l'intégration du 28 octobre (neuf chantiers ; voir DEMO-3, DESIGN-1, FACTURX-1, INTAKE-1, POD-2, OPS-FIAB, SEC-AUDIT, RECETTE-2810 et PROPRIO-2810). Précédente : 26 octobre 2026 (revue de cohérence : tableaux de pilotage, priorités et matrice réalignés sur le code). Source unique des priorités du projet. Cette version consolide l’audit initial, l’audit SaaS autonome, les sondes locales et les tests E2E. La copie dans les outputs de la tâche doit rester synchronisée avec ce fichier.

## Tâches ouvertes

_Tâches closes, anciens tableaux et journal : `docs/TODO-ARCHIVE.md`._

- [ ] **SEC-AUDIT — Durcissement du 28 octobre et correctifs de l'audit Codex.**

  **Qui : Toi.**

  Terminé quand : la CSP passe de Report-Only à bloquante après une recette sans violation sur les cartes, Stripe, Supabase et les polices ; la migration de limitation est appliquée en préproduction ; `CONTACT_HMAC_SECRET` est défini ; la protection Supabase contre les mots de passe compromis est active ; le rattachement par e-mail est arbitré ; aucune donnée de livreur au-delà de la règle décidée n'est lisible côté client.

  Constat du 2 novembre 2026 : CSP bloquante en ligne (en-tête relu), migration `auth_login_failures` appliquée en préproduction, `CONTACT_HMAC_SECRET` présent sur Vercel. Reste : la protection contre les mots de passe compromis, qui demande Supabase Pro. Non revérifié : la règle sur les données de livreur.

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

  Constat du 2 novembre 2026 : Node 22 réglé sur Vercel ; migration d'index appliquée ; workflow réellement lancé par GitHub, mais **toutes les 4 à 7 heures et non toutes les 5 minutes** (GitHub espace ces lancements) ; aucune variable `OPS_ALERT_WEBHOOK_URL` sur Vercel, donc une alerte ne part que dans les journaux. Reste : une cadence fiable, un canal d'alerte réel, le contrôle d'`after()` en ligne.

  Décisions et travaux du 2 novembre 2026 : relais par Supabase (tâche pg_cron `tutelliv-operations-relay`, pg_net activé, inactive tant que le secret `relay_cron_secret` manque ; copie du secret refusée par l'outil de sécurité, commande à lancer par le propriétaire). Alertes par e-mail : une par empreinte et par jour (`OPS_ALERT_RECIPIENT`, sinon `EMAIL_TEST_RECIPIENT`), tests ajoutés, `npm run check` vert. Non vérifié : relais réellement lancé, e-mail réellement reçu. Écart trouvé : la sonde `ops_monitor` (toutes les 30 minutes) écrit encore vers un webhook temporaire de recette, donc une panne totale de Vercel ne prévient pas le propriétaire ; à rediriger vers un vrai e-mail.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section OPS-FIAB.

- [ ] **V1-GO — Valider la V1 prête à être essayée.**

  **Qui : Claude — après les essais téléphone et la vérification de conformité.**

  Terminé quand : Parcours complet validé avec preuves ; aucun défaut bloquant connu sur ce parcours ; limites documentées ; fonctions non qualifiées explicitement hors promesse. Ce jalon ne vaut ni validation commerciale ni autorisation de production.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section V1-GO.

- [ ] **FACTURX-1 — Factur-X EN 16931 des factures de livraison.**

  **Qui : Toi.**

  Terminé quand : validation officielle (XSD et Schematron : Mustang ou validateur FNFE) passée sur des factures fictives de recette ; décision prise sur le PDF/A-3b strict (police embarquée) ; traitement BT-32 de la franchise en base confirmé ; recette navigateur des écrans administrateur et portail ; choix d'une plateforme agréée tracé (FACTURX-2 si retenu).

  Constat du 2 novembre 2026 : Mustang « valid » sans erreur le 30 octobre, polices embarquées, Super PDP choisie. Reste : la franchise (BT-32), à confirmer par la plateforme quand le compte existera, et la recette navigateur.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section FACTURX-1.

- [ ] **LEGAL-1 — Vérifier le respect des exigences applicables et préparer les documents.**

  **Qui : Toi — fournir les pièces et décider, puis Claude.**

  Terminé quand : exigences applicables identifiées à partir de sources officielles à jour et vérifiées avec preuves ; contrats et documents cohérents avec le service réel ; RGPD, GPS, photos, conservation, fournisseurs, responsabilités et support examinés ; pièces manquantes et écarts consignés puis traités avant les usages concernés. Les décisions et engagements restent à confirmer par le propriétaire.

  État du 2 novembre 2026 : première vérification faite, `docs/legal/VERIFICATION_2026-11-02.md` (exigences, sources, constats, verdicts). Aucune conformité déclarée. Démo fictive et entretiens de recherche possibles sous conditions ; vente et vraies données non. Nouveaux constats : Data Act absent du dossier ; offre Vercel Hobby non commerciale, contenus utilisables pour entraîner des IA, DPA réservé aux offres Pro et Enterprise ; réception des factures électroniques déjà obligatoire ; mentions légales incomplètes. Vérifications : `npm run check` 1 529/1 529 ; `verify-docs` OK. Non vérifié : voir section 5 du document.

  Textes J5 lus sur Drive le 2 novembre avec l'accord du propriétaire, en lecture seule ; écarts en section 6, rien de modifié sur Drive. Suite : les pièces et décisions de la section 4 du document. Écarts à traiter par Claude ensuite : purge et remise des données (DATA-02), file hors ligne sans expiration, analyse d'impact type, fournisseur de cartes.

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

  **Qui : Toi — SIREN, e-mail, téléphone ; puis Claude.**

  Constat du 2 novembre 2026 : liens, renvois aux formulaires et recette faits le 29 octobre. Reste : compléter le contenu des mentions.

  Terminé quand : chaque pied de page public (accueil, Fonctionnalités, Tarifs, Démonstration, Contact, inscription et connexion) mène aux mentions légales et à la politique de confidentialité ; les formulaires qui collectent des données (Contact, inscription) y renvoient au point de collecte ; contenu issu des pièces validées de LEGAL-1, sans identité, SIREN, adresse ni engagement inventés ; recette navigateur Light/Dark, 1440 et 390.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section LEGAL-LIENS.

- [ ] **INTAKE-1 — Commande par message IA (coller un message).**

  **Qui : Toi.**

  Terminé quand : essai réel sur vingt messages anonymisés avec mesure de la qualité d'extraction et du coût ; clé serveur fournie et fonction activée par une entreprise de recette ; fiche F10 qualifiée avant toute donnée réelle ; parcours navigateur « coller, relire, créer » rejoué avec la spécification corrigée ; décision prise sur l'entrée dans le portail client.

  Constat du 2 novembre 2026 : `ANTHROPIC_API_KEY` présente sur la préproduction. Reste : les vingt messages, le parcours rejoué, la décision sur le portail.

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

  C6, relevé du 2 novembre 2026 : recette connectée réparée (test périmé depuis le 23 octobre, vrai bug de `recordOrderCreatedUsage` corrigé) et verte en ligne sur la préproduction (run 41495900652). Passage de nuit limité à cette recette ; premier passage planifié à contrôler le 3 novembre. Parcours navigateur à la demande (`run_browser`), car le montage sur la préproduction est arrêté par son garde-fou `PREPRODUCTION_PERSISTENT_DEMO_UNEXPECTED`.

  E2E complet sur `tutelliv-dev`, serveur de dev, 2 novembre 2026 : 60 réussis, 22 échoués, 2 sautés sur 84. Après préparation des comptes et des données : 46 réussis, 3 échoués, 1 sauté sur les 50 tests des fichiers en échec. Les 3 restants, tous en dépassement de temps, passent seuls : `design2-theme:118` et `portal-theme:154` avec 5 minutes, `support:7` en 2,1 min (limite du test passée à 5 minutes). `/settings` à 360 px, 388 px de large au premier passage, ne se reproduit pas : cause non identifiée. `scripts/audit0111/connected.ts` : champ `monthlyOrders` corrigé, script non relancé. `npm run check` vert (1 530 tests). Limites : aucun passage complet d'une seule traite n'est vert, le navigateur n'a pas tourné en ligne, et 2 tickets de test `SUPPORT-1 navigateur` restent sur `tutelliv-dev` (suppression refusée, restes des courses interrompues).

  Vérifications de l'audit : `npm run check` vert (1 492 tests) ; `npm audit --omit=dev` sans faille ; journaux Vercel sur 7 jours, conseillers Supabase, comptages en base et pages publiques relus. Aucun code ni donnée modifiés. Non vérifié : intérieur de l'application non cliqué, E2E et build non relancés localement, performance non mesurée, failles lues dans le code mais non rejouées, environ 100 routes contrôlées seulement sur la présence de leur garde d'accès.

- [ ] **MOTS-UNIFIES — Employer les mêmes mots partout à l'écran.** Écart relevé le 1er novembre 2026 en écrivant les vidéos de formation ; le propriétaire demande de le régler. Mélanges constatés : « Chauffeur » et « Livreur » ; « Relevé » et « Facture » ; « Équipe » pour « Gestion des comptes » ; « Nouvel utilisateur » pour « Inviter un utilisateur » ; « Analytics avancés » et « Statistiques avancées » ; « Support prioritaire » et « Assistance prioritaire » ; « Dispatch automatique » et « Dispatch intelligent ».

  **Qui : Claude — après la vérification de conformité.**

  « Livreur » et les autres mots sont unifiés. Décision du propriétaire du 2 novembre 2026 : « Facture » à l'écran, avec la mention « ne constitue pas une facture électronique réglementaire » conservée ; le PDF classique reste « Relevé de prestation » car il n'a pas toutes les mentions légales ; le « relevé par livreur » est une autre notion et ne change pas. Écrans modifiés, non cliqués en navigateur. Reste : confirmation d'un comptable, puis le PDF classique.

  **Modèle conseillé : GPT‑6 Luna · effort moyen.**

  À garder en tête : « Relevé » avait été choisi exprès parce que le document n'est pas une facture électronique réglementaire. Le PDF classique ne doit pas changer sans vérification des exigences applicables (LEGAL-1), en lien avec le point C2 d'AUDIT-0111.

  Terminé quand : un seul mot par notion dans les écrans, e-mails et PDF des trois espaces ; recherche de chaque ancien mot sans résultat visible par l'utilisateur ; tests à jour, `npm run check` vert et clic réel navigateur.

  Source / dépendance / blocage : vérification des exigences applicables pour « Relevé » et « Facture » seulement. À faire avant de capturer les écrans des vidéos de formation.

- [ ] **MAIL-PONT — Relier la boîte de commandes de l'entreprise à TutelLiv.** Décisions du propriétaire (C14) : le 2 novembre, tri automatique entre e-mails ordinaires et e-mails de commande, validation toujours humaine, client inconnu créé à la validation (fiche sans accès, informations manquantes complétées par le dispatcher), une réponse automatique au client après validation avec le lien de suivi. Révision du 3 novembre : parcours principal = boîte dédiée aux commandes, renvoyée automatiquement vers l'adresse TutelLiv (aucune connexion Gmail/Outlook) ; la connexion directe Gmail/Outlook passe en option, plus tard.

  **Qui : Claude — écrire la spécification, puis Toi la relire.**

  Terminé quand : une boîte de commandes Gmail et une boîte Outlook renvoient automatiquement vers TutelLiv ; le code de confirmation de Gmail est visible dans TutelLiv ; le client d'origine est reconnu ; les e-mails de commande apparaissent en brouillon et les autres sont mis « à trier » ou ignorés sans être conservés ; la validation crée la commande et, si besoin, la fiche du client ; le client reçoit la confirmation (envoyée par TutelLiv au nom de l'entreprise, « répondre à » vers sa boîte) ; tests, essai réel avec chaque fournisseur, `npm run check` et clic réel navigateur.

  À prévoir : changement de schéma (fiche client sans accès, statut « à trier ») ; guide pour activer le renvoi (Gmail, Outlook, OVH), dont l'accord de l'administrateur Outlook professionnel pour les renvois externes. Option ultérieure, hors de cette tâche : connexion directe Gmail/Outlook (comptes Google Cloud et Azure, vérification Google et audit CASA, juridique plus lourd).

  **Modèle conseillé : Claude Opus · effort élevé.**

- [ ] **MAIL-ECARTS — Corriger les défauts trouvés en testant les e-mails reçus.** Essai demandé par le propriétaire le 2 novembre 2026, sur `tutelliv.fr` (espace de démonstration, 14 e-mails fictifs envoyés depuis Gmail). La chaîne marche : voir « Résultat » ci-dessous.

  **Qui : Toi — ouvrir Chrome (ou activer la réception de l'espace de démo), puis Claude.**

  Terminé quand : les défauts 2, 4, 5 et 6 sont corrigés et testés. Les défauts 1 et 3 sont repris par MAIL-PONT (décision C14 : renvoi automatique d'une boîte dédiée, qui garde le vrai expéditeur, et tri des e-mails ordinaires).

  1. **Client jamais retrouvé sur un e-mail transféré.** Le rapprochement ne regarde que l'expéditeur (`matchCustomerBySender`), qui est alors l'entreprise elle-même. Essai : e-mail transféré citant l'adresse d'un client existant, adresse bien lue par l'analyse, client non présélectionné. C'est pourtant l'usage indiqué à l'écran (« Transférez-y vos e-mails »). Le dispatcher doit choisir le client à la main.
  2. **Plusieurs livraisons dans un e-mail : quantités mélangées.** Essai : « 1 palette » et « 3 colis ». Quantité non retenue, champ prérempli à 1 avec l'avis « Absente du message », et chaque commande porte l'article « 1 palette (livraison 1), 3 colis (livraison 2) ». Sans correction du dispatcher, la seconde partirait avec une quantité de 1 au lieu de 3.
  3. **« Brouillon prêt » sur tout.** « Merci pour hier » et un e-mail dont tout est en pièce jointe reçoivent la même étiquette qu'une vraie commande, avec un brouillon vide. Rien n'est créé seul, mais l'étiquette trompe.

  4. **E-mail refusé en boucle s'il contient un caractère invalide.** Essai interne : un caractère nul (`\u0000`) ou un émoji coupé dans le texte ou l'expéditeur fait échouer l'écriture en base (Postgres 22021). Le webhook répond 503 à chaque renvoi : l'e-mail n'arrive jamais et personne n'est prévenu. Rare, mais perte silencieuse. Nettoyer le texte avant l'écriture dans `ingestInboundEmail`.
  5. **Plafond de 200 e-mails par jour dépassé sous envois simultanés.** Essai interne : à 199/200, 8 e-mails simultanés sont tous acceptés (207 en base). Le comptage est fait hors transaction. Impact limité : le quota d'analyse (60 par heure), lui, tient.
  6. **« Nom <adresse> » non reconnu dans le champ Expéditeur de la commande collée.** `parseSender` refuse ce format. Sans effet sur les e-mails reçus, dont l'adresse est nettoyée avant.

  Essai interne du 2 novembre 2026 (`tutelliv-dev`, deux entreprises de test, réception et modèle simulés, script non conservé, données supprimées et vérifiées) : 62 contrôles, 57 réussis, les 5 échecs correspondent aux défauts 4 à 6. Exercés pour la première fois sur PostgreSQL réel : verrou du quota d'analyse (12 analyses simultanées à 55/60 : 5 passent, 60 en base) ; verrou de création (5 créations même clé : 1 commande ; deux clients en même temps : 1 commande et des refus nets) ; rapprochement par téléphone (autres formats, numéro partagé, compte suspendu). Aussi réussis : expéditeur connu reconnu, autre entreprise et équipe non reconnues, formes d'adresse de réception, webhook rejoué 10 fois en même temps (1 ligne, 1 tâche), panne de Resend puis reprise, message de 20 000 caractères coupé à 8 000, HTML nettoyé, plafond de 200 hors simultanéité, conservation 30 jours, panne et réponse invalide du modèle (« À lire », texte gardé), isolation entre entreprises, pas de résurrection après classement. Limite : 70 analyses simultanées sur 5 connexions échouent par manque de connexions (44 sur 70), charge jugée irréaliste ; non testé sur Vercel.

  Résultat de l'essai réel : e-mails reçus et analysés en moins de 20 s, 11 analyses sur 11 réussies, environ 3 170 jetons en entrée et 910 en sortie par analyse. E-mail complet : adresses, contact, date et quantité justes, puis vraie commande créée (source ADMIN, assignée), un seul exemplaire malgré le double clic, e-mail retiré de la liste. Message court ou incomplet : champs signalés, création refusée. Deux livraisons : une commande par livraison, e-mail gardé tant qu'il en manque une ; reprise après rechargement sans doublon ; reprise avec un autre client refusée. Tentative d'injection : aucune consigne reprise, aucune commande. Pièce jointe signalée et non lue. Webhooks sans signature ou mal signés refusés (400). Adresse inconnue, adresse remplacée et réception désactivée : rien d'enregistré (11 lignes en base pour 11 e-mails attendus). Contenu vidé en base au classement et à la conversion. Captures locales : `outputs/recette-agents/mail-commande/`.

  Non vérifié : vrai e-mail d'un expéditeur reconnu (service testé sur vraie base, sans vrai e-mail) ; pièce jointe lourde réelle ; volume réel chez Resend et sur Vercel ; vrais messages de clients (INTAKE-1, F10 non qualifiée). Écart de méthode : un nettoyage trop large a visé aussi des commandes de démo de la session, refusé pour celles affichées ; la session isolée a ensuite été libérée à la déconnexion, sans effet durable. 14 e-mails de test restent dans « Envoyés » du Gmail du propriétaire.

  **Corrections du 3 novembre 2026 (commit `cfe97c0`, poussé sur `preproduction`, déploiement prêt sur `tutelliv.fr`).**
  - Défaut 2 : chaque livraison porte ses propres colis (`deliveries[].packages`, schéma de sortie et consigne du modèle) ; à défaut, les colis communs s'appliquent. Quantité absente signalée sur sa livraison (`deliveries.1.quantity`), plus de 1 silencieux. Anciens brouillons gardés sans colis propres toujours lisibles.
  - Défaut 4 : `dbSafeText` retire le caractère nul et remplace les moitiés d'émoji, après la coupe (qui pouvait elle-même couper un émoji), pour l'expéditeur, l'objet et le texte.
  - Défaut 5 : recompte du plafond de 200 sous verrou par entreprise (`pg_advisory_xact_lock`) dans la transaction d'écriture, attente du verrou jusqu'à 10 s.
  - Défaut 6 : `parseSender` accepte « Nom <adresse> ».
  - En passant : icône ⚠/✓ affichée deux fois dans trois alertes (brouillon et formulaire de commande public), le composant `Alert` met déjà la sienne.
  - Vérifié : tests unitaires ajoutés (quantités par livraison, quantité absente ou inventée, ancien brouillon, « Nom <adresse> », caractères invalides) ; `npm run check` vert (1 547 tests, 0 échec). Essai sur `tutelliv-dev` (entreprise de test créée puis supprimée, 0 reste) : e-mail avec caractère nul et émoji coupé enregistré et nettoyé ; à 199/200, 8 e-mails simultanés → 1 accepté, 7 refusés, 200 en base, le suivant refusé (6/6). Premier essai sans délai d'attente : refus Prisma P2028, d'où l'attente de 10 s. E2E navigateur en worktree isolé : nouveau parcours à deux livraisons (1 palette, quantité absente signalée sur la seconde seulement, saisies gardées par onglet) et parcours existant « double clic », tous deux réussis ; capture locale `outputs/recette-agents/mail-ecarts/deux-livraisons.png`.
  - Non vérifié : le vrai modèle remplit-il `deliveries[].packages` ? Pas de clé Anthropic en local, essai possible seulement en ligne après poussée. Retrait des icônes en double non revu au navigateur (contrôle par `npm run check`).
  - Essai en ligne bloqué le 3 novembre : l'e-mail « 1 palette / 3 colis » envoyé depuis le Gmail du propriétaire est parti vers l'ancienne adresse de démo (`a6cd…`, remplacée pendant l'essai du 2 novembre) et a été ignoré comme prévu, rien d'enregistré. L'entreprise de démo « LogiExpress Démo — environnement 1 » (base de préproduction) a une nouvelle adresse, mais sa réception est désactivée. L'activer directement en base a été refusé par l'outil de sécurité ; Chrome n'était pas connecté pour le faire par l'écran.
  - Suite : dès que Chrome est ouvert (ou la réception activée dans Paramètres de l'espace de démo), Claude active la réception, envoie l'e-mail à la nouvelle adresse, contrôle le brouillon (1 palette sur la livraison 1, 3 colis sur la livraison 2), désactive la réception et clôt.

  **Modèle conseillé : Claude Opus · effort moyen.**

- [ ] **PROPRIO-2810 — Actions du propriétaire avant mise en ligne.**

  **Qui : Toi.**

  Constat du 2 novembre 2026 : faits, migrations de préproduction, relais GitHub avec ses secrets, Node 22, `CONTACT_HMAC_SECRET`, clé Anthropic, Mustang, choix de la plateforme, note sur `J5_AUDIT_FACTUEL_DEV.md`. Reste : Supabase Pro, fiche F10, promotion en production.

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
