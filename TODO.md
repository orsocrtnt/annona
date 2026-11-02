# TODO TutelLiv — du produit existant au SaaS vendable


<!-- TODO_PROGRESS_START -->
## Progression globale

**93 tâches terminées sur 122 — 76 %**

`███████████████░░░░░` · 29 tâches restantes

**À faire par Claude**

- AUDIT-0111 — Corrections de l'audit complet du 1er novembre 2026 avant le premier pilote
- FACT-KM — Faire correspondre le prix annoncé et le prix facturé d'une course
- FACT-AUTO-VIDE — Prévenir quand la facture automatique ne peut pas partir
- ANALYSE-ENCAISSE — Corriger le pourcentage encaissé de la page Analyse
- MOTS-UNIFIES — Employer les mêmes mots partout à l'écran
- V1-GO — Valider la V1 prête à être essayée (après les essais téléphone et le juriste)
- DATA-02 — Prévoir sortie, export et conservation des données (après le juriste)
- PROD-04 — Définir les mesures de valeur (après les pilotes)
- SAAS-03 — Permettre la gestion autonome de l'abonnement (après le juriste)
- SAAS-02 — Mesurer le revenu et la santé du SaaS (après les pilotes)
- COST-1 — Simuler les coûts d'exploitation et la marge contributive (après les pilotes)
- GROWTH-1 — Construire le site commercial relié au parcours autonome (après le juriste)
- LEGAL-LIENS — Rendre accessibles les mentions légales et la politique de confidentialité depuis le site public (après le juriste)
- DISPATCH-5 — Imprévus et mesure du dispatch (après les pilotes)
- RELEASE-1 — Réaliser la recette de mise en vente (en dernier, avant la mise en vente)
- SMS — Ajouter seulement les extensions justifiées (seulement si les pilotes le demandent)

**À faire par toi**

- SEC-AUDIT — Durcissement du 28 octobre et correctifs de l'audit Codex
- POD-2 — Preuve de livraison complète : signature, PDF, envoi et relevés
- MOB-01C — Réaliser les essais iPhone et Android
- OPS-FIAB — Fiabiliser les tâches de fond et l'exploitation
- FACTURX-1 — Factur-X EN 16931 des factures de livraison
- LEGAL-1 — Préparer le dossier contractuel et données personnelles
- PROD-02 — Documenter le travail actuel et sa difficulté principale
- INTAKE-1 — Commande par message IA (coller un message)
- PROPRIO-2810 — Actions du propriétaire avant mise en ligne
- ONBOARD-1 — Guider jusqu’à la première livraison (pendant les pilotes)
- OFFER-1 — Valider la grille cible et l'offre pilote (pendant les entretiens et les pilotes)
- PILOT-1 — Recruter et conduire trois pilotes accompagnés (après les entretiens)
- PILOT-2 — Décider avec les preuves des pilotes (après les pilotes)

_Chaque tâche est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->

## Ce qu'il reste vraiment à faire (vue simple, à jour au 1er novembre 2026)

_Lire ce bloc en premier. Tout le reste du fichier est le détail. Un agent le met à jour à chaque fin de tâche (simples tirets ici : seules les cases des tâches comptent dans la jauge)._

