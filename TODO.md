# TODO TutelLiv — du produit existant au SaaS vendable


<!-- TODO_PROGRESS_START -->
## Progression globale

**101 tâches terminées sur 131 — 77 %**

`███████████████░░░░░` · 30 tâches restantes

**À faire par Claude**

- AUDIT-0411 — Corriger ce que les pilotes remarqueraient (audit de bout en bout du 4 novembre 2026)
- V1-GO — Valider la V1 prête à être essayée (après les essais téléphone et la vérification de conformité)
- DATA-02 — Prévoir sortie, export et conservation des données (après la vérification de conformité)
- PROD-04 — Définir les mesures de valeur (après les pilotes)
- SAAS-03 — Permettre la gestion autonome de l'abonnement (après la vérification de conformité)
- SAAS-02 — Mesurer le revenu et la santé du SaaS (après les pilotes)
- COST-1 — Simuler les coûts d'exploitation et la marge contributive (après les pilotes)
- GROWTH-1 — Construire le site commercial relié au parcours autonome (après la vérification de conformité)
- DISPATCH-5 — Imprévus et mesure du dispatch (après les pilotes)
- MOTS-UNIFIES — Employer les mêmes mots partout à l'écran (après la vérification de conformité)
- RELEASE-1 — Réaliser la recette de mise en vente (en dernier, avant la mise en vente)
- SMS — Ajouter seulement les extensions justifiées (seulement si les pilotes le demandent)

**À faire par toi**

- SEC-AUDIT — Durcissement du 28 octobre et correctifs de l'audit Codex
- POD-2 — Preuve de livraison complète : signature, PDF, envoi et relevés
- MOB-01C — Réaliser les essais iPhone et Android
- FACTURX-1 — Factur-X EN 16931 des factures de livraison
- PROD-02 — Documenter le travail actuel et sa difficulté principale
- INTAKE-1 — Commande par message IA (coller un message)
- AUDIT-0111 — Corrections de l'audit complet du 1er novembre 2026 avant le premier pilote
- PROPRIO-2810 — Actions du propriétaire avant mise en ligne
- DEMO-REFONTE — Rendre la démonstration claire (une journée lisible, remise à l'heure, liste « À essayer ») (relire le document de conception, puis Claude)
- ONBOARD-1 — Guider jusqu’à la première livraison (pendant les pilotes)
- OPS-FIAB — Fiabiliser les tâches de fond et l'exploitation (une commande, puis Claude)
- LEGAL-1 — Vérifier le respect des exigences applicables et préparer les documents (fournir les pièces et décider, puis Claude)
- OFFER-1 — Valider la grille cible et l'offre pilote (pendant les entretiens et les pilotes)
- PILOT-1 — Recruter et conduire trois pilotes accompagnés (après les entretiens)
- PILOT-2 — Décider avec les preuves des pilotes (après les pilotes)
- LEGAL-LIENS — Rendre accessibles les mentions légales et la politique de confidentialité depuis le site public (SIREN, e-mail, téléphone ; puis Claude)
- MAIL-PONT — Relier la boîte de commandes de l'entreprise à TutelLiv (régler `NEXT_PUBLIC_APP_URL` sur `https://tutelliv.fr` (Vercel, Preview `preproduction`) et retirer le filtre Gmail d'essai ; Outlook plus tard (décidé le 4 novembre) ; ensuite Claude)
- WHATSAPP-1 — Recevoir les commandes WhatsApp sans copier-coller (après le SIREN : compte Meta Business, numéro dédié, variables Vercel ; ensuite Claude)

_Chaque tâche est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->

## Ce qu'il reste vraiment à faire (vue simple, à jour au 5 novembre 2026)

_Lire ce bloc en premier. Tout le reste du fichier est le détail. Un agent le met à jour à chaque fin de tâche (simples tirets ici : seules les cases des tâches comptent dans la jauge)._