**1. Toi (le 30 octobre, Claude a fait le reste de ta liste : voir PROPRIO-2810)**
- Cette semaine, le plus important (audit du 1er novembre, PDF dans `outputs/audit-2026-11-01/`) : contacter des sociétés de livraison et tenir dix entretiens (PROD-02) ; le plan complet, les textes et la liste d'entreprises sont prêts (`docs/operations/prospection/README.md`). Chaque jour à partir du 2 novembre : trouver les coordonnées, écrire et appeler de 8 h à 11 h à New York (14 h à 17 h en France).
- Avant le premier message du démarchage : créer une vraie boîte mail, par exemple `orso@tutelliv.fr` (les mails actuels partent de `no-reply@`, une réponse serait perdue).
- Lundi 2 novembre, avant le premier message : demander ton SIREN sur le Guichet unique (pas encore de numéro, confirmé le 1er novembre). D'ici là, le démarchage se limite aux entretiens de recherche : aucun prix ni offre de pilote.
- Étude de marché (`outputs/reports/Marché TutelLiv livraison B2B France.md`, environ 840 entreprises visées, hypothèse à mesurer) : trier la liste de prospects (107 lignes sur 282 ont le bon profil), obtenir 50 réponses tirées au hasard sur la part de clients directs, demander un devis à GTLYS et à Toncarton.
- Donner ton accord pour créer une vraie production (AUDIT-0111, point E2) : tutelliv.fr tourne aujourd'hui sur une préversion.
- Plus tard : juriste, en choisir un (aucun contact juriste trouvé dans le Gmail le 30 octobre) ; le brouillon et le zip sont prêts.
- Plateforme Factur-X : ouvrir le compte Super PDP au nom de la société quand elle existe (choix fait par Claude le 30 octobre, carte blanche : compte gratuit jusqu'à 1 000 factures par mois, API publique, pas de devis nécessaire).
- Plus tard : trouver un téléphone Android (essais MOB-01C).
- Plus tard : passer Supabase en Pro (environ 25 $/mois) avant les vraies données, pour la protection contre les mots de passe compromis.
- INTAKE-1 : fournir une vingtaine de vrais messages de commande anonymisés pour mesurer la qualité d'extraction et le coût ; décider si la fonction entre dans le portail client.
- Si tu relances un jour l'ancien projet Supabase `wlomrzil…` (en pause, plus utilisé) : change d'abord son mot de passe, exposé le 26 octobre.

**2. Claude — peut le faire seul, dans cet ordre**
- Commandes récurrentes en panne sur tutelliv.fr : rien ne les déclenche sur le site, 10 sur 23 (données de test) étaient en retard le 1er novembre (AUDIT-0111, point E1). Corrigé en local (`86fb1bd`), reste à publier et à vérifier en ligne.
- Faille sur les comptes invités : une inscription permettait de prendre un compte invité (AUDIT-0111, point S1). Corrigé en local (`86fb1bd`), reste à publier et à vérifier en ligne avant le premier pilote.
- Démarchage : débloquer la place de démo numéro 1, refusé le 1er novembre par le contrôle de sécurité de l'outil ; à refaire si le propriétaire l'autorise. Empêcher qu'une preuve ajoutée en démo bloque une place. Les liens restants vers l'inscription (accueil, pied de page, Fonctionnalités, Démonstration) suivent S2 d'AUDIT-0111.
- AUDIT-0111 : les corrections avant pilote, dans l'ordre de la tâche (commandes récurrentes en panne sur tutelliv.fr, compte invité, raccourcis de test, changements d'état, double commande, lecture seule, démo, numéros de facture, dispatch, limites de tentatives, contrôle automatique sur base, TODO réduite). Aucune nouvelle fonction d'ici là.
- Écarts trouvés en écrivant les vidéos de formation : prix annoncé et prix facturé d'une course (FACT-KM), facture automatique qui échoue sans prévenir (FACT-AUTO-VIDE), pourcentage encaissé faux (ANALYSE-ENCAISSE), mots différents à l'écran (MOTS-UNIFIES, avis du juriste pour « Relevé » et « Facture » seulement).