**1. Toi (le 30 octobre, Claude a fait le reste de ta liste : voir PROPRIO-2810)**
- Compte super admin (5 novembre, à ta demande) : son e-mail est passé de `orsocarotenuto@tutelliv.fr` (sans boîte mail) à `orso@tutelliv.fr` dans la base de préproduction (connexion Supabase, identité et fiche TutelLiv, vérifiés). À faire : https://tutelliv.fr/login → « Mot de passe oublié » → `orso@tutelliv.fr`, puis connexion sur `/admin`.
- DEMO-REFONTE (5 novembre) : relire le document de conception de la nouvelle démo (`docs/superpowers/specs/2026-11-05-refonte-demo-design.md`) et dire « ok » ou ce qu'il faut changer.
- Site public (5 novembre) : Démonstration retirée, Fonctionnalités mise à jour, Tarifs remplacée par une page « TutelLiv arrive bientôt » avec liste d'attente (détail dans GROWTH-1). Les inscriptions arrivent dans `/admin/contact`, marquées « Liste d'attente ». Rien à faire ; poussé sur `preproduction`.
- OPS-FIAB (4 novembre) : push et migration faits par Claude (déploiement prêt, sonde toujours saine). Reste une commande, refusée à l'agent : `sh scripts/ops03b/copy-alert-email.sh` (doit afficher `"stored":true`). Dis-moi quand c'est fait : je teste l'e-mail.
- Le 3 novembre, règles d'autorisation ajoutées à ta demande (`.claude/settings.local.json`, non versionné) : migration de préproduction, variable `DRIVE_ROUTE_IGN_URL`, push et copie du secret du relais faits par Claude.
- Avant le premier pilote : faire confirmer par un comptable le mot « Facture » à l'écran pour un document sans toutes les mentions légales (le PDF classique reste « Relevé de prestation »).
- Cette semaine, le plus important (audit du 1er novembre, PDF dans `outputs/audit-2026-11-01/`) : contacter des sociétés de livraison et tenir dix entretiens (PROD-02) ; le plan complet, les textes, la liste d'entreprises et le pitch avec déroulé de démonstration sont prêts (`docs/operations/prospection/README.md`, `docs/operations/prospection/PITCH.md`). Liste à appeler : fichier Drive « TutelLiv_Suivi_Prospection_2026 », onglets PARIS (214 entreprises) et MARSEILLE (123 entreprises, Marseille, Bouches-du-Rhône et Toulon), avec téléphone ou e-mail, refaits le 4 novembre. Chaque jour à partir du 2 novembre : trouver les coordonnées, écrire et appeler de 8 h à 11 h à New York (14 h à 17 h en France).
- Boîtes mail (4 novembre) : `orso@tutelliv.fr` créée chez OVH (Zimbra Starter, organisation TutelLiv ; tutelliv.fr et tutelliv.com ajoutés en configuration DNS recommandée, enregistrements Resend relus et inchangés). La facture du 29 octobre ne compte que 2 boîtes au total (une offerte par domaine, 3,60 € HT par an chacune) : il reste 1 place (prévue pour `ugo.macaluso@tutelliv.com`) ; `marie.frey@tutelliv.com` demande une boîte de plus à commander (bouton « Commander » de Zimbra). Réponses aux e-mails de TutelLiv vers `orso@tutelliv.fr` : terminé le 4 novembre (MAIL-REPONSE). Comptes d'Ugo et Marie en pause à ta demande ; ensuite Claude prépare les comptes (mots de passe tapés par toi) et donne les réglages Outlook/Gmail.
- Supports des commerciaux (4 novembre, sans prix) : `outputs/commercial/kit/TutelLiv-antiseche-commercial.pdf` (3 pages : l'appel en 5 étapes avec les phrases à dire, quel statut mettre dans le tableau, réponses aux objections et « ne jamais ») et `outputs/commercial/kit/TutelLiv-plaquette-client.pdf` (2 pages, à donner au dirigeant ; cases « Votre contact / Téléphone » à remplir). Sources HTML à côté, PDF refaits par `node outputs/commercial/kit/simple-pdf.cjs` (0 débordement, 0 image cassée, rendu relu en capture). Rangés dans le Drive : Commercial > « Supports pour les commerciaux » (2 PDF, 498 Ko et 3,3 Mo, vérifiés dans la page du dossier). Antisèche complétée le même jour : c’est Orso qui mène les rendez-vous (créneaux lundi-vendredi 14 h-17 h, heure française), le commercial le prévient par mail à orso@tutelliv.fr. Catalogue avec prix laissé dans Commercial : partager aux commerciaux seulement « Supports pour les commerciaux » et le tableau de suivi (droit de modification). Restent à toi : leur contrat (J7 encore en brouillon) et leur adresse mail ; dire si le ton te va. Drive rangé le même jour : 75 éléments à la corbeille (doublons, archives V1, copies obsolètes), « Identité visuelle » gardée.
- OFFER-1 (4 novembre) : option « Réception automatique des commandes » en place (29 € en Starter, incluse Pro et Business). Push et migration C11 faits par Claude le 4 novembre au soir (déploiement prêt ; `https://tutelliv.fr/tarifs` affiche l'option). Reste à toi (Drive refusé à l'agent) : remplacer le catalogue avec prix du Drive (Commercial) par `outputs/commercial/kit/TutelLiv-kit-commercial.pdf` (Drive refusé à l'agent). Le worktree `outputs/recette-wt` d'une autre session fait échouer `npm run typecheck` : le supprimer quand cette session a fini.
- Lundi 2 novembre, avant le premier message : demander ton SIREN sur le Guichet unique (pas encore de numéro, confirmé le 1er novembre). D'ici là, le démarchage se limite aux entretiens de recherche : aucun prix ni offre de pilote.
- Étude de marché (`outputs/reports/Marché TutelLiv livraison B2B France.md`, environ 840 entreprises visées, hypothèse à mesurer) : trier la liste de prospects (107 lignes sur 282 ont le bon profil), obtenir 50 réponses tirées au hasard sur la part de clients directs, demander un devis à GTLYS et à Toncarton.
- Avant le premier pilote ou la première vente (décidé le 2 novembre) : passer Vercel en Pro et créer la vraie production (AUDIT-0111, point E2).
- Plateforme Factur-X : ouvrir le compte Super PDP au nom de la société quand elle existe (choix fait par Claude le 30 octobre, carte blanche : compte gratuit jusqu'à 1 000 factures par mois, API publique, pas de devis nécessaire).
- Avant le dépôt au Guichet unique : vérifier la reprise de ton ancien SIREN, et ta capacité à exercer depuis les États-Unis sous visa J-1 avec ta résidence fiscale (checklist J5, non tranché).
- LEGAL-1 (sections 4 et 6 de `docs/legal/VERIFICATION_2026-11-02.md`) : fournir SIREN, e-mail et téléphone, décider des durées de conservation et des clauses des CGV (plafond de responsabilité, préavis). Confirmer aussi la durée provisoire de sept jours pour la file hors ligne du livreur, et, si un pilote emploie des livreurs indépendants payés à la livraison, faire qualifier l'affectation automatique (`docs/legal/AIPD_TYPE.md`, section 3).
- Plus tard : trouver un téléphone Android (essais MOB-01C).
- Plus tard : passer Supabase en Pro (environ 25 $/mois) avant les vraies données, pour la protection contre les mots de passe compromis.
- MAIL-PONT : essai Gmail réussi le 4 novembre. À faire : dans Vercel, mettre `NEXT_PUBLIC_APP_URL` = `https://tutelliv.fr` pour Preview `preproduction` (les liens de suivi des e-mails pointent vers l'adresse `…vercel.app`), puis redéployer (contrôlé par Claude le 4 novembre : `https://tutelliv.fr/reset-password` est déjà autorisé dans Supabase, donc le changement ne casse pas « mot de passe oublié » ; modification refusée à l'agent par l'outil de sécurité) ; supprimer le filtre Gmail d'essai (Paramètres > Filtres) ; fournir une boîte Outlook pour l'essai Outlook.
- WHATSAPP-1 : option A codée (le dispatcher transfère le message au numéro TutelLiv). Dès le SIREN : créer le compte Meta Business au nom de la société et lancer sa vérification, prévoir une ligne dédiée jamais utilisée sur WhatsApp, puis me donner accès pour créer l'application Meta ; tu poseras ensuite dans Vercel `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_DISPLAY_NUMBER`. En même temps : demander à Meta le statut de prestataire technique pour l'option B.
- INTAKE-1 : fournir une vingtaine de vrais messages de commande anonymisés pour mesurer la qualité d'extraction et le coût ; décider si la fonction entre dans le portail client.
- Si tu relances un jour l'ancien projet Supabase `wlomrzil…` (en pause, plus utilisé) : change d'abord son mot de passe, exposé le 26 octobre.

**2. Claude — peut le faire seul, dans cet ordre**
- AUDIT-0411 : corrections en ligne depuis le 5 novembre, vérifiées dans Chrome sur tutelliv.fr. Suite : session de démo expirée (ton nom visible dans la démo), date prévue vide côté client, puis le reste de la liste (statuts uniformes, téléphone du livreur, recherche du client, données de démo, console interne, mineurs).
- LEGAL-1, écarts qui ne dépendent pas de toi : mise à jour des textes J5 une fois tes décisions prises (sur Drive : à reprendre dans le dépôt, Drive non modifié). Première vérification faite le 2 novembre (`docs/legal/VERIFICATION_2026-11-02.md`), aucune conformité déclarée.
- OPS-FIAB : dès tes trois commandes lancées, déclencher une panne fictive et vérifier l'e-mail d'alerte dans Gmail, puis l'alerte d'une tâche de fond en retard.
- MAIL-PONT : essai Outlook plus tard, quand tu le décides ; puis, si tu le veux, les fiches dans la page « Clients ».

**3. En attente de quelqu'un d'autre** (rien à faire tant que ça n'arrive pas)
- Propriétaire et fournisseurs : fournir les justificatifs, contrats et décisions manquants pour la vérification LEGAL-1, DATA-02 et la fiche F10 d’INTAKE-1 avant les données réelles. LEGAL-LIENS suit la vérification des documents.
- Pilotes (ils attendent les entretiens du point 1, qui ne dépendent que de toi pour démarrer) : PILOT-1 et 2, PROD-04, OFFER-1, V1-GO, ONBOARD-1, DISPATCH-5 (mesure).
- Mesures et mise en vente : SAAS-02, SAAS-03, COST-1, RELEASE-1, SMS, GROWTH-1.

**Déjà fait côté agent, la case attend une action du point 1 :** SEC-AUDIT (protection des mots de passe : Supabase Pro), POD-2, OPS-FIAB (alertes, cadence), INTAKE-1 (vingt vrais messages), FACTURX-1 (franchise à confirmer par la plateforme), MOB-01C.

Mise à jour : 29 octobre 2026, en fin de journée (revue de cohérence : matrice réalignée sur les cases ; LANDING-3, MAP-UNIFY-2, MAP-INTERACTION, E2E-MAJ, ICONES-IA et CONFIG-MSG-2 closes). Version précédente du même jour : bilan de l'intégration du 28 octobre (neuf chantiers ; voir DEMO-3, DESIGN-1, FACTURX-1, INTAKE-1, POD-2, OPS-FIAB, SEC-AUDIT, RECETTE-2810 et PROPRIO-2810). Précédente : 26 octobre 2026 (revue de cohérence : tableaux de pilotage, priorités et matrice réalignés sur le code). Source unique des priorités du projet. Cette version consolide l’audit initial, l’audit SaaS autonome, les sondes locales et les tests E2E. La copie dans les outputs de la tâche doit rester synchronisée avec ce fichier.

## Tâches ouvertes

_Tâches closes, anciens tableaux et journal : `docs/TODO-ARCHIVE.md`._

- [ ] **AUDIT-0411 — Corriger ce que les pilotes remarqueraient (audit de bout en bout du 4 novembre 2026).** Demande du propriétaire : utiliser TutelLiv comme un utilisateur et tout regarder, pour que les pilotes n'aient rien à redire sur l'existant. Rapport : `docs/rapports/2026-11-04/audit-bout-en-bout-pilotes.md` ; preuves locales `outputs/audit-2026-11-04/` (224 captures, parcours cliqués, journal des tests).

  **Qui : Claude.**

  **Modèle conseillé : GPT‑6 Astra · effort élevé (heures, adresses, compteurs : données métier).**

  Audit fait le 4 novembre : `preproduction` `31f4403` construit en production dans une copie isolée, base `tutelliv-dev` ; 224 écrans relevés (7 rôles, ordinateur et téléphone, clair et sombre), relus puis vérifiés à la main ; parcours cliqués commande → livreur (photo, signature) → preuve PDF → facture → support → réaffectation → suivi public ; 9 fichiers E2E : 21 réussis, 4 échoués (IA non branchée en local ×2, test V1 sans créneau, résidus de démo du 3 novembre), 5 ignorés.

  Corrigé le 4 novembre, feu vert du propriétaire (commit `1f89520` sur la branche `agent/audit-0411`, partie de `38d874f`, **non poussé**) :
  - Bloquants : heure de livraison stable à l'enregistrement et lue à l'heure de Paris, dates affichées à l'heure de Paris partout ; numéro de rue gardé avec un avertissement orange ; compteurs (minuit de Paris, livrées du jour, « En retard » unique, filtres de la carte, charge avec retards) ; page 404 française, avec messages pour les liens de suivi et de commande ; textes de développeur retirés de /tarifs et /demonstration ; suivi client cohérent.
  - Écarté : /register est déjà fermé proprement sur tutelliv.fr, seule la copie locale l'ouvrait.
  - Majeurs : annulation masquée sur une livraison terminée ; renvoi entre rôles expliqué par un message ; mentions internes reformulées et pluriels accordés ; marge pour la pastille Alertes ; fiche client sur téléphone ; « Commander à nouveau » ; en-têtes des commandes ; boutons désactivés lisibles en sombre ; livreur avec « Appeler le client » et « Échec de livraison » distinct ; premier champ en erreur ciblé ; PDF de preuve ; statuts de la console interne ; purge des e-mails reçus à la remise à zéro de la démo ; test E2E V1 avec créneau.
  - Vérifications : `npm run check` vert (1 594 tests, 7 nouveaux ou adaptés) ; build de production vert ; recette navigateur sur `tutelliv-dev` (Chrome), 27 contrôles OK, dont l'heure inchangée après enregistrement (22:59 Z → 22:59 Z) et la saisie de 10:30 enregistrée à 09:30 Z, captures relues dans `outputs/audit-2026-11-04/correctifs/` ; E2E `v1-operational`, `auth-role-pages` et `pod-proof` verts. `ux03-delivery` n'a pas pu se connecter : pool de démo local saturé (8 espaces loués, 3 en quarantaine, pas de recyclage en local) ; son seul changement (« À livrer avant le ») a été vérifié par la recette.
  - Données de dev : numéros fictifs 06 39 98 00 1x posés sur les 55 clients de démo. Comptes de rôle supprimés, serveur arrêté.

  Mis en ligne le 5 novembre 2026 (feu vert du propriétaire) : branche fusionnée sans conflit dans `preproduction`, `npm run check` vert après fusion (1 594 tests), push `38d874f..1f89520`, `ls-remote` = `1f89520`. Contrôle sur tutelliv.fr après déploiement (3 min 30) : page introuvable en français (« introuvable | TutelLiv », code 404), plus aucun texte de développeur sur /tarifs ni /demonstration. Non refait en ligne : écrans connectés (fiche livraison, tableau de bord), déjà recettés sur `tutelliv-dev` le 4 novembre.

  Recette Chrome sur tutelliv.fr le 5 novembre 2026 (démo publique) : OK — page introuvable et lien de suivi expiré en français ; /tarifs, /demonstration et /register sans texte de développeur ; tableau de bord avec un seul « En retard » (12 en haut et dans Aujourd'hui) ; fiche livraison 23:59 avant et après « Enregistrer » puis rechargement ; numéro de rue gardé (« 999 Avenue des Champs Élysées » avec l'avertissement orange) ; message « page réservée à un autre rôle » en vue Client ; aucune erreur dans la console. Non refait : annulation masquée sur une livraison livrée (aucune livraison livrée dans la démo).
  Nouveaux constats de cette recette : (a) un ancien onglet resté connecté à la démo ouvre un espace dont la session a expiré : « Réinitialiser la démo » échoue (409 « Session de démonstration absente ») et cet espace contient deux courses au nom d'Orso Carotenuto avec son adresse Gmail ; (b) côté client, « Mes commandes » affiche « — » dans Livraison prévue pour les 3 commandes, et l'accueil client « Prochaine livraison 01:11 hier » ; (c) nouvelle commande client : les deux listes « Adresse enregistrée » et « Créneau » n'ont toujours pas de libellé lié ; (d) restent visibles : « 0 action » sur l'accueil, « 3000 / mois » sans espace sur /tarifs, LIV-… et CMD-… pour la même livraison, statut « Attente ».

  Reste à faire, Claude :
  1. Constats (a) à (c) ci-dessus : session de démo expirée et données personnelles dans la démo, date prévue côté client, libellés des listes.
  2. Vérifier les 3 espaces de démo en quarantaine et la capacité du pool avant les appels de prospection.
  3. Statuts et références uniformes (LIV-… au dispatch contre CMD-… dans Commandes ; Attente / En attente / Sans livreur), avec MOTS-UNIFIES.
  4. Livreur sur téléphone : mission en cours et boutons plus haut que les quatre bandeaux.
  5. Choix du client avec recherche dans la nouvelle commande de l'administrateur, sans e-mail technique.
  6. Données de démo crédibles : heures de journée, peu de retards, sociétés clientes, e-mails lisibles.
  7. Console interne : tableau des souscriptions qui déborde, journal d'accès traduit, indicateurs contradictoires.
  8. Puis les mineurs du rapport : site public (trois styles, bouton Contact, « 0 action »), typographie, listes natives, menu actif, PDF de preuve (position GPS brute).

  Non testé : invitations et ajout de clients ou livreurs par l'écran, commandes récurrentes, analyse IA, WhatsApp, e-mails réels, vrais téléphones, vitesse des pages connectées en ligne.

- [ ] **DEMO-REFONTE — Rendre la démonstration claire (une journée lisible, remise à l'heure, liste « À essayer »).** Demande du propriétaire le 5 novembre 2026 : « les démos sont trop chargées », refonte en gardant la base.

  **Qui : Toi — relire le document de conception, puis Claude.**

  **Modèle conseillé : GPT‑6 Astra · effort élevé (données de démo, pool partagé, dates).**

  Décisions prises en questionnaire le 5 novembre : démo pour le commercial et pour le prospect seul ; une journée riche d'environ 15 éléments (4 livrées, 3 en route, 2 affectées, 2 sans livreur, 1 seul retard, 2 demain, 1 récurrente) ; clients entreprises ; remise à l'heure par décalage des dates au prêt de l'espace ; onglet expiré renvoyé vers /demonstration ; ménage de l'espace de base (dont les deux courses au nom du propriétaire) ; liste « À essayer » à 4 étapes dans la barre de démo. Cause relevée : les espaces sont remplis à la préparation (`demo-pool.service.ts:166`) puis prêtés sans remise à l'heure.

  Document : `docs/superpowers/specs/2026-11-05-refonte-demo-design.md` (non commité). Aucun code modifié. Suite : validation du document, plan de travail, puis réalisation par petites étapes testées.

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

  **Qui : Toi — une commande, puis Claude.**

  Terminé quand : le workflow GitHub planifié a réellement tourné sur la préproduction avec ses secrets ; `after()` est vérifié sur Vercel ; Node 22 est réglé sur Vercel ; la migration d'index est appliquée en préproduction (en production avec `CONCURRENTLY`) ; une tâche en retard déclenche une alerte reçue.

  Constat du 2 novembre 2026 : Node 22 réglé sur Vercel ; migration d'index appliquée ; workflow réellement lancé par GitHub, mais **toutes les 4 à 7 heures et non toutes les 5 minutes** (GitHub espace ces lancements) ; aucune variable `OPS_ALERT_WEBHOOK_URL` sur Vercel, donc une alerte ne part que dans les journaux. Reste : une cadence fiable, un canal d'alerte réel, le contrôle d'`after()` en ligne.

  Décisions et travaux du 2 novembre 2026 : relais par Supabase (tâche pg_cron `tutelliv-operations-relay`, pg_net activé, inactive tant que le secret `relay_cron_secret` manque ; copie du secret refusée par l'outil de sécurité, commande à lancer par le propriétaire). Alertes par e-mail : une par empreinte et par jour (`OPS_ALERT_RECIPIENT`, sinon `EMAIL_TEST_RECIPIENT`), tests ajoutés, `npm run check` vert. Non vérifié : relais réellement lancé, e-mail réellement reçu. Constat du 3 novembre (lecture seule, base de préproduction) : le secret `relay_cron_secret` est toujours absent du coffre ; la tâche `tutelliv-operations-relay` tourne toutes les 5 minutes mais à vide. Le 3 novembre au soir, à ta demande : la commande documentée ne pouvait pas marcher (Vercel ne rend pas les variables « sensibles », `[SENSITIVE]` écrit à la place ; le script de garde a refusé, rien stocké). Nouvelle commande `sh scripts/ops03b/copy-relay-secret.sh`, qui lit `.env.preproduction.local` : secret stocké (`stored: true`). Contrôlé : passage du relais de 23 h 10 UTC répondu 200 par `/api/cron/operations` (le secret correspond). Reste pour OPS-FIAB : la réception d'une vraie alerte et la sonde `ops_monitor` à rediriger vers un vrai e-mail. Écart trouvé : la sonde `ops_monitor` (toutes les 30 minutes) écrit encore vers un webhook temporaire de recette, donc une panne totale de Vercel ne prévient pas le propriétaire ; à rediriger vers un vrai e-mail.

  4 novembre 2026 : la sonde externe `ops_monitor` prévient maintenant par **e-mail**, envoyé par la base elle-même via Resend (une panne totale de Vercel reste signalée). Migration `20261104040000_ops_monitor_email_alerts` : canal e-mail prioritaire dès que trois secrets existent dans le coffre Supabase (`ops03b_resend_api_key`, `ops03b_alert_email_from`, `ops03b_alert_email_to`), sinon ancien webhook. Script de copie `sh scripts/ops03b/copy-alert-email.sh` (lit `.env.local` : clé Resend, `MAIL_FROM`, destinataire `OPS_ALERT_RECIPIENT` sinon `EMAIL_TEST_RECIPIENT`, aujourd'hui ton Gmail ; n'affiche rien, refuse toute autre base). Vérifié : test ajouté dans `tests/operations-health.test.ts` ; fonction compilée sur la préproduction dans une transaction annulée (rien gardé) ; lint et 1 587 tests verts ; `npm run typecheck` échoue seulement sur `outputs/recette-wt` (dossier d'une autre session, serveur encore actif, non touché). Refusé à l'agent par l'outil de sécurité : la copie des secrets dans le coffre. Non vérifié : e-mail réellement reçu (Gmail : aucune « Alerte TutelLiv » reçue à ce jour, ni de la sonde ni de l'appli).

  4 novembre au soir, à ta demande (« je te donne tous les accès ») : push et `prisma migrate deploy` faits par Claude ; déploiement `233b73f` prêt ; fonction e-mail présente en base ; passage de 21 h 30 UTC sain. Copie des secrets toujours refusée par l'outil de sécurité (« Secret-Store Writes »). Suite, **toi** : `sh scripts/ops03b/copy-alert-email.sh` (doit afficher `"stored":true`). Puis **Claude** : `select ops_monitor.run(true);` pour un e-mail « [Essai] », contrôle dans Gmail, e-mail de retour à la normale au passage suivant ; puis une tâche de fond en retard fictive (données E2E) pour l'alerte de l'appli.

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

  Textes J5 lus sur Drive le 2 novembre avec l'accord du propriétaire, en lecture seule ; écarts en section 6, rien de modifié sur Drive. Suite : les pièces et décisions de la section 4 du document. Écarts à traiter par Claude ensuite : purge et remise des données (DATA-02).

  3 novembre 2026, **itinéraires corrigés** (branche `agent/maps-ign`, commit local) : le navigateur n'appelle plus le démonstrateur OSRM public ; route serveur `/api/maps/route` (compte connecté, limite par compte) vers la Géoplateforme IGN ; CSP sans OSRM ; page Confidentialité, `SOUS_TRAITANTS.md` (F06) et `map-providers.md` mis à jour. Les noms de rue de l'IGN arrivent tronqués : écartés, consignes sans nom de rue. Vérifications : tests unitaires (lecture IGN et OSRM, serveur, client), `npm run check` 1 552/1 552, E2E `maps-route.spec.ts` avec vrai calcul IGN 1/1, clic réel Chrome sur la navigation du livreur de démo (guidage « Dans 130 m, Continuez », 4,4 km, 13 min ; deux calculs à 200 ; aucun appel OSRM). `DRIVE_ROUTE_IGN_URL` ajoutée sur Vercel (préproduction) le 3 novembre ; production à régler lors de la promotion. En ligne le 3 novembre (déploiement `35e0c6f` prêt) : `/api/maps/route` refuse sans connexion (401), OSRM absent de la CSP, page Confidentialité à jour, E2E `maps-route.spec.ts` lancé contre tutelliv.fr avec le livreur de démo : vrai calcul IGN 1/1. Non vérifié : téléphone réel ; tracé à l'écran vu dans le code de la page mais pas en capture ; usage commercial IGN à confirmer.

  3 novembre 2026, file hors ligne du livreur : chaque action est maintenant effacée de l'appareil au plus tard sept jours après sa création, tous comptes confondus (`purgeExpiredDriverActions` dans `src/features/driver/offline-action-queue.ts`, lancée à l'ouverture de l'application livreur ; une action en cours d'envoi n'est pas touchée). Durée provisoire, à confirmer par toi avec la section 4. Page Confidentialité et `docs/legal/VERIFICATION_2026-11-02.md` mis à jour. Vérifications : test ciblé `tests/driver-offline-actions.test.ts` + `tests/pod-signature.test.ts` 14/14 ; `npm run check` réussi (1 548 tests, types et lint). `npm run docs:verify` réussi (88 Markdown, aucun lien cassé). Non commité ni poussé : l'outil de sécurité a refusé le push, à faire sur demande. Non vérifié : purge sur un vrai téléphone (IndexedDB réel), à rejouer pendant MOB-01C ; phrase de la page Confidentialité non rouverte en navigateur (texte seul, types et lint verts).

  3 novembre 2026, analyse d'impact type et décision automatisée : `docs/legal/AIPD_TYPE.md` (trame pré-remplie avec les faits du code pour l'AIPD que chaque client fait ; analyse du Dispatch intelligent : pas d'évaluation de la personne, option désactivée par défaut, article 22 et directive (UE) 2024/2831 à qualifier si des indépendants payés à la livraison sont affectés automatiquement). Relié à l'index `docs/legal/README.md` et à la vérification. Non vérifié : portail client et suivi public non rejoués en navigateur pour ce document ; directive 2024/2831 non relue. Suite côté Claude : purge DATA-02 dès les durées décidées ; fournisseur de cartes ; textes J5 après tes décisions.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section LEGAL-1.

- [ ] **DATA-02 — Prévoir sortie, export et conservation des données.**

  **Qui : Claude — après la vérification de conformité.**

  Terminé quand : Export exploitable et test de suppression sur fixtures ; aucun effet sur une autre entreprise ; politique appliquée au stockage et sauvegardes.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section DATA-02.

- [ ] **PROD-02 — Documenter le travail actuel et sa difficulté principale.**

  **Qui : Toi.**

  Terminé quand : Synthèse des problèmes récurrents, fréquence, coût et outils actuels ; sélectionner un problème prioritaire avec preuves.

  Préparation du commit et de la publication le 1er novembre 2026 : pitch de prospection (10 secondes, 30 secondes, 2 minutes), choix des supports et déroulé de démonstration ajoutés dans `docs/operations/prospection/PITCH.md`, reliés aux deux index. Vérifications : `npm run check` réussi (1 518 tests, types et lint), `npm run docs:verify` réussi (86 Markdown, aucun lien cassé). Limites : démonstration réelle et PDF non recettés dans cette intervention documentaire ; fichiers `outputs/` exclus de la publication. Suite : mener les entretiens et consigner les preuves ; la tâche reste ouverte.

  Liste de prospection refaite le 4 novembre 2026 (demande du propriétaire : la liste locale n'avait presque aucune coordonnée). Constat : sur les 106 entreprises prioritaires du registre SIRENE, 2 seulement ont des coordonnées trouvables en ligne (micro-sociétés invisibles). Nouvelle source : Google Maps (Chrome du propriétaire), sites officiels et annuaire ColisActiv. Résultat dans le fichier Drive du propriétaire « TutelLiv_Suivi_Prospection_2026 », refait aux couleurs TutelLiv avec logo : onglets Tableau de bord, PARIS (214 entreprises dédoublonnées, 204 avec téléphone, 91 avec e-mail générique), MARSEILLE (20, reprises de l'ancien rapport), Mode d'emploi ; listes déroulantes de statut, couleurs par statut, relances dues en orange, compteurs automatiques. Anciens onglets renommés « Archive » et masqués, non supprimés. Vérifications : formules relues par l'API (234 entreprises, 0 erreur), rendu contrôlé dans le navigateur. Limites : coordonnées Google Maps non vérifiées une par une (fiabilité « Moyenne ») ; département déduit de la position Google, approximatif ; 123 entreprises PARIS sans e-mail ; MARSEILLE non enrichi par Google Maps. Suite : lancer les appels depuis les onglets PARIS et MARSEILLE (filtre Priorité = A).
  MARSEILLE enrichi le 4 novembre 2026 (demande du propriétaire « même chose pour Marseille et les alentours ») : 14 recherches Google Maps (Marseille, Aix, Aubagne, Vitrolles/Marignane, Martigues/Istres, Salon, La Ciotat, Gémenos/Rousset, Arles, Toulon), 329 fiches relevées, tri manuel (points relais DHL/UPS, supermarchés, restaurants, taxis, transitaires maritimes et grands groupes écartés), recherche d'e-mails génériques sur 59 sites, fusion avec les 20 anciennes lignes. Résultat : 123 entreprises dédoublonnées (112 dans le 13, 11 dans le Var), 121 avec téléphone, 38 avec e-mail ; priorité A 22, B 38, C 63 ; grands groupes (Transcausse, Star Service, Rocca, Ciblex…) forcés en C. Vérifications : compteurs de l'onglet et du Tableau de bord relus par l'API (123 / 38 e-mails), rendu contrôlé dans le navigateur. Limites : mêmes que PARIS (coordonnées non vérifiées une par une, ville déduite de la position Google) ; e-mails nominatifs ou d'autres agences écartés.
  Dirigeants PARIS ajoutés le 4 novembre 2026 (demande du propriétaire : numéros des dirigeants via Pappers ou autre). Pappers et le registre ne publient pas de numéro de téléphone des dirigeants ; on a donc relevé leurs noms dans le registre public (API recherche-entreprises.api.gouv.fr, même source que Pappers). Pour chaque entreprise, recherche par nom, puis rapprochement par adresse ; holdings remplacées par la personne qui les dirige ; commissaires aux comptes écartés. Résultat dans l'onglet PARIS, colonne Interlocuteur : 111 entreprises sur 214 avec dirigeant (69 sûres par adresse ou SIREN, 42 marquées « à confirmer »), SIREN complété en colonne Y ; 3 interlocuteurs déjà notés conservés ; 2 rapprochements faux retirés (Coursier Express, PRINE) ; 1001 Courses et Trans Zohra laissés sans dirigeant (doute). Aucun numéro privé recherché : la règle de `docs/operations/prospection/README.md` reste d'appeler les lignes d'entreprise et de demander le dirigeant par son nom. Vérification : écriture relue par l'API (214 cellules par colonne). Limites : les 42 « à confirmer » n'ont pas d'adresse correspondante ; 103 entreprises sans dirigeant trouvé (nom commercial différent du nom légal). MARSEILLE non traité.
  Téléphones des dirigeants PARIS ajoutés le 4 novembre 2026 (demande du propriétaire). Pappers refuse l'accès automatique (403) et ne publie pas ces numéros. Sources retenues, toutes publiées par l'entreprise elle-même : mentions légales, contact et « qui sommes-nous » de 150 sites lus automatiquement (numéro gardé seulement s'il est à côté du nom du dirigeant, numéros d'hébergeur écartés à la main) ; portable 06/07 publié comme numéro de l'entreprise ; ligne d'un entrepreneur individuel. Résultat : 32 entreprises avec « TÉL. DIRIGEANT » dans la colonne Interlocuteur (2 par les mentions légales : Freedom7, Trans-Drive ; 3 entrepreneurs individuels ; 27 portables d'entreprise, « sans doute le sien ») ; Freedom7, qui n'avait aucun téléphone, a reçu son numéro en colonne F. Aucun annuaire de numéros privés ni outil payant utilisé. Vérification : écriture relue par l'API. Limites : un portable d'entreprise peut appartenir à un salarié ; 79 dirigeants connus restent sans numéro direct (passer par le standard en les demandant par leur nom). Retiré le même jour à la demande du propriétaire : la colonne Interlocuteur est revenue à « Nom, fonction — registre », sans numéro ; le téléphone reste seulement dans la colonne Téléphone (F), où Freedom7 garde le 06 41 17 14 47 ajouté. Écriture relue par l'API (214 cellules). Puis, à sa demande, nouvelle colonne J « Tél. dirigeant » insérée après Interlocuteur dans l'onglet PARIS, avec les 32 numéros (numéro seul, sans commentaire). Vérification : formules de l'onglet et du Tableau de bord décalées automatiquement (Statut M→N, Relance P→Q), compteurs inchangés (214 à contacter, 91 e-mails, 205 téléphones). Limite : MARSEILLE n'a pas cette colonne, donc les deux onglets n'ont plus les mêmes lettres de colonnes.
  Recherche approfondie le même jour (demande du propriétaire : « le plus possible ») : (1) SIREN relevés dans les mentions légales des sites des entreprises sans dirigeant, puis registre → 20 dirigeants de plus (SIREN d'hébergeurs OVH/Linkeo et d'agences web écartés), soit 131 dirigeants sur 214 ; (2) deux agents de recherche web sur les 99 dirigeants sans numéro : aucun numéro écrit à côté d'un nom, 18 portables publiés par les entreprises, chacun revérifié sur sa page source ; 4 écartés (ligne recrutement et service client de Cygogne, WhatsApp 07 68 63 81 28 commun à trois sites). Résultat : 46 numéros dans « Tél. dirigeant », colonne que le propriétaire a déplacée en G. Incident : ce déplacement, fait pendant le travail, a fait écraser 20 cellules « Site web » ; sites restaurés depuis la lecture initiale, noms remis dans « Interlocuteur », alignement relu par l'API. Règle ajoutée en mémoire : relire les en-têtes avant chaque écriture. Extensions LinkedIn (Kaspr, Lusha) : impossibles pour l'agent (compte à créer, risque de blocage LinkedIn en cas d'automatisation) ; à faire à la main par l'ami prospecteur. Limites : 85 dirigeants sans numéro direct ; 83 entreprises sans dirigeant identifié.
  Suite le même jour (« rechercher jusqu'à rajouter des numéros », puis « même chose pour Marseille ») : PARIS, 21 numéros de plus pour des sociétés que l'INSEE déclare sans salarié (le standard est tenu par le dirigeant ; USEND et Cygogne écartés), chaque cellule portant une note de provenance → 67 numéros sur 131 dirigeants. Pappers (téléphone réservé aux comptes connectés, création de compte interdite à l'agent) et PagesJaunes (numéros masqués, résultats mélangés) testés dans Chrome puis abandonnés. MARSEILLE : colonne G « Tél. dirigeant » insérée comme sur PARIS ; registre + adresse + SIREN des mentions légales → 78 dirigeants sur 123 (colonne J, SIREN en Z ; Allo Express sans dirigeant et Vélos Coursiers Toulonnais non diffusible écartés) ; 38 numéros dans G avec note de provenance (1 mentions légales, 26 portables d'entreprise, 9 sociétés sans salarié, 2 entrepreneurs individuels) ; numéros d'hébergeur et standards déjà notés écartés. Vérifications : en-têtes relus avant écriture, lignes 34 et 124 relues, formules du Tableau de bord décalées automatiquement (MARSEILLE : Statut N, e-mail H, 123 / 38 / 121 inchangés). Limites : recherche web nominative non relancée pour MARSEILLE (rendement nul sur PARIS) ; « portable d'entreprise » et « sans salarié » restent des déductions, signalées dans la note de chaque cellule.
  Documentation pour les commerciaux le même jour (le propriétaire précise que le fichier leur est destiné) : onglet « Mode d'emploi », 8 lignes ajoutées (qui appeler, colonnes Interlocuteur et Tél. dirigeant, origine des numéros, conduite pendant et après l'appel, LinkedIn avec Kaspr ou Lusha à la main, chiffres au 04/11/2026) et ligne Sources complétée ; mise en forme recopiée de la ligne existante, hauteurs de ligne ajustées. Vérification : écriture confirmée par l'API ; rendu non contrôlé visuellement dans le navigateur.
  Cases vides de « Tél. dirigeant » remplies le même jour à la demande du propriétaire : « Pas de n° direct → appeler le standard et demander [nom du dirigeant] » (ou « le gérant » si inconnu), « Aucun numéro → écrire par e-mail ou passer par le site » quand l'entreprise n'a aucun téléphone. PARIS 147 cases, MARSEILLE 85 cases ; les 67 et 38 numéros conservés à l'identique, notes de provenance intactes. Ligne « Colonne Tél. dirigeant » du Mode d'emploi adaptée. Vérification : écriture confirmée par l'API, lignes 12 et 13 de PARIS relues.
  Réparation du fichier le 5 novembre 2026 (les commerciaux l'avaient cassé) : dans le Tableau de bord, 6 calculs avaient été remplacés par des chiffres tapés à la main (entreprises contactées, intéressées, et pour Paris « pas joint » 5, « à rappeler » 1, « entretien fixé » 1, « pas intéressé » 3). Calculs remis ; onglets PARIS et MARSEILLE relus en entier (337 lignes, numérotation, statuts, e-mails, sites, dates : aucune casse). Protection « avertissement » ajoutée sur le seul Tableau de bord (retirée des en-têtes PARIS et MARSEILLE à la demande du propriétaire) ; ligne « Tableau de bord » ajoutée au Mode d'emploi. Vérification : valeurs relues par l'API, les compteurs suivent de nouveau les statuts (Paris 8 à rappeler, 2 intéressés ; Marseille 2 pas intéressés). Limite : les résultats tapés à la main ne disent pas quelles entreprises sont concernées ; le commercial doit les reporter sur les bonnes lignes de PARIS.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section PROD-02.

- [ ] **PROD-04 — Définir les mesures de valeur.**

  **Qui : Claude — après les pilotes.**

  Terminé quand : Valeur de départ avant pilote et objectif convenu avec chaque entreprise ; instruments utilisables sans collecte excessive.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section PROD-04.

- [ ] **OFFER-1 — Valider la grille cible et l'offre pilote.**

  **Qui : Toi — pendant les entretiens et les pilotes.**

  Terminé quand : Offre acceptée par prospects ; coûts infrastructure/cartes/stockage/messages/support mesurés ; pas d’illimité non maîtrisé.

  4 novembre 2026, **revue des options faite (demande du jour)** : inventaire des fonctions ajoutées depuis le catalogue du 23 octobre dans `docs/rapports/2026-11-04/offer1-fonctions-depuis-c8.md` (seules 5 fonctions étaient contrôlées par l'offre ; tout le reste était ouvert à tous). Décision du propriétaire (C15 dans `docs/DECISIONS_PRODUIT_COMMERCIALES.md`) : nouvelle option « Réception automatique des commandes » (`order_automation` : e-mails renvoyés, WhatsApp, message collé lu par l'IA), 29 € HT par mois en Starter, incluse en Pro et Business ; preuve de livraison, factures, relances et Factur-X restent dans toutes les offres. Code : clé ajoutée au serveur, à la session, au comparatif et à la découverte premium de 60 jours ; contrôle unique dans l'analyse des messages (couvre les trois canaux) et à l'activation (refus 403 « option non incluse », désactiver reste possible, les e-mails déjà reçus restent lisibles) ; écran « Commande par message » avec l'encart « Option non incluse dans votre offre » ; démonstrations créées avec la sixième fonction. Catalogue `C11-2026-11-04` par la migration `20261104030000_catalog_c11_order_automation` (recopie de C10 ; pilotes complets complétés, pilotes restreints inchangés ; contrats existants inchangés). Documents : `docs/SAAS_OFFERS_ARCHITECTURE.md`, `docs/DECISIONS_PRODUIT_COMMERCIALES.md` ; supports locaux refaits (`outputs/commercial/kit/TutelLiv-kit-commercial.pdf`, plaquette `…-apres-siren-MODELE.pdf`, 0 débordement après fusion de deux lignes). Vérifications : `npm run check` 1 586/1 586 ; tests ajoutés (`tests/catalog-c11-order-automation.test.ts`, cas « non incluse » dans `tests/order-intake.test.ts` et `tests/order-intake-routes.test.ts`) ; `npm run test:saas01b` vert sur PostgreSQL jetable avec C11 (option Starter 2 900 / 34 800 centimes, incluse Pro et Business, options de C10 recopiées). **Vérifié ensuite (même jour, « fais tout toi-même »)** : migration appliquée sur `tutelliv-dev` et relue (C11 actif, C10 retiré, option 2 900 / 34 800 centimes en Starter, `order_automation` inclus en Pro et Business, 11 options au lieu de 10, 12 pilotes sur 12 complétés) ; E2E dans un worktree à moi : `public-order.spec.ts` 5/5 (lien, trois parcours e-mail, WhatsApp) et `order-intake.spec.ts` 2/2 après correction de la réponse simulée du test (champ `included` ajouté : sans lui l'écran se croyait « option non incluse ») ; écran « Option non incluse » vérifié au navigateur (encart affiché, « Activer » grisé pour l'adresse de réception, lien de commande toujours activable, capture relue). `npm run check` : 1 586/1 586, lint vert ; le contrôle de types complet échoue seulement sur `outputs/recette-wt`, worktree d'une autre session rangé dans le dépôt (vert sans ce dossier). **Non fait** : remplacer le catalogue avec prix du Drive (accès Drive refusé à l'agent, à faire par toi).

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

  5 novembre 2026, à la demande du propriétaire : pages **Tarifs** et **Démonstration en ligne** retirées du site public pour le moment. Plus aucun lien (barre, menu mobile, pied de page, accueil, fin de la mini-démo) ; `/tarifs` redirige vers `/fonctionnalites` et `/demonstration` vers la mini-démo de l'accueil (`/#demo`), redirections temporaires dans `next.config.ts` ; le code des deux pages est conservé pour les rouvrir. Le bouton « Voir la démo » de la barre mène à la mini-démo. Page **Fonctionnalités** refaite et mise à jour : parcours en 4 étapes, raccourcis vers les trois espaces, 26 phrases (contre 12) dont lien de commande sans compte, arrivée estimée, preuve PDF, e-mail/WhatsApp (« En option »), 3 livreurs proposés (« Selon la formule »), carte, tournées, imprévus, facture à la livraison, notification de mission, signature ; chaque phrase reste prouvée par un texte d'écran (`src/domains/growth/public-capabilities.ts`). Volontairement absents tant que le propriétaire ne les a pas validés : Factur-X (FACTURX-1) et commande par message IA (INTAKE-1). Vérifications : tests ciblés 39/39, `npm run check` vert (1594/1594) ; Playwright sur serveur isolé (copie séparée, port 3107) : 307 sur `/tarifs` et `/demonstration`, aucun lien restant vers ces pages sur l'accueil et Fonctionnalités, pas de débordement à 390 px, Clair et Sombre sans erreur console, ancre « Côté terrain » et bouton « Voir les fonctionnalités » de l'accueil cliqués. Non vérifié : E2E Playwright complets (listes `mobile-web` et `auth-role-pages` mises à jour, non relancées) et extension Chrome non connectée. Critères « prix HT/TTC » et « différence démo/pilote » de cette tâche suspendus tant que les pages restent retirées.

  5 novembre 2026 (suite), à la demande du propriétaire : `/tarifs` devient une **page provisoire « TutelLiv arrive bientôt »** avec liste d'attente (prénom, nom, entreprise, e-mail, téléphone, tous obligatoires). Lien « Tarifs » remis dans la barre et le pied de page de l'accueil, redirection `/tarifs` retirée (celle de `/demonstration` reste). Envoi vers `/api/waitlist` (`submitWaitlistEntry`, `src/domains/growth/contact.service.ts`) : même table `contact_messages` que Contact (aucune migration), même débit (3 par source et 50 par heure), pot de miel, alerte e-mail titrée « Liste d'attente : <entreprise> » ; les inscriptions se lisent dans `/admin/contact` (message « Liste d'attente : … »). Page Confidentialité complétée (données de la liste d'attente, même conservation que Contact). L'ancienne grille lue dans le catalogue est dans l'historique Git (commit 5f87f2f) ; `toPublicPricing` reste en place pour la remettre. Vérifications : tests ajoutés (inscription normalisée, champs obligatoires, téléphone de moins de 8 chiffres refusé, pot de miel, débit, titre de l'alerte, schéma strict, lien confidentialité) ; `npm run check` vert (1596/1596) ; Playwright sur serveur isolé (port 3108, base `tutelliv-dev`, alertes coupées) : envoi vide bloqué, vraie inscription E2E acceptée (202) puis message de confirmation, ligne vérifiée en base puis supprimée, téléphone trop court refusé (400, champ `phone`), lien Tarifs de la barre et du pied de page cliqué, Clair, Sombre et 390 px sans débordement ni erreur console. Non vérifié : réception réelle de l'alerte e-mail en préproduction (dépend de `CONTACT_ALERT_RECIPIENT` sur Vercel).

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

  **Qui : Toi — régler `NEXT_PUBLIC_APP_URL` sur `https://tutelliv.fr` (Vercel, Preview `preproduction`) et retirer le filtre Gmail d'essai ; Outlook plus tard (décidé le 4 novembre) ; ensuite Claude.**

  Terminé quand : une boîte de commandes Gmail et une boîte Outlook renvoient automatiquement vers TutelLiv ; le code de confirmation de Gmail est visible dans TutelLiv ; le client d'origine est reconnu ; les e-mails de commande apparaissent en brouillon et les autres sont mis « à trier » ou ignorés sans être conservés ; la validation crée la commande et, si besoin, la fiche du client ; le client reçoit la confirmation (envoyée par TutelLiv au nom de l'entreprise, « répondre à » vers sa boîte) ; tests, essai réel avec chaque fournisseur, `npm run check` et clic réel navigateur.

  Reprend deux défauts de MAIL-ECARTS (archivée le 3 novembre) : client jamais retrouvé sur un e-mail transféré (le rapprochement ne regarde que l'expéditeur, alors l'entreprise elle-même) ; « Brouillon prêt » affiché aussi sur un e-mail qui n'est pas une commande.

  À prévoir : changement de schéma (fiche client sans accès, statut « à trier ») ; guide pour activer le renvoi (Gmail, Outlook, OVH), dont l'accord de l'administrateur Outlook professionnel pour les renvois externes. Option ultérieure, hors de cette tâche : connexion directe Gmail/Outlook (comptes Google Cloud et Azure, vérification Google et audit CASA, juridique plus lourd).

  3 novembre 2026, spécification écrite : `docs/operations/order-intake/MAIL-PONT.md` (parcours, guide de renvoi Gmail/Outlook/OVH, expéditeur d'origine y compris transfert à la main, code de confirmation Gmail, tri `order`/`other` dans le même appel au modèle, confirmation avec « répondre à », sécurité, cinq étapes livrables). Point d'architecture trouvé : l'adresse e-mail d'un utilisateur est unique sur toute la plateforme, d'où la recommandation d'une fiche client propre à l'entreprise (option B) plutôt qu'un utilisateur sans connexion. Vérification : `npm run docs:verify`. Non vérifié : texte exact de l'e-mail de Gmail, redirection Outlook avec Resend, résultats SPF/DKIM chez Resend. Suite : tes quatre choix (section 9).

  3 novembre 2026, **étape 1 faite (tri)** : le modèle renvoie `kind` (`order`/`other`) dans le même appel ; nouveau statut `NOT_ORDER` ; section repliée « À trier » (raison affichée, « C'est une commande » ouvre le brouillon gardé, « Ignorer » efface le contenu), effacée après 7 jours ; e-mail vide ou fait de pièces jointes rangé sans appel au modèle. Corrige le défaut 3 de MAIL-ECARTS. Migration additive `20261103210000_inbound_not_order` appliquée sur `tutelliv-dev` puis sur la préproduction. Vérifications : tests unitaires ajoutés (`tests/public-order-channels.test.ts`, `tests/order-intake.test.ts`) ; `npm run check` 1 551/1 551 ; E2E en worktree isolé : `public-order.spec.ts` « E-MAIL » 1/1 (nouveau parcours « À trier » : merci rangé, pièce jointe sans appel au modèle, « Ignorer ») et `order-intake.spec.ts` 2/2 (un premier passage à froid avait échoué, non reproduit en deux reprises). Commit local `a37396b`, **non poussé** (push refusé par l'outil de sécurité). Non vérifié : vrai modèle sur un e-mail « merci » en ligne (après le push).

  3 novembre 2026, **étape 2 faite (vrai client sur un e-mail transféré à la main)** : si l'e-mail vient d'un membre de l'équipe, le premier bloc cité (`De :`, `From:`, `Expéditeur :`) donne le client, gardé dans `originalSender`, utilisé pour le rapprochement et affiché « lu dans l'e-mail transféré par … » ; un expéditeur extérieur n'est jamais remplacé ; effacé au classement. Corrige le défaut 1 de MAIL-ECARTS. Migration additive `20261103230000_inbound_original_sender` appliquée sur `tutelliv-dev` et en préproduction. Vérifications : tests unitaires (Gmail, Outlook, Apple Mail, transfert en français, équipe elle-même, nom sans adresse) ; `npm run check` 1 553/1 553 ; E2E « E-MAIL » 1/1 avec le nouveau scénario. Non poussé (push à faire par toi).

  3 novembre 2026, **étape 3 faite (sauf essais réels)** : champ « Votre boîte de commandes » (enregistré en minuscules, adresse invalide refusée) ; e-mail de `forwarding-noreply@google.com` reconnu, ni analysé ni listé, code affiché dans le réglage (« 246 813 579, demandé par … »), seuls le code et l'adresse gardés, effacé après 24 h ; guide de renvoi Gmail, Outlook (« Rediriger vers », accord de l'administrateur) et OVH. Vérifications : tests unitaires (formats anglais et français, autre expéditeur refusé) ; `npm run check` 1 554/1 554 ; E2E « E-MAIL » 2/2 (dont le nouveau test : code affiché, boîte enregistrée et relue après rechargement, guide ouvert). Un premier passage avait échoué : réglage masqué quand le domaine de réception n'est pas configuré (corrigé, affiché dès l'activation), puis délai de 60 s trop court à froid (porté à 180 s comme le test voisin). Migration `20261104000000_order_mailbox_forwarding` appliquée sur `tutelliv-dev` ; appliquée en préproduction le 3 novembre après ajout de la règle d'autorisation. Non vérifié : vrai renvoi Gmail et Outlook (après le push).

  3 novembre 2026, **étape 5 faite (confirmation au client)** : case « Envoyer la confirmation au client (adresse) » cochée par défaut à la validation ; une seule confirmation par e-mail reçu (tâche durable `inbound-confirmation:<e-mail>`, programmée dans la même transaction que la clôture), à l'expéditeur d'origine et jamais à un membre de l'équipe ; une ligne et un lien de suivi par commande créée ; `reply_to` vers la boîte de commandes (ajouté à l'envoi d'e-mails, ignoré si l'adresse est invalide) ; message « Confirmation envoyée à … » à l'écran. Vérifications : test unitaire de `reply_to` ; `npm run check` 1 555/1 555 ; E2E « E-MAIL » 2/2 (tâche programmée, `replyTo`, lien rattaché au client, aucune confirmation pour un e-mail classé) et `order-intake.spec.ts` 2/2. Le premier test E-MAIL dépassait 180 s (3,2 min) : limite portée à 300 s. Le test du code Gmail utilise maintenant un code unique par exécution (un reste d'essai le faisait échouer). Non vérifié : vrai e-mail reçu par un client (la base de développement n'envoie rien ; la préproduction envoie à l'adresse de test). Reste à MAIL-PONT : étape 4 (fiche client, ton choix A ou B) et les essais réels.

  4 novembre 2026, **étape 4 faite (fiche client, option B)** : table `company_customers` (nom, e-mail unique par entreprise, téléphone, `userId` facultatif) et `orders.company_customer_id` ; menu « Client » du brouillon avec comptes, fiches et « + Nouveau client (sans accès) », prérempli depuis l'expéditeur et présélectionné quand il est inconnu ; fiche créée dans la transaction de la commande (sous verrou ; adresse connue réutilisée sans être écrasée ; adresse d'un compte client refusée ; clé déjà utilisée pour un autre client = conflit) ; second e-mail rapproché de la fiche ; nom de la fiche dans les listes de commandes et sur la page de la commande ; fiche rattachée au compte si l'entreprise en ouvre un plus tard ; export DATA-02 étendu (`companyCustomers`). Détail : `docs/operations/order-intake/MAIL-PONT.md`, section 5.3. Migration `20261104010000_company_customers` (RLS, droits retirés à `anon`/`authenticated`) appliquée sur `tutelliv-dev`, puis en préproduction avec ton accord du 4 novembre. Vérifications : `tests/company-customer.test.ts` 9/9 (isolement entre entreprises, double clic, clics simultanés, reprise, conflit, compte existant, nom dans les listes) ; tests de rapprochement, de route, d'export et de rattachement mis à jour ; `npm run check` 1 567/1 567 ; `npm run docs:verify` vert (compte de modèles porté à 48 dans `docs/DATABASE.md`) ; E2E en worktree isolé : nouveau « E-MAIL fiche client » 1/1 (client inconnu, double clic = une fiche et une commande, second e-mail reconnu, page de la commande, fiche d'une autre entreprise absente de la liste et refusée en 404), les deux autres « E-MAIL » 2/2, `order-intake.spec.ts` « deux livraisons » 1/1 et « coller » 1/1 à la relance ; captures clair et sombre du formulaire relues. Aléa vu deux fois à froid : le créneau n'était pas prérempli avant le clic (le serveur refuse proprement « Choisissez un créneau ») ; réussite à la relance, déjà observé à l'étape 1 ; le nouveau test choisit le créneau s'il est vide. Non vérifié : nom de la fiche dans la liste des commandes au navigateur (test unitaire seulement) ; page « Clients » sans les fiches ; ni modification ni suppression d'une fiche (hors étape). Commit local, non poussé.

  4 novembre 2026, **essai réel Gmail commencé** (ton accord pour ta boîte Gmail dans Chrome) : étape 4 poussée (`972554c`), route `/api/orders/intake/customers` en ligne (401 au lieu de 404). Dans la démo de tutelliv.fr : adresse de réception activée, boîte de commandes `+commandes` enregistrée (relue par l'API). Dans Gmail : adresse TutelLiv ajoutée comme adresse de transfert (clé d'accès validée par toi), transfert global **non** activé. Résultat : l'e-mail de Google est bien arrivé dans TutelLiv, mais **non reconnu** : le format a changé, objet « (Gmail) Confirmation de transfert – Recevez les messages de … », **aucun code**, seulement un lien d'approbation `mail-settings.google.com`. Correctif `d92e7eb` (local, push refusé par le contrôle automatique) : lien reconnu (https vers `mail-settings.google.com` ou `mail.google.com`, chemin `/mail/`, sinon ignoré), gardé 24 h, bouton « Approuver le renvoi dans Gmail » ; ancien format à code toujours lu ; guide mis à jour. Vérifications : test unitaire sur le texte réel (anonymisé) et sur un faux lien ; `npm run check` 1 568/1 568. Non vérifié : affichage du bouton en ligne (après le push). La fonction d'analyse de la démo est encore désactivée (case d'acceptation du sous-traitant à cocher par toi).

  4 novembre 2026, suite de l'essai Gmail : correctif poussé (`bc83a1a`, déploiement Vercel prêt). « Renvoyer l'e-mail » dans Gmail → TutelLiv a reconnu le lien (`mail.google.com/mail/vf-…`, demandeur lu) et affiché « Approuver le renvoi dans Gmail » ; clic → page Google « Confirmez le transfert » → « Opération effectuée ». **Le code de confirmation Gmail est donc vérifié en vrai, au nouveau format.** Ancien e-mail non reconnu classé. Bloqué : la création du filtre Gmail (À `+commandes`, Transférer à TutelLiv) ne part pas depuis l'agent (trois clics sans effet, aucun filtre créé) ; à faire par toi. Constat : le bandeau « Approuver » reste 24 h même après approbation (effacement au premier e-mail renvoyé non codé) ; correction à décider après lecture d'un vrai e-mail renvoyé (en-têtes Gmail).

  4 novembre 2026, **essai réel Gmail réussi de bout en bout** (démo de tutelliv.fr, filtre Gmail limité à `orsocarotenuto+commandes@gmail.com` créé par toi, fonction activée par toi). 1er e-mail fictif : renvoyé par Gmail, reçu avec le vrai expéditeur, analysé par le vrai modèle (adresses, contact « M. Durand », échéance, 2 cartons corrects), « + Nouveau client (sans accès) » présélectionné et prérempli (nom lu dans la signature) → commande CRS-11495439 et fiche créées, page de la commande avec la carte « Client sans accès », confirmation reçue avec `Reply-To` vers la boîte de commandes. 2e e-mail : fiche reconnue (« Rapproché par e-mail de l'expéditeur (fiche sans accès à l'espace client) ») → CRS-60537708 sans nouvelle fiche ; bandeau Gmail disparu ; confirmation affichée « LogiExpress Démo via TutelLiv ». Corrections faites pendant l'essai et poussées (`89bcdfe`, `1b46667`) : expéditeur « Entreprise via TutelLiv » (nom nettoyé, adresse de `MAIL_FROM` seulement), pied « Votre réponse lui parvient directement » quand `Reply-To` existe, demande Gmail masquée dès qu'un e-mail ordinaire arrive après elle, en-tête de la commande avec le nom de la fiche. Vérifications : tests unitaires ajoutés (expéditeur, injection d'en-tête, pied, masquage) ; `npm run check` 1 570/1 570 ; relecture des e-mails reçus. Constats non corrigés : (1) les liens de suivi pointent vers `tutelliv-v2-git-preproduction-tutelliv.vercel.app` : variable Vercel `NEXT_PUBLIC_APP_URL` à régler par toi ; (2) le modèle a lu « demain » comme le 04/11 au lieu du 05/11 sur « Même chose qu'hier : … demain … avant 11h » (calcul du code vérifié correct ; relecture humaine non faite par l'agent) : à suivre dans la mesure de qualité d'INTAKE-1 ; (3) « Informations absentes du message : client » reste affiché alors que la nouvelle fiche est préremplie (formulation à revoir). Reste à MAIL-PONT : essai Outlook. Données d'essai laissées dans la démo (deux commandes fictives, une fiche).

  4 novembre 2026, **corrections après l'essai** (Outlook reporté par toi) : (3) « Informations absentes du message : client » n'est plus affiché quand un client est choisi ou qu'une nouvelle fiche est préremplie ; (2) un message qui cite plusieurs jours relatifs (« hier », « demain », « aujourd'hui », « après-demain »…) marque la date « À vérifier : le message cite plusieurs jours (hier, demain…) » (le calcul du code reste celui du modèle ; la relecture est demandée, pas une correction automatique). Vérifications : tests unitaires (mots répétés, « après-demain », « fichier », brouillon marqué ou non) ; `npm run check` 1 572/1 572. Non vérifié au navigateur : ces deux affichages (logique couverte par les tests, affichage non relu). (1) `NEXT_PUBLIC_APP_URL` : modification Vercel refusée à l'agent par l'outil de sécurité ; commande prête pour toi.

  **Modèle conseillé : Claude Opus · effort élevé.**

- [ ] **PROPRIO-2810 — Actions du propriétaire avant mise en ligne.**

  **Qui : Toi.**

  Constat du 2 novembre 2026 : faits, migrations de préproduction, relais GitHub avec ses secrets, Node 22, `CONTACT_HMAC_SECRET`, clé Anthropic, Mustang, choix de la plateforme, note sur `J5_AUDIT_FACTUEL_DEV.md`. Reste : Supabase Pro, fiche F10, promotion en production.

  Terminé quand : chaque ligne est constatée par un agent (secret présent, migration appliquée avec un schéma sans écart, réglage visible) ; aucun secret n'est affiché ni versionné ; promotion décidée explicitement.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section PROPRIO-2810.

- [ ] **RELEASE-1 — Réaliser la recette de mise en vente.**

  **Qui : Claude — en dernier, avant la mise en vente.**

  Terminé quand : Aucun défaut bloquant connu ouvert ; responsabilités opérationnelles définies ; décision de lancement explicite et surveillance prête.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section RELEASE-1.

- [ ] **WHATSAPP-1 — Recevoir les commandes WhatsApp sans copier-coller.** Demande du propriétaire du 4 novembre 2026. Spécification : `docs/operations/order-intake/WHATSAPP.md` (règles de Meta vérifiées en ligne le 4 novembre : pas de renvoi automatique, API officielle seulement, vérification de l'entreprise, messages reçus gratuits, message transféré sans auteur d'origine, règle de Meta sur l'IA). Conseil : option A, un numéro TutelLiv vers lequel le dispatcher transfère le message ; l'entreprise est reconnue par le numéro du dispatcher.

  **Qui : Toi — après le SIREN : compte Meta Business, numéro dédié, variables Vercel ; ensuite Claude.**

  4 novembre 2026, décision du propriétaire : **option A maintenant, B préparée** (« part du principe que j'ai le SIREN »). Fait :
  - Base : enum `InboundChannel` et colonne `inbound_order_emails.channel`, `company_intake_channels.whatsapp_enabled` (migration `20261104020000_whatsapp_inbound`, appliquée sur tutelliv-dev et en préproduction avec ton accord).
  - `src/domains/order-intake/whatsapp.service.ts` : signature `X-Hub-Signature-256`, abonnement par jeton, lecture des messages (accusés et réactions écartés, légende d'une photo lue), entreprise trouvée par le numéro du membre de l'équipe (administrateur, mini-admin, dispatcher, actif ; numéro présent dans deux entreprises : ignoré), réglage par entreprise. `resolveWhatsAppTarget` est le seul point à changer pour l'option B.
  - Route `GET/POST /api/webhooks/whatsapp` ; file commune `queueInboundMessage` (plafond, tâche d'analyse, purge) partagée avec l'e-mail.
  - Analyse : le numéro de l'équipe n'est jamais pris pour le client ; client cherché par l'e-mail, sinon le téléphone, retrouvés dans le texte (`matchCustomerFromText`) ; l'e-mail lu reçoit la confirmation, jamais le numéro de l'équipe.
  - Écran : ligne « WhatsApp » dans « Commandes sans connexion » (numéro, activer, liste des numéros reconnus de l'équipe), messages marqués « Reçu par WhatsApp, transféré par … », carte renommée « Messages de commande reçus ».
  - Docs : `WHATSAPP.md` (section 8 bis, décisions), `README.md` de l'order-intake, `.env.example`.
  Vérifications : `tests/whatsapp-intake.test.ts` (7 tests) et un test de reconnaissance par le texte dans `tests/order-intake.test.ts` ; `npm run check` vert (1 580 tests) ; build de production dans un worktree isolé ; E2E `tests/e2e/public-order.spec.ts` sur ce build (port 3110, variables WhatsApp de test) : parcours « WHATSAPP » vert (route signée et rejeu, analyse, réglage affiché, vrai clic « Créer la commande », client reconnu, confirmation programmée à l'e-mail lu), et les 4 autres parcours du fichier verts aussi (LIEN relancé seul après suppression de 3 commandes de test laissées par un passage interrompu). Les E2E existants ont été rendus robustes au mode « créneaux » de l'environnement de démo 1 (choix du créneau, lien public) et nettoient leurs commandes même en échec.
  Non vérifié : essai réel avec Meta (pas de compte), message d'aide au numéro inconnu (étape 4, demande un jeton d'accès), option B. Un essai réel est possible sans SIREN avec le numéro de test gratuit de Meta (compte développeur ouvert avec ton Facebook) : proposé le 4 novembre, reporté par toi (« plus tard »).

  4 novembre 2026, question « on peut pas faire autrement ? » : section 3 bis ajoutée à la spécification. Deux chemins sans SIREN : (1) WhatsApp → Partager → e-mail vers l'adresse de commandes, qui réutilise MAIL-PONT sans code (geste à essayer sur iPhone et Android) ; (2) API officielle avec un compte Meta non vérifié, plafonné à environ 250 conversations lancées par l'entreprise par jour (sources de prestataires), ce qui ne gêne pas la réception, et numéro de test de Meta pour coder. Écarté : bibliothèques non officielles (contraires aux conditions, risque de bannissement). Vérification : `npm run docs:verify`. Non vérifié : plafonds dans l'aide de Meta, réception sur le numéro de test, geste de partage.

  Terminé quand : un message WhatsApp transféré par un dispatcher depuis son téléphone devient un brouillon dans TutelLiv ; un message qui n'est pas une commande va dans « À trier » ; un numéro inconnu ne laisse aucune donnée ; la validation crée la commande et, si besoin, la fiche du client ; tests, essai réel sur un vrai téléphone, `npm run check` et clic réel dans le navigateur.

  Source / dépendance / blocage : SIREN, puis compte Meta Business vérifié et numéro dédié (propriétaire) ; Meta à ajouter aux sous-traitants (LEGAL-1). Aucun code avant le compte vérifié, faute d'essai réel possible. Jusque-là, le copier-coller d'INTAKE-1 suffit.

  4 novembre 2026, spécification écrite : réutilisation de MAIL-PONT (file des messages reçus, tri, « À trier », fiche client, validation), webhook signé `X-Hub-Signature-256`, messages texte seuls, numéro inconnu sans stockage, quatre étapes après les démarches Meta. Vérification : `npm run docs:verify`. Non vérifié : texte officiel de la règle de Meta sur l'IA, coexistence en France, plafonds sans vérification, tarifs français.

  **Modèle conseillé : Claude Opus · effort élevé.**

- [ ] **SMS — Ajouter seulement les extensions justifiées.**

  **Qui : Claude — seulement si les pilotes le demandent.**

  Terminé quand : Chaque extension a un problème mesuré, un coût, un critère de réussite et une place validée dans la roadmap.

  Détail et historique : `docs/TODO-ARCHIVE.md`, section SMS.