**3. En attente de quelqu'un d'autre** (rien à faire tant que ça n'arrive pas)
- Juriste : LEGAL-1, LEGAL-LIENS, DATA-02, et la fiche F10 d'INTAKE-1 (obligatoire avant tout vrai message de client).
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

  **Qui : Claude — après les essais téléphone et le juriste.**

  Terminé quand : Parcours complet validé avec preuves ; aucun défaut bloquant connu sur ce parcours ; limites documentées ; fonctions non qualifiées explicitement hors promesse. Ce jalon ne vaut ni validation commerciale ni autorisation de production.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section V1-GO.

- [ ] **FACTURX-1 — Factur-X EN 16931 des factures de livraison.**

  **Qui : Toi.**

  Terminé quand : validation officielle (XSD et Schematron : Mustang ou validateur FNFE) passée sur des factures fictives de recette ; décision prise sur le PDF/A-3b strict (police embarquée) ; traitement BT-32 de la franchise en base confirmé ; recette navigateur des écrans administrateur et portail ; choix d'une plateforme agréée tracé (FACTURX-2 si retenu).

  Détail et historique : `docs/TODO-ARCHIVE.md`, section FACTURX-1.

- [ ] **LEGAL-1 — Préparer le dossier contractuel et données personnelles.**

  **Qui : Toi.**

  Terminé quand : Documents validés et cohérents avec le service réel ; responsabilités et support explicités.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section LEGAL-1.

- [ ] **DATA-02 — Prévoir sortie, export et conservation des données.**

  **Qui : Claude — après le juriste.**

  Terminé quand : Export exploitable et test de suppression sur fixtures ; aucun effet sur une autre entreprise ; politique appliquée au stockage et sauvegardes.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section DATA-02.

- [ ] **PROD-02 — Documenter le travail actuel et sa difficulté principale.**

  **Qui : Toi.**

  Terminé quand : Synthèse des problèmes récurrents, fréquence, coût et outils actuels ; sélectionner un problème prioritaire avec preuves.

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

  **Qui : Claude — après le juriste.**

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

  **Qui : Claude — après le juriste.**

  Terminé quand : un prospect comprend pour qui est le produit, le problème résolu, les trois espaces, le prix HT/TTC indicatif, options et dépassements, la différence démo/pilote/découverte premium et la prochaine étape ; navigation responsive et accessible ; contenu cohérent avec le catalogue actif ; formulaires protégés contre abus ; pages légales publiées seulement après validation.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section GROWTH-1.

- [ ] **LEGAL-LIENS — Rendre accessibles les mentions légales et la politique de confidentialité depuis le site public.**

  **Qui : Claude — après le juriste.**

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

  **Qui : Claude.**

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

- [ ] **FACT-KM — Faire correspondre le prix annoncé et le prix facturé d'une course.** Écart relevé le 1er novembre 2026 en écrivant les vidéos de formation ; le propriétaire demande de le régler. « Tarification des courses » (forfait, prix au km, minimum, majorations) ne sert qu'à l'estimation montrée au client (`courier-estimate.service.ts`). La facture se calcule sur les zones, les suppléments, les achats et les lignes libres (`invoice.service.ts`, `order-invoice-form.tsx` : aucune référence au tarif des courses). Un client peut donc être facturé autrement que ce qu'on lui a annoncé.

  **Qui : Claude.**

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé (montants facturés).**

  À trancher en début de tâche : préremplir la facture d'une course avec le calcul de l'estimation, ou réserver une seule méthode de prix par entreprise. Recommandation : préremplir, en laissant l'entreprise corriger avant d'enregistrer. Rester honnête sur la distance « environ » déjà retenue.

  Terminé quand : pour une même course, estimation et facture partent du même calcul, à la main comme à la livraison, ou l'écran explique clairement la différence ; factures déjà émises inchangées ; tests des montants, `npm run check` vert et clic réel navigateur.

  Source / dépendance / blocage : aucun blocage. Refaire ensuite le plan 4 de la vidéo E5 (`outputs/videos-formation/scenarios/`).

- [ ] **FACT-AUTO-VIDE — Prévenir quand la facture automatique ne peut pas partir.** Écart relevé le 1er novembre 2026 en écrivant les vidéos de formation ; le propriétaire demande de le régler. Avec « Émettre la facture à la livraison », une commande sans zone reconnue ni achat lève `DELIVERY_INVOICE_EMPTY` (`invoice.service.ts:238`), erreur définitive sans nouvel essai ; aucun écran de l'entreprise ne le signale. La livraison reste alors sans facture, sans que personne le sache.

  **Qui : Claude.**

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : l'entreprise voit, à un endroit qu'elle consulte déjà et dans ses mots, quelle commande n'a pas de facture, pourquoi, et peut l'émettre à la main ou ajouter la zone manquante ; le même contrôle couvre l'autre erreur définitive (`INVOICE_AMOUNT_TOO_LARGE`) ; tests du cas réel, `npm run check` vert et clic réel navigateur.

  Source / dépendance / blocage : aucun blocage. Adapter ensuite le plan 8 de la vidéo F1.

- [ ] **ANALYSE-ENCAISSE — Corriger le pourcentage encaissé de la page Analyse.** Écart relevé le 1er novembre 2026 en écrivant les vidéos de formation ; le propriétaire demande de le régler. `analytics.service.ts:123-128` compte « Encaissé » (payées) et « En attente » (en attente, brouillons), sans les factures en retard ; celles-ci et les annulées comptent pourtant dans « Facturé ». Le pourcentage part de `collectedShare(encaissé, en attente)` : il oublie les retards et paraît donc meilleur que la réalité. Les brouillons, eux, n'ont pas encore été facturés au client.

  **Qui : Claude.**

  **Modèle conseillé : GPT‑6 Luna · effort moyen.**

  Terminé quand : retards affichés à part ; annulées et brouillons traités selon une règle écrite ; « Encaissé + En attente + En retard » égale le total affiché ; le pourcentage se calcule sur ce total ; test avec une facture de chaque statut, `npm run check` vert et clic réel navigateur.

  Source / dépendance / blocage : aucun blocage. Rendre ensuite visible la carte « Encaissement » dans la vidéo F3.

- [ ] **MOTS-UNIFIES — Employer les mêmes mots partout à l'écran.** Écart relevé le 1er novembre 2026 en écrivant les vidéos de formation ; le propriétaire demande de le régler. Mélanges constatés : « Chauffeur » et « Livreur » ; « Relevé » et « Facture » ; « Équipe » pour « Gestion des comptes » ; « Nouvel utilisateur » pour « Inviter un utilisateur » ; « Analytics avancés » et « Statistiques avancées » ; « Support prioritaire » et « Assistance prioritaire » ; « Dispatch automatique » et « Dispatch intelligent ».

  **Qui : Claude.**

  **Modèle conseillé : GPT‑6 Luna · effort moyen.**

  À trancher : recommandation « Livreur » partout, sauf le code interne. « Relevé » a été choisi exprès parce que le document n'est pas une facture électronique réglementaire : ne pas le remplacer par « Facture » sans avis du juriste (LEGAL-1), en lien avec le point C2 d'AUDIT-0111. Le reste peut avancer sans attendre.

  Terminé quand : un seul mot par notion dans les écrans, e-mails et PDF des trois espaces ; recherche de chaque ancien mot sans résultat visible par l'utilisateur ; tests à jour, `npm run check` vert et clic réel navigateur.

  Source / dépendance / blocage : juriste pour « Relevé » et « Facture » seulement. À faire avant de capturer les écrans des vidéos de formation.

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
