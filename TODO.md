# TODO TutelLiv — du produit existant au SaaS vendable


<!-- TODO_PROGRESS_START -->
## Progression globale

**58 tâches terminées sur 100 — 58 %**

`████████████░░░░░░░░` · 42 tâches restantes

_Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->
Mise à jour : 29 octobre 2026 (bilan de l'intégration du 28 octobre : neuf chantiers sur `integration/2026-10-28`, non poussée ; voir DEMO-3, DESIGN-1, FACTURX-1, INTAKE-1, POD-2, OPS-FIAB, SEC-AUDIT, RECETTE-2810 et PROPRIO-2810). Précédente : 26 octobre 2026 (revue de cohérence : tableaux de pilotage, priorités et matrice réalignés sur le code). Source unique des priorités du projet. Cette version consolide l’audit initial, l’audit SaaS autonome, les sondes locales et les tests E2E. La copie dans les outputs de la tâche doit rester synchronisée avec ce fichier.

## Tableau de pilotage

### Deux jalons indépendants

| Jalon | Résultat attendu | Ce qui ne le bloque pas | État actuel |
|---|---|---|---|
| **A — V1 pour trois pilotes** | Trois entreprises françaises de livraison B2B utilisent TutelLiv pendant environ quatre semaines avec comptes créés et droits attribués manuellement. | Stripe, inscription commerciale autonome, commissions et site complet. | Socle fonctionnel, préproduction, CI, restauration, surveillance/alertes OPS-03B, démo rapide et supervision ADMIN-1 validés ; e-mails réels, GPS physique, cadre juridique, essai pilote d'ONBOARD-1 et recette finale restent à fermer. |
| **B — SaaS autonome** | Site → offre/options → compte → paiement → activation → configuration → première livraison sans intervention TutelLiv. | Recrutement des pilotes et activation des paiements réels. | Catalogue, droits, quotas et inscription persistante avec paiement fictif terminés. Paiement sandbox Stripe (SAAS-01B), découverte premium (SAAS-04) et commissions (SALES-1) terminés. Construits mais non clos : « Mon abonnement » avec changement de formule et résiliation, indicateurs et alertes SaaS, pages Tarifs/Fonctionnalités/Démonstration et Contact avec sa lecture en back-office. Restent le moyen de paiement et les documents, la réconciliation Stripe, les pages légales et le domaine. |

### Cinq prochaines tâches recommandées

Revue du 27 octobre 2026 : la liste précédente est en grande partie faite. La CI `preproduction` est verte, les alertes SAAS-02 sont affichées, les changements de formule et la résiliation SAAS-03 passent par le serveur, et l'export DATA-02 est écrit en flux. Comme le 26 octobre, la liste ne retient que des incréments réalisables localement, sans dépense ni donnée réelle ; le compte Stripe de test et la base `tutelliv-dev` sont désormais disponibles.

| Ordre | Tâche | Pourquoi maintenant | Dépendance réelle | Modèle conseillé |
|---:|---|---|---|---|
| 1 | **SAAS-03 — export depuis l'écran** | Fait le 27 octobre : moyen de paiement, factures, options en libre-service, verrou d'opération corrigé (`test:saas01b` de nouveau vert). Essai A/B navigateur avec deux entreprises passé le 28 octobre. Reste l'export depuis l'écran, qui attend un canal de remise chiffré. | Aucune pour la sandbox ; l'export depuis l'écran attend un canal de remise chiffré (DATA-02). | GPT‑6 Astra · effort élevé |
| 2 | **PERF-02 — routes connectées sur PostgreSQL jetable** | Prisma, le pool et les routes publiques sont mesurés ; `tutelliv-dev` débloque les routes connectées. | Charge préproduction : accord du propriétaire. | GPT‑6 Astra · effort élevé |
| 3 | **ENV-2 — clôture** | Il reste à vérifier que `npm run test:e2e` démarre sur `tutelliv-dev` sans contournement, à confirmer l'origine de la clé Stripe de test et à installer Node 22.18.0 (la version de la CI) en local : sous Node 20, Supabase refuse de démarrer sans WebSocket natif. | Mot de passe de l'ancien projet `wlomrzil…`, aujourd'hui en pause : propriétaire. | GPT‑6 Luna · effort faible |
| 4 | **SAAS-02 — recette `/admin`, puis coûts** | Fait le 27 octobre : rapprochement facture par facture avec Stripe et remboursements déduits du net. Recette navigateur `/admin` en super-administrateur passée le 27 octobre. Restent les coûts et alertes de coût. | Rétention, conversion et coûts : historique réel et règles validées. | GPT‑6.1 Sol · effort élevé |
| 5 | **UX-03 — recette mini-admin, clavier, revue** | Fait le 27 octobre : fiche livraison dédiée, toutes les entrées du back-office, retard et prochaine action du serveur, variantes client et livreur, essais par statut et par rôle. Recette navigateur dispatcher et mini-admin et parcours au clavier passés le 27 octobre. Reste la revue visuelle avec DESIGN-1. | Présentation finale : DESIGN-1 ; revue visuelle différée. | GPT‑6.1 Sol · effort élevé |

COST-1 documentaire est terminée ; sa phase mesurée attend PERF-02 et les pilotes. La validation pilote d'ONBOARD-1 et l'envoi réel EMAIL/SEC-05 restent prioritaires dès que pilotes et domaine sont disponibles.

### Chemins critiques

- **Pilotes :** DEMO-2, OPS-03B, ADMIN-1 et DISPATCH-3 terminés ; tranche pilote d'ONBOARD-1 → SEC-05/EMAIL réels + MOB-01C + validation LEGAL-1/DATA-02 → V1-GO → PILOT-1 → PILOT-2. Les comptes et droits peuvent être créés manuellement ; SAAS-01B/03/04 et SALES-1 ne bloquent pas ce chemin.
- **Inscription autonome :** SIGNUP-1, SAAS-01B (sandbox Stripe), SAAS-04 et SALES-1 sont terminés ; SAAS-03 (formule, résiliation), SAAS-02 (indicateurs, alertes) et GROWTH-1 (pages publiques, Contact) ont une tranche livrée → moyen de paiement et documents SAAS-03 → réconciliation SAAS-02 → pages légales et domaine GROWTH-1 → RELEASE-1. ONBOARD-1 est partagé avec le chemin pilote.
- **Validation économique :** COST-1 documentaire est terminée ; PERF-02 et les pilotes doivent maintenant remplacer les hypothèses par des mesures. Les règles C7 sont confirmées ; OFFER-1 confronte encore prix, coûts et acceptation au marché.
- **Design :** direction « Menthe » retenue le 26 octobre 2026 (Light menthe, Dark encre + pastel ; `DESIGN.md`). DESIGN-1 la propage aux trois espaces et ajoute le mode Dark, puis MAP-3, UX-03 et UX-04 s'appliquent seulement aux parcours essentiels. La refonte globale ne bloque ni le SaaS ni les portes techniques des pilotes.

### Interventions du propriétaire

Liste unique des actions qui ne peuvent pas être faites par un agent, classées par urgence. Mise à jour le 27 octobre 2026 ; un agent la tient à jour et la retire ligne par ligne quand l'action est constatée.

Fait le 27 octobre 2026 sur instruction du propriétaire : relecture de la branche `todo/agent2-backlog`, application en préproduction des migrations `contact_messages` puis `sales_codes` (aucun écart avec le schéma), puis fusion dans `preproduction`. Le même jour, toujours sur instruction : fonctions Vercel de préproduction passées de `iad1` à Paris (`cdg1`), puis, sur décision du propriétaire, nouveau projet Supabase de développement `tutelliv-dev` (Paris), l'ancien `wlomrzil…` et la copie `tutelliv-restore-rehearsal` restant en pause, sans rien supprimer.

Ajout du 29 octobre 2026 : le lot des neuf chantiers intégrés le 28 octobre attend des actions du propriétaire (secrets GitHub, Node 22 Vercel, `CONTACT_HMAC_SECRET`, clé Anthropic, protection Supabase, validation Factur-X, migrations de préproduction sur accord) ; elles sont détaillées dans **PROPRIO-2810**.

**Urgent — sécurité et chaîne de livraison**
1. **Maintenant, le projet est de nouveau actif :** changer le mot de passe de la base de développement `wlomrzil…` (Supabase → Project Settings → Database → Reset database password), exposé dans un journal d'outil le 26 octobre. Mettre ensuite la nouvelle adresse dans `.env.local` du dossier principal (celui de l'agent design), ou laisser un agent le faire pendant une pause de l'agent design. → ENV-2

**Décisions produit** — toutes prises le 27 octobre 2026 (voir `docs/DECISIONS_PRODUIT_COMMERCIALES.md`, section C10) : impayé et changement de formule pendant la découverte (SAAS-04), refus d'une baisse avec ressources en excès et journal d'abonnement autorisé sur préproduction (SAAS-03), un code permanent par commercial (SALES-1), Contact stocké dans le back-office plateforme (GROWTH-1), seuils 80/100/120 % et Business (SAAS-02), sessions de test démo libérées après une heure.

Complément du même jour : une résiliation pendant la découverte la termine immédiatement (SAAS-04), la migration des codes commerciaux est autorisée (application en préproduction après fusion, SALES-1) et un compte super-administrateur temporaire peut être créé sur la préproduction pour les recettes navigateur, puis supprimé.

**Ressources et comptes**
2. Fait le 27 octobre 2026 : compte Stripe de test branché sur le développement local, recette SAAS-01B passée. Tarification adaptative (Adaptive Pricing) désactivée en mode test le même jour, vérifiée par l'API : une session Checkout créée sans paramètre renvoie `adaptive_pricing.enabled = false` en `eur` (session expirée aussitôt). À refaire en mode live lors de l'activation des paiements réels. → SAAS-01B, SAAS-03, SAAS-02
3. Acheter le domaine retenu, choisir et configurer l'expéditeur, donner l'accès au fournisseur d'e-mails. → SEC-05, EMAIL
4. Séance iPhone préparée le 27 octobre 2026 (seul, à pied, prévue demain ou ce week-end) : donner deux lieux publics du parcours au moment de partir, garder le Mac branché pour le relevé. Un Android reste à trouver pour fermer la tâche. → MOB-01C, puis V1-GO
5. Autoriser, si souhaité, une charge mesurée sur la préproduction (sans dépense). → PERF-02, COST-1

**Juridique et terrain**
6. Créer ou identifier la structure éditrice et faire valider contrats, RGPD, GPS, photos, conservation et sous-traitants par les professionnels compétents. → LEGAL-1, DATA-02, V1-GO
7. Recruter et autoriser dix entretiens. → PROD-02, OFFER-1
8. Sélectionner les trois entreprises pilotes, autoriser les contacts et signer le protocole. → PILOT-1, ONBOARD-1

### Dépendances fournisseur ou validation extérieure

- **Professionnels juridique/comptable :** validation des documents, rôles RGPD, fiscalité et facturation ; la préparation interne ne ferme jamais LEGAL-1.
- **E-mail et domaine :** le code et les modèles peuvent avancer avec un transport de test ; les envois pilotes attendent domaine et expéditeur vérifiés.
- **Stripe :** l'adaptateur et la sandbox peuvent être développés avant la structure juridique ; encaissement réel, activation live et dépense restent interdits sans validation.
- **Appareils et pilotes :** seuls les essais physiques et l'usage terrain exigent ces ressources. Les développements, simulations et tests fictifs indépendants continuent.

## Deux objectifs actuels : pilotes fiables et SaaS autonome

Objectif économique confirmé : vendre TutelLiv par abonnement à des entreprises françaises de livraison locale B2B. Le cœur de cible compte 5 à 20 livreurs et des clients professionnels récurrents, avec priorité commerciale à Paris/Île-de-France et Marseille/Bouches-du-Rhône. La préparation technique avance sans attendre les entretiens ; la demande du marché et la volonté de payer ne sont pas pour autant validées.

Faits rapportés par le propriétaire : les commandes arrivent par plusieurs canaux, surtout par e-mail ; l’administrateur rédige un autre e-mail pour un livreur, qui confirme par e-mail ; le reste des échanges se poursuit ainsi. Difficultés identifiées : temps, organisation et difficulté à savoir où en est ET où se trouve la livraison.

Promesse de travail : recevoir les commandes dans l’espace client existant, organiser les livreurs et suivre chaque livraison — étapes et position datée — dans un dossier partagé, jusqu’à la preuve et l’historique. La grille commerciale cible est définie, mais sa rentabilité, son acceptation et les gains clients chiffrés restent à valider. Référence : `docs/DECISIONS_PRODUIT_COMMERCIALES.md`.

## Périmètre de la V1

- Trois espaces conservés : client, administrateur/dispatch et livreur.
- Parcours principal : commande client → affectation → prise en charge explicite → exécution et échanges/incident → suivi statut + GPS daté → preuve → historique.
- Réutiliser les parcours standard et coursier déjà présents et partiellement testés. L’import automatique des e-mails n’est pas le parcours principal ni un nouveau chantier V1.
- Localisation limitée aux rôles et missions concernés, état périmé visible et arrêt hors service. Ne pas promettre le suivi permanent en arrière-plan avant les essais.
- Les récurrences sont qualifiées en interne ; leur cron déployé reste à surveiller. Les missions spéciales sont expérimentales, désactivées par défaut et exclues de l'offre pilote faute de devis accepté dans TutelLiv. La V1 retient un export comptable et des documents opérationnels, sans promettre une comptabilité complète ni l'émission réglementaire. BILL-02 est terminé et protège les statuts du noyau.
- Exclusions V1 confirmées : transport médical réglementé, matières dangereuses, transport frigorifique contrôlé, international/douanes et logistique lourde ou industrielle complexe.
- Pas de nouvelle IA, de SMS généralisé, d’app native ou de connecteurs multiples sans besoin démontré. Une app native peut être reconsidérée si les essais terrain révèlent une limite bloquante.

## Comment exécuter cette TODO

### Allocation conseillée des modèles

Le modèle conseillé ne change ni la priorité ni les dépendances : il indique le niveau de départ le plus économique jugé adapté à la tâche entière. Conserver ce modèle pendant inspection → implémentation → tests → corrections → mise à jour de la TODO. Passer au niveau supérieur si l’inspection révèle un changement de schéma, un risque de sécurité ou de données, une forte concurrence, plusieurs domaines couplés ou une décision produit ambiguë. Les tâches terminées ne sont pas étiquetées, puisqu’elles ne consomment plus de travail prévu.

- **GPT‑6 Luna** : tâche ciblée, documentation, mesure ou correction locale bien délimitée.
- **GPT‑6.1 Sol** : développement courant sur plusieurs fichiers, intégration, interface/API et tests.
- **GPT‑6 Astra** : architecture transversale, migration, sécurité, paiement, concurrence ou décision à fort impact.
- **Repli si le modèle conseillé est indisponible** : GPT‑5.6 Luna pour GPT‑6 Luna ; GPT‑5.6 Sol pour GPT‑6.1 Sol ; GPT‑6.1 Sol avec effort élevé pour Astra. Un ancien modèle est un repli de disponibilité, pas une économie de quota supposée.
- L’effort conseillé (`faible`, `moyen` ou `élevé`) est un réglage de raisonnement, pas une estimation garantie du quota. La génération du modèle ne permet pas, à elle seule, de déduire sa consommation.

Référence vérifiée le 9 octobre 2026 : [modèles disponibles et recommandations Codex](https://learn.chatgpt.com/docs/models).

Le routage persistant est défini dans `.cursor/rules/tutelliv-model-router.mdc` et l'exécution isolée dans `.cursor/agents/tutelliv-task-runner.md`. Par défaut, une seule tâche est menée jusqu'à sa preuve et sa case avant de rendre le bilan ; aucun agent parallèle ni mode Ultra n'est lancé sans justification explicite.

- Ne démarrer que le travail autorisé. Le plan ne vaut pas autorisation de tout implémenter. SEC-02 et SEC-01 ont été explicitement autorisées puis réalisées ; les autres tâches restent à engager selon la demande utilisateur.
- Pour chaque tâche : inspecter le code et les preuves → préciser le scénario attendu → implémenter → tester → corriger → retester → consigner le résultat et mettre à jour la case → poursuivre la première tâche autorisée non bloquée.
- Une case cochée signifie critère de sortie vérifié, avec preuve et limites. « Présent dans le code » ou « HTTP 200 » ne suffisent pas à valider une fonctionnalité entière.
- Conserver les modifications locales. Distinguer défaut reproduit, risque de code et hypothèse produit. Si un scénario dépend d’un accès, continuer les autres tâches.
- Questions réservées aux identifiants indispensables, coûts/engagements externes, actions destructives, décisions produit majeures ou refus du contrôle automatique. Ne pas redemander l’autorisation de tests sur la base actuelle : elle a été donnée pour des données E2E identifiables, sans données réelles.
- Codex peut prendre les choix techniques courants. Le propriétaire décide segment, promesse, offre, périmètre comptable, engagements de support et lancement. Les essais terrain et validations spécialisées nécessitent leurs intervenants.
- Pas de calendrier de développement ni de tarif validé déduit de ces rapports. Après inspection d’une tâche, la découper si elle ne tient pas dans un changement vérifiable.

## Acquis à conserver

- [x] SETUP-1 — AGENTS.md, relais Cursor et backlog centralisés.
- [x] SETUP-2 — Synchronisation implicite de base retirée au démarrage.
- [x] SETUP-3 — Types/lint/tests locaux configurés : 7 tests lors de l’audit initial ; suite portée à 217 tests réussis, avec les avertissements lint historiques consignés, au 16 octobre 2026.
- [x] SETUP-4 — Lancement, variables et e-mails optionnels documentés.
- [x] RUN-1A — Build production et parcours principal vérifiés : inscription, trois rôles, commande, affectation, photo, livraison, facture PDF ; course avec échec motivé. Une commande a aussi été créée et clôturée par navigateur.
- [x] RUN-1B — Contrôles anonymes et plusieurs refus entre rôles/entreprises vérifiés ; fuite du support reproduite puis corrigée dans SEC-02 ; anomalie de compteur après facturation ensuite corrigée et vérifiée dans BILL-02.

Ces réussites ne valident pas le GPS terrain, la charge, la conformité du PDF ni le cron. Les droits mini-admin et frontières d’entreprise ont ensuite été couverts par SEC-03 et SEC-06. L’environnement dédié et la recette commerciale complète restent ouverts.

## Ordre d’exécution et tâches différées

Priorités réconciliées le 22 octobre 2026 pour les tâches encore ouvertes. Le niveau indique l'ordre du travail interne ; les validations extérieures sont suivies séparément et ne doivent pas immobiliser les tâches indépendantes :

- **P0 — Débloquer les pilotes et garder la chaîne verte :** ENV-2, tranche pilote d'ONBOARD-1. La phase documentaire COST-1, DEMO-2, OPS-03B, SIGNUP-1, SAAS-01A, ADMIN-1, ENV-1, CI-1, DB-1, OPS-03A et les principales frontières SEC sont terminées ; toute régression mesurable ou CI rouge redevient P0.
- **P1 — Fermer la fiabilité et le libre-service testable :** SEC-05, EMAIL, SAAS-01B, SAAS-03, SAAS-04, SALES-1, SAAS-02, PERF-02.
- **P2 — Expérience et préparation opérationnelle :** DESIGN-1, MAP-3, UX-03, UX-04, GROWTH-1, V1-GO, OFFER-1, COST-1 (phase mesurée).
- **P3 — Validation extérieure et terrain :** LEGAL-1, DATA-02, MOB-01C, PROD-02, PROD-04, PILOT-1, PILOT-2, RELEASE-1.
- **P4 — Extensions après validation :** SMS. Aucun paiement réel, fournisseur payant ou déploiement de production n'est autorisé par cette priorité.

Les dépendances de sécurité et de validation priment sur le numéro : une tâche P3 peut être préparée localement, mais ne doit pas contourner une porte P0/P1 pour utiliser des données réelles.

1. Terminé : DEMO-2 rend la démo rapide et réutilisable grâce au pool isolé et au recyclage asynchrone.
2. Terminé : SAAS-01A fournit le catalogue versionné, le registre pilote/souscription, les droits, options, quotas et compteurs appliqués côté serveur.
3. Terminé : OPS-03B surveille la préproduction protégée toutes les trente minutes et a validé l'alerte de panne puis de reprise ; conserver les mesures de coûts pour PERF-02.
4. Terminé : SIGNUP-1 orchestre offre, compte, vérification e-mail, faux paiement déterministe, activation idempotente et reprise après interruption.
5. Tranches locales faites : adaptateur Stripe sandbox (SAAS-01B), vue « Mon abonnement » (SAAS-03), découverte premium (SAAS-04) et noyau théorique de SALES-1. Restent la preuve Stripe en mode test, les mutations d'abonnement et la persistance commerciale.
6. Fermer ONBOARD-1 pour les comptes pilotes créés manuellement, puis le relier au parcours autonome ; terminer en parallèle les e-mails, la capacité et les essais GPS physiques dès que leurs ressources sont disponibles.
7. Appliquer DESIGN-1, MAP-3, UX-03 et UX-04 aux parcours essentiels, puis intégrer le site commercial, la supervision interne et la recette V1 sur données fictives.
8. Après les portes sécurité, juridique et exploitation, conduire les trois pilotes séparément de la découverte premium, remplacer les hypothèses de coût par des mesures et décider de la mise en vente.
9. Activer le paiement réel seulement après structure juridique, règles fiscales/facturation, compte bancaire, contrats et décision explicite.

La réorganisation du plan n’autorise pas à implémenter tout le backlog. La reprise a permis de formaliser PROD-03 et V1-RECETTE ; la recette complète V1-GO reste ouverte.

## Audit de fusion — SaaS autonome, 21 octobre 2026

- **Déjà développé et à conserver :** préproduction Supabase/Vercel isolée, branche GitHub et CI connectée ; séparation multi-tenant et permissions principales ; trois espaces ; parcours complet d'une livraison ; commandes récurrentes ; duplication d'une ancienne commande/livraison ; preuve, historique, échanges, support, export comptable ; page publique de présentation ; première supervision SUPER_ADMIN ; assistant interne en sept étapes.
- **Partiellement développé :** inscription autonome complète avec paiement fictif mais sans fournisseur de paiement sandbox/réel ; onboarding calculé depuis les données et désormais atteint après activation, mais invitations réelles/import/reprise commerciale non qualifiés ; supervision interne limitée aux entreprises/utilisateurs/livraisons et au revenu des prestations ; restauration fournisseur exercée, mais sauvegarde horaire et alertes encore incomplètes ; site public sans pages Tarifs/Fonctionnalités/Démo/Contact/Légal complètes. Le catalogue, les souscriptions/pilotes, les droits et compteurs de quotas sont présents via SAAS-01A.
- **Absent du code au 21 octobre :** découverte premium, Stripe, factures d'abonnement, espace « Mon abonnement », attribution commerciale persistée, commissions, simulation de coûts multi-clients et tableau de supervision SaaS complet. *Au 26 octobre, tous ont une tranche locale (voir SAAS-01B/02/03/04, SALES-1, COST-1, ADMIN-1) sauf les factures d'abonnement et l'attribution commerciale persistée.*
- **Doublons évités :** infrastructure → ENV-1/CI-1/DB-1/OPS-03A ; e-mails → SEC-05/EMAIL ; onboarding après activation → ONBOARD-1 ; récurrence/duplication → OPS-01 et fonctions existantes ; UX/cartes → MAP-3/DESIGN-1/MOB-01C ; pilotes → PILOT-1/2 ; site → GROWTH-1 ; métriques → SAAS-02 ; mise en vente → RELEASE-1.

## Matrice des 27 tâches ouvertes

Revue du 26 octobre 2026 : lignes des tâches closes retirées (DEMO-2, OPS-03B, SIGNUP-1, ADMIN-1), ENV-2 et DISPATCH-3 ajoutées (DISPATCH-3 close le 27 octobre), prochain incrément réaligné sur le code. `A` = indispensable ou utile aux pilotes ; `B` = libre-service payant ; `C` = croissance après les deux jalons. « Local » signifie qu'un incrément vérifiable peut être terminé sans dépense ni intervention extérieure.

| Tâche | Jalon | Travail restant et prochain incrément | Dépendance / parallélisation | Complexité · modèle |
|---|---|---|---|---|
| ENV-2 | A+B | Rendre `.env.local` joignable (projet de développement en pause) et changer son mot de passe exposé. | Propriétaire ; contournement documenté par `.env.preproduction.local`. | Faible · GPT‑6 Luna |
| SEC-05 | A+B | Code et 32 tests locaux faits ; recette avec envoi réel, expiration et réception. | Domaine/expéditeur. | Moyenne · GPT‑6.1 Sol |
| EMAIL | A+B | Modèles et transport de test faits ; envoi réel, erreurs fournisseur et réception. | Domaine/Resend. | Moyenne · GPT‑6.1 Sol |
| ONBOARD-1 | A+B | Tranche technique qualifiée ; essai par un pilote réel, temps humain, invitations réelles, décision d'import. | Pilotes + EMAIL. | Élevée · GPT‑6.1 Sol |
| MOB-01C | A | Exécuter GPS, verrouillage, refus et reprise sur iPhone/Android réels. | Appareils/opérateur. | Moyenne · GPT‑6.1 Sol |
| DESIGN-1 | A+B | Tranche portail (Light et Dark) livrée et recettée sur tutelliv-dev (29 octobre) ; propager aux espaces administrateur et livreur, lecteur d'écran, zoom 200 %. | Local ; validation visuelle du propriétaire. | Élevée · GPT‑6.1 Sol |
| MAP-3 | A | Plan vectoriel Menthe livré ; validation visuelle et cas sans réseau. | Après DESIGN-1 ; propriétaire. | Moyenne · GPT‑6.1 Sol |
| UX-03 | A+B | Inventorier les entrées vers une livraison et unifier la fiche. | Après composants DESIGN-1. | Élevée · GPT‑6.1 Sol |
| UX-04 | A+B | Inventorier et simplifier les actions des parcours prioritaires. | Après composants DESIGN-1. | Moyenne · GPT‑6.1 Sol |
| V1-GO | A | Rejouer la recette finale et documenter les limites promises. | MOB-01C, EMAIL/SEC-05 réels, LEGAL-1 ; latence préproduction (PERF-02). | Élevée · GPT‑6 Astra |
| LEGAL-1 | A+B | Compléter les inconnues puis obtenir validation professionnelle. | Identité éditeur et professionnels externes. | Moyenne · GPT‑6 Astra |
| DATA-02 | A+B | Export complété du contrat SaaS (27 octobre) ; export en flux, remise chiffrée, politique et nettoyage planifié. | Politique finale : LEGAL-1. | Élevée · GPT‑6 Astra |
| PROD-02 | A | Conduire dix entretiens sur le travail réel. | Recrutement/contacts autorisés. | Élevée · GPT‑6.1 Sol |
| PROD-04 | A+B | Instruments définis ; mesurer sur pilotes. | PROD-02/PILOT-1. | Moyenne · GPT‑6.1 Sol |
| OFFER-1 | A+B | Confronter au marché la grille et les limites. | Prospects/pilotes. | Moyenne · GPT‑6 Astra |
| PILOT-1 | A | Recruter, contractualiser et conduire trois pilotes quatre semaines. | Portes A–C et autorisation de contact. | Moyenne · GPT‑6.1 Sol |
| PILOT-2 | A | Analyser usage, valeur, abandons et volonté de payer. | Après PILOT-1. | Moyenne · GPT‑6 Astra |
| SAAS-01B | B | Recette réelle en mode test faite le 27 octobre : Checkout, refus, 3D Secure, webhooks, renouvellements, impayé, changement, résiliation, remboursement. | Tarification adaptative à désactiver (propriétaire). | Très élevée · GPT‑6 Astra |
| SAAS-03 | B | Lecture, API et écran « Mon abonnement » : changement de formule (aperçu, prorata, comptes en excès bloquants) et résiliation à l'échéance, recettés sur Stripe sandbox réelle (27 octobre) ; abonnements sans compte de facturation en lecture seule. Restent options, moyen de paiement, documents, export DATA-02. | Arbitrage export (juriste). | Très élevée · GPT‑6 Astra |
| SALES-1 | B | Tout est fait et prouvé localement (27 octobre) : codes, écran super-admin, lien d'inscription, attribution figée, commissions et historique. Reste la vérification en préproduction. | Application de la migration avant fusion. | Élevée · GPT‑6 Astra |
| SAAS-02 | B+C | Lecture revenu/consommation et alertes C10 faites, affichées et recettées (27 octobre) ; réconciliation paiements, rétention, conversion. | Stripe de test. | Élevée · GPT‑6.1 Sol |
| PERF-02 | A+B | Harnais en mémoire et PostgreSQL local jetable faits (27 octobre) ; routes Next locales, puis préproduction et région Vercel. | Charge distante : accord propriétaire. | Élevée · GPT‑6 Astra |
| COST-1 | A+B | Phase documentaire faite ; phase 2 mesurée. | PERF-02 et pilotes. | Élevée · GPT‑6 Astra |
| GROWTH-1 | B | Tarifs, Fonctionnalités, Démonstration, Contact et sa boîte de lecture faits (27 octobre). Mini-démo interactive du hero faite le 27 octobre (client → dispatcher intelligent → livreur → suivi, `src/features/landing/product-tour/`, spec et plan dans `docs/superpowers/`) : `npm run check` vert, parcours navigateur 1440/390 et mouvement réduit verts ; revue visuelle propriétaire à faire. Reste : pages légales. | Migration à appliquer après fusion ; légal : LEGAL-1. | Élevée · GPT‑6.1 Sol |
| DEMO-3 | A+B | Tranches 1, 2, 3, 5 et 6 livrées et recettées sur tutelliv-dev (29 octobre) ; restent arrivée estimée en direct, créneau, tableaux de bord et tournées/push, puis e-mails réels. | EMAIL pour les e-mails réels ; migration pour le créneau ; accord du propriétaire pour les tournées. | Élevée · GPT‑6.1 Sol |
| RELEASE-1 | B | Rejouer toutes les portes avant encaissement et production. | Dernier jalon. | Très élevée · GPT‑6 Astra |
| SMS | C | Requalifier uniquement si les pilotes montrent un besoin payant répété. | Différée. | Moyenne · GPT‑6.1 Sol |
| FACTURX-1 | B | Implémenté et recetté (29 octobre) ; validation Mustang/FNFE, PDF/A strict, BT-32, plateforme agréée. | Propriétaire pour la validation officielle. | Moyenne · GPT‑6.1 Sol |
| INTAKE-1 | A+B | Implémenté, recette sans clé (29 octobre) ; clé, essai réel sur vingt messages, coût, fiche F10. | Propriétaire (clé, F10). | Moyenne · GPT‑6.1 Sol |
| POD-2 | A | Implémenté et recetté (29 octobre) ; essai sur téléphone réel, règles pilotables depuis l'interface. | MOB-01C. | Élevée · GPT‑6.1 Sol |
| OPS-FIAB | A+B | Implémenté (29 octobre) ; déclenchement réel du workflow, `after()` sur Vercel, Node 22, index en préproduction. | Propriétaire (secrets, Vercel). | Moyenne · GPT‑6 Luna |
| SEC-AUDIT | A+B | Implémenté et recetté (29 octobre) ; CSP bloquante, migration et secrets de préproduction, rattachement par e-mail. | Propriétaire (migration, secrets). | Élevée · GPT‑6 Astra |
| DISPATCH-4 | A | Outil de dispatch avancé : score pondéré réglable, temps de trajet réel, tournées, suggestions, réoptimisation. | Périmètre à cadrer avec le propriétaire. | Élevée · GPT‑6 Astra |
| CONFIG-MSG | A+B | Messages clairs quand une configuration échoue (cause et action), à commencer par Factur-X. | — | Moyenne · GPT‑6.1 Sol |
| DESIGN-2 | A+B | Mode sombre sur tout le site (landing, back-office, admin, livreur) et carte sombre assortie. | Après DESIGN-1 ; validation du propriétaire. | Élevée · GPT‑6.1 Sol |
| FACTURX-SAISIE | A+B | Champs exigés par le Factur-X obligatoires et bloquants dès l'enregistrement des mentions légales. | — | Moyenne · GPT‑6.1 Sol |
| LANDING-2 | A+B | Landing et page de connexion refaites : minimalistes, très visuelles (Apple, Tesla, Uber), claires et efficaces. | Direction visuelle : propriétaire. | Élevée · GPT‑6.1 Sol |
| MOBILE-WEB | A+B | Revoir toute l'application au format téléphone, dans le navigateur. | Après DESIGN-2, MAP-INTERACTION et UX-ALERTES. | Élevée · GPT‑6.1 Sol |
| CROSS-BROWSER | A+B | Même rendu sur Edge, Safari, Firefox et Chrome (écart constaté sur Edge). | Après LANDING-2 et MOBILE-WEB ; capture de l'écart à fournir par le propriétaire. | Moyenne · GPT‑6.1 Sol |
| AUTH-ROLE | A+B | Refuser côté serveur les pages d'un espace au mauvais rôle (aujourd'hui refus seulement côté navigateur). | — | Élevée · GPT‑6 Astra |
| RECETTE-2810 | A+B | Dix-sept points mineurs ou à trancher des recettes du 28 octobre. | Décisions produit du propriétaire. | Moyenne · GPT‑6.1 Sol |
| PROPRIO-2810 | A+B | Quatorze actions du propriétaire avant mise en ligne, dont les migrations de préproduction sur accord. | Propriétaire. | Faible · GPT‑6 Luna |

## 0 — Cadrer la V1 sur le problème observé

Le cadrage du propriétaire permet d’avancer ; aucun entretien commercial n’est exigé pour ces travaux internes.

- [x] **PROD-03 — Définir la promesse et la V1.** Orientation confirmée par le propriétaire : remplacer la chaîne d’e-mails par le portail client, l’affectation avec prise en charge, les échanges liés à la commande, les statuts et le GPS daté, puis la preuve et l’historique. Formaliser les scénarios et exclusions à partir de ce cadrage. Conserver les trois espaces existants. Définir les exclusions et fonctionnalités masquées si non fiables.

  Terminé quand : Scénario de réussite du client, liste V1 et hors V1 validés ; chaque fonction retenue répond aux difficultés rapportées par le propriétaire ; ne pas prétendre que cela valide le marché.

  Source / dépendance / blocage : Récit du propriétaire désormais recueilli ; docs/CADRAGE_CLIENT.md. Ne dépend plus des entretiens différés de PROD-02 pour préparer la V1.

- [x] **V1-RECETTE — Établir la recette du parcours principal.** Cartographier ce qui existe et les écarts, sans réécrire les fonctions déjà testées. Définir les scénarios client → admin → livreur → client : commande, affectation, prise en charge, changement, incident, position et preuve. Couvrir standard et coursier existants.

  Terminé quand : Une checklist liée aux tâches ci-dessous décrit rôle, action, résultat attendu et preuve de test pour chaque étape ; les écarts sont constatés dans le code ou le navigateur.

  Source / dépendance / blocage : Après formalisation PROD-03 ; prochaine préparation fonctionnelle, avant ajout de nouveaux écrans.

- [x] **V1-MESURE — Préparer les mesures sans attendre la prospection.** Définir comment mesurer temps de création/affectation, actions de coordination et accès au statut/à la position ; effectuer une mesure interne sur scénarios identiques.

  **Modèle conseillé : GPT‑6 Luna · effort moyen ; repli si indisponible : GPT‑5.6 Luna.**

  Terminé quand : Protocole reproductible et valeurs internes consignées avec appareil, réseau, volumes et aide utilisée ; aucun gain client chiffré annoncé sans observation réelle.

  Résultat vérifié le 2026-10-16 : protocole reproductible et cinq scénarios standard identiques exécutés sur entreprise fictive isolée. Médianes techniques : création commande/livraison 3 775,4 ms ; affectation 3 039 ms ; question client 2 105,3 ms ; réponse dispatch 2 108,3 ms ; relecture fil 1 260,3 ms ; lecture statut/position client 644,2 ms et administration 629,3 ms. Les cinq suivis rendent une position fraîche et une chronologie cohérente. Environnement, réseau, volume et assistance automatisée sont consignés.

  Validation : harnais connecté réussi, valeurs individuelles/minimum/médiane/maximum archivées ; comptes globaux strictement identiques avant/après et zéro résidu fixture. Protocole `docs/operations/v1-mesure/README.md`, rapport `docs/rapports/2026-10-16/v1-mesure.md`, preuve `outputs/v1-mesure/internal-baseline.json`. Ces valeurs ne mesurent ni le temps humain complet ni un gain client et ne doivent pas devenir une promesse commerciale. Prépare PROD-04 sans remplacer sa validation future.

## 1 — Protéger les données et les comptes

SEC-01/02/03/04 et SEC-06 sont terminées. SEC-05 est implémentée localement mais reste ouverte jusqu’à la configuration et à la recette e-mail réelles. L’absence d’accès hébergeur ne bloque pas les analyses et tests locaux indépendants.

- [x] **ENV-1 — Séparer développement, préproduction et production.** Inventorier les services existants ; préparer une cible isolée, secrets distincts et fixtures A/B. La base actuelle est autorisée pour les tests sans données réelles ; elle ne constitue pas une préproduction dédiée.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Tests reproductibles sur cible identifiée ; aucun envoi réel ; procédure de remise à zéro limitée aux fixtures documentée.

  Source / dépendance / blocage : Accès Supabase/hébergement et coût éventuel à confirmer.

  Avancement local vérifié le 2026-10-17 : inventaire reproductible sans valeur sensible ajouté. La seule configuration disponible reste la cible de test autorisée : origine applicative locale, Supabase configuré, runtime PostgreSQL poolé sur 6543 et accès direct sur 5432. Sept variables runtime sur huit sont présentes ; `OPS_HEALTH_SECRET` est injecté seulement au lancement local, tandis que les liens Auth, l'expéditeur métier et le webhook d'incident restent désactivés. Le dépôt GitHub et un lien Vercel local sont détectés, mais aucune cible préproduction/production ni comparaison de secrets n'est établie. `.env.local` est ignoré par Git. Zéro mutation et zéro valeur dévoilée. Script linté, 37 documents contrôlés, scanner sans détection sur 796 fichiers et diff-check réussis. Procédure `docs/operations/env1/README.md`, rapport `docs/rapports/2026-10-17/env1-inventory.md`, preuve `outputs/env1/inventory.json`.

  Reste à faire : confirmer le coût et créer deux cibles distinctes, renseigner les environnements protégés avec des secrets propres, appliquer la future baseline DB-1 à la préproduction, exécuter TEST-2 puis vérifier qu'aucune ressource de production n'est joignable. Aucun compte fournisseur n'a été modifié ; ENV-1 reste ouverte.

  Décision et coût au 2026-10-18 : le propriétaire autorise la préparation d'une préproduction séparée, mais demande validation avant toute dépense. Estimation documentée : environ 20 $/mois avec Vercel Pro + Supabase/Resend Free, 45 $/mois avec Supabase Pro, et 145 $/mois avec PITR 7 jours pour tester une cible RPO ≤ 1 h, hors taxes/domaine/dépassements. Aucune ressource créée. `docs/operations/env1/COSTS.md`.

  Avancement du 2026-10-19 : le dépôt distant `main` correspond toujours au dernier commit partagé du 7 septembre et ne contient pas le travail local actuel. Le dossier local est relié au projet Vercel `tutelliv-v2` et au Supabase existant `wlomrzilflbouzyhzwxm`. Une branche locale `preproduction` a été créée et le travail courant y est figé dans le commit local `34ba118`, sans push. Architecture retenue : cible actuelle pour le développement fictif et les 51 démonstrations, Vercel Preview + second Supabase gratuit distinct pour la préproduction, production distincte plus tard. La connexion aux trois tableaux de bord reste nécessaire pour confirmer branche Production, quotas et région avant création/push. Rapport `docs/rapports/2026-10-19/infrastructure-preproduction.md`, procédure `docs/operations/preproduction/README.md`.

  Vérification distante du 2026-10-19 : Vercel Hobby est connecté au bon dépôt et conserve `main` comme branche Production ; ses huit variables actuelles sont limitées à Production. Supabase Free contient un seul projet actif, deux projets en pause et dispose donc d'un second emplacement actif gratuit. Le projet actuel est à Paris. Le formulaire `tutelliv-preproduction` est préparé dans la même région, sans copie de données, avec exposition automatique des tables désactivée et RLS automatique activée. Aucun secret n'est saisi, aucun projet créé et aucun push effectué. La prochaine action est la génération sécurisée du mot de passe puis la création finale du projet isolé.

  Préproduction créée le 2026-10-19 : second projet Supabase Free sain à Paris, sans donnée copiée. Configuration locale distincte dans `.env.preproduction.local`, ignoré et limité au compte local. Baseline Prisma appliquée et vérifiée : vingt tables métier sous RLS, registre de migration protégé, zéro droit direct aux rôles publics, zéro utilisateur Auth, bucket `delivery-pods` privé limité à 5 Mio JPEG/PNG et zéro drift. Le formulaire Vercel est resté non enregistré. Le mot de passe PostgreSQL et la clé serveur aperçus dans une vue technique doivent être remplacés avant push ; ENV-1 reste ouverte jusqu'à cette rotation, la configuration Preview et TEST-2.

  Terminé le 2026-10-20 : identifiants remplacés, ancienne clé serveur révoquée, branche distante et Preview Vercel actives, variables Preview et environnement GitHub `preproduction` configurés. La migration additive RBAC et son rejeu sont vérifiés. Le commit `f6e19cc` est déployé avec succès en Preview et la chaîne GitHub connectée réussit la garde d'isolation, 279 tests, TEST-2, le montage temporaire, trois parcours Chromium, la preuve nettoyée et le nettoyage `always()`. Le contrôle direct final confirme zéro entreprise de test, zéro utilisateur Auth, deux migrations appliquées, zéro drift, RLS partout et bucket privé. La Preview reste protégée par l'authentification Vercel ; la CI teste donc le même commit dans son runner relié au Supabase de préproduction et contrôle le déploiement séparément. Rapport `docs/rapports/2026-10-20/preproduction-ci.md`.

- [ ] **ENV-2 — Rétablir une cible de développement locale joignable.** `.env.local` vise encore le projet Supabase de développement `wlomrzil…`, en pause : connexion, Playwright par défaut et recettes navigateur locales échouent (`ENOTFOUND`, 401), ce qui a bloqué les preuves navigateur de SAAS-03, SAAS-04 et ADMIN-1. Son mot de passe de base a de plus été exposé dans un journal d'outil le 26 octobre 2026.

  **Modèle conseillé : GPT‑6 Luna · effort faible.**

  Terminé quand : le mot de passe exposé est changé ; `.env.local` pointe vers une cible de développement joignable, distincte de la préproduction et de la production ; `npm run dev` permet une connexion démo et `npm run test:e2e` démarre sans contournement ; aucun secret n'est versionné.

  Source / dépendance / blocage : ajoutée lors de la revue du 26 octobre 2026 à partir de `docs/rapports/CLAUDE_STABILISATION_HANDOFF.md` (E2). Action du propriétaire : réactiver le projet gratuit en pause ou en créer un autre. Contournement en attendant : lancer l'application avec `.env.preproduction.local` sur la préproduction autorisée (commande dans le rapport de passation).

  Avancement du 2026-10-27, sur instruction du propriétaire. **Région** : les fonctions de préproduction tournaient en `iad1` (Washington) pour une base à Paris. `vercel.json` les fixe désormais en `cdg1`. Ce réglage est versionné : la production `main` ne change pas tant qu'elle n'est pas fusionnée. Test : `tests/env2-vercel-region.test.ts`. Mesure sur le déploiement protégé, 12 appels `GET /api/signup` après chauffe, tous en 200 : médiane **886 ms avant, 332 ms après**. **Projet de développement** : l'ancien `wlomrzil…` (20 tables sans historique Prisma, 57 entreprises fictives, 25 comptes, mot de passe exposé) n'était plus utilisé ; il est remis en pause, sans suppression. Le propriétaire a choisi un projet neuf : `tutelliv-dev` (Paris), créé vide, `tutelliv-restore-rehearsal` restant en pause pour les deux projets actifs du plan gratuit. La surveillance OPS-03B ne peut pas viser la préproduction depuis ce projet : aucune migration ne la planifie et sa fonction s'arrête (`OPS03B_MONITOR_NOT_CONFIGURED`) tant que le coffre Supabase est vide. Le même jour, `tutelliv-dev` a été mis à niveau : 19 migrations, 39 tables, même posture de sécurité que la préproduction, données de démonstration, réserve de 3 espaces, connexion de démonstration et 6 pages connectées vérifiées sur le port 3108. Le garde-fou `npm run env2:verify-dev` refuse tout `.env.local` qui viserait un autre projet ; la procédure est dans `docs/operations/env2/README.md`. Deux écarts corrigés au passage : un projet neuf n'a pas le déclencheur `ensure_rls` de la préproduction (installé à l'identique, documenté) ; et la construction d'un nouvel espace de démonstration attendait 8 livraisons alors que le scénario du 26 octobre en crée 15, ce qui bloquait toute création d'espace (la préproduction n'était pas touchée, ses espaces existants passant par le recyclage). **Constat** : le `.env.local` du dossier de l'agent 2 contient une clé Stripe de test valide (`livemode: false`, EUR, aucun client), vérifiée en lecture seule ; son origine reste à confirmer avant de lever le blocage Stripe de SAAS-01B.

  Suite navigateur du 2026-10-28 : `npm run test:e2e` démarre seul son serveur de développement contre `tutelliv-dev`, sans contournement. Sous Node 20, le nettoyage de V1-GO échoue faute de WebSocket natif (Supabase) et laisse 2 commandes et une photo, supprimées depuis ; sous Node 22.18.0 (`npx -y -p node@22.18.0 -- npm run test:e2e`), V1-GO passe avec un nettoyage complet. Corrections d'essais : ONBOARD-1, écrit pour la préproduction isolée, est ignoré explicitement quand la garde `env2:verify-dev` reconnaît `tutelliv-dev` (il reste joué en CI) ; TEST-2 passe à 240 s, car depuis le poste local la base distante allonge chaque appel et la panne simulée ne s'affiche qu'après les trois relances de React Query (vérifié par sonde : erreur visible à 15 s) ; SUPPORT-1 et V1-GO se déconnectent désormais à la fin, ce qui rend l'espace de démo au pool. Sans cela, chaque passage complet gardait plusieurs espaces loués une heure, et le troisième passage du jour a échoué en 503 sur 7 essais (pool vide). Meilleur passage complet avant ces corrections : 21 réussis, 3 échecs expliqués ci-dessus. À rejouer : la suite complète une fois le pool libéré, pour confirmer SUPPORT-1 et V1-GO avec déconnexion. Restent côté propriétaire : origine de la clé Stripe de test et Node 22.18.0 installé en local.

  Avancement du 2026-10-29 : `.nvmrc` fixé à 22.18.0 et `engines` à `>=22.18 <23` (chantier fiabilité, OPS-FIAB) ; le Node 22 sur Vercel reste à régler par le propriétaire (PROPRIO-2810). Les cinq migrations du 28 octobre ont été appliquées sur `tutelliv-dev` uniquement ; `npm run check` 1145/1145 sous le contrôle de l'orchestrateur. Une des vérifications de l'audit Codex (complément 2) a échoué sous le sandbox (`listen EPERM` sur le test PERF-02) : le check complet ne se prouve pas dans tout environnement restreint.

- [x] **SEC-02 — Bloquer les références étrangères dans le support.** Vérifier entreprise ET client pour relatedOrderId et relatedDeliveryId avant insertion et lecture.

  Terminé quand : Le ticket B vers commande/livraison A est refusé sans révéler de référence ; ticket légitime réussi ; tests de régression.

  Source / dépendance / blocage : Défaut reproduit via API E2E.

  Preuve actuelle : correction locale validée par 10 tests locaux et 23 vérifications HTTP ; rapport SEC-02. Non déployée.

- [x] **SEC-01 — Limiter le rattachement des données au bon client et à sa société.** Ajouter le périmètre entreprise au rattachement par e-mail ; vérifier commandes, livraisons, factures et photos. Préparer le traitement des anciens rattachements sans correction massive implicite.

  Terminé quand : Deux entreprises avec même e-mail de commande orpheline restent isolées au login, à la création de compte et au téléchargement.

  Source / dépendance / blocage : Reproduit sur code avec Prisma simulé ; décider identité multi-entreprises si nécessaire.

  Preuve actuelle : correction locale validée par 16 tests locaux et 31 assertions API/base ; aucun ancien rattachement interentreprises détecté lors du contrôle ciblé. Rapport SEC-01. Non déployée.

- [x] **SEC-03 — Fermer l’augmentation indue des droits mini-admin.** Refus par défaut pour réglages absents ; réserver la délégation sensible ou plafonner les droits accordables côté serveur. Préparer tests locaux et matrice de rôles.

  Terminé quand : Impossible d’augmenter ses propres droits ou de créer un compte plus privilégié ; réglages vides n’ouvrent aucun module.

  Preuve locale : seuls COMPANY_ADMIN/SUPER_ADMIN gèrent les mini-admins ; entreprise contrôlée ; réglages absents/vides sans accès ; choix explicite dans l’interface. `npm run check` : 28 tests réussis dont 12 SEC-03, types OK, lint sans erreur (24 avertissements existants). Services et routes exécutés avec dépendances simulées. Recette distante et navigateur non exécutée ; test distant de privilèges toujours soumis à autorisation spécifique. Rapport SEC-03 dans docs/rapports/2026-09-27/sec03.md.

- [x] **SEC-04 — Faire respecter suspension et révocation.** Vérifier statuts compte/entreprise dans les gardes et invalider les permissions en cache de façon cohérente entre instances.

  Terminé quand : Compte suspendu refusé sur les routes protégées ; retrait de module effectif dans un délai documenté et testé.

  Preuve locale : autorisation explicite reçue après le refus initial. Statuts compte/entreprise contrôlés, cache de permissions inter-requêtes retiré, connexion/synchronisation et démo contrôlées. 39 tests réussis dont 11 SEC-04 ; types OK, lint sans erreur (24 avertissements existants). Retrait effectif dès la prochaine requête après validation en base, testé sur deux instances simulées. Aucune suspension distante ni déploiement. Requêtes déjà autorisées, jetons Supabase, Storage et écrans déjà chargés hors de cette garantie. Rapport : docs/rapports/2026-09-28/sec04.md.

- [ ] **SEC-05 — Remplacer les mots de passe temporaires persistants par des invitations.** Invitations limitées dans le temps et à usage unique, mot de passe choisi par le destinataire, e-mail vérifié, limites de tentatives et récupération de compte.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : Aucun mot de passe en localStorage ; invitation expirée/réutilisée refusée ; récupération et déconnexion testées.

  État : implémentation locale et tests terminés ; case laissée ouverte pour EMAIL et recette Supabase réelle. Invitations sans mot de passe temporaire ; ancienne persistance purgée ; compte en attente jusqu’au choix du mot de passe ; récupération et inscription entreprise avec confirmation ; auto-confirmation au login retirée. `npm run check` : 52 tests réussis (13 nouveaux), types/lint OK, 24 avertissements existants. Contrôles navigateur sur copie isolée : liens absents/fictifs, confirmation et refus propre lorsque les envois sont désactivés. Aucun envoi ni changement distant.

  Reste : configurer SMTP, les trois modèles et Confirm email, vérifier expiration/limites réellement appliquées, tester réception/rejeu/expiration/récupération/reprises avec une boîte contrôlée. AUTH_EMAIL_LINKS_ENABLED absent actuellement : nouveaux envois Auth désactivés. Docs : docs/AUTH_EMAIL_SETUP.md et docs/rapports/2026-09-28/sec05.md. Les réponses fournisseur simulées ne valident pas sa configuration distante.

  Avancement local du 2026-10-24 : liens d'invitation et de récupération expirés, ainsi que leur seconde utilisation, sont refusés sans écriture ni activation dans le vrai service, avec Supabase simulé. La panne fournisseur est visible, la reprise garde la même clé, et le mode `disabled` ne contacte jamais Resend, même au rejeu. Validation locale : `npm run test:email-sec05` 32/32 et `npm run check` 366/366 ; aucune configuration SMTP/Supabase/Resend, aucun domaine ni réception réelle. Rapport `docs/rapports/2026-10-24/email-sec05-local.md`.

  Avancement du 2026-10-28, chantier sécurité (rapport `docs/rapports/agents/2026-10-28-securite.md`, tâche SEC-AUDIT) : l'auto-inscription ne crée plus jamais d'entreprise ni d'abonnement `LEGACY` ; les connexions échouées sont limitées (e-mail + source 5, e-mail seul 20, source 30, sur 15 minutes glissantes, 429 en français avec `Retry-After`, même message pour un compte inexistant) et `/api/profile/password` suit la même limite. Recette navigateur de l'intégration : cinq échecs puis 429, `retry-after: 889`. La récupération de compte, l'invitation et l'envoi réel restent ceux décrits ci-dessus : case laissée ouverte, « Reste » inchangé (SMTP, trois modèles, Confirm email, protection Supabase contre les mots de passe compromis, réception réelle).

- [x] **SEC-06 — Vérifier toutes les frontières d’accès et le stockage.** Couvrir API, exports, PDF, photos, rôles et accès directs Supabase ; inspecter politiques réellement déployées, sans supposer leur absence.

  Terminé quand : Matrice A/B × admin/mini-admin/client/chauffeur documentée ; refus lecture/écriture/téléchargement hors périmètre, y compris URL signées expirées.

  État final vérifié le 2026-10-05 : faille distante confirmée puis verrouillée après autorisation explicite. RLS activé et zéro droit direct anon/authenticated/PUBLIC sur les 17 tables métier ; REST avec la seule clé publique renvoie 401 sur les 17. Prisma reste opérationnel. Chemins de photos et frontières d’entreprise renforcés sur commandes, livraisons, cartes, factures/PDF, modèles de nouvelle commande et missions chauffeur. `npm run check` : 58 tests réussis, types/lint OK (24 avertissements existants). Bucket privé ; URL publique refusée, lien signé lisible avant expiration puis refusé après expiration.

  Recette connectée : 41/41 contrôles réussis sur A/B × admin/mini-admin/client/chauffeur, dont lectures autorisées, accès et écritures étrangers en 404, interfaces d’un autre rôle en 403, PDF, messages et photos. Le mini-admin fictif temporaire a été supprimé de la base et de Supabase Auth. Aucun contenu métier modifié. Script de retour arrière conservé mais non exécuté. Rapport : docs/rapports/2026-10-01/sec06.md. Aucun déploiement.

  Source / dépendance / blocage : Terminé ; les droits par défaut des futures tables restent dans DB-1.

- [ ] **SEC-AUDIT — Durcissement du 28 octobre et correctifs de l'audit Codex.** Fermer les faiblesses relevées par la revue du 28 octobre : inscription qui créait des entreprises, limitation des connexions, erreurs internes exposées, corps JSON non stricts, contrôle d'origine, en-têtes de sécurité, secret HMAC du Contact, et minimisation des données du livreur vues par le client.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : la CSP passe de Report-Only à bloquante après une recette sans violation sur les cartes, Stripe, Supabase et les polices ; la migration de limitation est appliquée en préproduction ; `CONTACT_HMAC_SECRET` est défini ; la protection Supabase contre les mots de passe compromis est active ; le rattachement par e-mail est arbitré ; aucune donnée de livreur au-delà de la règle décidée n'est lisible côté client.

  Source / dépendance / blocage : branche `agent/securite` et branche `agent/correctifs-codex` intégrées ; rapports `docs/rapports/agents/2026-10-28-securite.md` et `2026-10-29-correctifs-codex.md` ; audit indépendant `outputs/verification-2026-10-28/rapport.md`. Migration `20261028180000_auth_login_failures` (RLS + REVOKE), appliquée sur tutelliv-dev uniquement ; sans elle la limitation est inactive (la connexion reste permise, erreur journalisée). Actions du propriétaire : PROPRIO-2810.

  État : implémenté et recetté sur tutelliv-dev les 28 et 29 octobre 2026. Sécurité : plus aucune entreprise ni abonnement `LEGACY` créé par `syncUserFromSupabase` (`accountType` et métadonnées Supabase ignorés) ; limitation des connexions par réservation atomique sous verrou consultatif (e-mail + source 5, e-mail seul 20, source 30 si l'IP est connue), 429 en français avec `Retry-After`, aucune lecture du compte, panne de base ou migration absente = connexion permise ; `withApiHandler` ne montre que les erreurs métier nommées, `ZodError` et le JSON invalide ; `.strict()` sur `portal/order-estimate`, `portal/notifications`, `admin/sales-codes/[id]`, `auth/sync` (`contact` et `admin/sales-codes` déjà stricts) ; contrôle `Origin` des mutations dans le middleware (webhook Stripe et crons exemptés) ; `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` et CSP Report-Only dans `next.config.ts` ; `CONTACT_HMAC_SECRET` dédié ; test de graphe d'imports interdisant à un module client d'atteindre `admin.ts` ; code mort retiré. Correctifs de l'audit Codex (livreur vu par le client) : I2 prénom seul et téléphone masquable par l'entreprise (`portalShowDriverPhone`, défaut vrai, `GET/PATCH /api/company/portal-settings`, interrupteur dans les réglages) ; C2 sorties de la fiche commande, de la carte, du suivi partagé et des échanges réduites au prénom, back-office inchangé ; C3 anciens livreurs de l'entreprise (inactifs compris) et noms à particules masqués dans l'historique, libellé « Assignée automatiquement » neutralisé. `npm run check` 798/798 sur la branche sécurité puis 1145/1145 sur l'intégration (557e9d5) ; `security-review` : aucune vulnérabilité de confiance supérieure ou égale à 8. Recette navigateur : cinq échecs puis 429 (`retry-after: 889`), même message pour compte existant ou non ; mutations avec `Origin` étranger refusées en 403 (déconnexion, commandes, factures, connexion) ; en-têtes présents sur `/login` ; zéro violation CSP sur `/dashboard`, `/dispatch`, `/portal/orders`, `/driver/missions`, `/admin` et les cartes ; recette ciblée de 557e9d5 : aucun nom de famille dans dix réponses client et cinq écrans (y compris « Jean de La Fontaine » réaffecté), interrupteur, rôles client et livreur refusés en 403, nom complet conservé au back-office. Audit Codex : complément 2 non favorable (C3, C4), complément 3 favorable côté code sur 557e9d5, avec réserves. Case laissée ouverte : migration non appliquée en préproduction, CSP encore Report-Only, actions du propriétaire en attente.

  Reste : CSP bloquante après une recette complète (Stripe, Supabase Storage, polices, cartes) ; HSTS à vérifier en préproduction (posé par Vercel, absent en développement) ; migration `20261028180000_auth_login_failures` en préproduction ; `CONTACT_HMAC_SECRET` dans Vercel ; protection Supabase contre les mots de passe compromis ; recette de connexion et d'inscription réelles avec le contrôle d'origine ; le rattachement par e-mail de `syncUserFromSupabase` ne filtre pas `authId: null` (un compte Supabase recréé avec la même adresse confirmée reprend le profil ; pas d'exploitation connue, à arbitrer avec la réinvitation) ; `docs/legal/J5_AUDIT_FACTUEL_DEV.md` cite encore `provision-company-admin.ts` (document juridique non modifié, à traiter par le fondateur) ; `429` non testé sur un compte livreur ou client, MINI_ADMIN non recetté ; noms de livreurs saisis dans du texte libre (motif d'annulation, message, ticket) et nom de famille cité seul non couverts par le masquage ; un livreur supprimé cité sans le préfixe « Livreur » n'est pas réduit ; un prénom composé séparé par une espace est tronqué (sens le plus sûr) ; verrous consultatifs (connexion, commande par message, relances) simulés en mémoire et jamais exercés sur PostgreSQL réel ; généralisation de `updateSettingsWithClaim` (RECETTE-2810).

- [x] **DB-1 — Versionner les évolutions de base.** Comparer schéma et état de la cible, établir une base de migrations et une stratégie de retour arrière.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : Migration sur copie isolée et procédure de restauration vérifiées ; aucune synchronisation implicite au démarrage.

  Avancement ciblé ACK-1 vérifié le 2026-10-10 : ajout nullable versionné, testé sur copie de 32 livraisons avec export/restauration identiques puis appliqué explicitement à la base de test. Valeurs initiales et RLS préservées. Cette copie partielle ne valide pas baseline globale, relations/politiques complètes, droits des futures tables ou restauration base+photos ; DB-1 reste ouverte. Procédure : `docs/operations/ack1/README.md`.

  Avancement local vérifié le 2026-10-17 : audit de schéma reproductible ajouté. Le premier diff cible → Prisma contenait onze opérations : remplacement de cinq clés étrangères dont l'action de mise à jour déployée était `NO ACTION`, et retrait du défaut déjà présent sur `operation_jobs.updated_at`. Le schéma Prisma a été aligné sur la cible existante, sans écriture distante ; le diff est maintenant vide. La base contient vingt tables publiques, toutes avec RLS, zéro politique et zéro droit direct `anon`/`authenticated`/`PUBLIC`, mais aucune table `_prisma_migrations`. L'empreinte catalogue est strictement identique avant/après. Deux brouillons séparés ont été générés : baseline Prisma de 119 instructions et complément sécurité des vingt tables. Ils sont marqués non applicables et ne couvrent pas Auth/Storage. Validation : 235 tests, types/lint stricts, scripts d'audit lintés, 38 documents, scanner sans détection sur 802 fichiers, diff-check et build de 100 pages réussis. Procédure `docs/operations/db1/README.md`, rapport `docs/rapports/2026-10-17/db1-inventory.md`, preuves `outputs/db1/`.

  Reste à faire : remplacer les identifiants signalés, exécuter TEST-2 sur la Preview, tester une migration additive et sa reprise, puis traiter la cible historique seulement après sauvegarde et autorisation. DB-1 reste ouverte.

  Avancement préproduction du 2026-10-19 : migration initiale versionnée sous `prisma/migrations/20261019000000_initial`, appliquée avec succès sur la cible isolée vide. Le contrôle connecté confirme vingt tables métier, une migration terminée, RLS sur les vingt-et-une tables publiques avec le registre, zéro politique ou droit public, zéro utilisateur Auth, bucket privé conforme et zéro drift Prisma. Script reproductible : `npm run db1:verify-preproduction`. DB-1 reste ouverte pour la rotation des identifiants, TEST-2, une migration additive avec reprise et le traitement séparé de la cible historique après sauvegarde et autorisation.

  Avancement du 2026-10-20 : identifiants remplacés et ancienne clé serveur révoquée. La migration additive `20261019010000_rbac_reference_data` versionne six rôles, trente-trois permissions et cent neuf liaisons ; son application puis un second `migrate deploy` sans migration en attente sont vérifiés. TEST-2 passe sur la cible isolée et la vérification finale retrouve deux migrations, zéro drift, zéro utilisateur Auth et les références exactes. DB-1 reste ouverte pour une restauration complète base + Storage et le traitement séparé de la cible historique après sauvegarde et autorisation.

  État final vérifié le 2026-10-21 : deux schémas temporaires strictement bornés ont reçu les deux migrations sur la préproduction isolée. Un graphe fictif couvrant les vingt tables applicatives a été exporté puis restauré à l'identique ; les vingt empreintes correspondent, les références RBAC sont exactes, RLS couvre les vingt tables, le diff Prisma est vide et un second `migrate deploy` ne trouve rien à appliquer. Les schémas temporaires ont été supprimés. L'empreinte du schéma public, ses compteurs métier et le bucket Storage sont identiques avant/après. Le contrôle final reconnaît seulement la démo permanente et trois sessions temporaires valides. La restauration complète du service et de Storage a ensuite été validée séparément dans OPS-03A.

  Source / dépendance / limite : Terminé ; procédure `docs/operations/db1/README.md`, rapport `docs/rapports/2026-10-21/db1-migration-restore.md`, preuves sans secret sous `outputs/db1/`. Toute migration destructive future doit disposer de sa propre reprise vérifiée.

  Garde de régression du 2026-10-27 : `tests/db1-migration-security.test.ts` lit les 19 migrations. Il vérifie que les tables publiques créées correspondent exactement aux `@@map` du schéma, et que chacune active la RLS et retire tous les droits à `PUBLIC`, `anon` et `authenticated` (forme simple ou bloc conditionnel). Il vérifie aussi qu'aucune `CREATE POLICY` ni aucun `GRANT` vers ces rôles n'apparaît. Contrôle du même jour, en lecture seule : l'écart entre la base de préproduction et le schéma de la branche (`prisma migrate diff --from-url`) est identique, instruction par instruction, aux deux migrations en attente (`contact_messages`, `sales_codes`). Rejouer toute la chaîne sur un PostgreSQL vierge reste impossible, car elle exige les extensions Supabase `http`, `pg_cron` et le schéma `storage`. Vérifié : 3/3, et chaque règle échoue bien quand on retire la RLS ou un REVOKE, ou qu'on ajoute un GRANT ou une table sans modèle.

## 2 — Remplacer la coordination par e-mail

Le client utilise son espace pour commander ; l’administrateur organise et le livreur prend en charge. Un ticket support seul ne prouve pas que les échanges de mission sont couverts.

- [x] **OPS-02A — Rendre la création de commande atomique.** Regrouper commande, articles et livraison dans une transaction adaptée ; tester les erreurs à chaque écriture.

  Terminé quand : Une panne ne laisse pas de commande partielle ni de livraison orpheline.

  État final vérifié le 2026-10-05 : commandes standard et coursier, articles, collectes et livraison créés dans une transaction unique. Les générateurs internes de données client et de scénario démo couvrent aussi leurs chaînes associées. Pannes injectées aux étapes commande, articles et livraison : zéro objet partiel. Recette connectée : deux créations 201, structures complètes, deux nettoyages et zéro résidu. `npm run check` : 63 tests réussis, types/lint OK (24 avertissements existants). Aucun changement de schéma, migration ou déploiement.

  Source / dépendance / blocage : Terminé ; rapport `docs/rapports/2026-10-05/ops02a.md`. OPS-02B a ensuite ajouté la déduplication et les effets différés durables.

- [x] **OPS-02B — Empêcher les doublons et garantir les effets différés.** Clé d’idempotence, tâches durables pour dispatch/notifications, reprises bornées et visibilité des échecs.

  Terminé quand : Double clic, requête répétée et arrêt du processus donnent une seule commande et des effets rejouables sans doublon.

  État final vérifié le 2026-10-08 : la création client exige une clé d’idempotence stable par tentative ; une répétition identique rend la même commande et un contenu différent sous la même clé renvoie 409. Commande, livraison et tâche d’auto-dispatch sont créées ensemble. Dispatch et notifications utilisent des tâches persistantes, réclamées atomiquement avec bail de 5 minutes, trois tentatives maximum et reprises à 1, 5 puis 30 minutes. Les workers expirés ne peuvent pas écraser leur successeur ; les échecs sont visibles et relançables par l’entreprise autorisée. Les notifications sont dédupliquées par événement, limitées à l’entreprise et à une ressource encore existante, avec la même clé d’idempotence chez Resend. Les changements génériques ne peuvent plus déclarer « affectée » sans passer par l’affectation d’un chauffeur.

  Recette connectée sur la base de test : deux créations concurrentes 201 donnent un seul identifiant, une commande, une livraison et une tâche ; conflit de contenu 409 ; répétitions de statut, facture et acceptation de mission spéciale sans doublon ; reprise d’une tâche abandonnée réussie ; affectation sans chauffeur refusée par les routes commande et livraison (409). Données fictives nettoyées, zéro résidu. Schéma contrôlé : colonnes d’idempotence et index unique présents ; 18e table métier `operation_jobs` protégée par RLS, sans droit anon/authenticated/PUBLIC et refus REST anonyme 401. `npm run check` : 75/75 tests, types valides, lint sans erreur avec 24 avertissements historiques. Build production et `git diff --check` réussis. Aucun déploiement.

  Source / dépendance / blocage : Terminé ; rapport `docs/rapports/2026-10-08/ops02b.md`. La cadence d’une minute du planificateur doit être confirmée sur l’hébergement avant production ; DB-1 reste ouverte pour versionner l’évolution du schéma.

- [x] **ACK-1 — Rendre la prise en charge explicite.** Distinguer affectation, confirmation et début réel ; traiter refus/indisponibilité et retour au dispatch sans inventer une confirmation.

  Terminé quand : Admin et livreur voient le même responsable et la même prise en charge horodatée ; une mission non prise en charge reste identifiable ; refus/réaffectation et double clic testés.

  État final vérifié le 2026-10-10, clôturé le 2026-10-11 : confirmation explicite et date `missionAcceptedAt` distinctes du départ, visibles dans les trois espaces. Départ interdit sans confirmation ; refus motivé avant départ remet commande/livraison en attente, efface l'acceptation active et garde la trace. Réaffectation sans confirmation héritée ; cartes périmées et cycle A → B → A refusés. Double clic sans double événement. Anciennes missions commencées préservées sans date inventée. Le libre choix ne peut plus voler une affectation concurrente ; perte de concurrence traitée proprement par l'auto-dispatch.

  Validation : 93/93 tests locaux, types valides, lint sans erreur avec 24 avertissements historiques ; build production réussi. 26 contrôles connectés et 5 scénarios Chrome réussis, dont même responsable et timestamp dans client/admin/chauffeur. Fixtures nettoyées : zéro résidu. Migration SQL additive/nullable explicitement vérifiée sur copie isolée et appliquée à la base de test ; lignes préexistantes et RLS préservées. Aucun déploiement.

  Source / dépendance / limite : rapport `docs/rapports/2026-10-11/ack1.md` ; preuves `outputs/ack1/connected-final.json`. ACK-1 et R04 terminées. DB-1 reste ouverte pour baseline/restauration globales et ENV-1. Erreur Leaflet reproduite sur la navigation chauffeur, suivie séparément dans MAP-1. Suite recommandée : BILL-02.

- [x] **DISPATCH-1 — Tester les cas difficiles d’affectation.** Capacité, disponibilité, concurrence, réaffectation et annulation après démarrage ; rendre les conflits explicites.

  Terminé quand : Deux affectations concurrentes ne produisent pas deux missions actives incohérentes ; transitions refusées sans perte d’historique.

  État final vérifié le 2026-10-09 : affectation, réaffectation, désaffectation, démarrage et transitions chauffeur réclament atomiquement l’état attendu. La capacité est recalculée sous verrou du chauffeur ; seul son dépassement peut être forcé, avec une trace explicite. Pause, catégorie, zone, mission démarrée et états terminaux restent non forçables. Une réaffectation conserve ancien et nouveau chauffeur dans l’historique. Après démarrage, retrait et réaffectation sont refusés ; l’annulation reste possible avec motif obligatoire et conserve le démarrage et la trace du chauffeur. La suppression d’un chauffeur actif et celle d’une commande opérationnelle sont refusées.

  Recette connectée sur la base de test : 14 scénarios réussis. Deux sessions ont produit une réponse 200 et une 409 pour une même livraison, avec un seul responsable, un seul événement et une seule tâche ; le rejeu vers le gagnant est idempotent. Une course sur la dernière place de capacité produit aussi 200/409 ; le dépassement volontaire est tracé. Pause normale ou forcée : 409 sans mutation. Auto-dispatch contre affectation manuelle : un seul gagnant. Double démarrage : un succès, un conflit et un seul événement. Réaffectation, retrait et annulation sans motif après démarrage : trois refus 409, état et historique inchangés ; annulation motivée ensuite réussie. Frontière entreprise, suppression du chauffeur actif, annulation générique après démarrage et conservation des commandes opérationnelles vérifiées. Toutes les fixtures ont été supprimées, zéro résidu.

  `npm run check` : 81/81 tests, types valides, lint sans erreur avec 24 avertissements historiques. Build production et `git diff --check` réussis. Aucun changement de schéma ni déploiement. R03 est validé ; R04 reste ouvert pour définir la prise en charge explicite et comparer son horodatage dans les trois espaces.

  Source / dépendance / blocage : Terminé ; rapport `docs/rapports/2026-10-09/dispatch1.md`. Suite : ACK-1.

- [x] **COMM-1 — Centraliser les échanges opérationnels par commande.** Inspecter puis compléter un fil lié à la commande : questions, instructions, modifications et incidents entre acteurs autorisés. Séparer notes internes et messages visibles au client ; signaler les nouveaux messages. Réutiliser le support si adapté.

  Terminé quand : Un échange aller-retour client/admin/livreur est consultable dans le bon dossier sans e-mail obligatoire ; auteur et date visibles ; droits et visibilité interne/externe testés, y compris après réaffectation.

  Résultat : Fil partagé dans les trois espaces, auteur/date/catégorie, notes réservées au personnel et nouveaux échanges signalés sans e-mail. Droits client/entreprise/chauffeur courant, notifications et réaffectation contrôlés ; doubles envois, pagination et marquage précis protégés. Historique conservé en lecture seule après fin.

  Validation : 113 tests locaux, types/lint (24 avertissements historiques), build et 64 contrôles connectés réussis dont quatre scénarios navigateur. Migration additive appliquée explicitement après copie/restauration ciblée ; RLS active et aucun droit public. Zéro fixture résiduelle ; commandes préexistantes identiques. R05 cochée. Rapport : docs/rapports/2026-10-12/comm1.md ; preuves outputs/comm1/connected-final.json.

  Source / dépendance / blocage : Terminée ; DB-1 globale et MAP-1 restent ouvertes. Actualisation dix secondes, aucune pièce jointe ni e-mail ajouté. Suite : ALERT-1.

- [x] **ALERT-1 — Rendre retards et incidents actionnables.** Définir retard, destinataire, acquittement et action possible ; vérifier cloche et indicateurs existants avant ajout.

  Terminé quand : Un retard simulé apparaît au bon rôle, sans doublon ; action et résolution visibles.

  Résultat vérifié le 2026-10-12 : retard calculé sur la date de livraison demandée déjà présente, sans échéance ni promesse inventée. Panneau partagé pour personnel habilité, client propriétaire et chauffeur courant ; incidents COMM-1 et notes internes respectent leur périmètre. Prise en compte avec action prévue, puis résolution avec résultat ; journal durable visible. Cloche/fil lus ne résolvent pas l’alerte. Ancienne échéance conserve son journal ; réaffectation réévalue les droits ; fin affiche Clôturée, distinct de Résolue.

  Validation : 128 tests locaux, types/lint (24 avertissements historiques) et build réussis. 76 assertions connectées principales puis 12 régressions ciblées finales ; doubles clics/deux auteurs, courses action/clôture et action/réaffectation, multi-livraisons, rôles A/B, notifications et navigateur vérifiés. Zéro fixture/compte Auth/job message orphelin après audit reconnecté. Conflit P2034/attente harnais, sandbox Chrome et P1017 après cleanup consignés sans masquer les limites : empreinte préexistants égale avant cleanup ; hash baseline en mémoire perdu lors du dernier audit, comparaison post-cleanup indépendante non disponible. Aucun schéma modifié. Rapport : docs/rapports/2026-10-12/alert1.md ; preuves outputs/alert1/connected-final.json et audit-final.json.

  Source / dépendance / blocage : Terminée après relecture des preuves. DB-1 globale et MAP-1 restent ouvertes. Liste globale limitée explicitement à 100 dossiers actifs récents ; dossier individuel disponible. R10 reste ouvert pour sa recette intégrale. Suite : TRACK-1.

- [x] **DISPATCH-2 — Mettre en évidence la commande en retard ciblée.** Depuis toute liste, alerte ou indicateur de commandes en retard, le clic ouvre le dispatch avec le bon dossier sélectionné, visible et clairement surligné. Conserver le contexte dans l’URL pour que l’ouverture directe, le rechargement et le retour navigateur restent fiables ; si la commande n’est plus en retard ou inaccessible, afficher un message explicite sans révéler de données étrangères.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : le clic depuis chaque point d’entrée concerné mène au bon dispatch sans recherche manuelle ; la ligne, la carte ou le panneau correspondant reçoit le focus visuel et clavier ; le surlignage reste lisible sur mobile et desktop ; filtres, pagination, permissions entreprise et disparition du retard sont testés ; aucune autre commande n’est mise en évidence par erreur.

  Résultat vérifié le 2026-10-16 : les listes de retards du tableau de bord et les alertes opérationnelles du back-office ouvrent la livraison exacte avec un contexte URL durable. La file réinitialise le filtre, rejoint la bonne page, fait défiler puis focalise une seule ligne avec un surlignage noir lisible ; la carte conserve aussi la sélection dans l’URL, ouvre le panneau mobile et focalise la carte correspondante. Une cible au-delà des 80 lignes habituelles est ajoutée seulement après contrôle de l’entreprise et du statut actif. Retard disparu, livraison terminée et identifiant étranger partagent un message neutre ; les liens ordinaires vers une livraison non en retard restent compatibles. Les espaces client et chauffeur conservent l’ouverture des échanges et n’exposent pas le dispatch.

  Validation : `npm run check` réussi, 205/205 tests ; build production réussi, 96 pages statiques. Test connecté en lecture seule réussi sur un retard réel et une frontière interentreprises, sans aucune mutation. Aucun schéma, migration, donnée ou déploiement modifié. Rapport `docs/rapports/2026-10-16/dispatch2.md`.

  Source / dépendance / blocage : terminée. Revue visuelle groupée possible plus tard à la demande du propriétaire ; elle ne bloque pas le comportement validé.

- [x] **DISPATCH-3 — Qualifier l'auto-dispatch dans sa transaction.** Le premier essai interne d'ONBOARD-1 avec dispatch automatique a expiré dans une transaction Prisma interactive de 5 secondes (nettoyage confirmé, parcours manuel réussi ensuite). Reproduire localement, identifier ce qui allonge la transaction (requêtes séquentielles, appels réseau, verrous) et la rendre bornée sans perdre l'atomicité ni l'idempotence d'OPS-02B.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : la cause est identifiée et reproduite par un test ; l'auto-dispatch ne fait plus d'appel lent dans la transaction ou utilise un délai justifié ; un échec reste explicite, sans affectation partielle ni doublon de job ; la tranche ONBOARD-1 avec dispatch automatique réussit sur la préproduction autorisée.

  Source / dépendance / blocage : ajoutée lors de la revue du 26 octobre 2026 depuis la note ONBOARD-1 du 23 octobre. Aucune dépendance extérieure pour la reproduction et la correction locales.

  Terminé le 2026-10-27. Cause : la transaction de création de commande (standard/coursier, et missions spéciales) gardait le délai Prisma par défaut de 5 s, alors qu'elle enchaîne une dizaine d'allers-retours séquentiels (droits SaaS, commande, usage, articles, livraison, job). Depuis le poste local, chaque requête vers la préproduction coûte environ 550 ms via le pooler. Ce n'est pas la logique d'auto-dispatch, exécutée hors transaction par le job. Reproduction sur la préproduction autorisée sans la correction : `ONBOARD1_AUTO_DISPATCH=1` (nouvelle variante de `scripts/onboard1/connected.ts`) échoue en `P2028` « timeout 5000 ms, 5128 ms passed ». Correction : `{ maxWait: 10_000, timeout: 30_000 }`, déjà la convention des autres transactions de `order.service.ts`. L'atomicité et l'unicité du job ne changent pas.

  Validation : `tests/order-atomicity.test.ts` 10/10, dont deux nouveaux tests qui échouent sans la correction (délai 5 000 ms inférieur au budget mesuré de 5 500 ms) ; pannes injectées sans écriture partielle et double envoi sans doublon de job toujours verts. `npm run check` 515/515. Recette connectée sur préproduction avec auto-dispatch : 39,9 s, création de commande 9,9 s, un job `AUTO_DISPATCH`, résidu nul. Sans auto-dispatch : 39,1 s, résidu nul.

  Limite consignée pour PERF-02 : 21 autres transactions interactives gardent le délai de 5 s (dont l'activation d'inscription `signup.service.ts:871`, la facturation sandbox, le support et les données client). Elles ne posent problème que si l'application est loin de la base (poste local, ou fonctions Vercel hors de Paris, voir ENV-2). À mesurer avant de les modifier. Contrôle du 2026-10-27 : la recette connectée SIGNUP-1, activation d'inscription comprise, réussit depuis le poste local sur la préproduction, sans résidu. Cette transaction tient donc dans ses 5 s.

- [x] **BILL-02 — Séparer livraison et facturation.** Préserver l'état logistique et sa date lors de la facturation ; contrôler une permission dédiée ; préparer la reprise des données existantes.

  Terminé quand : Facturer ne change ni la mission ni le compteur de livraisons ; rôle commandes seul refusé ; tests des compteurs client/chauffeur/admin.

  État final vérifié le 2026-10-11, clôturé le 2026-10-12 : émission et règlement modifient uniquement Invoice. Statuts comptables retirés des actions logistiques et refusés côté routes/services. Permissions invoices:create/update dédiées ; paiement avec version attendue et rejeu sans double date. Interface distingue Livré et Facture émise/Payée. Compteurs client/chauffeur/admin, dates et historique conservés ; une mission facturée/payée peut continuer et se clôturer sans écrasement. Générateur démo et statistiques par période adaptés.

  Validation : 102/102 tests locaux, types valides, lint sans erreur (24 avertissements historiques), build réussi. 72 contrôles connectés : 51 API, 15 navigateur/reprise et 6 poursuite/concurrence ; compteurs avant/après strictement identiques. Zéro fixture résiduelle, objets historiques inchangés. Aucun changement de schéma, migration ou déploiement.

  Reprise préparée : diagnostic read-only de deux commandes et une livraison dans d'anciens états comptables ; proposition fondée sur historique/POD/date métier, procédure documentée et essai sur fixture réussi. Aucune réparation préexistante appliquée ; ces anciens affichages restent à corriger sur instruction explicite. Outil : scripts/diagnose-billing-statuses.ts ; procédure : docs/operations/bill02/README.md.

  Source / limite : rapport docs/rapports/2026-10-12/bill02.md ; preuve outputs/bill02/connected-final.json. BILL-02 et R11 terminées ; DB-1 globale reste ouverte. Calculs/conformité/numérotation relèvent de BILL-01A/B. Suite : COMM-1.

- [x] **POD-1 — Durcir et vérifier les preuves de livraison.** Valider taille et contenu des fichiers avant stockage, contrôler accès et réessai, gérer fichiers orphelins ; conserver note et motif d’échec.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Fichier invalide refusé ; réseau interrompu ne perd pas la preuve ; photo privée retrouvée par les rôles autorisés.

  Résultat vérifié le 2026-10-13 : JPEG/PNG contrôlés par MIME, structure, dimensions et limite de 5 Mo avant stockage ; chemin serveur aléatoire et privé, jamais accepté depuis le client ni exposé dans les réponses. Une clôture réussie peut être rejouée après perte de réponse sans second upload ; un rejeu contradictoire est refusé. Upload non attaché supprimé après conflit, anciens fichiers de la même livraison nettoyés après réussite. Photo signée disponible une heure pour le chauffeur affecté, le client propriétaire et le personnel autorisé de la même entreprise ; accès anonyme et interentreprises refusés. Note et motif d'échec conservés et affichés.

  Validation : 148 tests locaux, types/lint sans erreur (24 avertissements historiques), build réussi et 55 assertions connectées. Fichiers tronqué/SVG/surdimensionné, preuve prématurée, réponse abandonnée puis retry, double envoi concurrent, orphelin réel, bucket privé et trois rôles A/B vérifiés. Zéro fixture, compte Auth ou objet Storage résiduel ; empreinte des données préexistantes identique. Aucun schéma ni déploiement. Rapport `docs/rapports/2026-10-13/pod1.md`, règles `docs/operations/pod1/README.md`, preuve `outputs/pod1/connected-final.json`.

  Limite : la reprise serveur après résultat inconnu est couverte. La coupure réelle pendant l'envoi, la file hors ligne et la reconnexion sur téléphone restent MOB-01B et la partie encore ouverte de R09.

  Source / dépendance / blocage : Photo et motif déjà passés E2E ; parcours conservé. Suite : DATA-01.

  Suite du 2026-10-28 : signature à l'écran, photos sans métadonnées, PDF de preuve, envoi au donneur d'ordre, relevés par coursier et conservation dans POD-2.

- [ ] **POD-2 — Preuve de livraison complète : signature, PDF, envoi et relevés.** Compléter POD-1 : signature tactile à l'écran avec nom du réceptionnaire et refus motivé, photos ré-encodées sans métadonnées, PDF de preuve, envoi au donneur d'ordre, relevés par coursier et conservation. Tranche 6 de DEMO-3 (nom du réceptionnaire).

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : essai sur téléphone réel de la signature tactile et de la reprise hors ligne ; règles de preuve pilotables depuis l'interface ; décision prise sur le nom obligatoire ou non ; position enregistrée alignée sur la décision GPS ; durée de conservation validée (LEGAL-1/DATA-02) ; e-mail réel du lien de preuve reçu.

  Source / dépendance / blocage : branche `agent/preuve-livraison` intégrée ; rapport `docs/rapports/agents/2026-10-28-preuve-livraison.md`. Migration `20261028120000_pod_signature` (colonnes nullables sur `deliveries`, table déjà sous RLS), appliquée sur tutelliv-dev uniquement ; aucun bucket à créer (signature dans `delivery-pods`). Essai téléphone : MOB-01C. E-mail réel : EMAIL.

  État : implémenté et recetté sur tutelliv-dev le 28 octobre 2026. Signature PNG validée (octets, 40–1 600 × 40–800 px, 300 Ko), aplatie sur blanc, stockée sous `companyId/deliveryId-sig-…png` ; hors ligne elle voyage dans la file IndexedDB existante ; règle par entreprise `settings.proofRules.signatureRequired` (défaut : facultative) et `emailToClient`, API `GET/PATCH /api/company/proof-rules` (fusion SQL ciblée) et `GET /api/driver/proof-rules` ; URL signées de 300 s, plus aucun chemin de stockage dans les réponses ; PDF de preuve reproductible sans le nom du livreur, routes back-office et portail ; envoi par la tâche durable `CLIENT_NOTIFICATION` existante ; relevés `GET /api/back-office/courier-statements` (CSV avec BOM, `;`, formules neutralisées, permission `drivers:read`) ; export et archive DATA-02, purge démo. `npm run check` 800/800 sur la branche puis 1145/1145 sur l'intégration (557e9d5). `security-review` : aucune vulnérabilité de confiance élevée. Recette navigateur : livraison réussie (bouton désactivé sans rien, tracer / effacer / retracer, photo, nom, alerte « Localisation éloignée », `DELIVERED`/`SUCCESS`), échec avec motif (`FAILED`/`REFUSED`), PDF back-office 200, client propriétaire 200, autre client 404, id inconnu 404, livraison sans preuve = lien PDF nul et PDF 404, portail « Reçu par … » avec signature et lien PDF. Audit Codex : voir les réserves ci-dessous. Case laissée ouverte : aucun essai sur téléphone.

  Reste : essai sur iPhone et Android (canevas tactile, mode avion, reprise) ; spécification `tests/e2e/pod-proof.spec.ts` (parcours de signature en `test.fixme`, aucune livraison terminée dans le jeu de démo) ; règles de signature et d'e-mail pilotables depuis l'interface (API seulement) ; hors ligne, si la règle « signature requise » n'a jamais été chargée le livreur peut enregistrer sans, le serveur refuse à la reprise (action en échec visible) ; nom du réceptionnaire facultatif aujourd'hui (RECETTE-2810) ; liste brute de livraisons pouvant encore exposer le chemin de stockage de la signature (clé interne d'un bucket privé, sans lien) ; position de la preuve à aligner sur la décision GPS ; durée de conservation à valider ; e-mail réel. La remarque du rapport sur le nom et le téléphone du livreur renvoyés au portail est traitée par les correctifs I2, C2 et C3 (SEC-AUDIT).

- [x] **DATA-01 — Rendre tout l’historique consultable.** Pagination, recherche et filtres côté serveur ; exports complets limités à l’entreprise autorisée.

  Terminé quand : Sur 1 000 commandes, retrouver la plus ancienne ; export complet, tri stable et aucun mélange entre entreprises.

  Résultat vérifié le 2026-10-14 : les listes admin, commandes client actives et historique client ont une pagination serveur de 25/50/100, recherche par commande/client/adresse/livraison, filtres statut/type/dates et tri stable `createdAt DESC, id DESC`. L'export CSV reprend tous les résultats filtrés par lots de 500, sans tenir compte de la page, avec protection des formules et en-têtes privés sans cache. Chaque lecture exige l'entreprise ; le portail exige aussi le client. La résolution historique par e-mail est désormais elle aussi bornée à l'entreprise.

  Validation : 152 tests, types/lint sans erreur (24 avertissements historiques) et build réussis. Recette connectée sur 1 000 commandes A et 7 B : plus ancienne retrouvée en page 20/20 par admin et client, tri répété identique, filtres et recherches vérifiés, exports A de 1 000 lignes et B de 7 lignes sans mélange. Quatre comptes A/B et toutes les fixtures supprimés ; empreinte des données préexistantes identique. Rapport `docs/rapports/2026-10-14/data01.md`, règles `docs/operations/data01/README.md`, preuve `outputs/data01/connected-final.json`.

  Limite : l'export lit par lots mais assemble le CSV en mémoire ; la charge simultanée et les volumes nettement supérieurs à 1 000 restent à qualifier dans DATA-02/SAAS-02. Aucun schéma ni déploiement. Suite : MOB-01A.

## 3 — Savoir où en est et où se trouve la livraison

Statuts ET localisation sont demandés. Leur présence dans le code ne suffit pas : tester fraîcheur, droits, perte réseau et comportement sur appareil.

- [x] **TRACK-1 — Unifier le suivi des étapes et de la position.** Relier commande et mission dans les trois espaces, avec chronologie cohérente, responsable, statut, position utile et heure de dernière mise à jour. Limiter le client à ses livraisons et au suivi nécessaire pendant la mission.

  Terminé quand : Une modification de statut apparaît aux rôles autorisés ; position absente/périmée explicitée ; aucune donnée d’un autre client ; fin de mission et fin de service arrêtent l’exposition du suivi conformément aux règles définies.

  Résultat : panneau partagé dans les trois espaces, responsable courant et actions réellement survenues ; service explicite et mission démarrée exigés, signal daté et périmé sans coordonnées. Droits relus en base ; client limité à ses commandes/livraisons, chauffeur aux missions affectées, admin à son entreprise. Fin de service/mission masque le signal ; aucune position issue des destinations. Réutilisation SEC-06, ACK-1, COMM-1 et statuts BILL-02, sans schéma ajouté.

  Validation : 144 tests, types/lint (24 avertissements historiques), build et 79 assertions connectées réussis ; trois interfaces capturées, rafraîchissement observé : admin 66.30 s, client 66.50 s, driver 66.62 s, sous saturation du pool de test (P2024/HTTP 500) ; délai nominal de 10 s non qualifié. Réaffectation, transitions, expiration réelle et courses publication/arrêt testées. Audit global zéro résidu et empreinte des préexistants identique. Rapport `docs/rapports/2026-10-12/track1.md`, règle `docs/operations/track1/README.md`, preuves `outputs/track1/connected-final.json`.

  Limites : cartes globales non appelées sur les anciennes données pour éviter leur géocodage persistant ; tests de service en substitution, dispatch de positions et carte client testés connectés. MOB-01A a depuis qualifié les états client GPS/réseau et corrigé le chargement SSR Leaflet ; GPS physique, téléphone verrouillé et recette complète des cartes restent MOB-01C et MAP-1/2. R06/R07/R08, DB-1 et ENV-1 restent ouvertes. Aucune promesse GPS permanent. Suite active : UX-01.

- [x] **MOB-01A — Afficher un suivi GPS honnête.** Contrôler les réponses réseau, fraîcheur des positions, refus de permission, perte du signal et début/fin de service.

  Terminé quand : Position périmée identifiée ; erreur de synchronisation visible ; arrêt hors service effectif.

  Résultat vérifié le 2026-10-14 : l'interface chauffeur distingue recherche, synchronisation confirmée par le serveur, position périmée, permission refusée, signal indisponible, délai dépassé, navigateur incompatible, perte réseau et erreur serveur. La dernière synchronisation reste datée ; le retour du réseau et le bouton de reprise relancent explicitement le suivi. Aucun observateur GPS hors service ou sans mission démarrée. La fermeture du service arrête le navigateur, supprime la position serveur et bloque une publication tardive.

  Validation : 157 tests, types/lint sans erreur bloquante, build de 96 pages et recette connectée réussis. Service fermé et absence de mission refusés 409 sans écriture ; signal frais, périmé sans coordonnées, redevenu frais puis hors service vérifiés depuis les rôles chauffeur/client. Permission, réseau et réponses invalides injectés côté client et rendus avec annonces accessibles. Toutes les fixtures Auth/base supprimées ; empreinte des préexistants identique. Rapport `docs/rapports/2026-10-14/mob01a.md`, règles `docs/operations/mob01a/README.md`, preuve `outputs/mob01a/connected-final.json`.

  Limites : téléphones physiques, écran verrouillé et arrière-plan restent MOB-01C ; coupures d'actions métier MOB-01B ; pannes du fournisseur cartographique MAP-2. Suite : UX-01.

- [x] **TRACK-2 — Dernier signal des livreurs et position estimée entre deux signaux.** Afficher sur toutes les cartes l'âge du dernier signal, faire avancer le livreur vers sa prochaine étape en attendant un nouveau signal et le garder visible quand le signal se perd.

  Terminé quand : « En direct » ou « Il y a X min » sous le nom, rafraîchi seul ; pendant une mission, le livreur avance en ligne droite vers la prochaine étape à 25 km/h entre deux signaux ; pastille verte en direct, jaune en position estimée (camion toujours vert), rouge « Signal perdu » après 3 min sans signal, livreur arrêté au point atteint ; visible par l'administration, le dispatch et le client ; démo avec livreurs en direct, estimé et au signal perdu.

  Résultat vérifié le 2026-10-27 (décisions du propriétaire du même jour, révisées le soir : 3 min au lieu de 10, mouvement continu entre deux signaux, arrêt sans retour en arrière, pastilles jaune puis rouge) : `trackingTarget` choisit la prochaine étape (destination en livraison ou course collectée, première collecte localisée d'une course en route, aucune sinon) ; `trackingPosition` expose la trajectoire (`motion`) et, signal périmé, la position estimée (`estimated`) ou figée après 3 min, au lieu de coordonnées nulles. Cartes des chauffeurs, du dispatch et du portail, et suivi de commande, branchés sans changer droits ni périmètre (service ouvert et mission démarrée toujours exigés, fin de mission/service masque toujours). Itinéraire calculé par le serveur (`drive-route.service` : OSRM avec grands carrefours, secours IGN `bdtopo-valhalla`), gardé en mémoire par livreur et réutilisé tant que ses relevés restent à moins de 40 m de la route, en file (une requête par seconde), sans nouvel essai 30 s après un échec ; il est envoyé avec la position, le navigateur ne demande aucun itinéraire pour les livreurs et le livreur n'avance jamais en ligne droite (sans route, il reste à son dernier point). Conduite simulée partagée par le serveur, les cartes et la démo (`drive-simulation`) : croisière 30 km/h, ralentissement selon la courbure des virages, freinage et accélération progressifs, grands carrefours au ralenti, arrêt aux feux simulés (cycle selon le lieu et l'heure). Marqueur animé image par image, glissement de 800 ms à chaque nouveau signal, arrêt signal perdu ; sur la carte d'une livraison, seule la route restante devant le livreur est tracée. Les cartes ne se recadrent plus quand un livreur roule. Libellé et pastille recalculés sans attendre de données. Suivi de commande : « Position estimée », « Signal interrompu », « Signal perdu ». Page Fonctionnalités alignée. Démo : livreurs qui roulent à 25 km/h vers la même prochaine étape que les cartes, sur des trajets traversant Paris (boucle d'environ 10 min) ; retard fictif figé par livreur au reset (0, 0, 100 s, 0, perdu), le livreur perdu garde un relevé figé une minute après son départ ; réservé aux entreprises de démo.

  Validation : `npm run check` vert ; tests de la règle (mi-chemin, plafond, arrêt à 3 min sans retour, sans cible, choix de la cible, trajectoire), des trois services, des pastilles et libellés et de la démo. Navigateur sur la préproduction en démo (espaces recyclés normalement) : carte des chauffeurs 3 en direct (vert), 1 estimé (camion vert, pastille jaune), 1 perdu (pastille rouge, immobile) ; mouvement mesuré sur 12 s couvrant une actualisation : au plus 1 à 1,4 px par image de 50 ms, carte immobile ; carte d'une livraison : la trace part du livreur (écart 0 px) et raccourcit derrière lui ; suivi client « Signal perdu : livreur arrêté à sa dernière position estimée. » ; 0 erreur console ; axe 0 sur la carte des chauffeurs et le portail.

  Limites : à l'ouverture d'une carte, un livreur dont l'itinéraire n'est pas encore en mémoire reste immobile jusqu'à la lecture suivante (environ 10 s), le temps du calcul en file. Cache en mémoire par instance serveur : une nouvelle instance recalcule une fois par livreur. Feux et carrefours simulés, pas réels ; sans OSRM, pas de feux (IGN ne détaille pas les carrefours). En réel, la vitesse supposée de 25 km/h peut différer du trafic : le livreur glisse alors vers chaque nouveau relevé. En démo, chaque livreur repart du début de son trajet fictif environ toutes les 10 min (un glissement visible). Aucun GPS physique (MOB-01C). Les retards démo s'appliquent au recyclage normal de chaque espace (version du scénario inchangée, pas de réinitialisation implicite). Préexistant hors périmètre : contraste 4,44:1 des pastilles orange du panneau `/dispatch/map` (`dispatch-map-status.ts`). Branche locale `feat/suivi-position-estimee`, non poussée.

  Visibilité : appliquer les droits de TRACK-1 ; aucune carte globale des autres clients pour un client, ni suivi hors mission/service sous couvert de centralisation.

- [x] **UX-01 — Corriger les attentes silencieuses liées au GPS.** Chargement immédiat, attente bornée, message et confirmation hors zone explicite ; ne pas relancer inutilement la position.

  Terminé quand : Au clic, retour visuel immédiat ; aucun clic multiple requis ; délai et erreur compréhensibles.

  Résultat vérifié le 2026-10-15 : progression accessible immédiate et erreur persistante dans la carte et les dialogues ; actions GPS/confirmation protégées des doubles clics. Signal frais du suivi réutilisé (15 s max), sinon acquisition unique partagée bornée à 6 s ; contrôle serveur borné à 8 s. Même position conservée jusqu’à la mutation et à la confirmation explicite hors zone. Actions standard sans besoin de proximité envoyées sans acquisition GPS.

  Validation : 163 tests dont 6 UX-01, types/lint sans erreur (24 avertissements historiques), build de 96 pages et recette navigateur isolée réussis : double clic, signal frais, hors zone, permission refusée + preuve d’échec, GPS/serveur muets et action standard. Compteurs vérifiés : aucune acquisition répétée ni mutation avant confirmation/à l’expiration. Rapport `docs/rapports/2026-10-15/ux01.md`, harnais source `outputs/ux01/harnais/`.

  Limites : recette locale avec GPS/API/mutation simulés, sans base distante. Borne 14 s pour la phase GPS/proximité au premier plan ; upload et enregistrement métier distincts. MOB-01B/C restent ouvertes pour coupures réelles et appareils physiques ; MAP-1/2 pour les cartes.

- [x] **MAP-1 — Diagnostiquer les cartes et le chargement Leaflet.** Reproduire carte admin mode Uber, marqueurs, ouverture directe et navigation interne ; traiter window is not defined si reproduit.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : Aucune erreur SSR dans les scénarios validés ; affichage cohérent sur mobile/desktop.

  Reproduction complémentaire le 2026-10-10 : erreur Leaflet `window is not defined` au préchargement de `/driver/navigate/[id]` pendant la recette ACK-1. Le geste de départ et son état sont validés, la navigation cartographique reste non qualifiée. Preuve : `outputs/ack1/server.log`. Conserver aussi les scénarios carte admin et navigation interne prévus.

  État partiel le 2026-10-14 : MOB-01A charge désormais la carte de navigation uniquement dans le navigateur ; l'erreur SSR ne réapparaît plus au démarrage du build de production. MAP-1 reste ouverte pour la recette visuelle complète des cartes admin, mobile et de la navigation interne.

  Résultat vérifié le 2026-10-15 : HTTP 500 `window is not defined` reproduit sur les widgets via SSR Next réel ; widgets et carte client chargent désormais tous leurs composants Leaflet uniquement dans le navigateur. Cadrage client mobile corrigé : le panneau réserve une marge supérieure, plus une marge gauche qui expulsait la destination hors écran. Badge admin redondant masqué sur mobile pour préserver le panneau.

  Validation : 168/168 tests locaux (5 nouveaux), types/lint OK (24 avertissements historiques), build production réussi (96 pages), `git diff --check` réussi. Harnais Next isolé avec composants et styles réels, hooks/GPS/itinéraire simulés, aucune base : cinq ouvertures directes HTTP 200, navigation interne, sélection admin, marqueurs, zoom et rendus 1280×720 / 390×844. Destinations mobile/desktop visibles après correction, aucune erreur console dans la session finale. Preuves : `outputs/map1/`, rapport `docs/rapports/2026-10-15/map1.md`.

  Limites : cette recette qualifie le chargement et le rendu des composants, pas les permissions/layouts authentifiés, GPS terrain ni la qualité des fournisseurs. Tuiles Esri « Map data not yet available » observées au zoom chauffeur : MAP-2 reste ouverte, avec zoom/attributions/itinéraires dégradés. Aucun accès base, migration, seed, push ou déploiement. Suite : MAP-2.

- [x] **MAP-2 — Fiabiliser fournisseurs, zoom et états dégradés.** Configuration cartes/géocodage/itinéraires, timeouts, quotas, budgets et attributions ; remplacer le faux trajet à durée zéro par une indisponibilité explicite.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Panne fournisseur simulée lisible ; zoom sans tuiles vides aux niveaux autorisés ; coûts et conditions vérifiés avant vente.

  Source / dépendance / blocage : Audit MAP-01 + ancien MAP-2 ; fournisseur payant seulement après décision.

  Résultat vérifié le 2026-10-15 : fond Esri remplacé par OSM configurable, zoom borné au plafond natif (1–19 par défaut), attributions visibles sur toutes les cartes. Tuiles en panne signalées après erreur/10 s avec reprise ; géocodage IGN et itinéraires bornés à 8 s, absence explicite sans faux point/trajet/durée. Destinations nulles conservées dans les listes et acceptées par les cartes admin/client/chauffeurs ; rafraîchissement navigation borné à 30 s, réponses anciennes ignorées.

  Validation : 183/183 tests (15 nouveaux, scénario suivi enrichi), types/lint OK (24 avertissements historiques), build production 96 pages, `git diff --check` réussi. Recette navigateur isolée 1280×720 / 390×844 : zoom 18–19 sans tuile vide, marqueurs et attribution ; pannes tuiles, itinéraire 503, timeout et destination absente lisibles. Deux sondes publiques IGN/OSRM réussies. Rapport `docs/rapports/2026-10-15/map2.md`, guide `docs/operations/map-providers.md`, preuves `outputs/map2/`.

  Limites avant vente : OSM public sans SLA ni capacité illimitée ; IGN 50 requêtes/s/IP ; OSRM/FOSSGIS public 1 requête/s et usage sans charge lourde. Conditions commerciales complètes OSRM non accessibles derrière contrôle anti-robot : démonstrateur non qualifié pour un SaaS payant. Choix fournisseur/auto-hébergement, capacité, contrôle global des volumes, budget/alertes et confidentialité restent des décisions V1-GO. Aucun service payant activé, budget nouveau fournisseur engagé 0 €. Aucune base, migration, seed/reset, push ou déploiement ; serveur de recette arrêté. Suite : MOB-01B.

- [ ] **MAP-3 — Retrouver un design de carte sobre noir/blanc.** Revoir le style des cartes administrateur, client et livreur pour retrouver l’ancien rendu apprécié, proche d’Uber : fond monochrome, contraste maîtrisé, marqueurs et trajet immédiatement lisibles, commandes discrètes. Réduire la charge visuelle sans masquer statuts, destinations, position, erreurs fournisseur ni attribution obligatoire.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : une même direction visuelle noir/blanc est cohérente dans les trois espaces sur mobile et desktop ; les informations essentielles restent compréhensibles en quelques secondes ; marqueurs sélectionnés/non sélectionnés, trajet, regroupements, panneau et états dégradés sont distinguables ; la carte retrouve la hiérarchie de l’ancienne version — fond très clair, itinéraire bleu dominant, panneaux blancs flottants, progression discrète, libellés de collecte/livraison et position du livreur lisibles — sans copier les éléments devenus inutiles ; comparaison visuelle avant/après validée par le propriétaire.

  Source / dépendance / blocage : préférence explicite du propriétaire le 15 octobre 2026 : les cartes actuelles sont jugées trop chargées et l’ancien style blanc/noir « type Uber » était préféré. La capture de l’ancienne version fournie le 20 octobre est conservée dans `docs/references/design/ancienne-carte-tutelliv.png` et devient la référence principale de direction visuelle. Après PERF-01 afin de ne pas confondre refonte visuelle et diagnostic de lenteur. Réutiliser les garanties fonctionnelles de MAP-1/2 et ne pas choisir un fournisseur payant sans décision.

  État technique au 16 octobre 2026 : thème commun noir/blanc appliqué aux cartes administrateur, client et livreur ; fond monochrome, trajets à halo blanc/ligne noire, marqueurs et sélection contrastés, panneaux blancs, HUD et progression simplifiés, panne fournisseur et attribution préservées. Recette locale 1280 × 720 et 390 × 844 sans débordement, `npm run check` réussi (199/199 tests), build Next.js réussi (96 pages) et `git diff --check` réussi. Preuves avant/après et rapport : `docs/rapports/2026-10-15/map3.md`. Le 20 octobre, le propriétaire a fourni l’ancienne carte et demandé une nouvelle passe : la tâche reste ouverte pour rapprocher la composition et la hiérarchie visuelle de cette référence, puis obtenir sa validation explicite.

  Support de revue préparé le 2026-10-18 : critères et captures disponibles dans `docs/operations/map3/REVIEW.md`. Une nouvelle série homogène admin/client/livreur sera produite sur préproduction avec mission active ; la case reste ouverte jusqu'à l'accord du propriétaire.

  Sécurité du fond vectoriel du 2026-10-27 : `maplibre-gl` 5.24.0, ajouté avec le plan Menthe, porte une faille XSS critique (GHSA-jrc7-96c5-q579, versions ≤ 6.4.0) qui fait échouer `npm run audit:prod` et donc la CI. Passage en 6.13.0 (corrigée, publiée depuis trois semaines ; le plugin Leaflet accepte la v6). La v6 cherche son worker à côté de son module, chemin introuvable une fois empaqueté par Next : carte vide et « Worker failed to load » constatés dans Chrome. Le worker autonome est désormais copié au postinstall vers `public/vendor/` (ignoré par Git) et désigné par `setWorkerUrl`. Vérifié : `npm run audit:prod` 0 vulnérabilité, `npm run check` 513/513, build CI sans secret, `npm ci` recrée le worker, Chrome réel sur la préproduction autorisée en dev (Turbopack) et en build de production : fond Menthe affiché sur la carte chauffeurs et la carte livraison avec 14 repères, aucune erreur hors favicon 404 préexistant. Aucune validation visuelle de MAP-3 n'en est déduite.

- [x] **MOB-01B — Rendre les actions résistantes au réseau faible.** File de reprise adaptée, idempotence et état en attente pour statuts et photos ; éviter doubles validations.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : Coupure et reconnexion ne perdent ni preuve ni action et ne doublent pas la livraison.

  Source / dépendance / blocage : Après OPS-02B et POD-1.

  Résultat vérifié le 2026-10-16 : chaque statut ou clôture chauffeur est écrit dans une file IndexedDB isolée par compte avant envoi, photo comprise. Coupures, HTTP transitoires et reconnexion déclenchent une reprise bornée ; une seule action est admise par mission. Attente et refus sont visibles dans le bandeau chauffeur et la mission, avec relance et retrait explicites. Le serveur accepte sans effet supplémentaire le rejeu d'un palier déjà atteint ; les rejeux POD identiques restent sans second upload ni double clôture.

  Validation : `npm run check` réussi avec 209/209 tests, build Next.js réussi (96 pages), `git diff --check` réussi. Recette Chrome isolée : Blob relu à l'identique après coupure, une tentative, un seul envoi après reconnexion, file vide après succès. Aucune base distante ni donnée métier touchée. Rapport `docs/rapports/2026-10-16/mob01b.md`, procédure `docs/operations/mob01b/README.md`, preuve `outputs/mob01b/browser-indexeddb.json`. Les essais téléphone, écran verrouillé et arrière-plan restent MOB-01C.

- [ ] **MOB-01C — Réaliser les essais iPhone et Android.** Mission réelle fictive avec déplacements, GPS refusé, écran verrouillé et retour dans l’app. Mesurer limites plutôt que promettre un suivi permanent.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : Matrice appareils/scénarios avec preuves ; décider PWA/app native seulement si une limite bloque la promesse.

  Source / dépendance / blocage : Téléphones et opérateur terrain requis ; après MOB-01A/B.

  Préparation du 2026-10-18 : protocole détaillé iPhone/Safari et Android/Chrome, Wi-Fi/mobile, GPS autorisé/refusé, signal perdu, écran verrouillé, interruption, preuve et reprise ajouté dans `docs/operations/mob01c/README.md`. Le propriétaire fournira les appareils et l'opérateur lorsque la préproduction sera prête ; aucune compatibilité physique n'est déclarée validée.

  Préparation de séance du 2026-10-27, sur instruction du propriétaire : iPhone seul, une personne, à pied ; Android à trouver. Deux obstacles écartés. D'abord, la démonstration ne convient pas : elle simule les positions des livreurs en mission (`demo-live-positions.service.ts`) et masquerait les trous du verrouillage. Ensuite, la base ne garde qu'une position par livreur : un relevé externe est nécessaire. Ajout de `scripts/mob01c/field-fixture.ts` (`npm run mob01c:setup|watch|cleanup`) : entreprise `mob01c-<clé>` hors démo sur la préproduction, livreur et administrateur connectables, trois livraisons STANDARD (capacité de dispatch d'un livreur) vers deux lieux publics du parcours ; relevé toutes les 5 s sans coordonnées ; nettoyage guidé par manifeste. Vérifié sur la préproduction avec deux adresses publiques de Paris : géocodage, connexion des deux comptes, 3 missions, relevé, nettoyage à zéro résidu (entreprise, utilisateurs, Auth, Storage) ; `eslint` et `tsc` sans erreur. Déroulé en 14 étapes dans `docs/operations/mob01c/README.md`. Prochaine étape : séance du propriétaire, puis rapport ; la case reste ouverte tant que l'Android n'est pas passé.

## 4 — Rendre la V1 simple, testable et exploitable

Préparer ces éléments maintenant. Aucun contact commercial nécessaire pour les jalons internes ; ne pas confondre une archive du code avec une restauration de service.

- [ ] **ONBOARD-1 — Guider jusqu’à la première livraison.** Proposer un assistant persistant avec barre de progression : informations entreprise, services/paramètres, livreurs, collaborateurs autorisés, premiers clients professionnels, tarifs utiles, import validé si retenu, première commande et première livraison. Chaque étape peut être quittée et reprise sans perdre les données déjà confirmées. Le même assistant doit fonctionner pour un compte pilote créé manuellement puis, plus tard, après activation autonome par SIGNUP-1.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : une entreprise fictive puis un pilote réalisent une livraison test sans intervention obligatoire ; progression fiable après reconnexion ; invitations d'utilisateurs existants ou nouveaux cohérentes ; étapes facultatives sautables ; temps et interventions mesurés ; import invalide ne corrompt rien.

  Source / dépendance / blocage : la tranche pilote ne dépend plus de SIGNUP-1 ; elle peut rendre la progression reprenable et qualifier les invitations sur une entreprise fictive ou créée manuellement. Le branchement automatique dépend ensuite de SAAS-01A/SIGNUP-1. La validation humaine finale attend PILOT-1.

  Jalon interne prioritaire : rejouer la première livraison avec une entreprise fictive et les trois rôles, en consignant le temps et les aides nécessaires. La validation par un pilote réel reste ultérieure ; ne pas cocher l’ensemble sur la seule recette interne.

  Jalon interne réalisé le 2026-10-16 : écran `/onboarding` réservé à l'administrateur, sept étapes calculées depuis l'état réel et liens vers services, comptes, tarifs, dispatch, commandes et livraison. Une entreprise fictive isolée passe de 2/7 à 5/7, 6/7 puis 7/7 en 45 372 ms automatisées ; tâches asynchrones attendues et résidu nul. 220 tests locaux, test Chrome de l'écran et refus client/livreur réussis. L'invitation e-mail réelle et l'import restent explicitement non validés. Rapport `docs/rapports/2026-10-16/onboard1-internal.md`, procédure `docs/operations/onboard1/README.md`, preuve `outputs/onboard1/connected.json`.

  Tranche technique qualifiée le 2026-10-23 : neuf étapes avec informations entreprise enregistrées et validées, collaborateurs facultatifs passables/reprenables conservés côté société, comptes actifs distingués des invitations en attente et réglages vides refusés. Reprise serveur après retour/rechargement/reconnexion ; SIGNUP-1 ouvre l’assistant, login/sync consomment `onboardingRequired` et retrouvent le dashboard quand le parcours est prêt. Écritures isolées par société, réservées à l’administrateur avec permissions et droits SaaS modifiables ; compte en lecture seule refusé. Invitations nouvelles/existantes/autre société et pannes qualifiées sans envoi réel.

  Validation : 17 tests ciblés, `npm run check` **345/345**, build **106 pages**, recette pilote manuel **3 → 6 → 7 → 8 terminées + 1 passée sur 9** en **36 626 ms automatisées**, zéro résidu. Chrome réel sur build local : coordonnées invalides/sauvegardées, passage/reprise, retour arrière, rechargement, reconnexion, ancien lien dashboard, compte terminé, lecture seule, refus client/livreur ; mobile 390 × 844 sans débordement et zéro erreur JavaScript. Raccord connecté SIGNUP-1 rejoué sur comptes fictifs. Rapport `docs/rapports/2026-10-23/onboard1-pilot-technique.md`, procédure `docs/operations/onboard1/README.md`, preuves `outputs/onboard1/`.

  Reste avant de cocher : exécution par un pilote réel, mesure du temps humain et des interventions, réception/renvoi réels des invitations avec SEC-05/EMAIL, décision sur un éventuel format d’import (aucun import exposé). Un premier essai interne avec dispatch automatique a expiré dans une transaction Prisma de 5 secondes ; nettoyage confirmé, parcours manuel réussi ensuite, option automatique non qualifiée par cette tranche. Corrigé et requalifié le 2026-10-27 par DISPATCH-3 (variante `ONBOARD1_AUTO_DISPATCH=1` réussie sur préproduction). La tâche reste ouverte ; aucune validation terrain ni clôture globale n’est déduite des recettes techniques.

- [x] **UX-02 — Reproduire et corriger la navigation d’inscription.** Tester le lien /login → /register après chargement, retour et cache ; préserver l’inscription qui fonctionne en accès direct.

  **Modèle conseillé : GPT‑6 Luna · effort moyen ; repli si indisponible : GPT‑5.6 Luna.**

  Terminé quand : Lien fiable sur les navigateurs retenus ; test de régression ; cause identifiée.

  Source / dépendance / blocage : Échec de clic observé E2E.

  État final vérifié le 2026-10-16 : l'ancienne panne n'était plus déterministe, mais son périmètre a été isolé à la transition client App Router/RSC, l'accès document direct ayant toujours fonctionné. Le passage connexion → inscription utilise désormais explicitement une navigation document pour ne plus dépendre du cache client conservé ; les clics avec Cmd/Ctrl/Shift/Alt et bouton secondaire gardent le comportement natif. Accès direct, clic après chargement, retour arrière, attente avec cache chaud et rechargement réussis dans Chrome ; les quatre clics sont confirmés comme navigations document. Deux tests unitaires dédiés, 211/211 tests locaux, types/lint sans erreur bloquante, build 96 pages et diff-check réussis. Aucun compte, e-mail, base ou service distant utilisé. Rapport : `docs/rapports/2026-10-16/ux02.md` ; preuve : `outputs/ux02/browser-navigation.json`.

- [x] **PERF-01 — Accélérer la navigation dans tout le produit (priorité immédiate).** Reproduire la lenteur ressentie dans les espaces administrateur, client et livreur. Mesurer connexion, première page, changements de page, listes, cartes et mutations à froid/chaud ; distinguer temps serveur, base, réseau, JavaScript, rendu et rafraîchissements. Corriger les causes dominantes sans masquer les attentes ni servir des données périmées.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : matrice de parcours et mesures avant/après reproductibles sur un environnement de référence ; retour visuel au clic immédiat ; budgets de navigation fixés puis respectés sur les parcours essentiels ; régressions d’authentification, de permissions et de fraîcheur des données exclues par tests. Consigner séparément les limites du mode développement et les performances du build de production.

  Source / dépendance / blocage : lenteur générale constatée directement par le propriétaire le 15 octobre 2026 sur le site local ; élargit l’ancien PERF-LOGIN / NAV / T2–T12. Commencer avant les autres fonctionnalités non bloquantes.

  État final vérifié le 2026-10-15 : contexte auth frais, lectures redondantes retirées, compteurs regroupés, pool borné/configurable 1–10 (défaut 5), préchargement ciblé, revalidation opérationnelle et photos privées hors chemin critique. Production : pages directes hors carte 1,63–2,68 s, cartes 2,12–3,12 s, connexions 3,55–3,94 s ; retours internes chauds 71–102 ms. Retour visuel 1,3 ms ; mutation admin propagée au portail monté en 13,93 s. Budgets dev distincts respectés, coût de compilation et limite watcher documentés. Le 16 octobre, la stratégie expérimentale `relationJoins` a été retirée après reproduction d'une panique Prisma sous lectures auth concurrentes ; la fraîcheur et l'absence de cache restent inchangées.

  Validation : 195/195 tests locaux, types/lint sans erreur (24 avertissements historiques), build hors serveur dev et diff-check réussis ; matrices avant/après admin/client/livreur, auth/permissions/fraîcheur et lien photo privé vérifiés. Empreinte métier restaurée, zéro fixture PERF01, serveurs de test arrêtés. Aucun reset, migration ni déploiement. Rapport : docs/rapports/2026-10-15/perf01.md ; preuves et protocole : outputs/perf01 et scripts/perf/README.md. Limites : environnement local et base distante de test, aucune garantie p95 sous charge ni dimensionnement multi-instance validé. Suite autorisée : MAP-3, sans l’implémenter dans cette tâche.

- [x] **UI-2 — Finir la lisibilité et l’accessibilité des parcours essentiels.** Vérifier mobile, erreurs, clavier, libellés, bandeau démo et barre de suivi ; conserver les tokens existants.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : Parcours commande et mission utilisables au clavier et sur petit écran ; erreurs visibles ; contraste vérifié.

  Source / dépendance / blocage : Anciens UI-1/UI-2 ; priorité après fiabilité.

  État final vérifié le 2026-10-16 : lien d'évitement et repère principal communs, menu mobile avec focus piégé/Échap/retour au déclencheur, états actifs annoncés, contrôles nommés, erreurs reliées et focus sur champ invalide. Les alertes longues et tables restent contenues ; suivi et fenêtre chauffeur tiennent sur petit écran. Audit Chrome de 8 écrans à 390 × 844 px : débordement global nul, un titre et un `main` par écran, aucun contrôle sans nom, champ sans libellé ou cible isolée sous 24 px. Les sept couples de couleur essentiels dépassent 4,5:1 et la réduction d'animations est respectée.

  Validation : `npm run check` réussi avec 214/214 tests, build Next.js réussi (96 pages), `git diff --check` réussi et recette interactive Chrome sans erreur JavaScript. Aucune donnée métier créée ou modifiée. Rapport `docs/rapports/2026-10-16/ui2.md`, procédure `docs/operations/ui2/README.md`, preuves `outputs/ui2/`.

- [ ] **DESIGN-1 — Revoir la direction visuelle de l’ensemble du produit.** Auditer les écrans des trois espaces, définir une direction commune sobre inspirée de l’ancienne carte, puis alléger et harmoniser tableaux de bord, navigation, listes, formulaires, cartes de contenu, modales et états vides/chargement/erreur. Revenir à des surfaces majoritairement blanches, noires et grises avec une couleur d’action maîtrisée ; réduire les blocs, couleurs, ombres et informations simultanées qui rendent les écrans chargés. Conserver la lisibilité métier et les repères propres à chaque rôle.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : inventaire visuel des parcours essentiels et règles de design consignés ; composants et tokens partagés au lieu de corrections page par page ; espaces administrateur, client et livreur cohérents sur ordinateur et mobile ; cartes de contenu redevenues sobres dans l’esprit blanc/noir apprécié par le propriétaire ; états interactifs, contraste, clavier, densité et responsive vérifiés ; comparaison avant/après des écrans principaux relue et validée par le propriétaire.

  Source / dépendance / blocage : demande explicite du propriétaire le 20 octobre 2026 de revoir le design complet, en utilisant l’ancienne carte conservée dans `docs/references/design/ancienne-carte-tutelliv.png` comme référence de sobriété et de hiérarchie, pas comme maquette à copier à l’identique. Commencer par l’audit et le système visuel, puis appliquer par parcours prioritaire : connexion/onboarding, tableau de bord/dispatch, commande, suivi client, mission livreur. Préserver les acquis UI-2, les performances PERF-01 et les fonctions métier ; aucun nouveau fournisseur payant.

  Ordre limité : valider d'abord les tokens et composants sur connexion/inscription, tableau de bord/dispatch, création de commande, fiche livraison, mission livreur et suivi client. Généraliser seulement après revue de ces écrans. Une refonte cosmétique exhaustive n'est une dépendance ni de SAAS-01A/SIGNUP-1 ni du démarrage manuel des pilotes.

  État au 29 octobre 2026, tranche portail (rapport `docs/rapports/agents/2026-10-28-design-portail.md`, intégrée sur `integration/2026-10-28`, non poussée) : direction « Menthe » conservée en Light, mode Dark « Encre + Pastel » du portail client uniquement (jetons sémantiques, variante `dark:` limitée au portail, choix Système / Clair / Sombre mémorisé, script d'initialisation sans éclair), Sora pour les titres du portail, cibles tactiles de 44 px, menu mobile, formulaire de commande à action principale unique et barre collante sur mobile, focus clavier visible dans les menus, `prefers-reduced-transparency` effectif dans le portail. Les dix défauts relevés sur captures sont corrigés. Preuves : 32 captures de référence et captures après correction dans `outputs/recette-agents/design/` (locales), comparaison pixel du Light à la référence à moins de 1 % près hors améliorations volontaires listées, E2E `portal-theme` (9) et `v1-roles` (1) réussis, `npm run check` 748/748 sur la branche puis 1145/1145 sur l'intégration (557e9d5). Recette navigateur de l'intégration : `/portal` en Sombre rechargé sans éclair, aller-retour `/portal` et `/dashboard`, OS sombre avec `/dashboard` et les cartes qui restent en Light et le portail en sombre, menu mobile à 390 px (bouton de 44 px, Échap ferme), `/portal/orders/new` à barre collante sans débordement, aucune violation CSP avec les cartes et les polices. Audit Codex : conforme avec réserves de recette. Case laissée ouverte : seule la tranche portail est livrée.

  Reste : propagation de la direction et du Dark aux espaces administrateur/dispatch et livreur (hors portail, le Light reste la cible) ; plan de carte sombre (MAP-3) ; lecteur d'écran et zoom à 200 % ; `/portal/profile` non vérifié ; bouton « Réessayer » absent de l'état d'erreur des commandes ; libellés de la barre de statut de carte à 10 et 11 px (composant partagé avec le back-office) ; `prefers-reduced-transparency` hors portail ; comparaison avant/après relue et validée par le propriétaire (revue visuelle différée) ; défauts mineurs de la recette dans RECETTE-2810.

- [ ] **UX-03 — Faire de la livraison le dossier opérationnel principal.** Depuis toute liste, carte, alerte ou tableau de bord, un clic sur une livraison doit ouvrir une fiche canonique claire. Elle regroupe selon le rôle : référence et statut de livraison, client et contacts utiles, adresses et étapes, créneaux/délais prévus, retard calculé, horodatages réels, livreur et affectation, instructions, contenu utile de la commande, incident ou échec, échanges et chronologie, preuve de livraison et documents associés. Organiser par priorité et sections repliables afin que l’état, le délai et la prochaine action soient compris immédiatement sans produire une page surchargée.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  **Complexité : élevée — agrégation multi-rôles, confidentialité, états temporels et cohérence entre plusieurs écrans.**

  Terminé quand : toutes les entrées vers une même livraison ouvrent la même fiche ou sa variante de rôle cohérente ; les données essentielles sont visibles avant le détail ; la preuve peut être consultée lorsqu’elle existe et son absence est explicite ; délais prévus, retard, durée et horodatages utilisent une règle serveur unique ; les données client et internes sont filtrées par rôle et entreprise ; liens profonds, retour à la liste, clavier et mobile fonctionnent. La référence de livraison sert de repère humain principal. Le numéro de commande reste disponible pour recherche, copie, support ou rapprochement, mais apparaît dans une zone secondaire « Informations techniques » et ne concurrence plus le statut, le client ou la livraison.

  Tests requis : livraison en attente, affectée, en cours, livrée avec preuve, échouée, annulée et en retard ; preuve absente/présente ; accès administrateur, mini-admin, client et livreur ; entreprise étrangère refusée sans fuite ; lien profond, navigation retour, petit écran et données partielles anciennes. Vérifier qu'aucune référence de commande ne domine visuellement les listes et fiches principales.

  Source / dépendance / blocage : demande explicite du propriétaire le 21 octobre 2026. Réutiliser les services et pages de détail existants, les garanties TRACK-1/POD-1/SEC-06 et les règles DISPATCH-2 ; commencer par un inventaire des écrans pour éviter une nouvelle fiche concurrente. DESIGN-1 fixe la présentation, UX-03 fixe la hiérarchie métier et le contenu.

  Inventaire du 2026-10-27 : `docs/operations/ux03/INVENTORY.md` liste les fiches par rôle et les entrées vers une livraison (fichier:ligne). Le back-office n'a pas de fiche livraison : la livraison n'y est qu'un panneau de la fiche commande `/dashboard/orders/[id]`, titrée par la référence de commande. Selon l'entrée, une même livraison ouvre la fiche commande, la file `/dispatch?delivery=` ou la carte `/dispatch/map?delivery=`. Côté client, la fiche `/portal/deliveries/[id]` existe, mais les tableaux et les factures ouvrent la commande. Le livreur n'a que l'écran de navigation. Avant toute implémentation, le propriétaire doit choisir la fiche canonique du back-office : une page livraison dédiée, ou la fiche commande réorganisée. Aucun écran n'a été modifié.

  Décision et première tranche du 2026-10-27 : le propriétaire a choisi une page livraison dédiée. `/dashboard/deliveries/[id]` a pour titre la référence de livraison, suivie du statut, d'un résumé (client, livreur, créneau ou date de fin), de l'assignation, du panneau de livraison existant (preuve et chronologie comprises), de l'itinéraire, du contact client, du contenu replié, des échanges, puis des « Informations techniques » repliées avec le lien vers la commande. Données : `GET /api/deliveries/[id]`, déjà filtrée par rôle et entreprise. La ligne de la file dispatch, le double-clic sur la carte et le lien « Livraison » du support ouvrent désormais cette fiche. Vérifié : `tests/ux03-delivery-entries.test.ts`, `npm run check` 714/714. Playwright `tests/e2e/ux03-delivery.spec.ts` sur le serveur déjà lancé, avec une livraison démo réelle : titre, commande repliée, 390 px, retour au dispatch, ouverture depuis une ligne du dispatch, identifiant inconnu refusé. Restent : variantes client et livreur, alertes et tableau de bord, essais par statut et par rôle.

  Retard et prochaine action du 2026-10-27 : `deliveryTiming` (`src/domains/delivery/delivery-timing.ts`) réutilise `isLateDelivery`, la règle du tableau de bord et de l'analyse. Il renvoie l'échéance (date souhaitée de la commande), le retard en minutes (figé à la fin d'une livraison terminée, absent sans échéance) et une prochaine action selon le statut, l'affectation, l'acceptation et la preuve. `GET /api/deliveries/[id]` l'expose dans `timing`, et la fiche affiche en tête la prochaine action, le retard et l'échéance. Un identifiant inconnu n'est plus relancé trois fois. Vérifié : `tests/ux03-delivery-timing.test.ts` (tous les statuts, retard en cours ou terminé, données sans échéance), tests ADMIN-1 de la route mis à jour, `npm run check` 716/716, Playwright sur une livraison démo réelle.

  Variantes, alertes et essais du 2026-10-27 : les alertes liées à une livraison et la liste du tableau de bord ouvrent désormais la fiche livraison ; dans le back-office, seuls les tableaux de commandes ouvrent encore la commande. Le client (`/portal/deliveries/[id]`) et le livreur (carte de mission) reçoivent l'échéance et le retard de la même règle `deliveryTiming`, sans la prochaine action, qui reste interne. Le client voit « Prévue le … · en retard de … », le livreur « À livrer avant … ». Vérifié : `tests/ux03-delivery-entries.test.ts`, `tests/ux03-delivery-timing.test.ts`. Playwright `tests/e2e/ux03-delivery.spec.ts` 4/4 sur la démo réelle : une fiche par statut présent avec la prochaine action du serveur, alerte vers la fiche, variante client (API équipe refusée en 403, livraison d'autrui en 404), variante livreur (mission d'un autre en 404). `npm run check` : 721/722 ; le seul échec est le test de la mini-démo d'accueil, modifié par l'agent design et qui attend son fichier `scene-invoices.tsx`, en cours. Restent avant de cocher : recette navigateur mini-admin et dispatcher, clavier, revue visuelle DESIGN-1.

  Recette par rôle et clavier du 2026-10-27 : `npm run e2e:role-accounts -- setup` crée sur `tutelliv-dev` uniquement (garde ENV-2) des comptes dispatcher, mini-admin (module Dispatch, puis module Support seul) et super-admin, rattachés à l'entreprise modèle « LogiExpress Démo » hors pool ; `cleanup` les supprime avec leur manifeste local `outputs/e2e-role-accounts.json`. `tests/e2e/ux03-delivery.spec.ts` 8/8 sur serveur local : le dispatcher et le mini-admin Dispatch ouvrent la fiche depuis la file, voient l'assignation tant que la livraison n'est pas terminée et reçoivent 404 sur une livraison d'une autre entreprise ; le mini-admin Support reçoit 403 et la fiche reste « Livraison introuvable » ; au clavier, Entrée sur une ligne ouvre la fiche, Tab atteint « Retour au dispatch » puis « Informations techniques » avec un focus visible, Entrée déplie et le lien commande s'ouvre. Correction : la fiche ne relance plus la requête sur un refus d'accès. `npm run check` 725/725. Comptes supprimés après l'essai. Reste : la revue visuelle avec DESIGN-1, différée.

- [ ] **UX-04 — Simplifier les actions et supprimer les explications permanentes inutiles.** Inventorier les boutons, rangées d'actions et textes qui expliquent en permanence leur fonctionnement. Pour chaque écran, conserver une action principale évidente, regrouper les actions secondaires, déplacer les actions rares dans un menu clairement nommé et retirer les lignes d'aide redondantes. Si la place, le nom ou l'icône ne suffisent pas à comprendre une action, renommer ou repositionner le contrôle avant d'ajouter une aide. Réserver les aides contextuelles aux notions réellement complexes, sans masquer une étape critique dans une infobulle.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  **Complexité : moyenne à élevée — inventaire transversal, hiérarchie des actions et risque de masquer une fonction importante.**

  Terminé quand : aucun parcours essentiel n'affiche une succession de boutons accompagnés chacun d'une phrase explicative ; les libellés utilisent des verbes et désignent précisément le résultat ; les actions principales sont stables au même endroit ; les actions destructives restent séparées et confirmées ; les icônes seules possèdent un nom accessible ; les aides restantes sont courtes, contextuelles et justifiées. Un utilisateur de chaque rôle peut créer, affecter, démarrer, suivre, clôturer et consulter une preuve sans demander à quoi servent les commandes visibles.

  Tests requis : audit des écrans principaux administrateur/client/livreur sur ordinateur et mobile ; noms accessibles, clavier, focus, menus et confirmations ; scénarios de découverte sans consigne préalable ; vérification qu'aucune action métier existante n'a disparu et que la réduction visuelle ne dégrade ni permissions ni performances.

  Source / dépendance / blocage : demande explicite du propriétaire le 21 octobre 2026 après constat d'un trop grand nombre de boutons, de rangées et d'explications. Complète DESIGN-1 sans le dupliquer : DESIGN-1 définit le système visuel, UX-04 réduit et clarifie les actions. Préserver UI-2 et les protections serveur ; une interface plus simple ne doit pas rendre une action sensible moins explicite.

- [x] **TEST-2 — Transformer les vérifications en suite reproductible.** Tests de règles métier, intégration sur deux entreprises et E2E des trois rôles ; fixtures isolées et traces sans secrets.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : CI rejoue livraison, échec, facture, refus d’accès et scénarios de panne ; pas de simple objectif de couverture.

  Source / dépendance / blocage : Après corrections concernées ; tests existants conservés.

  État final revalidé le 2026-10-17 : la suite rejoue 235 règles locales, une intégration connectée sur deux entreprises temporaires et trois parcours navigateur consécutifs. Livraison avec preuve, échec motivé, facture visible, six frontières interentreprises, deux refus entre rôles, panne 503 avec repli visible, onboarding interne et boucle support sont vérifiés. Le contrôle final confirme zéro résidu sur entreprises, utilisateurs, commandes, livraisons, factures et tâches.

  Validation : `npm run check` réussi avec 235/235 tests, trois E2E Chrome réussis en 4,5 minutes, build Next.js de 100 pages, scanner de 802 fichiers sans secret, 38 documents et `git diff --check` réussis. La recette a reproduit puis corrigé la saturation du pool au troisième login de démonstration : les montages transactionnels sont bornés par lots de deux et le build local est testé via `localhost` pour ses cookies sécurisés. Les preuves ne contiennent ni identifiant interne, ni e-mail, ni secret ; traces et vidéos persistantes désactivées. Procédure `docs/operations/test2/README.md`, rapport `docs/rapports/2026-10-16/test2.md`, preuves `outputs/test2/`. TEST-2 fournit le point d'entrée pour CI-1 sans déployer.

- [x] **CI-1 — Automatiser les contrôles et préparer la livraison.** Types, lint, tests, build, revue des dépendances et secrets ; procédure de déploiement préproduction puis production et retour arrière.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Modification défaillante bloquée ; déploiement et retour arrière essayés sur cible isolée.

  Source / dépendance / blocage : ENV-1, DB-1 ; publication réelle sur instruction explicite.

  Avancement vérifié le 2026-10-16 : l'audit initial de DOC-1 rapportait 28 entrées, puis le diagnostic précis 12 packages dont Next.js critique. Next.js/ESLint passent de 15.5.19 à 15.5.28, PostCSS et Sharp sont forcés vers leurs versions corrigées, et les outils de build/lint sont correctement classés en développement. `npm audit --omit=dev` passe désormais avec zéro vulnérabilité de production ; six alertes élevées restent uniquement dans la chaîne ESLint de développement, sans version corrigée compatible publiée. Installation `npm ci`, 217 tests, lint strict, deux E2E et build 98 pages réussis. Rapport `docs/rapports/2026-10-16/ci1-dependencies.md`, preuve `outputs/ci1/dependency-audit.json`.

  Avancement vérifié le 2026-10-17 : workflow GitHub Actions ajouté. À chaque changement de `main` ou demande de fusion, le job sans secret installe le lockfile, bloque les fichiers/empreintes de secrets, lance types, lint, 235 tests, documentation, audit des dépendances de production et build. Le build a été rejoué dans une copie neuve sans `.env.local` avec uniquement trois valeurs publiques factices `.invalid`. Un premier échec a révélé les variables publiques Supabase nécessaires au pré-rendu ; le workflow les fournit désormais sans utiliser d'identifiant réel. La recette TEST-2 connectée est un job manuel séparé, lié à l'environnement protégé `preproduction`, et ne publie ses preuves nettoyées qu'après succès. Procédure `docs/operations/ci1/README.md`, rapport `docs/rapports/2026-10-17/ci1-workflow.md`, preuve `outputs/ci1/workflow-validation.json`.

  Reste à faire : publier le workflow sur le dépôt `origin` après autorisation, configurer l'environnement protégé et ses secrets après ENV-1, exécuter la recette connectée sur cette cible, puis ajouter et essayer le déploiement/retour arrière après DB-1. Aucun push ni déploiement n'a été effectué ; CI-1 reste ouverte.

  Avancement du 2026-10-19 : le workflow couvre désormais les pushes `preproduction` et exécute une garde d'isolation avant le job connecté. Cette garde refuse la référence Supabase actuelle, les hôtes incohérents, les secrets opérationnels faibles/partagés, les e-mails réels et le nettoyage automatique. Le cron opérationnel chaque minute a été retiré du manifeste de préproduction car Vercel Hobby le refuse ; sa route reste disponible. Validation : 279 tests dont quatre ciblés, types/lint stricts, build de 102 pages, 58 documents, audit production sans vulnérabilité, scanner de 871 fichiers sans secret et diff-check réussis. Publication et première exécution distante restent bloquées par la reconnexion et ENV-1/DB-1.

  Terminé le 2026-10-20 : workflow et branche publiés, job local GitHub vert et Preview Vercel créée sans modifier `main`. La chaîne connectée distante du commit `f6e19cc` est entièrement verte : garde d'isolation, 279 tests, recette A/B, montage temporaire, trois parcours Chromium, preuve sans secret, nettoyage de six sociétés temporaires et artefact de preuve publié. Le contrôle direct final retrouve zéro utilisateur Auth et une base conforme. Le retour arrière Preview vers `f6e19cc` réussit en 1 min 39 s, puis le rétablissement du commit courant `04a0a35` réussit en 2 min 11 s ; l'alias stable suit de nouveau le commit courant. Vercel Hobby ne propose pas l'Instant Rollback pour une Preview : la procédure redéploie le commit sain avec les réglages actuels. Rapport `docs/rapports/2026-10-20/ci1-rollback.md`. DB-1 et OPS-03A ont ensuite validé séparément migrations et restauration base + Storage.

- [x] **OPS-03A — Vérifier sauvegarde et restauration.** Inventorier hébergement, base, photos et politiques existantes ; fixer objectifs de perte acceptable et délai de reprise.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : Restauration complète sur cible isolée chronométrée ; contrôle des commandes et photos ; procédure écrite.

  Source / dépendance / blocage : Accès hébergeur requis ; ne pas supposer sauvegardes absentes.

  Acquis partiel : archive locale complète créée et vérifiée après SEC-02, avant SEC-01. Elle ne couvre ni la base Supabase distante ni Storage ; cette tâche reste ouverte.

  Avancement local du 2026-10-17 : inventaire en lecture seule reproductible ajouté. La cible de test utilise PostgreSQL 17.6 (~15 Mio), vingt tables publiques avec RLS, et un bucket `delivery-pods` privé contenant deux objets correspondant à deux références de preuve. Aucun outil `pg_dump` n'est présent dans les emplacements usuels ; la baseline de migrations globale manque toujours. Objectif interne avant vente fixé à RPO ≤ 1 h pour base/photos et RTO ≤ 4 h, sans en faire une promesse avant exercice. Procédure `docs/operations/ops03a/README.md`, rapport `docs/rapports/2026-10-17/ops03a-inventory.md`, preuve `outputs/ops03a/inventory.json`.

  Reste à faire : vérifier plan/rétention dans le compte hébergeur, disposer d'une cible Supabase isolée et des outils compatibles, restaurer base + objets + configuration, chronométrer puis rejouer santé, RLS, Auth, commandes et photos. Aucun de ces contrôles ne peut être remplacé par l'inventaire ; la case reste ouverte.

  Décision du 2026-10-18 : RPO ≤ 1 h et RTO ≤ 4 h retenus comme cibles techniques, sans garantie contractuelle avant exercice. Les simulations sont autorisées exclusivement sur préproduction. L'estimation montre qu'un PITR Supabase 7 jours coûte environ 100 $/mois en plus du plan et couvre PostgreSQL, pas à lui seul les fichiers Storage ; validation de dépense et stratégie de copie des photos requises avant activation.

  Avancement connecté du 2026-10-21 : répétition logique base + Storage réussie sur la préproduction isolée. Deux schémas et deux buckets temporaires strictement bornés ont été créés ; l'archive locale temporaire a contenu les vingt tables et une vraie preuve PNG avec manifeste SHA-256. La source a été supprimée avant restauration. Les vingt tables, la relation commande/livraison, le chemin de preuve, la configuration privée du bucket, les octets et la lecture par URL signée ont été retrouvés à l'identique. Sauvegarde 18,332 s, restauration 10,529 s, validation 12,9 s, total 55,969 s. Schéma public, données, comptes Auth, catalogue et fichiers existants sont identiques avant/après ; schémas, buckets et archive temporaires ont été supprimés. Procédure `docs/operations/ops03a/README.md`, rapport `docs/rapports/2026-10-21/ops03a-restore-rehearsal.md`, preuve `outputs/ops03a/restore-rehearsal.json`.

  Déblocage du 2026-10-21 : le propriétaire a confirmé que les quatre entreprises non démo et toutes les anciennes sessions de la cible historique sont aussi fictives. L'inventaire final en lecture seule a trouvé cinquante-deux anciennes sessions, une société démo de base et zéro mutation. Le projet historique `wlomrzilflbouzyhzwxm` a ensuite été mis en pause, sans suppression ; Supabase le conserve récupérable et l'emplacement gratuit est libéré. La préproduction est restée conforme après l'opération : garde d'isolation, vingt tables, deux migrations, références RBAC, RLS, bucket privé, démo permanente et trois sessions temporaires valides. Rapport `docs/rapports/2026-10-21/supabase-legacy-pause.md`.

  Terminé le 2026-10-21 : une cible Supabase Free temporaire et isolée a reçu l'export officiel de la cible historique. Les 58 tables sauvegardées ont exactement les compteurs attendus : 4 569 lignes publiques, 1 061 lignes Auth, 91 Realtime et 77 Storage ; 25 utilisateurs sont visibles par l'API Auth. Les vingt tables applicatives ont RLS active, 438 commandes et 438 livraisons sont présentes. Les deux PNG ont été restaurés dans le bucket privé, puis vérifiés octet par octet par téléchargement direct et URL signée. Import SQL : 2 min 12 s ; phase Storage finale : 3,298 s. Archives et journaux sont protégés par un manifeste SHA-256 ; aucun secret n'entre dans les preuves. Procédure `docs/operations/ops03a/README.md`, rapport `docs/rapports/2026-10-21/ops03a-provider-restore.md`, preuve `outputs/ops03a/provider-restore.json`.

  Limite connue de lancement : le plan Free ne garantit pas le RPO interne d'une heure et les sauvegardes de base n'incluent pas Storage. RELEASE-1 devra valider une copie chiffrée hors site au moins horaire ou une option fournisseur payante approuvée, sans présenter l'objectif comme une garantie contractuelle.

- [x] **OPS-03B — Installer diagnostics et alertes utiles.** Suivre erreurs API, jobs, uploads, disponibilité et actions sensibles sans secrets ; procédure d’incident et responsable.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Panne simulée déclenche une alerte exploitable ; diagnostic et reprise documentés.

  Source / dépendance / blocage : ENV-1 et la préproduction isolée sont terminées. La simulation, le diagnostic et un canal de test peuvent avancer maintenant ; seul le destinataire live dépend d'EMAIL.

  Avancement local du 2026-10-16 : sonde publique minimale et diagnostic profond protégé ajoutés. La base, le bucket privé et les tâches échouées/bloquées sont contrôlés sans identifiant métier ; un état dégradé renvoie 503. Les crons signalent désormais les échecs terminaux et les files non vidées via un événement structuré, nettoyé avant journal ou webhook HTTPS. Procédure : `docs/operations/ops03b/README.md` ; rapport : `docs/rapports/2026-10-16/ops03b-local.md`.

  Validation locale : 235/235 tests, types/lint stricts, 34 documents, diff-check et build Next.js de 100 pages réussis. La recette connectée en lecture seule confirme 20 lectures auth concurrentes, base/Storage/file sains et zéro mutation. Elle a aussi permis de reproduire puis corriger une panique Prisma 5.22 sous concurrence en retirant `relationJoins`, sans cache d'autorisation. Preuve : `outputs/ops03b/connected.json`.

  Reste à faire : brancher un vrai moniteur/canal sur la préproduction d'ENV-1, désigner son responsable, simuler une panne, recevoir l'alerte puis mesurer le retour à la normale. La case reste ouverte jusque-là.

  Décision du 2026-10-18 : démarrer avec des alertes par e-mail, suivies initialement par le propriétaire. Couvrir indisponibilité, base, sauvegarde, tâches critiques, sécurité et paiement futur ; aucun Slack requis en V1. Le destinataire opérationnel et le domaine d'envoi restent à configurer avec EMAIL.

  Terminé le 2026-10-23 : moniteur indépendant actif dans Supabase toutes les trente minutes, avec journal privé 90 jours, quatre secrets dans Vault, transitions panne/reprise, rappels bornés et idempotence. Le jeton Vercel Automation Bypass dédié traverse la protection sans rendre la préproduction publique. Baseline réelle saine (HTTP public/profond 200, base/Storage/file `ok`), panne fictive alertée en 80 ms puis reprise réelle alertée en 1 369 ms ; état final sain, un seul cron actif, aucun accès `anon`/`authenticated`, aucune donnée métier mutée. Le canal webhook reste un canal de recette ; EMAIL le remplacera avant pilotes réels. Rapport : `docs/rapports/2026-10-23/ops03b-preproduction-monitor.md`.

- [ ] **OPS-FIAB — Fiabiliser les tâches de fond et l'exploitation.** Lancer les tâches durables sans dépendre du seul cron Vercel, détecter les tâches en retard, fixer Node et indexer les clés étrangères.

  **Modèle conseillé : GPT‑6 Luna · effort moyen.**

  Terminé quand : le workflow GitHub planifié a réellement tourné sur la préproduction avec ses secrets ; `after()` est vérifié sur Vercel ; Node 22 est réglé sur Vercel ; la migration d'index est appliquée en préproduction (en production avec `CONCURRENTLY`) ; une tâche en retard déclenche une alerte reçue.

  Source / dépendance / blocage : branche `agent/fiabilite` intégrée ; rapport `docs/rapports/agents/2026-10-28-fiabilite.md`, `docs/OPERATIONS.md`. Secrets GitHub, Node Vercel et migration de préproduction : propriétaire (PROPRIO-2810). Un workflow planifié ne tourne que depuis la branche par défaut (`main`).

  État : implémenté et recetté localement sur tutelliv-dev le 28 octobre 2026. `kickOperationJob` passe par `runAfterResponse` (`after()`, repli direct hors requête, jamais d'exception pour l'appelant, 12 appelants inventoriés) ; filet cron `.github/workflows/cron-operations.yml` toutes les 5 minutes (environnement GitHub `preproduction`, `Authorization: Bearer CRON_SECRET`, `vercel.json` intact) ; test de chevauchement de deux `processDueOperationJobs` ; `.nvmrc` 22.18.0, `engines` `>=22.18 <23` ; 12 `@@index` et migration `20261028090000_fk_indexes` (`CREATE INDEX IF NOT EXISTS`, appliquée sur tutelliv-dev uniquement) ; `countOverduePendingJobs` : le cron renvoie 503 et un incident `operation-jobs-overdue` si une tâche `PENDING` a plus de 15 minutes de retard, que le santé profonde ne couvrait pas. Le même cron passe aussi les factures échues en retard (DEMO-3). `npm run check` 1145/1145 sur l'intégration (557e9d5), build à 146 pages. Recette navigateur : `/api/cron/operations` 401 sans secret ; avec secret 503 `success:false` (trois tâches `signup-welcome` en échec, e-mail désactivé), tâches et factures échues traitées. Case laissée ouverte : rien n'a été exécuté sur Vercel ni sur GitHub.

  Reste : déclenchement réel du workflow (secrets `PREPROD_BASE_URL`, `PREPROD_CRON_SECRET`, `VERCEL_AUTOMATION_BYPASS_SECRET` si la protection l'exige, environnement GitHub sans restriction de branche, présence du workflow sur `main`) ; exécution réelle d'`after()` sur Vercel ; Node 22 sur Vercel ; migration d'index en préproduction ; cron en 503 dès qu'une tâche échoue, ce qui masque le succès des autres (RECETTE-2810) ; premier job « Prise en charge » resté `PENDING` plus d'une minute avant le cron (RECETTE-2810).

- [x] **SUPPORT-1 — Fermer la boucle du support.** Vérifier puis compléter réception staff, réponse, statut et historique ; définir canal réellement suivi et délai annoncé.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : Ticket client → réponse staff → notification → résolution visible ; accès interentreprises refusé.

  Source / dépendance / blocage : Après SEC-02 ; audit PROD-01.

  Périmètre : assistance et résolution des tickets. COMM-1 couvre la coordination opérationnelle autour d’une commande ; réutiliser les éléments existants sans confondre les deux usages.

  État final vérifié le 2026-10-16 : le client crée et suit sa demande dans le portail ; l'équipe la reçoit dans `/support`, répond, conserve l'historique et change son statut. Réponses et statuts produisent une notification TutelLiv ; une réponse client rouvre une demande résolue. Le canal annoncé est l'espace intégré, avec un objectif de première réponse sous un jour ouvré. L'e-mail reste explicitement dans EMAIL.

  Validation : 217/217 tests locaux, recette connectée sur deux entreprises avec zéro résidu, parcours Chrome client/admin/chauffeur et deux refus 403 réussis, suite E2E globale 2/2, build Next.js 98 pages et `git diff --check` réussis. Une concurrence réponse/résolution détectée en recette est couverte : une réponse tardive ne rétrograde plus un ticket résolu. Procédure `docs/operations/support1/README.md`, rapport `docs/rapports/2026-10-16/support1.md`, preuves `outputs/support1/`.

- [ ] **EMAIL — Valider les messages transactionnels.** Configurer expéditeur et destinataires de test ; invitations, récupération, événements utiles et gestion d’échec.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : Envoi test reçu ; échec visible/rejouable ; préférences respectées ; aucun envoi en double.

  Source / dépendance / blocage : le transport, les modèles, l'idempotence et les pannes simulées sont testables sans domaine. La clé Resend, le domaine vérifié et la boîte contrôlée sont requis uniquement pour fermer la recette d'envoi réel ; OPS-02B est terminée.

  Limite V1 : les e-mails servent aux invitations, à la récupération et aux alertes utiles ; ils ne redeviennent pas le lieu principal de coordination des missions. Pas d’import automatique des commandes par e-mail prévu dans le noyau.

  Décision du 2026-10-18 : Resend retenu en principe ; la boîte de réception de test choisie est configurée uniquement dans l'environnement local ignoré par Git. Préparer `no-reply@…` et `support@…`, mais aucun domaine n'est acheté/confirmé : ne pas inventer `tutelliv.fr` ou `.com`, ne pas modifier le DNS et ne pas activer d'envoi réel avant validation.

  Avancement local du 2026-10-18 : transport métier sécurisé par trois modes explicites (disabled, test, live). Le mode recette redirige tous les messages vers une boîte contrôlée et affiche cet état dans le portail ; le dépôt reste désactivé par défaut. Configuration partielle refusée, délai borné, sujets neutralisés, clés d'idempotence stables, erreurs sans contenu sensible, frontières d'entreprise et préférences vérifiées. Les échecs de livraison/facture restent visibles et rejouables dans la file durable. Validation : 266 tests, types/lint stricts, build isolé 101 pages, 55 documents, scanner 855 fichiers et diff-check réussis. Aucun envoi ni secret utilisé. Procédure `docs/operations/email/README.md`, rapport `docs/rapports/2026-10-18/email-transport-local.md`, preuve `outputs/email/verification.json`.

  Reste à faire avant de cocher : confirmer le domaine et les expéditeurs, configurer Resend et le SMTP/modèles Supabase sur ENV-1, recevoir les messages dans la boîte de test configurée hors Git, tester expiration/limitations, panne/reprise et doublons sur la cible isolée. Aucun envoi réel n'a été effectué.

  Avancement local du 2026-10-24 : `npm run test:email-sec05` couvre 32 tests avec Supabase/Resend simulés : expiration et rejeu invitation/récupération, panne visible puis reprise à clé stable, tâche/notification uniques, livraison fournisseur idempotente simulée et zéro appel en mode `disabled`, y compris au rejeu. `npm run check` passe 366/366. EMAIL reste ouverte pour domaine, expéditeurs, SMTP/Resend configurés, limites fournisseur et réception réelle. Rapport `docs/rapports/2026-10-24/email-sec05-local.md`.

  Avancement du 2026-10-29 : les nouveaux e-mails des chantiers du 28 octobre (relance de facture, « Nouvelle facture » à la livraison, « Prise en charge », preuve de livraison avec lien du portail) passent par les tâches durables et la clé d'idempotence existantes ; en recette sur tutelliv-dev le transport est désactivé, donc aucune réception réelle n'a été observée et la déduplication par `Idempotency-Key` côté Resend n'a pas été vue. Ces e-mails s'ajoutent à la recette d'envoi réel de cette tâche, toujours ouverte.

- [x] **DOC-1 — Réconcilier la documentation et les procédures.** Actualiser architecture, base, commandes, configuration, limitations, dépannage et reprise ; archiver les statuts historiques non vérifiés.

  **Modèle conseillé : GPT‑6 Luna · effort moyen ; repli si indisponible : GPT‑5.6 Luna.**

  Terminé quand : Un nouveau collaborateur lance et vérifie la cible à partir de la documentation ; liens et commandes valides.

  Source / dépendance / blocage : Ancien DOC-1.

  État final vérifié le 2026-10-16 : README et index courant, architecture, vingt modèles Prisma, six rôles, configuration, commandes sûres, crons, limites, dépannage et reprise ciblée réconciliés avec le code. Les modules déjà présents ne sont plus présentés comme futurs ; les rapports datés sont explicitement des preuves historiques.

  Validation : `npm run docs:verify` contrôle 29 documents sans lien cassé, script cité absent ni variable manquante. Sur une copie neuve sans secrets, `npm ci`, génération Prisma, contrôle documentaire, `npm run check` avec 217/217 tests, démarrage local et `/login` 200 réussissent. Aucune base distante touchée. Rapport `docs/rapports/2026-10-16/doc1.md`, preuves `outputs/doc1/`.

- [x] **LINT-1 — Résoudre la dette de vérification.** Traiter les 24 avertissements observés et remplacer next lint déprécié avec une configuration équivalente.

  **Modèle conseillé : GPT‑6 Luna · effort faible ; repli si indisponible : GPT‑5.6 Luna.**

  Terminé quand : Types, lint, tests et build passent ; aucune désactivation globale pour masquer les erreurs.

  Source / dépendance / blocage : Ancien LINT-1.

  État final vérifié le 2026-10-16 : les 20 avertissements qui subsistaient au début de l'exécution dans 15 fichiers source sont résolus. La commande dépréciée `next lint` est remplacée par ESLint sur `src` avec zéro avertissement admis. Imports et paramètres inutilisés, dépendances de Hooks, aperçus de preuve de livraison et période active du tableau de bord sont corrigés sans désactivation globale.

  Validation : `npm run check` réussi avec 217/217 tests et lint à zéro avertissement ; suite E2E 2/2, build Next.js 98 pages, contrôle documentaire et `git diff --check` réussis. Rapport `docs/rapports/2026-10-16/lint1.md`, preuve `outputs/lint1/summary.json`.

- [ ] **V1-GO — Valider la V1 prête à être essayée.** Exécuter la recette des trois rôles sur données fictives, sécurité, erreurs réseau, GPS sur téléphones réels, échanges, preuve et historique. Vérifier configuration, aide et incidents connus.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : Parcours complet validé avec preuves ; aucun défaut bloquant connu sur ce parcours ; limites documentées ; fonctions non qualifiées explicitement hors promesse. Ce jalon ne vaut ni validation commerciale ni autorisation de production.

  Source / dépendance / blocage : Après les phases 1 à 4 ci-dessous pour les fonctions promises ; appareils/opérateur nécessaires aux essais terrain ; dépendances externes signalées sans bloquer les autres travaux.

  Avancement local vérifié les 2026-10-17/18 : 235 règles locales, recette connectée A/B avec doubles créations standard/coursier, collecte obligatoire, transition invalide refusée, livraison, échec avec motif obligatoire et concordant client/admin, preuve, facture, conversation et isolation, puis trois parcours Chrome généraux consécutifs réussis. Un scénario Chrome opérationnel supplémentaire ferme R01, R02, R06 et R10 en 4,1 minutes : double clic réel avec une seule commande, parcours coursier collecte → livraison, trois contrôles de proximité 200, vraie preuve PNG relue côté client/admin et échec `ABSENT` concordant. Les champs Motif et Note sont nommés pour les technologies d'assistance. Cinq captures, aucune erreur de page, preuve privée supprimée et zéro résidu. Une saturation `P2028` au troisième login a été reproduite puis corrigée en bornant à deux les transactions simultanées de montage de démo. Le build local de production est testé via `localhost` pour conserver les cookies sécurisés. Build 100 pages, scanner et documentation sans erreur, diff-check réussi. Procédure `docs/operations/v1-go/README.md`, rapport `docs/rapports/2026-10-17/v1-go-local.md`, preuves `outputs/v1-go/readiness.json` et `outputs/v1-go/browser-operational.json`.

  Reste à faire avec intervention : MOB-01C sur iPhone/Android physiques et SEC-05/EMAIL avec expéditeur réel. TEST-2 sur préproduction et la restauration OPS-03A sur cible isolée sont terminés. Les essais physiques et e-mails gardent la case ouverte sans bloquer les travaux locaux indépendants.

## 5 — Conserver les modules utiles et préparer l’usage réel

Travaux conservés. Les fonctions optionnelles ne bloquent pas le noyau si elles sont explicitement exclues de la V1 ; une fonction non qualifiée ne doit pas être exposée comme fiable. Contrats et données restent à cadrer avant usage réel.

- [x] **OPS-01 — Fiabiliser les récurrences.** Occurrence durable unique, reprises après erreur, lots drainés, fuseaux horaires et fin de mois.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : 100 échéances traitées sans perte ; échec après réservation rejoué une seule fois ; pause/annulation respectées.

  Source / dépendance / blocage : Défaut initial reproduit avec dépendances simulées. Worker et base de test qualifiés ; cron déployé, alertes de préproduction et DB-1 restent à valider avant vente.

  Validation : 100 échéances simulées traitées sans perte ni doublon, panne après création durable rejouée sur une seule commande, pause/annulation et fins de mois vérifiées. Recette connectée de cinq occurrences + rejeu après interruption réussie en 40,7 s ; zéro fixture résiduelle. 226 tests, types/lint stricts, documentation, diff-check et build de 100 pages réussis. Aucun schéma, migration ou déploiement modifié. Rapport `docs/rapports/2026-10-16/ops01.md`, guide `docs/operations/ops01/README.md`, preuve `outputs/ops01/connected.json`.

- [x] **SPECIAL-1 — Qualifier les missions spéciales.** Tester devis/demande multi-adresses jusqu’à livraison, autorisations et facturation si conservées dans la V1.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Parcours complet validé ou fonction exclue explicitement de la promesse pilote.

  Source / dépendance / blocage : Non couvert E2E ; après PROD-03.

  Validation : socle demande à trois adresses → conversion manuelle après accord externe → affectation → prise en charge → livraison avec preuve → facture testé sur deux entreprises isolées. Lecture, écriture de statut et facture interentreprises refusées ; passage direct du devis à livré refusé ; zéro fixture résiduelle. La catégorie reste désactivée par défaut et les écrans signalent sa nature expérimentale. Le devis chiffré, ses versions et l'acceptation client n'existent pas dans TutelLiv : la fonction est donc explicitement hors offre pilote. Tests ciblés 4/4, suite complète 230/230, types/lint stricts, documentation, diff-check, recette connectée en 39,5 s et build de 100 pages réussis ; rapport `docs/rapports/2026-10-16/special1.md`, guide `docs/operations/special1/README.md`, preuve `outputs/special1/connected.json`.

- [x] **BILL-01A — Décider le périmètre de facturation de livraison.** Choisir export/connecteur comptable ou émission de factures finales ; distinguer ces documents des abonnements TutelLiv.

  **Modèle conseillé : GPT‑6 Astra · effort moyen.**

  Terminé quand : Décision écrite et promesse commerciale correspondante ; ne pas annoncer une comptabilité complète sur la base du PDF actuel.

  Décision confirmée le 2026-10-18 : la V1 fournit consultation des prestations, informations tarifaires, export comptable et documents de suivi. TutelLiv ne promet ni logiciel de comptabilité complet, ni émission réglementaire de factures électroniques. Préparer une future intégration avec un outil comptable ou une plateforme agréée, compte tenu du calendrier français 2026/2027. Référence : `docs/DECISIONS_PRODUIT_COMMERCIALES.md`.

- [x] **BILL-01B — Mettre le flux de facturation au niveau de la promesse.** Branche V1 retenue selon BILL-01A : export comptable des prestations et relevés opérationnels. L'émission finale avec séquences, instantanés légaux, avoirs et mentions réglementaires appartient à une future intégration décidée séparément.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Critère V1 adapté à la décision propriétaire du 2026-10-18 : export réservé à l'entreprise et testé, période/statut explicites, décimaux précis, lignes et versions traçables, données enregistrées indépendantes des tarifs actuels, répétition sans doublon et lecture cohérente entre lots ; contrat de colonnes et limites historiques documentés. Calculs et relevé long vérifiés. Le critère d'émission finale réglementaire ne s'applique pas à cette branche export.

  Résultat vérifié le 2026-10-18 : téléchargement depuis Commandes, route `invoices:read`, CSV UTF-8/BOM à 29 colonnes `tutelliv-delivery-v1`, lignes DOCUMENT/LINE et empreinte de version ; filtres de création UTC et cinq statuts explicites. Lecture transactionnelle RepeatableRead par lots de 250, bornes 10 000 documents/50 000 enregistrements/20 Mio et refus sans fichier partiel. Montants calculés avec Decimal et arrondi au centime, saisies sous-centime/non finies refusées. Les anciennes données ne sont ni recalculées ni corrigées implicitement ; anomalies de détail signalées. Relevé PDF opérationnel paginé et distinction prestations/abonnement affichée.

  Validation : 261 tests locaux, types/lint stricts, build isolé sans secrets de 101 pages, recette connectée 1 001 documents A + 1 B réussis. Cinq statuts, deux bornes UTC le jour de changement d'heure, caractères CSV/formules/Unicode, deux exports identiques, changement de tarifs/nom sans effet, révision détectée et écriture concurrente entre pages testés. Référence étrangère refusée ; zéro résidu et empreinte préexistants inchangée. PDF de neuf pages avec 160 lignes et fin retrouvées, rendu visuel contrôlé. Gardes HTTP réelles exécutées localement avec session substituée ; aucun nouveau parcours navigateur authentifié revendiqué.

  Limites explicites : PENDING reste révisable, les coordonnées/mentions légales ne sont pas figées dans le modèle et le PDF utilise encore des réglages courants ; aucun avoir ni imputation automatique, aucune garantie réglementaire. Annulations positives d'origine signalées pour rapprochement externe. Les futurs abonnements restent séparés. Aucun schéma, migration, donnée réelle, envoi, serveur utilisateur, push ou déploiement modifié. Rapport `docs/rapports/2026-10-18/bill01b.md`, contrat `docs/operations/bill01b/README.md`, preuves `outputs/bill01b/`.

  Source / dépendance : BILL-01A et BILL-02 terminées ; émission finale exclue de la promesse V1 conformément à `docs/DECISIONS_PRODUIT_COMMERCIALES.md`.

  Suite du 2026-10-28 : Factur-X EN 16931 des factures de livraison dans FACTURX-1 (le relevé classique et l'export comptable restent inchangés).

- [ ] **FACTURX-1 — Factur-X EN 16931 des factures de livraison.** Joindre au PDF de la facture de livraison un XML CII (profil EN 16931 « Comfort ») embarqué en PDF/A-3, téléchargeable depuis le back-office et le portail, avec mentions légales de l'entreprise et identité de facturation du client, sans changer le relevé classique ni l'export comptable. Ce n'est pas une émission via une plateforme agréée et il ne faut pas le présenter comme une conformité certifiée.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : validation officielle (XSD et Schematron : Mustang ou validateur FNFE) passée sur des factures fictives de recette ; décision prise sur le PDF/A-3b strict (police embarquée) ; traitement BT-32 de la franchise en base confirmé ; recette navigateur des écrans administrateur et portail ; choix d'une plateforme agréée tracé (FACTURX-2 si retenu).

  Source / dépendance / blocage : branche `agent/facturx` intégrée dans `integration/2026-10-28` ; rapport `docs/rapports/agents/2026-10-28-facturx.md` et `docs/FACTURX.md`. Aucune migration, aucune dépendance ajoutée (mentions légales dans `Company` et `settings.einvoicing`, identité client dans `settings.invoiceIdentity`). Validation officielle : fichier fictif, hors agent, par le propriétaire (PROPRIO-2810).

  État : implémenté et recetté sur tutelliv-dev le 28 octobre 2026. Générateur XML pur avec contrôles BR (BR-CO, BR-S, BR-E, BR-AE), intégration PDF (`/AF`, XMP PDF/A-3 + schéma `fx`, OutputIntent sRGB, `/ID` déterministe), facture payée (`TotalPrepaidAmount`), franchise via BT-32, mentions légales visibles propres à la variante Factur-X, écritures des réglages par réclamation sur `updatedAt`, route `/api/invoices/[id]/pdf` sous `withApiHandler`, bouton du portail masqué en brouillon ou annulée. Relevé classique inchangé (empreintes de contenu vérifiées). `npm run check` 785/785 sur la branche puis 1145/1145 sur l'intégration (557e9d5). `security-review` : aucune vulnérabilité de confiance supérieure ou égale à 8. Recette navigateur de l'intégration : téléchargements du back-office et du portail (propriétaire 200, autre client 404), XML extrait avec pdf-lib (70 + 12 = 82 HT, TVA 20 % = 16,40, TTC 98,40 ; franchise 45 / 0 / 45), brouillon et annulée en 422 avec bouton masqué, entreprise sans SIREN en 422 clair avec PDF classique disponible, facture en retard téléchargeable. Audit Codex : conforme, validation XSD/Schematron et plateforme agréée non prouvées. Case laissée ouverte : la validation officielle n'a pas eu lieu.

  Reste : validation Mustang/FNFE sur factures de recette ; décision sur le PDF/A-3b strict (polices non embarquées aujourd'hui) ; confirmation du traitement BT-32 de la franchise par la FNFE ou une plateforme agréée ; choix d'une plateforme agréée (FACTURX-2) ; remarque de confiance faible (environ 3/10) : le 409 « SIREN déjà utilisé » permet d'énumérer une donnée publique ; spécification E2E `facturx.spec.ts` à corriger (RECETTE-2810). Écritures de `settings` hors réclamation : voir RECETTE-2810.

- [ ] **LEGAL-1 — Préparer le dossier contractuel et données personnelles.** Faire valider contrat SaaS/CGV, confidentialité, traitement de données, sous-traitants, hébergement, GPS, photos, conservation et incidents selon usages/pays.

  **Modèle conseillé : GPT‑6 Astra · effort moyen.**

  Terminé quand : Documents validés et cohérents avec le service réel ; responsabilités et support explicités.

  Source / dépendance / blocage : Pays et organisation à confirmer ; validation professionnelle.

  Avancement décisionnel du 2026-10-18 : la France est confirmée ; identité juridique, SIREN, TVA et adresse restent inconnus et ne doivent pas être inventés. Préparer CGV/contrat SaaS B2B, confidentialité, accord de traitement, sous-traitants, GPS, photos, conservation, assistance et responsabilités pour validation professionnelle avant exploitation réelle.

  Dossier préparatoire réalisé le 2026-10-18 : inventaire des douze pièces à établir/valider, matrice par traitement des responsabilités envisagées, registre des fournisseurs/destinataires connus, inconnues et décisions, sources officielles datées et checklist avant données réelles. Le dossier couvre aussi pilote gratuit, attribution/commissions, facturation électronique 2026/2027, GPS salariés, photos, incidents et sortie. Aucune clause définitive ni identité fictive. `docs/legal/README.md`.

  Reste à faire : confirmer l'identité de l'éditeur et ses justificatifs, recueillir contrats/DPA/régions des fournisseurs réellement retenus, faire qualifier les rôles et l'AIPD, puis faire rédiger ou valider chaque pièce par les professionnels compétents. LEGAL-1 reste ouverte.

- [ ] **DATA-02 — Prévoir sortie, export et conservation des données.** Définir export par entreprise, délais de conservation, suppression et arrêt GPS hors service ; séparer clôture compte et obligations de conservation.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : Export exploitable et test de suppression sur fixtures ; aucun effet sur une autre entreprise ; politique appliquée au stockage et sauvegardes.

  Source / dépendance / blocage : Après LEGAL-1 ; action réelle destructive seulement sur instruction.

  Avancement local vérifié le 2026-10-17 : export JSON versionné du graphe d'une entreprise ajouté, avec entreprise, utilisateurs/rôles, adresses, dernière position, notifications, récurrences, commandes/articles/collectes, livraisons/suivi, conversations/lectures, factures, support, manifeste de jobs et manifeste des preuves privées. Les identifiants Auth, clés d'idempotence, empreintes et détails internes des jobs sont exclus. Recette A/B réussie : aucune donnée de B dans l'export de A ; suppression strictement gardée de la fixture A ; tous ses compteurs à zéro ; B inchangée ; zéro résidu final. Procédure `docs/operations/data02/README.md`, rapport `docs/rapports/2026-10-17/data02-local.md`, preuve `outputs/data02/connected.json`.

  Complément local validé le 2026-10-18 : archive privée contenant le JSON, les photos originales et un manifeste SHA256, avec vérificateur hors ligne. Liens entreprise/commande/livraison et chemins contrôlés avant tout téléchargement ; flux séquentiels bornés ; finalisation seulement après succès complet. Huit tests dédiés, 243 tests au total, types/lint, recette réelle A/B et vérificateur d'intégrité réussis. Photo manquante ou référence étrangère refusée sans archive partielle ; B intacte ; zéro entreprise et zéro objet Storage de fixture restants. Rapport `docs/rapports/2026-10-18/data02-proof-archive.md`. Le JSON est encore chargé en mémoire ; les permissions locales ne constituent pas un chiffrement ni une restauration validée.

  Première tranche de nettoyage démo vérifiée le 2026-10-18 : nouvelles sessions avec échéance serveur de huit heures, grâce d'une heure et outil opérateur dry-run par défaut. Suppression transactionnelle limitée au roster synthétique exact, sans fichier ni référence interentreprises ; legacy, Auth, assets et jobs en cours refusés sans mutation. Recette connectée A/B : expirée supprimée, active et entreprise normale intactes, référence étrangère et objets Storage conservés lors des refus, panne intermédiaire entièrement annulée, deux workers/rejeu idempotents. Zéro fixture DB/Storage et 17 compteurs globaux restaurés. Validation : 251 tests, types/lint, build isolé de 100 pages, 47 documents, scanner 832 fichiers et diff-check réussis. Guide `docs/operations/data02/DEMO_RETENTION.md`, rapport `docs/rapports/2026-10-18/data02-demo-retention.md`, preuve `outputs/data02/demo-retention-connected.json`. Aucun ordonnanceur activé ; cible ≤24 h non garantie sur tous les cas.

  Préparation du planificateur local validée le 2026-10-18 : exécuteur partagé limité aux 100 plus anciennes sessions expirées, détection de reliquat, compteurs/codes agrégés sans identifiant et route `/api/cron/demo-cleanup` protégée par secret de cron plus autorisation DATA-02 exacte. Refus, reliquat et panne déclenchent un incident opérationnel sans fuite d'identifiant. La route n'est inscrite dans aucun horaire et reste désactivée par défaut ; aucun déploiement ni nettoyage connecté en écriture n'a été effectué. Le dry-run connecté a refusé sans mutation 51 anciennes candidates non certifiées. Validation : 271 tests, types/lint stricts, build isolé de 102 pages, 57 documents, scanner de 862 fichiers et diff-check réussis. Rapport `docs/rapports/2026-10-18/data02-demo-scheduler.md`, preuve `outputs/data02/demo-scheduler-verification.json`.

  Avancement préproduction du 2026-10-20 : un modèle permanent strictement reconnu est installé sur la nouvelle cible isolée. Une connexion crée une société de session distincte ; la déconnexion demande sa suppression protégée en arrière-plan, sans ralentir la sortie, et l'accès expire côté serveur après huit heures. La fixture CI préserve le modèle et le compte Auth lorsqu'ils existaient avant son exécution, mais refuse toute autre donnée préalable. Essais réels : création d'une session isolée, authentification administrateur, suppression de cette seule session, puis contrôle final d'une société modèle, huit utilisateurs applicatifs et un utilisateur Auth. La première création a cependant pris 83 s sur Supabase Free et le nettoyage 39 s ; l'horaire des expirations reste désactivé.

  Qualification legacy vérifiée le 2026-10-18 : un ancien cookie ne peut plus rouvrir une session sans échéance exacte ; la prochaine connexion crée une session bornée. Inventaire connecté strictement en lecture seule : 51/51 anciennes candidates ont le marqueur et le roster synthétique attendus, aucune référence DB de logo/avatar/photo/PDF ou job actif, aucun objet Storage et aucune référence interentreprises ; toutes portent un graphe métier et aucune n'a d'échéance persistée. Elles restent inaccessibles et conservées : aucune adoption, date inventée ou suppression sans décision explicite. Validation : 275 tests, types/lint stricts, build isolé de 102 pages, 57 documents, scanner de 867 fichiers et diff-check réussis. Rapport `docs/rapports/2026-10-18/data02-legacy-demos.md`, preuve agrégée `outputs/data02/demo-legacy-inventory.json`.

  Décision legacy du 2026-10-21 : les cinquante-deux anciennes sessions, la société démo de base et les quatre sociétés auparavant marquées normales sont confirmées fictives. Le projet historique a été mis en pause sans suppression ; aucune conservation métier de ces jeux n'est requise. L'export complet, Auth et Storage compris, a ensuite été restauré sur une cible isolée dans OPS-03A. Reste à faire avec intervention/décision : politique légale de conservation, canal chiffré de remise, politique de sauvegarde hors site des futurs clients, nettoyage des futurs cas avec assets, puis activation et observation de l'horaire sur préproduction. Aucune route destructive générique n'est exposée ; la route démo étroitement gardée n'est pas planifiée. DATA-02 reste ouverte.

  Inventaire technique du 2026-10-25 : `docs/operations/data02/INVENTORY.md` classe chaque modèle Prisma et signale ceux qui manquent à l'export entreprise. Auth et Storage ne sont pas relus. Aucune durée ni suppression n'est décidée. DATA-02 reste ouverte.
  Contrat d'export local du 2026-10-25 : une horloge figée et deux entreprises fictives aux données proches prouvent l'isolation de toutes les catégories déjà exportées, leurs tris stables, leurs compteurs et l'absence de lecture annexe quand l'entreprise manque. Le contenu n'est pas élargi : Role et OperationJob restent partiels, les modèles déjà absents le restent, Auth et Storage ne sont pas lus. Preuve dédiée : `npm run test:data02:export-contract`. DATA-02 reste ouverte.
  Contrat SaaS dans l'export du 2026-10-27 : `data.subscriptions` ajoute la souscription de l'entreprise, l'historique des formules (code et nom seulement), les options et sièges, et les périodes de consommation. Les identifiants du fournisseur de paiement, les instantanés internes, les journaux techniques, les réservations transitoires et le brouillon d'inscription restent exclus. L'ajout est compatible avec la version 1, ce qui laisse l'archive et son vérificateur inchangés. Quatre compteurs ont été ajoutés et `INVENTORY.md` est mis à jour : douze modèles restent hors export, chacun avec sa raison. Vérifié : `npm run test:data02:export-contract` (huit lectures isolées, projection exacte, exclusions, tris), inventaire et archive 11/11, `npm run check` 515/515. Export réel en lecture seule sur deux entreprises de la préproduction autorisée : souscription LEGACY, puis souscription commerciale avec 2 formules et 2 options, sans identifiant fournisseur. Seuls les compteurs ont été affichés et rien n'a été écrit. DATA-02 reste ouverte : politique de conservation (LEGAL-1), canal de remise chiffré, JSON encore chargé en mémoire.

  Export en flux du 2026-10-27 : `visitCompanyExport` relit chaque collection par pages de 100 lignes. La pagination se fait par clé `createdAt`, `id`, toujours filtrée par `companyId`, dans une seule transaction en lecture répétable bornée à dix minutes. `createCompanyExportJsonWriter` écrit le même document v1 page par page, avec `counts` et `externalAssets` placés après `data`. L'archive écrit désormais `company.json` en flux, avec son SHA256 et sa taille calculés pendant l'écriture. Elle contrôle le graphe commandes/livraisons page par page, toujours avant la première lecture Storage. Le plafond JSON passe de 10 Mio en mémoire à 1 Gio sur disque. `exportCompanyData` garde le même contenu pour les recettes. Vérifié : `npm run test:data02:export-contract` 5/5 (pages stables avec horodatages identiques, sans doublon ni perte ; flux identique à l'export en mémoire avec des pages de 1 et de 100 ; collection vide ; collection rouverte et taille de page invalide refusées) ; `tests/company-archive.test.ts` 8/8 ; `npm run check` 689/689. Recette connectée `test:data02` sur `tutelliv-dev` sous Node 22.18.0, la version de la CI : réussie, isolation A/B, zéro résidu. Sous le Node 20 local, elle échoue avant l'export, car Supabase exige un WebSocket natif. Sur une entreprise fictive de `tutelliv-dev`, en lecture seule : export identique avec des pages de 1 et de 100 lignes (15 commandes, 11 utilisateurs). Limites : aucun essai sur un gros volume réel ni d'exports simultanés ; une page embarque l'historique complet de chaque ligne. DATA-02 reste ouverte : politique de conservation (LEGAL-1), canal de remise chiffré, sauvegardes.

  Proposition France préparée le 2026-10-18 : GPS 60 jours par défaut, archivage commercial probatoire jusqu'à cinq ans si justifié, pièces comptables dix ans, démos sous 24 h et pilotes supprimés sous 30 jours après export, avec séparation active/archive. Toute suppression définitive de données réelles reste interdite avant validation juridique ; seule la tranche de données démo explicitement autorisée ci-dessus est implémentée. `docs/operations/data02/RETENTION_POLICY_DRAFT.md`.

  Complément du 2026-10-28, intégration des chantiers parallèles : le manifeste d'export liste les signatures des réceptionnaires (`kind: "signature"`) et l'archive les télécharge avec leur SHA256 ; une signature bloque la purge démo comme une photo ; durée de conservation documentée dans `docs/DATABASE.md` sans aucune durée validée ni purgeur général (LEGAL-1). Les tables `OrderIntakeUsage` (jetons et issue, aucun texte) et `InvoiceReminder` sont classées dans `docs/operations/data02/INVENTORY.md` (l'export de la seconde est « non »). Le fournisseur du modèle de la commande par message est la fiche F10 de `docs/legal/SOUS_TRAITANTS.md`, à qualifier avant toute donnée réelle (INTAKE-1). La position enregistrée avec une preuve est la dernière position connue du livreur : à aligner sur la décision GPS avant données réelles. Tâche toujours ouverte.

- [x] **DEMO-1 — Isoler les démonstrations.** Éviter qu’un login remette à zéro la session d’un autre prospect ; jeu fictif et remise à zéro limitée.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : Deux démos simultanées indépendantes ; aucun impact sur entreprises réelles.

  Source / dépendance / blocage : Audit PROD-01 ; avant diffusion de démos.

  Validation : chaque navigateur reçoit une entreprise fictive propre, avec cookie HTTP-only de huit heures et trois personas isolés. Deux sessions simultanées de huit livraisons ont été créées ; reset de A sans perte du marqueur B, puis reconnexion B sans reconstruction. La recette complète est passée de 85,7 à 36,7 s après parallélisation et a laissé zéro résidu. Les réglages de dispatch utilisent la clé courante. Suite complète 230/230, types/lint stricts, 33 documents, diff-check et build de 100 pages réussis. Les sessions expirées restent à traiter par la future politique DATA-02/OPS-03B avant trafic public important. Rapport `docs/rapports/2026-10-16/demo1.md`, guide `docs/operations/demo1/README.md`, preuve `outputs/demo1/connected.json`.

  Extension préproduction du 2026-10-20 : compte et scénario modèle permanents installés sur la nouvelle base isolée, société propre créée pour le navigateur puis supprimée à la déconnexion. La fermeture d'onglet seule conserve la session jusqu'à son échéance fiable de huit heures. La CI sait réutiliser et préserver le modèle exact. L'ancienne cible et ses 51 démonstrations n'ont pas été modifiées. La latence initiale distante de 83 s est une régression P0 à traiter avant ouverture publique ; elle ne remet pas en cause l'isolation vérifiée.

- [x] **DEMO-2 — Rendre l'ouverture de la démonstration quasi immédiate.** Retirer la construction complète du scénario du chemin de connexion. Préparer un petit stock d'environnements fictifs isolés, les attribuer atomiquement à une session, puis les remettre à l'état modèle en arrière-plan après déconnexion ou expiration. Prévoir capacité, attente et repli explicites sans jamais partager une entreprise entre deux visiteurs.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  **Complexité : élevée — concurrence, recyclage fiable, nettoyage et coexistence avec la CI.**

  Terminé quand : première ouverture et reconnexion respectent un budget mesuré sur Preview ; deux visiteurs simultanés restent isolés ; aucune construction longue ne bloque l'authentification ; un pool épuisé affiche un état maîtrisé ; logout/expiration recyclent uniquement la session concernée ; données, Auth, Storage et jobs sont contrôlés ; le modèle permanent reste intact et la cible historique mise en pause n'est pas sollicitée.

  Tests requis : attribution concurrente, double clic, abandon pendant attribution, pool vide, recycle réussi/échoué, expiration, redémarrage worker, CI simultanée et zéro fuite A/B. Ne pas augmenter le plan Supabase ni activer un ordonnanceur payant sans accord.

  Budgets à valider sur la Preview : p95 connexion → tableau de bord ≤ 5 s lorsqu'un environnement est prêt, aucune ouverture ≥ 10 s, reconnexion p95 ≤ 3 s et réponse de déconnexion ≤ 2 s avant recyclage asynchrone. Maintenir au moins trois environnements prêts pour les essais ; un pool vide affiche une attente explicite et ne bascule jamais vers une entreprise partagée. Le temps de reconstruction en arrière-plan reste mesuré séparément.

  Source / dépendance / blocage : DEMO-1 a validé l'isolation mais la création mesurée à 83 s sur Supabase Free est incompatible avec une démo publique. Réutiliser les gardes DATA-02 et OPS-02B ; distinguer vitesse de démo et connexion normale d'un client existant.

  Terminé le 2026-10-22 : pool persistant de trois entreprises fictives créé sur la seule préproduction isolée, avec réservation sérialisable, empreinte de session unique, double clic idempotent, attente `503/Retry-After` si le stock est vide, recyclage durable hors réponse et quarantaine fermée en cas d'asset, job, référence étrangère ou panne Storage. Auth est nettoyé avant la ligne locale ; les jobs terminés sont purgés. RLS est active et les rôles publics n'ont aucun droit sur la table de coordination. La recette connectée a validé concurrence, A/B, stock vide, expiration, worker interrompu, échec/récupération et modèle permanent intact. Sur la vraie Vercel Preview du commit `f353f58`, trois ouvertures prêtes ont mesuré p95/max 3 035 ms, reconnexion p95 279 ms et logout p95 1 201 ms ; une première fonction froide avait mesuré 5 290 ms, toujours sous le plafond absolu de 10 s. Le pool final contient 3 prêts, 0 loué, 0 quarantaine. Validation globale : 298 tests, types/lint et build réussis. Guide `docs/operations/demo2/README.md`, rapport `docs/rapports/2026-10-22/demo2.md`, preuves `outputs/demo2/connected.json` et `outputs/demo2/http.json`.

## 6 — Reprendre la validation commerciale quand le propriétaire sera disponible

Prospection, entretiens et pilotes différés à sa demande ; aucune prise de contact prévue. Conserver leurs critères, sans les considérer validés par les tests internes.

  Location des recettes du 2026-10-27, décision C10 : une connexion démo qui envoie `demoTestSession: true` réserve son espace une heure au lieu de huit. Les cinq recettes Playwright démo l'envoient. Seule la valeur booléenne `true` est acceptée, et l'indicateur ne peut que raccourcir la session de celui qui l'envoie. Les humains gardent huit heures. Vérifié : harnais de connexion (indicateur vrai, chaîne, absent), `tests/demo-pool.test.ts`, `npm run check` 525/525. Limite : pas exercé sur la préproduction, dont le pool est saturé par d'autres sessions.

- [x] **PROD-01 — Confirmer le segment et le pays.** Entreprises françaises de coursiers et livraison express B2B, idéalement 5–20 livreurs et clients professionnels récurrents ; 3–5 livreurs en cible secondaire et structures plus importantes via Business. Priorité Paris/Île-de-France et Marseille/Bouches-du-Rhône. Acheteur principal : dirigeant ou responsable d'exploitation ; dispatcher prescripteur et utilisateur quotidien.

  **Modèle conseillé : GPT‑6 Astra · effort moyen.**

  Terminé quand : Une fiche cible validée ; aucune hypothèse présentée comme un fait.

  Validation propriétaire du 2026-10-18 : France et segment confirmés. Exclusions V1 : médical réglementé, matières dangereuses, frigorifique contrôlé, international/douanes et transport lourd/logistique industrielle complexe. Fiche consolidée dans `docs/DECISIONS_PRODUIT_COMMERCIALES.md`. Cette clôture fixe la cible ; PROD-02 reste nécessaire pour vérifier la réalité et l'intensité du problème.

- [ ] **PROD-02 — Documenter le travail actuel et sa difficulté principale.** Préparer dix entretiens sur des journées récentes : réception des demandes, affectation, appels de suivi, preuves perdues, facturation. Recruter et contacter uniquement avec instruction explicite.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Synthèse des problèmes récurrents, fréquence, coût et outils actuels ; sélectionner un problème prioritaire avec preuves.

  Source / dépendance / blocage : Après PROD-01 ; prospects requis.

  Statut de planification : différé, conservé ; ne bloque pas le développement de la V1 sur données fictives. Les validations externes restent nécessaires au critère de clôture.

  Avancement : le propriétaire a décrit les e-mails client → administrateur → livreur → confirmation et échanges par e-mail. Difficultés rapportées : temps, organisation, visibilité des étapes et position. Les entretiens indépendants et mesures ne sont pas réalisés.

  Ciblage confirmé le 2026-10-18 : France entière, priorité Paris/Île-de-France et Marseille/Bouches-du-Rhône ; objectif d'environ dix entretiens. Un système de recherche de prospects est en préparation, mais aucun résultat n'est encore compté comme preuve.

- [ ] **PROD-04 — Définir les mesures de valeur.** Mesurer temps de dispatch, appels de suivi par livraison, incidents, délai de récupération de preuve et temps de première livraison. Définir période et méthode de mesure.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : Valeur de départ avant pilote et objectif convenu avec chaque entreprise ; instruments utilisables sans collecte excessive.

  Source / dépendance / blocage : l'instrumentation, les définitions et la fiche de valeur initiale peuvent être préparées maintenant à partir de V1-MESURE. Les valeurs propres à chaque entreprise et tout gain annoncé attendent PROD-02/PILOT-1.

  Prochaine tranche immédiate : figer définitions, événements, périodes, minimisation et fiche de saisie, sans produire de gain commercial. La baseline entreprise et les objectifs convenus restent une validation terrain.

  Protocole documentaire local du 2026-10-25 : `docs/operations/prod04/README.md` fixe des périodes comparables, le début et la fin de chaque mesure, les sources autorisées, la minimisation et les calculs descriptifs. Il réutilise la fiche PILOT-1 sans lancer de collecte, conserve les valeurs absentes comme « non mesuré » et interdit seuil, causalité ou gain inventé. PROD-04 reste ouverte : aucune baseline d'entreprise, aucun objectif convenu et aucune donnée terrain ne sont disponibles avant PROD-02/PILOT-1.

- [ ] **OFFER-1 — Valider la grille cible et l'offre pilote.** Confronter les formules Starter 79 € HT/mois, Pro 179 € et Business 349 €, leurs annuels à 790/1 790/3 490 € HT, options, plafonds et dépassements aux coûts et prospects. Pilote proposé : trois entreprises, quatre semaines, gratuit, usage encadré, accompagnement direct, export final et aucune obligation de souscription. Les prix TTC à 20 % servent d'exemple France ; la taxe réellement applicable doit être déterminée par transaction.

  **Modèle conseillé : GPT‑6 Astra · effort moyen.**

  Terminé quand : Offre acceptée par prospects ; coûts infrastructure/cartes/stockage/messages/support mesurés ; pas d’illimité non maîtrisé.

  Source / dépendance / blocage : grille et pilote décidés par le propriétaire le 2026-10-18, complétés les 2026-10-20/21. Les options et utilisateurs supplémentaires ne bénéficient pas des deux mois offerts de la formule annuelle : leur prix annuel correspond à douze mensualités. Les dépassements sont non bloquants, mesurés et facturés chaque mois, sans packs. Le dispatcher limité est confirmé : 0 inclus en Starter, 1 en Pro, 1 en Business, puis 8 € HT/mois par dispatcher supplémentaire dans toutes les offres et douze mensualités sur l'annuel. Les sept familles de règles C7 sont fermées ; acceptation, rentabilité et limites Business restent à vérifier. L'ancienne hypothèse 199 € est abandonnée. Référence : `docs/DECISIONS_PRODUIT_COMMERCIALES.md` et future simulation COST-1.

  Statut de planification : différé, conservé ; ne bloque pas le développement de la V1 sur données fictives. Les validations externes restent nécessaires au critère de clôture.

- [x] **SAAS-01A — Implémenter le noyau des offres, droits et quotas.** Créer un catalogue versionné et configurable pour Starter, Pro, Business et leurs options ; une souscription ou un pilote identifié par entreprise ; des éléments souscrits et un instantané contractuel ; des droits effectifs et compteurs par période. Appliquer côté serveur les fonctions, plafonds de livreurs, administrateurs et dispatchers/mini-administrateurs ainsi que les commandes, y compris après changement d'offre. Une option déjà incluse ne peut jamais être facturée une seconde fois. Séparer strictement abonnement TutelLiv, prestations de livraison et pilote gratuit.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  **Complexité : très élevée — nouveau schéma, migrations, concurrence, droits transversaux et compatibilité des entreprises existantes.**

  Terminé quand : catalogue et instantanés sont historisés ; pilote gratuit ou souscription manuelle produit les bons droits et plafonds ; Starter/Pro/Business incluent respectivement 0/1/1 dispatcher et chaque dispatcher supplémentaire est tarifé une seule fois ; chaque création d'utilisateur est contrôlée côté serveur ; Business « illimité » reste mesuré avec politique d'usage ; les commandes ne sont pas bloquées au quota et leurs dépassements sont comptés une seule fois dans la bonne période mensuelle, y compris pour l'annuel ; changements de formule recalculent les droits sans réécrire le passé ; requêtes forgées et interface modifiée ne contournent rien ; entreprises existantes sont migrées vers un état explicite sans activation payante inventée.

  Tests requis : matrice Starter/Pro/Business × options × rôles, dont 0/1/1 dispatcher inclus et supplément à 8 € ; refus serveur des abonnements, paiements et paramètres sensibles au dispatcher ; bornes exactes et concurrence au dernier siège/à la dernière commande ; changement, échéance et reprise ; inclusion sans double facturation ; isolation A/B ; pilote distinct ; migration et retour arrière sur préproduction.

  Source / dépendance / blocage : architecture et règles confirmées dans `docs/SAAS_OFFERS_ARCHITECTURE.md` et `docs/DECISIONS_PRODUIT_COMMERCIALES.md`. Aucun paiement réel n'est nécessaire ni activé.

  Ordre interne : (1) catalogue/version et pilote manuel, (2) souscription/éléments instantanés, (3) résolution centralisée des droits, (4) quotas et compteurs transactionnels, (5) changements d'offre. Chaque incrément migre et se restaure sur copie isolée ; aucune logique temporaire dans l'interface ne remplace le contrôle serveur.

  Résultat vérifié le 2026-10-22 : catalogue C7, 3 offres et 9 options versionnés ; souscriptions commerciales, pilotes et états historiques séparés ; instantanés et périodes d'effet historisés ; plafonds de sièges réservés atomiquement ; dispatcher 0/1/1 puis 8 € HT/mois ou 96 € HT/an ; commandes non bloquées et comptées une seule fois par mois UTC ; contrôles serveur sur dispatch automatique, GPS administrateur/client et analytics. Les entreprises présentes restent `LEGACY` sans paiement inventé et les sessions démo deviennent des pilotes de huit heures. La migration additive est appliquée à la préproduction isolée : 29 tables sous RLS, 3 migrations, zéro droit public et zéro drift. Répétition sauvegarde/restauration : 29 empreintes identiques, schémas temporaires supprimés, données publiques inchangées. Validation : `npm run check` avec 295 tests, build 103 pages, vérification préproduction verte. Rapport : `docs/rapports/2026-10-22/saas-01a.md`.

- [x] **SIGNUP-1 — Construire l'inscription autonome jusqu'à la première livraison.** Créer un parcours persistant : offre mensuelle/annuelle → options et quantités autorisées → prix HT/TTC indicatif et dépassements expliqués → identité/coordonnées professionnelles, SIREN/SIRET et facturation → vérification e-mail → paiement fictif → création atomique de l'entreprise et du premier administrateur → droits/quotas → bienvenue → reprise dans ONBOARD-1. Aucune entreprise payante active ne doit être accordée sur un simple retour navigateur ou sans confirmation serveur du paiement requis.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  **Complexité : très élevée — orchestration durable entre identité, paiement, entreprise, e-mail et onboarding.**

  Terminé quand : le parcours reprend après fermeture ou panne ; e-mail/entreprise déjà utilisés sont traités sans fuite ; paiement refusé, double événement, double soumission, invitation d'un compte existant et erreur de provisionnement restent cohérents ; l'activation est idempotente et compensable ; une entreprise fictive va de la page d'offre à sa première livraison sans intervention humaine ; les étapes et leur progression sont accessibles sur mobile.

  Tests requis : succès mensuel/annuel, interruption à chaque étape, paiement refusé/non confirmé/dupliqué/désordonné, e-mail et SIREN/SIRET existants, provisionnement partiel injecté, reprise, deux inscriptions concurrentes et isolation interentreprises. Utiliser d'abord un adaptateur de paiement fictif déterministe ; aucune transaction réelle.

  Source / dépendance / blocage : dépend des interfaces stables de SAAS-01A et réutilise SEC-05, EMAIL et ONBOARD-1. Le transport e-mail de test et un adaptateur de paiement fictif suffisent au développement ; domaine, Stripe live, structure juridique et pilotes ne le bloquent pas.

  Résultat vérifié le 2026-10-22 : assistant responsive en cinq étapes, reprise par jeton opaque de trente jours, catalogue serveur et devis HT/TTC mensuel/annuel, options et plafonds contrôlés, identité légale/facturation, confirmation Supabase gérée et paiement fictif strictement limité au local/Preview. Une confirmation serveur exacte est exigée avant la transaction atomique qui crée entreprise, administrateur, offre, options, droits et quotas. Les événements de paiement, doubles soumissions et activations sont idempotents ; l'e-mail de bienvenue est une tâche durable rejouable. La préproduction isolée porte les quatre migrations SIGNUP-1, la vérification e-mail et l'adaptateur fictif sans aucune variable Production. Recette connectée : mensuel, annuel, refus, attente, rejeu, concurrence SIREN, isolation, passage ONBOARD-1 jusqu'à une première livraison et retour exact de la base à son état initial. Validation : 308 tests, build de 106 pages, migration à jour et garde de préproduction verte. Rapport : `docs/rapports/2026-10-22/signup-1.md`.

  Correctif vérifié le 2026-10-23 : la Site URL Supabase de préproduction ne pointe plus vers `localhost` et `/reset-password` est explicitement autorisé. TutelLiv accepte maintenant le lien `ConfirmationURL` du modèle Supabase gratuit, qui redirige une session dans le fragment, en plus du futur modèle personnalisé `TokenHash`. Le fragment est retiré immédiatement puis validé côté serveur dans un client isolé ; aucune activation ni entreprise n'est créée sans métadonnées gérées et paiement serveur confirmé. Validation : 309 tests, types/lint sans erreur et build de 106 pages réussi.

  Renvoi ajouté le 2026-10-23 : l'écran d'attente affiche un bouton « Renvoyer l'e-mail » avec compte à rebours de trente secondes. Le délai persiste en base et est réservé atomiquement côté serveur ; rechargement, double clic ou appels concurrents ne peuvent pas contourner la limite. La dixième migration de préproduction est appliquée et enregistrée dans l'historique Prisma. Validation locale : types/lint et 311 tests, dont la concurrence de renvoi ; build et déploiement Preview vérifiés. Limite externe conservée : le fournisseur Supabase gratuit impose actuellement soixante secondes entre confirmations, donc l'envoi réel à trente secondes attend le futur SMTP personnalisé ; le refus fournisseur est affiché sans contourner sa protection.

- [ ] **PILOT-1 — Recruter et conduire trois pilotes accompagnés.** Préparer démonstration, critères d’entrée et protocole ; viser quatre semaines d’usage représentatif, sans en faire un délai de développement.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : Mesures avant/après, incidents, adoption par les trois rôles, coût support et retours consignés chaque semaine.

  Source / dépendance / blocage : Après portes A–C ci-dessous ; contacts et démarrage commercial explicitement autorisés.

  Statut de planification : différé, conservé ; ne bloque pas le développement de la V1 sur données fictives. Les validations externes restent nécessaires au critère de clôture.

  Dispositif proposé le 2026-10-18 : trois entreprises pendant quatre semaines, gratuit, nombre de livreurs convenu, usage réel encadré, accompagnement direct, aucune facturation automatisée, aucune obligation de souscription et export final. Mesurer commandes, livreurs actifs, fonctions, erreurs, besoins, retours des trois rôles et disposition à payer. Le caractère gratuit doit être validé dans le protocole ; aucune donnée réelle avant les portes A–C.

  Préparation locale du 2026-10-18 : protocole exécutable et fiches de suivi ajoutés dans `docs/operations/pilot1/`. Ils définissent les portes technique, contrat/données et exploitation, le périmètre V1, la semaine 0 puis quatre semaines, les mesures stables, trois niveaux d'incident, les entretiens séparés des trois rôles et la sortie avec export/conservation. Aucun prospect n'a été contacté, aucune donnée réelle utilisée et aucun résultat commercial supposé. PILOT-1 reste ouverte jusqu'à la conduite documentée des trois pilotes.

- [ ] **PILOT-2 — Décider avec les preuves des pilotes.** Analyser ce qui crée de la valeur et les abandons ; objectif proposé : au moins deux pilotes veulent payer pour continuer, avec gain observé.

  **Modèle conseillé : GPT‑6 Astra · effort moyen.**

  Terminé quand : Décision poursuivre/resserrer/revoir l’offre documentée ; ne pas ajouter des fonctions pour masquer l’absence de valeur.

  Source / dépendance / blocage : Après PILOT-1 ; objectif à valider, pas résultat acquis.

  Statut de planification : différé, conservé ; ne bloque pas le développement de la V1 sur données fictives. Les validations externes restent nécessaires au critère de clôture.

## 7 — Vente autonome, exploitation SaaS et extensions

Développer l'architecture et les scénarios en environnement fictif sans activer de paiement réel. Les inconnues commerciales restent configurables jusqu'à arbitrage ; les intégrations multiples ou fonctions sans lien avec le problème prioritaire restent différées.

- [x] **SAAS-01B — Intégrer paiement et facturation SaaS en environnement fictif.** Brancher Stripe comme premier fournisseur étudié derrière l'adaptateur de paiement de SIGNUP-1. Gérer abonnement mensuel/annuel, options, utilisateurs supplémentaires, dépassements facturés sur la période, renouvellement, changement, paiement échoué, résiliation, remboursement décidé et historique. Les droits suivent uniquement des événements serveur vérifiés et idempotents. Distinguer facture/justificatif du fournisseur de paiement et obligations françaises de facturation électronique.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  **Complexité : très élevée — argent, fiscalité, événements asynchrones, idempotence et réconciliation.**

  Terminé quand : en sandbox, succès, événement dupliqué/désordonné/manquant, impayé, renouvellement, annulation et remboursement retenu sont réconciliés ; aucun droit sur simple retour navigateur ; montants EUR HT/TTC, taxe appliquée et source de calcul sont traçables ; une option incluse n'est jamais facturée ; les options d'une formule annuelle sont facturées douze mensualités sans remise de deux mois ; les dépassements sont comptabilisés sur la période ; aucun secret n'est exposé.

  Tests requis : webhooks signés, rejeu et ordre inversé, interruption navigateur, double paiement, changement simultané, taxes simulées, limites de montant, rapprochement, panne fournisseur et reprise. Aucun paiement réel ni activation commerciale avant structure juridique, compte bancaire, règles fiscales/facturation et autorisation explicite.

  Source / dépendance / blocage : après SAAS-01A et SIGNUP-1 ; le développement sandbox peut commencer avant les pilotes. Les règles C7 sont confirmées : montées et ajouts immédiats après paiement du prorata, diminutions au renouvellement, dépassements mensuels non bloquants, restrictions J0/J3/J7/J14/J30, résiliation en fin de période, remboursements exceptionnels tracés et support prioritaire sans délai court garanti. Fournisseur réel, règles fiscales/contractuelles et coûts restent à valider avant paiement réel. Architecture : `docs/SAAS_OFFERS_ARCHITECTURE.md`.

  Avancement local du 2026-10-24 : adaptateur `stripe-sandbox` derrière SIGNUP-1, journal durable, C9 Business 20/50/9 €, webhooks signés, cron inerte tant que l’adaptateur reste `fake`. Vérifié : `npm run check` 358/358, `npm run test:saas01b` (PostgreSQL isolé Homebrew `127.0.0.1:55439`, y compris crash d’usage sans fermer la période), `npm run test:saas01b:e2e` 3/3 Chrome sans réseau Stripe, notice `?payment=cancelled` visible. **Aucun compte Stripe n’existe encore** : la case reste ouverte jusqu’à Checkout/webhooks réels en mode test. Rapport `docs/rapports/2026-10-24/saas-01b.md`, procédure `docs/operations/saas01b/README.md`.

  Recette Stripe en mode test du 2026-10-27, sur instruction du propriétaire, contre `tutelliv-dev` et `stripe listen` vers le port 3108. Passés : Checkout carte 4242 (entreprise activée seulement après facture payée de 94,80 € TTC), abandon sur Stripe (inscription conservée), carte refusée et 3D Secure, signature absente ou forgée (400), événement rejoué sans effet, changement Starter → Pro → Business avec prorata payé et consentement au centime, résiliation en fin de période, remboursement partiel par `npm run billing:refund` (opérateur plateforme, motif journalisé, relance sans double remboursement), et par horloge de test : renouvellement payé, renouvellement refusé (`PAST_DUE`, droits non prolongés), régularisation. Trois défauts corrigés : un changement vers la formule active verrouillait le compte pour toujours ; les webhooks simultanés produisaient des conflits d'écriture (503) ; une demande appliquée pouvait répondre en erreur. Restent : quelques 503 isolés en local, dus à des transactions de plus de 5 s entre ce poste et la base de Paris (Stripe les rejoue) ; les relances J3…J30 se calculent sur l'heure réelle et ne se vérifient donc pas par horloge de test. Les critères de la case sont remplis ; cochée sur validation du propriétaire le 27 octobre 2026.

- [ ] **SAAS-03 — Permettre la gestion autonome de l'abonnement.** Ajouter « Mon abonnement » pour afficher formule, périodicité, options, consommations, alertes et historique ; ajouter/supprimer une option, changer de formule ou de périodicité, gérer le moyen de paiement, consulter les documents, résilier et lancer l'export DATA-02. Toute dépense supplémentaire exige un récapitulatif et une confirmation explicite ; une rétrogradation impossible explique les dépassements à résoudre.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  **Complexité : très élevée — cycle de vie, facturation, droits immédiats/différés et cas de rétrogradation.**

  Terminé quand : chaque action passe par le serveur et un journal auditable ; l'état affiché se réconcilie avec le fournisseur ; seuils de commandes/livreurs produisent des alertes sans doublon ; les rétrogradations avec ressources excédentaires sont refusées ou planifiées selon la règle décidée, jamais destructives ; résiliation conserve l'accès/export selon la politique ; seuls les rôles autorisés gèrent l'abonnement.

  Tests requis : ajout/retrait d'option incluse ou payante, montée/rétrogradation, mensuel→annuel, plafond dépassé, moyen de paiement, résiliation, export, concurrence et isolement A/B. Dépend de SAAS-01A/B et DATA-02.

  Source / dépendance / blocage : après les événements et droits stables de SAAS-01A/B. Les vues en lecture et alertes peuvent être préparées avant les mutations payantes ; prorata, effets immédiats/différés et restrictions d'impayé suivent les règles C7 confirmées.

  Avancement local du 2026-10-24 : vue « Mon abonnement » ajoutée à la seule navigation `COMPANY_ADMIN`, avec `GET /api/billing/subscription` sans cache et strictement filtré à l’entreprise de session. Le DTO local affiche formule, période, options, consommation, alertes 80/100/120 et historique dédupliqué par identifiant interne, sans état JSON brut ni identifiant fournisseur, secret ou entrée/résultat d’opération. État vide et erreur de lecture explicites ; aucun POST n’est appelé. `npm run test:saas03` 5/5 et `npm run check` 371/371 passent. La recette Playwright ouvre désormais explicitement la session démo COMPANY_ADMIN, mais échoue avant navigation (login 401 : résolution DNS Supabase indisponible, sans contournement du middleware) : aucune réussite navigateur n’est revendiquée. SAAS-03 reste ouverte : mutations payantes, moyen de paiement, résiliation et export DATA-02 ne sont pas livrés. Procédure `docs/operations/saas03/README.md`, rapport `docs/rapports/2026-10-24/saas-03-readonly.md`.

  Évaluation de changement de formule du 2026-10-27 : la fonction pure `assessPlanChange` (`src/domains/billing/plan-change.ts`) donne le sens et le moment d'effet C7 (montée immédiate après prorata, baisse au renouvellement). Elle calcule aussi les limites de sièges de la formule visée, en ne comptant que les options compatibles et dans la limite de son maximum. Elle liste enfin les dépassements bloquants, les options qui tomberaient, les fonctions perdues et le dépassement de commandes, qui ne bloque pas. Elle ne tranche ni le sort d'une baisse bloquée ni le remplacement d'une option incompatible, et rien ne l'appelle encore. Vérifié : `npm run test:saas03` 10/10, dont 5 nouveaux cas sur le catalogue C9. Prochaine étape : un journal d'abonnement auditable, donc une migration additive à faire autoriser par le propriétaire, avant toute mutation.

  Correction et branchement du 2026-10-27, décision C10. Les mutations existent déjà pour les abonnements Stripe sandbox : `POST /api/billing` (aperçu, changement, résiliation), réservé à `COMPANY_ADMIN`, idempotent, avec confirmation explicite. Elles sont journalisées avec leur auteur dans `SaasBillingOperation`, donc la migration « journal » n'est pas nécessaire et n'a pas été créée. Ajout : un changement de formule qui laisserait des comptes en excès est refusé immédiatement (409 `PLAN_CHANGE_SEATS_EXCEEDED`, dépassements listés) avant tout appel au fournisseur, et l'aperçu renvoie l'évaluation. Ce contrôle n'est jamais plus permissif que celui du renouvellement. Vérifié : `npm run test:saas03` 11/11, `npm run test:admin01` 88/88, `npm run check`, calcul réel en lecture seule sur la préproduction recoupé par SQL. Restent ouverts : les abonnements à paiement fictif ou manuel, sans compte de facturation (la route répond 404), la réconciliation avec un vrai compte Stripe de test, l'export DATA-02 depuis « Mon abonnement », l'écran des actions et sa recette navigateur.

  Abonnements gérés par l'équipe du 2026-10-27, décision C10 complémentaire. Sans compte de facturation en ligne, « Mon abonnement » affichait « Aucun abonnement actif » à un pilote ou à un client en paiement manuel. `getSubscriptionView` se replie désormais sur l'abonnement SaaS de l'entreprise de session : formule active (`COMMERCIAL`), « Pilote accompagné » (`PILOT`) ou « Accès historique » (`LEGACY`), options et sièges en cours, période, consommation (« sans plafond » pour le plafond illimité) et alertes. L'historique reste vide et aucun identifiant fournisseur ni snapshot n'est lu. Une carte « Abonnement géré par l'équipe TutelLiv » renvoie vers `/contact` ; aucune action en ligne n'est ajoutée. Un compte commercial sans formule active reste « Aucun abonnement actif », sans formule inventée. Un compte de facturation existant garde sa vue (`management: SELF_SERVICE`), sans repli. Vérifié : `tests/saas03-subscription.test.ts` 8/8, `npm run check`, build CI. Recette Chrome sur PostgreSQL local jetable, avec un compte de connexion temporaire en préproduction supprimé ensuite (0 trace vérifiée en SQL) : abonnement manuel Starter annuel avec option et alerte 80 %, pilote sans périodicité ni plafond, 390 px sans débordement, lien vers `/contact`. Reporté par décision : l'export DATA-02 depuis cet écran, faute de canal de remise chiffré.

  Moyen de paiement et factures du 2026-10-27 : « Mon abonnement » ouvre le portail client Stripe (`POST /api/billing`, action `portal`, réservée à `COMPANY_ADMIN`). Le portail est limité au changement de carte et aux factures ; formule, résiliation et coordonnées y sont désactivées, et la configuration est retrouvée par sa métadonnée, jamais dupliquée. Chaque ouverture est journalisée (`PAYMENT_PORTAL`, auteur, sans le lien) et visible dans l'historique. Le portail reste ouvert en cas d'impayé et est refusé pour un abonnement résilié ou géré par l'équipe. L'historique affiche « Voir la facture » pour les seules adresses `https://invoice.stripe.com`. Vérifié : `tests/saas03-payment-portal.test.ts` 6/6, `npm run test:saas03`, `npm run check` 700/700. Recette Playwright `tests/e2e/saas03.spec.ts` sur le serveur de développement déjà lancé (port 3121, sans second serveur) : lien de facture, erreur puis redirection vers un portail factice, 390 px sans débordement ; le test de changement de formule repasse aussi. Essai réel sur le compte Stripe de test (abonnement de la recette SAAS-01B dans `tutelliv-dev`) : portail `billing.stripe.com` en HTTP 200, deux sessions distinctes, journal `DONE` sans lien, 2 factures sur 2 avec un lien. Constat annexe : sur `tutelliv-dev`, sept espaces démo sont restés bloqués en recyclage ou en préparation depuis 20 h 45 environ ; un seul était prêt pendant la recette. Restent pour SAAS-03 : l'ajout et le retrait d'une option en libre-service, l'export DATA-02 depuis l'écran (canal chiffré) et les essais de concurrence A/B des actions.

  Options en libre-service du 2026-10-27 : la carte « Options et comptes supplémentaires » de « Mon abonnement » ajoute ou retire les options et comptes de la formule actuelle (case à cocher, boutons − / + bornés par les sièges de la formule). Elle passe par l'aperçu et le changement existants : ajout immédiat après prorata, retrait au renouvellement, sièges en excès refusés, montant confirmé, clé idempotente, journal. `GET /api/billing` expose les noms, prix et plafonds sans identifiant interne. Vérifié : `npm run test:saas03` 24/24, `npm run check` 712/712. Playwright sur le serveur déjà lancé : un seul aperçu après les clics, plafond respecté, confirmation au montant affiché, 390 px. Aperçu réel sur le compte Stripe de test : ajout du dispatch automatique à un Starter mensuel, immédiat, 34,52 € TTC. Concurrence : `test:saas01b` vérifie encore les changements simultanés refusés, la reprise unique après plantage et la clé non réutilisable. Elle échoue ensuite à la ligne 132 : depuis la consolidation `a44721a`, un changement refusé par le fournisseur garde son verrou jusqu'au rapprochement, alors que la recette attend l'ancienne libération. L'échec est constaté aussi sur le dernier commit, sans les changements du jour. Il faut l'aligner sur la règle de reprise voulue. Restent pour SAAS-03 : l'export DATA-02 depuis l'écran (canal chiffré), l'alignement de `test:saas01b` et un essai A/B navigateur avec deux entreprises.

  Verrou d'une opération refusée, corrigé le 2026-10-27 : la consolidation `a44721a` gardait le verrou après tout refus d'un changement ou d'une résiliation, ce qui bloquait le compte pour de bon (même refus à chaque reprise, puis `BILLING_MANUAL_RECONCILIATION_REQUIRED` après 23 h). Désormais, le verrou n'est rendu que si rien n'a été appliqué chez Stripe : changement vide, conflit détecté avant appel, ou refus de la première étape. L'adaptateur lève `BILLING_PARTIAL_EFFECT` quand une étape échoue après une autre déjà appliquée (calendrier créé, ou calendrier libéré avant une résiliation) ; le verrou reste alors posé pour un rapprochement manuel. Vérifié : `tests/billing-write-conflict.test.ts`, `tests/saas01b-partial-effect.test.ts` 3/3, `npm run test:saas01b` de nouveau vert avec 17 contrôles (dont l'effet partiel), `npm run check` 719/719. Règle dans `docs/operations/saas01b/README.md`. Restent pour SAAS-03 : l'export DATA-02 depuis l'écran (canal chiffré) et un essai A/B navigateur avec deux entreprises.

  Isolement A/B du 2026-10-28 : `tests/e2e/saas03-isolation.spec.ts`, avec deux administrateurs temporaires de deux entreprises de recette ayant chacune un compte Stripe de test (`npm run e2e:role-accounts`, sur `tutelliv-dev` seulement, supprimés après l'essai). Un `accountId` ou `companyId` ajouté à `POST /api/billing` est refusé (400) ; le portail ouvert par A n'apparaît que dans le journal de A ; aucune facture de A (2 factures) n'est visible par B (3 factures), ni dans l'API ni dans « Mon abonnement ». 1/1 sur le serveur de développement. Reste : l'export depuis l'écran, qui attend un canal de remise chiffré (DATA-02).

- [x] **SAAS-04 — Appliquer les 60 jours de découverte premium.** Pour une nouvelle souscription payante Starter ou Pro, ouvrir temporairement les fonctions logicielles premium éligibles, sans relever les quotas et sans inclure automatiquement le support humain prioritaire. Afficher la date de fin et les fonctions concernées ; à l'échéance, retirer seulement les droits non inclus/non achetés, sans facturation automatique.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  **Complexité : élevée — droits temporels, fuseaux horaires, renouvellement et communication sans vente forcée.**

  Terminé quand : début et fin sont calculés côté serveur depuis la première souscription payante ; horloge simulée à J0/J59/J60 ; quotas inchangés ; option achetée conservée ; fonction incluse jamais coupée ; aucun supplément créé à l'échéance ; annulation/impayé/changement de formule suivent une règle documentée ; pilote gratuit reste entièrement distinct.

  Source / dépendance / blocage : dépend de SAAS-01A et des événements SAAS-01B. Les règles d'impayé et changement pendant la découverte restent à arbitrer avec celles de facturation.

  Avancement local du 2026-10-24 : machine de droits ajoutée uniquement au paiement `fake` confirmé. Une première souscription Starter ou Pro fixe côté serveur une échéance à 60 jours ; à J0 et J59, `auto_dispatch`, `admin_gps`, `client_gps` et `advanced_analytics` sont ouverts sans modifier les quotas, puis retirés exactement à J60 s'ils ne sont ni inclus ni achetés. L'assistance prioritaire n'est jamais offerte ; options achetées et fonctions de formule restent présentes ; aucune ligne, facture ou supplément n'est créé à l'échéance. Business, activations manuelles et pilotes gratuits n'ouvrent aucune découverte. Vérifié : `npm run test:saas04` 3/3 et `npm run check` 374/374. SAAS-04 reste ouverte pour l'affichage de la date/fonctions et pour les règles encore non décidées d'impayé ou de changement de formule pendant la découverte.

  Affichage local ajouté le 2026-10-25 dans « Mon abonnement » : tant que la découverte Starter/Pro est active, l'API de lecture expose uniquement son échéance et les quatre fonctions éligibles, puis l'encart disparaît exactement à J60. L'écran précise que quotas et facturation restent inchangés ; Business reste exclu. Vérifié : `npm run test:saas04` 4/4 et `npm run check` 375/375. La recette Playwright a démarré mais reste bloquée avant navigation par le DNS Supabase (`ENOTFOUND`, connexion 401), sans contournement. La case reste ouverte uniquement pour les règles d'impayé et de changement de formule pendant la découverte, qui nécessitent une décision du propriétaire.

  Revue du 2026-10-27 : une souscription confirmée par l'adaptateur `stripe-sandbox` n'ouvre aucune découverte (`saas.service.ts`, test `saas04` qui l'exige). Ce n'est pas un oubli : avec Stripe, impayé et changement de formule deviennent possibles et leur règle pendant la découverte n'est pas décidée. Le raccord Stripe suivra cette décision ; aucun code modifié.

  Décision C10 appliquée le 2026-10-27 (`docs/DECISIONS_PRODUIT_COMMERCIALES.md`). Une souscription confirmée par `stripe-sandbox` ouvre désormais les mêmes 60 jours ; un adaptateur inconnu n'en ouvre aucun. Le premier échec de paiement met fin à la découverte, définitivement : la projection Stripe ramène `premiumDiscoveryEndsAt` à la date de l'échec, et une régularisation ne la rouvre pas. Les droits et « Mon abonnement » appliquent la coupure dès que l'échec est enregistré, même avant la projection, et les règles d'impayé habituelles continuent de s'appliquer au compte. Un changement de formule garde la date de fin ; Business n'a pas de découverte. Vérifié : `npm run test:saas04` 7/7 (4 nouveaux cas), `npm run test:saas03`, `npm run test:saas01b` (PostgreSQL local, doublure Stripe) et `npm run check`. La case reste ouverte : la règle d'annulation pendant la découverte n'est pas encore décidée.

  Résiliation, complément C10 du 2026-10-27 : une résiliation demandée pendant la découverte la termine immédiatement, même si la période payée continue. La projection Stripe ramène `premiumDiscoveryEndsAt` au moment où elle constate la demande ; droits et « Mon abonnement » la coupent dès que `cancelAtPeriodEnd` est vrai, et une résiliation annulée ensuite ne la rouvre pas. L'abonnement, les fonctions de la formule et la création de commandes restent actifs jusqu'à la fin de la période payée. Vérifié : `npm run test:saas04` 8/8, `npm run test:saas01b` (13 contrôles, PostgreSQL local, doublure Stripe), `npm run test:saas03` 11/11 et `npm run check`. Tous les critères de sortie sont prouvés : case cochée. Limite connue : la recette avec un vrai compte Stripe de test reste suivie dans SAAS-01B.

- [x] **SALES-1 — Tracer l'origine des ventes et calculer les commissions.** Associer un code/lien et un commercial à l'inscription, figer les éléments de souscription initiale, conserver le niveau **apporteur 15 % / accompagné 25 % / autonome 35 %**, puis calculer pendant douze mois maximum une commission théorique sur les seuls montants HT réellement encaissés et éligibles. Les options ou changements ultérieurs n'ajoutent pas de commission. Aucun versement automatisé ni CRM complexe.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  **Complexité : élevée — audit financier, corrections, remboursements et immutabilité de l'attribution.**

  Terminé quand : attribution initiale non falsifiable depuis le navigateur ; lien/code expiré ou invalide traité ; instantané des éléments éligibles historisé ; encaissement, impayé et remboursement créent des écritures explicables et idempotentes ; historique consultable par un rôle plateforme autorisé ; calcul exclut achats ultérieurs et s'arrête à douze mois.

  Source / dépendance / blocage : dépend de SAAS-01A/B. Les taux remplacent l'ancienne hypothèse 25/35/50. Contrat et qualification juridique obligatoires avant mise en service ; aucun paiement de commission automatisé.

  Périmètre V1 : enregistrer l'origine, figer l'instantané initial et calculer un montant théorique explicable. Exclure versement, portefeuille commercial, objectifs, relances et CRM ; ces fonctions ne sont pas des dépendances de RELEASE-1.

  Tranche théorique locale du 2026-10-25 : noyau pur ajouté sans schéma ni fournisseur. Il fige les niveaux **apporteur 15 % / accompagné 25 % / autonome 35 %**, la fenêtre maximale de douze mois, le contrat et les lignes initiales éligibles. Chaque règlement produit une clé déterministe ; la base HT est limitée aux montants effectivement payés des lignes initiales, y compris quand une quantité du même produit augmente ensuite. Les factures ouvertes, changements, usages et règlements à partir de la borne exacte des douze mois ne commissionnent pas. Une ventilation incomplète ou un montant imposant une règle d'arrondi non décidée échoue explicitement. Vérifié : `npm run test:sales01` 5/5 et `npm run check` 380/380. SALES-1 reste ouverte : aucune attribution n'est persistée, aucun code/lien n'est émis et aucune régularisation de remboursement/impayé n'est inventée. Prochaine décision propriétaire nécessaire : règles d'émission, propriété et expiration des codes commerciaux avant leur raccord à SIGNUP-1.

  Codes et attribution du 2026-10-27, décision C10 et migration autorisée le même jour. Migration additive `20261027120000_sales_codes` : `sales_codes` (un code permanent par commercial, adresse unique, niveau, auteur, désactivation tracée), `sales_attributions` (une par entreprise, figée) et `sales_commission_entries` (préparée pour les écritures par règlement), RLS active et aucun droit public. Validée sur PostgreSQL local jetable (zéro écart) et **appliquée nulle part**. `sales-code.service.ts` crée les codes (`PRENOM-XXXX`, sans caractère ambigu, collision réessayée), les désactive sans jamais les réactiver, et n'accepte à l'inscription qu'un code existant et actif (message explicite sinon). Le navigateur ne transmet qu'un texte ; le brouillon garde l'identifiant côté serveur et n'expose que `salesCodeApplied`. L'activation fige dans sa transaction le niveau, le taux, la fenêtre de douze mois et les lignes initiales, identiques au contrat de facturation. Un code désactivé avant l'activation n'attribue rien, et une attribution impossible à figer ne bloque jamais un client qui a payé. Vérifié : `npm run test:sales01` (7 nouveaux cas), `tests/signup.test.ts`, `npm run test:saas01b` (14 contrôles dont l'attribution réelle à l'activation, unique malgré l'événement rejoué), `npm run check` 540/540. Restent : écran et API super-administrateur des codes, lien d'inscription et champ dans l'assistant, écritures de commission sur règlement, et une décision sur l'effet d'un remboursement.

  Écran super-administrateur du 2026-10-27 : page `/admin/sales` (lien « Codes commerciaux ») pour créer un code (commercial, e-mail, niveau), lister codes et nombre d'entreprises attribuées (pagination 25/50/100) et désactiver après confirmation, sans réactivation. `GET`/`POST /api/admin/sales-codes` et `PATCH /api/admin/sales-codes/[id]` (action `disable` seule) appliquent l'ordre ADMIN-1 : authentification, rôle `SUPER_ADMIN`, journal, puis corps et service. L'auteur vient de la session. Si le journal est indisponible, rien n'est écrit (503). **Exception de sécurité à relire :** ce sont les seules écritures sous `/api/admin`. Le test ADMIN-1 « GET seulement » les autorise désormais par une liste blanche explicite, en vérifiant qu'elles ne touchent aucune donnée d'entreprise. Le journal enregistre la méthode en base sans l'afficher (minimisation ADMIN-1 conservée). Vérifié : `npm run test:sales01` 17/17, `npm run test:admin01` 88/88, `npm run check` 545/545 et build CI. Recette Chrome avec un compte super-administrateur temporaire, créé sur l'Auth de préproduction et supprimé ensuite (0 trace vérifiée), sur une base PostgreSQL locale jetable : connexion, état vide, création `ELODIEMA-XXXX` au niveau 25 %, second code du même commercial refusé avec message, désactivation confirmée, API `no-store` sans auteur interne, `SALES_CODES` au journal, téléphone sans débordement de page.

  Lien et champ d'inscription du 2026-10-27 : `/register?code=XXXX` pré-remplit un champ facultatif « Code commercial » à l'étape Formule (combinable avec `?plan=`). Le code n'est envoyé que s'il est saisi, donc un retour sans saisie conserve le code appliqué. Un code inconnu ou désactivé affiche le message serveur et ne crée aucun brouillon. L'écran super-administrateur copie le lien d'inscription d'un code actif. Vérifié : `npm run test:sales01` 18/18, `npm run check` et build CI. Recette Chrome sur PostgreSQL local jetable (catalogue C9 chargé) : champ pré-rempli, code désactivé refusé sans brouillon, code actif enregistré dans le brouillon (`PRO`), API publique limitée à `salesCodeApplied`, code conservé au retour, téléphone sans débordement. Restent pour SALES-1 : écritures de commission sur règlement, décision sur l'effet d'un remboursement, consultation de l'historique, application de la migration.

  Commissions et historique du 2026-10-27, décisions du même jour (reprise au prorata ; ventilation selon le contrat initial). `commission-ledger.ts` produit une écriture par facture et par état (ouverte, payée, impayée, annulée), avec un motif explicite : payée et commissionnée, non payée, hors des douze mois, changement ou consommation, contrat modifié, paiement partiel, facture non reconnue. Un remboursement ajoute une reprise négative au prorata, cumulative, plafonnée et arrondie au centime supérieur. Les clés sont déterministes et l'insertion ignore les doublons : un rejeu ne crée rien. La fenêtre part de la période de la première facture, donc le 13e paiement mensuel est exclu. La projection de facturation enregistre ces écritures dans sa transaction ; une erreur de calcul est journalisée sans bloquer l'abonnement. L'écran « Codes commerciaux » ouvre l'historique d'un code (entreprise, niveau, période, écritures, total net) via `GET /api/admin/sales-codes/[id]`, journalisé sous la nouvelle ressource `SALES_COMMISSIONS` (ajoutée à la migration SALES-1, toujours non appliquée, revalidée sur base vierge : zéro écart, RLS active, aucun droit public), sans aucun identifiant de facture Stripe. Vérifié : `npm run test:sales01` 24/24, `npm run test:admin01` 88/88, `npm run test:saas01b` (15 contrôles dont le grand livre réel : 35 % du paiement initial, changement et consommation à zéro, reprise de 0,30 € sur 1 € TTC remboursé, rejeu sans doublon), `npm run check` et build CI. Recette Chrome avec un super-administrateur temporaire de préproduction (supprimé, 0 trace) sur PostgreSQL local : total net 24,30 €, reprise et impayé lisibles, aucun identifiant de facture renvoyé, code désactivé consultable, lecture journalisée. **Tous les critères de sortie sont prouvés localement.** La case attend l'application de la migration en préproduction et une vérification sur place ; la recette avec un vrai compte Stripe de test reste suivie dans SAAS-01B.

  Relecture avant fusion du 2026-10-27 : aucun bloquant. Correctif : l'attribution (activation) et les écritures de commission (projection de facturation) partageaient la transaction appelante, et une erreur SQL l'aurait annulée entière, ce qu'un try/catch ne rattrape pas. Elles passent désormais sous un point de sauvegarde PostgreSQL. Une erreur n'annule que ces écritures, elle est journalisée par son seul code, et les commissions manquantes sont reprises au rapprochement suivant. Vérifié : tests 34/34 (cas d'erreur base de données ajoutés). Banc SAAS-01B sur PostgreSQL réel, 15/15. Preuve sur PostgreSQL jetable : la table des écritures supprimée provoque une vraie erreur P2021, et la transaction appelante est quand même validée. Points mineurs relevés et laissés en suite : un code appliqué ne peut qu'être remplacé, pas retiré, depuis l'assistant ; aucune limite de débit sur la saisie d'un code (impact faible, un code réel attaché à sa propre inscription).

  Terminé le 2026-10-27 en préproduction. Migrations appliquées avant la fusion, puis code fusionné et déployé (`fba1537`, CI verte, déploiement Vercel réussi). Recette Chrome sur le déploiement protégé, avec un super-administrateur temporaire, sans erreur de page :
  - code créé (Apporteur · 15 %, actif), historique vide explicite ;
  - lien `/register?code=` pré-rempli ; code inconnu refusé sans brouillon ; code valide lié au brouillon en base ; l'API publique n'expose que `salesCodeApplied` ;
  - désactivation affichée, puis code désactivé refusé à l'inscription (390 px, sans débordement) ;
  - journal d'accès : `SALES_CODES` POST, PATCH et GET, `SALES_COMMISSIONS` GET.
  Nettoyage vérifié en SQL : brouillon, code de test et compte supprimés, aucune trace (0 compte de recette, 0 code, 3 brouillons comme avant). Hors recette : les commissions sur factures réelles attendent un compte Stripe de test (SAAS-01B) ; leur calcul est prouvé sur le banc local.

- [ ] **SAAS-02 — Mesurer le revenu et la santé du SaaS.** Séparer revenu abonnement, frais et coûts des factures de livraison ; activation, rétention, conversion et consommation par entreprise. Mesurer commandes, livreurs et options, y compris l'usage Business annoncé illimité, avec alertes de coût sans plafond caché.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Indicateurs réconciliés avec paiements ; définitions écrites ; quotas et alertes de coûts testés.

  Source / dépendance / blocage : Après SAAS-01A/B et PROD-04.

  Statut de planification : différé, conservé ; ne bloque pas le développement de la V1 sur données fictives. Les validations externes restent nécessaires au critère de clôture.

  Tranche locale en lecture seule du 2026-10-25 : la supervision `SUPER_ADMIN` sépare désormais les factures de livraison du montant SaaS HT brut journalisé, distingue abonnement et dépassements, compte les activations commerciales du mois UTC et expose commandes, inclus, dépassements, livreurs et options/sièges par entreprise et par formule, Business compris. Trois `findMany` lisent seulement le journal et les compteurs existants ; pilotes exclus, événements fictifs dédupliqués et aucune persistance ajoutée. Définitions et garde-fous : `docs/operations/saas02/README.md`. Vérifié : `npm run test:saas02` 4/4 et `npm run check` 384/384. SAAS-02 reste ouverte : pas de réconciliation fournisseur/Stripe, date d'encaissement ou ventilation HT des remboursements ; rétention, conversion, coûts, marges et alertes ne sont pas déduits sans historique ni règle validés.

  Alertes de consommation du 2026-10-27, décision C10 : `GET /api/admin/saas-health` renvoie `alerts`, calculées à la lecture sur toutes les souscriptions commerciales, pilotes exclus. Seuils : 80, 100 et 120 % des commandes incluses du mois ; pour Business, deux fois les commandes incluses ou 40 livreurs actifs ou invités. Chaque entreprise a au plus une alerte par nature (le plus haut seuil franchi), triées par gravité, et une période sans mesure ne déclenche aucune fausse alerte. La page « Souscriptions » d'ADMIN-1 affichait déjà les 80/100/120 % par entreprise. Vérifié : `npm run test:saas02` 5/5, `npm run test:admin01` 88/88, `npm run check` 525/525. Limite : la page de santé ne les affiche pas encore, car l'affichage demande une recette navigateur super-administrateur. SAAS-02 reste ouverte pour la réconciliation Stripe, la rétention, la conversion et les coûts.

  Affichage du 2026-10-27 : la page `/admin`, section « Santé SaaS », présente un encart « Alertes de consommation » (entreprise, formule, libellé du seuil, mesure / seuil), avec un état vide explicite et aucune action ; il rappelle que rien n'est bloqué ni facturé. Vérifié : `tests/saas02-health.test.ts` (chaque nature d'alerte a son libellé), `npm run check` et build CI. Recette Chrome avec un super-administrateur temporaire de l'Auth de préproduction (supprimé, 0 trace vérifiée) sur PostgreSQL local jetable : Starter à 1 250 / 1 200 (120 %) affiché avant Pro à 2 500 / 2 400 (80 %).

  Rapprochement fournisseur du 2026-10-27 : `npm run saas02:reconcile -- AAAA-MM <sortie>` compare, facture par facture, le journal local aux factures relues chez Stripe, uniquement en lecture (Prisma, GET Stripe). Il signale cinq types d'écart : facture absente d'un côté ou de l'autre, statut, montants, remboursement. Il calcule l'encaissé HT du mois à la date d'encaissement Stripe (`paid_at`, désormais conservée dans les factures), à côté de l'indicateur local à l'échéance. Les remboursements sont ventilés en HT de façon proportionnelle et provisoire. Fonction pure `reconcileRevenue` (`src/domains/billing/revenue-reconciliation.ts`), définitions dans `docs/operations/saas02/README.md`. Vérifié : `npm run test:saas02` 10/10, `npm run check` 706/706. Essai réel sur le compte Stripe de test et `tutelliv-dev` : 5 comptes, 8 factures, 764,78 € HT des deux côtés, 10 € TTC remboursés, aucun écart. Restent pour SAAS-02 : la date comptable des remboursements, la rétention, la conversion, les coûts et marges, et les alertes de coût.

  Remboursements dans la santé SaaS du 2026-10-27 : `GET /api/admin/saas-health` ajoute `refundedHtCents` (remboursements des factures du mois, ventilés en HT au prorata, à titre provisoire) et `netPaidHtCents` ; le brut reste inchangé. La page `/admin` affiche le remboursé et le net. Les définitions renvoient au rapprochement `npm run saas02:reconcile`. Vérifié : `npm run test:saas02` 11/11, `npm run check` 710/710. Lecture réelle sur `tutelliv-dev` : 764,78 € HT bruts, 8,33 € HT remboursés, 756,45 € HT nets, identiques au rapprochement. Non vérifié : l'affichage dans un navigateur, faute de compte super-administrateur sur `tutelliv-dev` ; la seule commande prévue pour en créer un vise la préproduction.

  Recette navigateur `/admin` du 2026-10-27 : `tests/e2e/saas02-admin.spec.ts`, avec le super-admin temporaire de `npm run e2e:role-accounts` sur `tutelliv-dev`. Un dispatcher reçoit 403 sur `GET /api/admin/saas-health` ; le super-admin voit « Santé SaaS · lecture seule », le montant abonnement HT du serveur et, lorsqu'un remboursement existe, « − … remboursés, net … » aux montants de l'API ; la section ne contient ni bouton ni champ. 1/1 sur serveur local. Compte supprimé après l'essai. Restent : date comptable des remboursements, rétention, conversion, coûts, marges et alertes de coût.

- [ ] **PERF-02 — Qualifier la charge et la capacité multi-entreprises.** Compléter PERF-01 par des essais reproductibles de montée en charge sur préproduction : connexions, tableaux de bord, création/affectation, positions GPS, Realtime, preuves, exports, jobs et webhooks SaaS. Mesurer débit, p50/p95, erreurs, saturation du pool et récupération, sans générer de coût non autorisé.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  **Complexité : élevée — charge réaliste, protection de la cible et interprétation des limites Free.**

  Terminé quand : profils Starter 5/1 000, Pro 10/3 000 et Business 25/6 000 représentés par données fictives ; scénarios 1, 10, 50 et 100 entreprises simulés sans écrire en production ; budgets et point de saturation consignés ; dégradation et reprise observées ; aucune fuite interentreprises ; décision de capacité avant pilotes réels. Un modèle analytique peut remplacer une charge distante coûteuse tant que sa limite est explicite.

  Source / dépendance / blocage : PERF-01 a qualifié la navigation unitaire mais pas le p95 sous charge. Toute exécution susceptible de dépasser les offres gratuites exige une autorisation préalable ; commencer par harnais local, données synthétiques et plafond conservateur.

  Avancement local du 2026-10-24 : harnais `npm run test:perf02` ajouté, limité au loopback et aux données en mémoire (zéro réseau/base/migration/seed). Les 12 scénarios Starter 5/1 000, Pro 10/3 000 et Business 25/6 000 × 1/10/50/100 entreprises sont produits dans un JSON ; les p50/p95, débit, erreurs, pool, isolation A/B, saturation (5 admises/7 refusées) et reprise locale sont mesurés. La matérialisation est plafonnée à 12 commandes/entreprise et le reliquat est séparé comme extrapolation analytique. Plafond prudent local : 4 opérations concurrentes, **sans valeur d'hébergement**. Vérifié : `npm run test:perf02`, tests ciblés 3/3 et `npm run check` 361/361. Procédure `docs/operations/perf02/README.md`, rapport `docs/rapports/2026-10-24/perf-02-local.md`. La case reste ouverte : PostgreSQL/Prisma, Next, fichiers, Realtime fournisseur et charge préproduction/pilote ne sont pas encore qualifiés.

  PostgreSQL local du 2026-10-27 : `npm run test:perf02:postgres` démarre un PostgreSQL 15 jetable, y pousse le schéma, puis le supprime. La mesure refuse toute autre base et ne fait aucun appel réseau. Elle exerce le vrai code avec le pool de 5 connexions sur 10 entreprises fictives (auto-dispatch, 5 livreurs chacune) : 48 créations de commande et 96 lectures (tableau, carte dispatch) par niveau. Résultats, sans erreur ni fuite interentreprises : création p50/p95 de 6,9/13 ms à concurrence 1 et de 59/92 ms à concurrence 16. Le débit plafonne vers 300 créations/s à 8 ; au-delà, les opérations attendent une connexion libre du pool. Lectures p95 ≤ 17 ms. Une création enchaîne une dizaine d'allers-retours, donc son coût réel dépend surtout de la latence réseau vers la base : environ 5,5 s depuis le poste local, environ 1 s si les fonctions Vercel tournaient hors de Paris (hypothèse ENV-2). Vérifié : garde testée, `npm run check`. Procédure `docs/operations/perf02/README.md`. La case reste ouverte : Next, fichiers, Realtime, préproduction et région d'hébergement ne sont pas qualifiés.

  Serveur Next local du 2026-10-27, décision C10 complémentaire. `npm run test:perf02:next` construit l'application en production et la sert sur `127.0.0.1`, contre le PostgreSQL jetable doté du catalogue actif, avec un environnement fixé qui n'hérite d'aucun secret. Il mesure 6 pages publiques, `GET /api/signup` et `POST /api/contact`. Résultats, sans erreur : les pages publiques sont prérendues, p95 ≤ 4,5 ms à 1 requête et ≤ 43 ms à 16 ; `/tarifs` fige donc le catalogue au build. L'API d'inscription tient un p95 de 5 ms à 1 et de 23 ms à 16. Défaut trouvé puis corrigé : une rafale de 60 envois Contact simultanés en avait accepté 56 pour une limite de 50 (comptage puis écriture non atomiques) ; après correction (GROWTH-1), exactement 50. Vérifié : `tests/perf02-next.test.ts` 4/4, typecheck, mesure complète, serveur et base supprimés. Procédure et tableau : `docs/operations/perf02/README.md`. La case reste ouverte : routes connectées (ENV-2), fichiers, Realtime, préproduction et région.

  Routes connectées, préparé le 2026-10-28 : `npm run test:perf02:connected` construit l'application en production, la sert sur `127.0.0.1:55452` contre `tutelliv-dev` (garde ENV-2) et mesure en lecture seule 7 API et 2 pages connectées, de 1 à 16 requêtes simultanées et 24 par niveau, puis contrôle l'isolement entre la session démo et un dispatcher d'une autre entreprise (comptes de `npm run e2e:role-accounts`). Le build passe ; la mesure a été interrompue à la demande du propriétaire avant ses résultats. À lancer sous Node 22, sans serveur de développement en parallèle, avec les comptes de rôle créés puis supprimés.

- [ ] **COST-1 — Simuler les coûts d'exploitation et la marge contributive.** Établir un modèle par Starter 5 livreurs/1 000 commandes, Pro 10/3 000 et Business 25/6 000, puis pour 1, 10, 50 et 100 entreprises. Séparer coûts fixes, variables et paliers de forfait pour Supabase/PostgreSQL/Realtime/Storage, positions GPS, cartographie/itinéraires, e-mails, preuves, Vercel, paiement et support. Comparer aux prix 79/179/349 € HT et aux commissions de 15/25/35 % sur les montants initiaux éligibles encaissés.

  **Modèle conseillé : phase documentaire GPT‑6.1 Sol · effort moyen ; validation mesurée GPT‑6 Astra · effort élevé.**

  **Complexité : élevée — hypothèses de volume, tarifs externes changeants et scénarios de montée en gamme.**

  Terminé quand : hypothèses et sources datées ; volumes par livraison explicités ; frais de paiement et support distingués ; commissions 15/25/35 % simulées séparément ; coût mensuel total, marge contributive et coût marginal approximatif par client pour chaque scénario ; seuils de changement de plan et sensibilité haute/basse ; risque des livreurs Business illimités isolé ; comparaison aux prix HT sans confondre marge contributive, marge brute et résultat ; chiffres exportables vers le prévisionnel. Aucun test facturable lancé sans accord.

  Source / dépendance / blocage : phase 1 immédiate avec inventaire ENV-1, limites MAP-2, factures publiques datées et hypothèses explicites ; elle produit des fourchettes, pas une vérité mesurée. Phase 2 après PERF-02 et premiers pilotes pour remplacer les hypothèses de charge et support. Aucun test distant payant n'est requis pour la phase 1.

  - [x] **Phase 1 — estimation documentaire.** Terminée le 2026-10-23 : modèle reproductible de 36 scénarios, variantes basse/centrale/haute, coûts fixes/variables, trois commissions, frais Stripe, support et coût marginal exportés. L'audit constate zéro Realtime actuel, GPS jusqu'à 4 s, polling dispatch 20 s, route 30 s et preuve 5 Mio. Le scénario central à dix entreprises avec commission 35 % estime une contribution de 99,62 € Starter, 94,44 € Pro et 664,17 € Business. Le risque dominant est cartographie/navigation + GPS/compute + support ; « Business illimité » reste économiquement non borné sans mesure et règle d'usage. Rapport `docs/rapports/2026-10-23/cost1-documentaire.md`, méthode `docs/operations/cost1/README.md`, calcul `scripts/cost1/model.mjs`, exports `outputs/cost1/`.
  - [ ] **Phase 2 — validation mesurée.** Remplacer temps CPU, paliers Supabase, cadence réelle de navigation, taille/taux de preuves, e-mails et support par `PERF-02` et les trois pilotes ; obtenir un devis cartographique au-delà des paliers publics. Aucun essai facturable sans accord.

    Avancement local du 2026-10-24 : intégrateur `npm run cost1:perf02` ajouté après régénération du modèle ; il apparie strictement les 12 sorties PERF-02 aux profils/volumes et aux trois variantes documentaires, en reprenant seulement latences, débit, erreurs, matérialisation, extrapolation signalée, isolation, saturation/reprise et plafond local. Fichier absent, schéma/volume ou scénarios incompatibles échouent explicitement. **Aucun coût, marge, commission, CPU Vercel, palier Supabase, preuve, e-mail, navigation/cartographie ou support n'est remplacé.** Vérifié : `npm run cost1:model`, `npm run cost1:perf02`, tests ciblés 2/2 et `npm run check` 363/363. Procédure `docs/operations/cost1/README.md`, rapport `docs/rapports/2026-10-24/cost1-validation-locale.md`. Phase 2 et COST-1 restent ouverts pour les mesures PostgreSQL/Next, hébergement, preuves, e-mails, cartographie et trois pilotes.

- [ ] **GROWTH-1 — Construire le site commercial relié au parcours autonome.** Faire évoluer la page publique existante vers Accueil, Fonctionnalités par rôle, Tarifs/options, Démonstration, Inscription, Connexion, Contact et Informations légales. Relier chaque offre à SIGNUP-1 ; présenter uniquement les fonctions réellement disponibles, limites, dépassements et traitement des données. Aucun témoignage ou gain inventé.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : un prospect comprend pour qui est le produit, le problème résolu, les trois espaces, le prix HT/TTC indicatif, options et dépassements, la différence démo/pilote/découverte premium et la prochaine étape ; navigation responsive et accessible ; contenu cohérent avec le catalogue actif ; formulaires protégés contre abus ; pages légales publiées seulement après validation.

  Source / dépendance / blocage : la page d'accueil existe, mais pas l'ensemble du site commercial demandé. L'arborescence, les contenus factuels et les composants partagés peuvent être préparés maintenant ; prix dynamiques et appels à l'action s'intègrent après SAAS-01A/SIGNUP-1, puis les preuves commerciales après PILOT-2/OFFER-1. Publication sur instruction.

  Statut de planification : différé, conservé ; ne bloque pas le développement de la V1 sur données fictives. Les validations externes restent nécessaires au critère de clôture.

  Tranche locale du 2026-10-25 : page publique `/tarifs` lue sur le catalogue d'inscription actif. Elle affiche Starter, Pro et Business en HT mensuel et annuel, TTC indicatif, quotas, plafonds et options encore achetables. Business reste plafonné par le catalogue. Le pilote gratuit, la découverte premium et la souscription commerciale sont distingués. Chaque formule ouvre `/register` sans paiement fournisseur. GROWTH-1 reste ouvert : pas de refonte, pas de pages légales, pas de publication.

  Tranche locale du 2026-10-25, suite : page publique `/fonctionnalites`. Trois sections, client, administration/dispatch et livreur. Chaque phrase renvoie à un écran déjà livré : commande, affectation, statut daté, position absente ou périmée, échanges, incident, photo de remise, historique. GROWTH-1 reste ouvert.

  Tranche locale du 2026-10-25, démonstration : page publique `/demonstration`. Elle distingue la démo du pilote, de la découverte premium et de la souscription. Le bouton reprend la connexion démo existante seulement si le compte démo est déjà en base. Aucune session n'est créée par cette page. GROWTH-1 reste ouvert.

  Porte locale du 2026-10-25 : `docs/operations/growth01/ACCEPTANCE.md`. Les parcours anonymes Accueil, Fonctionnalités, Tarifs, Démonstration, Inscription et Connexion se rejoignent. Le contact public, les pages légales validées et le domaine restent dehors. GROWTH-1 reste ouvert.
  Contact du 2026-10-27, décision C10. Page `/contact` et `POST /api/contact` avec validation stricte, pot de miel, limites par source et globales en base, et une IP jamais stockée (empreinte HMAC seulement). Les messages vont dans une nouvelle table `contact_messages` (RLS, aucun droit public), lue par `GET /api/admin/contact-messages`, réservé au super-administrateur et journalisé. La migration a été validée sur un PostgreSQL local jetable (zéro écart, RLS, aucun droit public) et n'est **appliquée nulle part**. Vérifié : `tests/growth01-contact.test.ts` 6/6, `npm run test:admin01` 88/88, `npm run check` 532/532, build CI sans secret, recette Chrome locale complète (`docs/operations/growth01/ACCEPTANCE.md`). Restent : l'écran de lecture dans le back-office, l'application de la migration après fusion, la durée de conservation (LEGAL-1), les pages légales et le domaine.

  Boîte de lecture du 2026-10-27 : page `/admin/contact` (lien « Messages Contact »), en lecture seule et paginée 25/50/100, les plus récents d'abord. Elle montre nom, entreprise, e-mail (lien `mailto:`), téléphone, date à l'heure de Paris et message (sauts de ligne conservés), jamais l'empreinte de source. Vérifié : `tests/growth01-contact.test.ts` 7/7, `npm run check` et build CI. Recette Chrome avec le même compte temporaire, sur PostgreSQL local : ordre correct, HTML et `<script>` affichés comme texte sans exécution, empreinte absente de la page, téléphone sans débordement. Il reste, après fusion, l'application de la migration en préproduction.

  Débit Contact durci le 2026-10-27 : la source de la limite par heure est désormais la **dernière** adresse de `x-forwarded-for`, puis `x-real-ip`. Avant, la première adresse était lue. Vercel écrase cet en-tête et la préproduction n'était donc pas contournable, mais derrière un proxy qui ajoute sa propre adresse, la première vient du client : en la faisant varier, un robot pouvait ignorer la limite de 3 par source et épuiser à lui seul la limite globale de 50 par heure, ce qui fermait le formulaire à tout le monde pendant une heure. Limite connue : avec plusieurs proxys qui ajoutent chacun une adresse, tous les visiteurs partageraient la même source, ce qui bloque trop au lieu de laisser passer. Vérifié : `tests/growth01-contact.test.ts` 8/8 (adresse forgée refusée au 4ᵉ envoi), typecheck.

  Limite Contact atomique du 2026-10-27 : la mesure PERF-02 du serveur Next a montré 56 envois acceptés sur une rafale de 60 simultanés, pour une limite globale de 50. Des envois concurrents lisaient le même compte avant d'écrire, ce qui permettait aussi de dépasser les 3 envois par source. Le comptage et l'écriture se font désormais dans une transaction, sous un verrou consultatif PostgreSQL de transaction (`pg_advisory_xact_lock`), compatible avec le pooler de Supabase en mode transaction. Aucun schéma n'est modifié. Vérifié : `tests/growth01-contact.test.ts` 9/9 (8 envois simultanés d'une source : 3 acceptés ; à deux places de la limite globale : 2 acceptés). Mesure rejouée sur PostgreSQL réel : 50 acceptés, 10 refusés, 50 écrits.

- [ ] **DEMO-3 — Rendre réel ce que la mini-démo du site montre.** Revue du 28 octobre 2026 (code de `preproduction` comparé aux 7 étapes de `src/features/landing/product-tour/`) : 3 points disponibles, 8 partiels, 1 absent. Le propriétaire a choisi de montrer ces fonctions comme disponibles (spec `docs/superpowers/specs/2026-10-27-landing-product-tour-design.md`) ; cette tâche comble l'écart, par tranches livrées et testées une à une, dans cet ordre :
  1. **Paiements côté entreprise (absent)** : liste des factures payées / en attente / en retard, passage automatique en retard avec le nombre de jours, bouton « Relancer » qui envoie un e-mail au client et trace la relance. Aujourd'hui l'onglet Facturation ne mène qu'aux réglages et le statut `OVERDUE` n'est jamais posé.
  2. **Facture créée à la livraison** : générer la facture au passage en « Livrée » et réutiliser l'e-mail existant (`notify.service.ts`) ; aujourd'hui elle est créée à la main.
  3. **Distance GPS dans le dispatcher** : prendre en compte la position des livreurs et la distance au retrait dans l'auto-dispatch (aujourd'hui : priorité, charge, code postal).
  4. **Arrivée estimée en direct côté client** : livreur qui avance sur la carte du portail et « arrive dans X min » calculé par le service de trajet ; aujourd'hui l'heure affichée est l'heure planifiée.
  5. **Notification « prise en charge »** au client quand le livreur accepte la mission.
  6. **Nom du réceptionnaire** dans la preuve de livraison, en base et dans le portail.
  7. **Créneau horaire à la commande** (champ en base, choix dans le formulaire, « Prochain créneau » côté client) ; poids du colis si retenu.
  8. **Tableau de bord client** : « Montant à régler », « Dernière facture », activité récente, carte.
  9. **Tableau de bord entreprise** : retards affichés en permanence et graphique sur 7 jours.
  10. **Regroupement en tournées** des commandes voisines, puis **push « Nouvelle mission »** au livreur.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : chaque tranche a ses tests métier, `npm run check` vert et un clic réel en navigateur ; chaque phrase de la démo correspond à un comportement vérifiable du produit, ou la démo est ajustée avec l'accord du propriétaire.

  Source / dépendance / blocage : revue du 28 octobre 2026 ; e-mails réels de la tranche 1 liés à EMAIL ; tranches 6 et 7 avec changement de schéma (migration à évaluer avant exécution) ; tranche 10 (tournées, push) à confirmer par le propriétaire avant de démarrer.

  Statut de planification : ouverte. Tranches 1, 2, 3, 5 et 6 livrées le 28 octobre 2026 sur `integration/2026-10-28` (non poussée) ; tranches 4, 7, 8, 9 et 10 non commencées.

  État au 29 octobre 2026 (rapports `docs/rapports/agents/2026-10-28-{facturation,dispatch-gps,preuve-livraison}.md` et `2026-10-29-correctifs-codex.md`) :

  - **Tranche 1 — Paiements : livrée, recettée sur tutelliv-dev.** Onglet « Paiements » (compteurs payées / en attente / en retard, filtres, « En retard · N j »), passage automatique en `OVERDUE` par le filet cron (SQL conditionnel, idempotent, sans toucher `updated_at`), affichage du retard calculé à la lecture, facture en retard toujours payable, « Relancer » tracé (table `invoice_reminders` : auteur, date, canal, résultat), anti-doublon de 24 h, e-mail par tâche durable seulement si l'envoi est configuré, sinon trace `NOT_SENT_EMAIL_NOT_CONFIGURED`. Après l'audit Codex : C1 (réservation d'envoi par facture sous verrou consultatif, états `SENDING`/`SENT`, reprise d'une réservation orpheline après 5 minutes avec la même clé fournisseur) et C4 (issue d'envoi inconnue : la relance reste `SENDING`, aucune seconde relance ; seul un refus HTTP certain rend la réservation). Recette navigateur : onglet par défaut, compteurs, filtres, état vide, « En retard · 5 j », double clic sur « Relancer » = une relance, double clic sur « Enregistrer le règlement » = `PAID` ; recette ciblée de 557e9d5 : deux POST simultanés puis un troisième = une seule relance en base, ligne « Relance non envoyée : e-mail non configuré ».
  - **Tranche 2 — Facture à la livraison : livrée, recettée sur tutelliv-dev.** Réglage par entreprise `autoInvoiceOnDelivery`, désactivé par défaut ; tâche durable `DELIVERY_INVOICE` inscrite dans la transaction de chacun des trois passages en « Livrée » (clé propre à chaque passage) ; une seule facture active par commande, contrôlée sous verrou ; facture annulée non bloquante ; erreur permanente `DELIVERY_INVOICE_EMPTY` visible sur la tâche ; e-mail « Nouvelle facture » réutilisé. Recette navigateur : interrupteur ON, commande passée deux fois en « Livrée » = une facture ; OFF = aucune ; Dispatcher, client et livreur refusés (403) sur `/api/invoices`. Parcours croisé sur une même livraison : prise en charge, signature et photo, livrée, facture automatique (98,40), Factur-X 200 aux totaux cohérents.
  - **Tranche 3 — Distance GPS au dispatch : livrée, recette partielle.** La distance haversine locale entre la dernière position récente du livreur en service et le point de retrait ne sert que de départage final, après priorité réglée, zone et charge ; sans position exploitable le livreur est neutre, jamais exclu ; seuils réglables dans Règles dispatch (activé par défaut, 15 min, 10 km). Aucune coordonnée exposée, aucun chiffre dans l'historique client. Recette navigateur : case et deux champs (« 7,26 » devient 7,3 au blur, champ vidé = valeur précédente, valeur conservée après rechargement), auto-dispatch fonctionnel avec un historique sans chiffre de position. Non démontré : un départage réel par la distance avec des positions de livreurs réelles.
  - **Tranche 5 — Notification « prise en charge » : livrée, recettée sur tutelliv-dev.** Déclenchée à l'acceptation de la mission (pas au départ), tâche durable créée dans la transaction, texte d'affectation devenu « Un chauffeur a été assigné ». Recette navigateur : « Prendre en charge » avec double clic = deux POST 200 mais une seule tâche et une seule notification, après passage du cron.
  - **Tranche 6 — Nom du réceptionnaire : livrée par la preuve de livraison (POD-2), recettée sur tutelliv-dev.** Nom saisi dans la boîte de preuve (avec signature à l'écran), stocké en base (migration `20261028120000_pod_signature`) et affiché dans le portail (« Reçu par … »), signature et PDF de preuve compris. À trancher : le nom est facultatif aujourd'hui, la validation s'active sans lui (RECETTE-2810).

  Preuves : `npm run check` 1145/1145 sur 557e9d5 (types, lint et tests locaux) ; `npm run build` à 146 pages ; migrations appliquées sur tutelliv-dev uniquement (`20261028230000_invoice_reminders`, `20261028120000_pod_signature`) ; recette navigateur de l'intégration `outputs/recette-agents/integration/rapport.md` (aucun défaut bloquant ni important) et recette ciblée `outputs/recette-agents/integration-correctifs/rapport.md` ; audit Codex `outputs/verification-2026-10-28/rapport.md` : le complément 2 (013d1fc) refusait l'intégration pour C3 et C4 ; le complément 3 (557e9d5) les juge corrigés (78/78 tests ciblés) et rend un verdict favorable côté code pour la préproduction, avec réserves : check intégral indépendant, PostgreSQL réel, fournisseur réel et portes du propriétaire non vérifiés. Une recette sur tutelliv-dev ne vaut ni validation terrain ni validation pilote ; case laissée ouverte.

  Reste : tranches 4, 7, 8, 9 et 10 ; e-mails réels des tranches 1, 2 et 5 (EMAIL) ; affichage de `proximity` dans l'interface du dispatcher (l'API `eligible-drivers` l'expose, aucun écran ne l'affiche) ; promesse « trajets » de la démo (tranches 4 et 10) ; essai du départage par la distance avec des positions réelles (MOB-01C) ; pagination de la liste Paiements au-delà de 100 factures ; spécifications E2E `demo3-payments` à corriger (RECETTE-2810) ; migrations de préproduction sur accord (PROPRIO-2810). Tranche 7 et tranche 10 : conditions de départ inchangées (migration à évaluer, accord du propriétaire).

- [ ] **INTAKE-1 — Commande par message IA (coller un message).** Depuis le back-office (Commandes et Dispatch, « Depuis un message »), coller un message de client, obtenir un brouillon de commande structuré, le relire et le valider avant création pour le compte d'un client actif choisi (`source = ADMIN`). Aucune commande n'est créée sans validation humaine ; fonction désactivée sans clé et tant que l'entreprise ne l'active pas.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : essai réel sur vingt messages anonymisés avec mesure de la qualité d'extraction et du coût ; clé serveur fournie et fonction activée par une entreprise de recette ; fiche F10 qualifiée avant toute donnée réelle ; parcours navigateur « coller, relire, créer » rejoué avec la spécification corrigée ; décision prise sur l'entrée dans le portail client.

  Source / dépendance / blocage : branche `agent/commande-ia` intégrée ; rapport `docs/rapports/agents/2026-10-28-commande-ia.md` et `docs/operations/order-intake/README.md`. Décision C11 du 28 octobre 2026 (création côté back-office acceptée pour le compte d'un client choisi, depuis ce seul flux et après validation du dispatcher) consignée dans `docs/DECISIONS_PRODUIT_COMMERCIALES.md` et `PRODUCT.md`. Migration `20261028100000_order_intake_usage` (RLS + REVOKE), appliquée sur tutelliv-dev uniquement. Clé `ANTHROPIC_API_KEY` et qualification F10 : propriétaire (PROPRIO-2810).

  État : implémenté et partiellement recetté sur tutelliv-dev le 28 octobre 2026. Domaine pur `src/domains/order-intake/` (schéma Zod strict, échéance Europe/Paris, prompt avec expéditeur et message dans des cadres échappés, fournisseur Anthropic `claude-haiku-5-5`, quota par entreprise sans stockage du texte, 429 avec `Retry-After`), routes `/api/orders/intake/{route,analyze,orders}`, pages `/dashboard/orders/intake` et `/dispatch/intake`. Rapprochement du client limité aux clients actifs, rapprochement par téléphone en SQL déterministe, clé réutilisée pour un autre client en 409, refus d'abonnement en 403 explicite, activation atomique de la seule clé `orderIntake` (`jsonb_set`). Coût estimé par analyse : 0,0004 à 0,0006 $ (pire cas environ 0,0024 $), non mesuré. Correctif I1 de l'audit Codex : anti-doublon interclients atomique (verrou consultatif entreprise + clé, relecture du gagnant dans les deux transactions de `createClientOrder`, géocodage hors transaction) ; ferme la « course restante » du rapport. 42 tests dédiés ; `npm run check` 777/777 sur la branche puis 1145/1145 sur l'intégration (557e9d5) ; `security-review` : aucune vulnérabilité de confiance supérieure ou égale à 8. Recette navigateur : sans clé, « Fonction non configurée », zone de texte désactivée, aucune erreur ; bouton « Depuis un message » à 44 px dans le dispatch ; SQL réel de l'activation exercé sur l'entreprise E2E (seule la clé `orderIntake` change, `billing`, `einvoicing` et `legalBilling` intacts). Audit Codex : « non conforme » avant I1, I1 corrigé et confirmé aux compléments 2 et 3 (4 tests atomiques verts), sous réserve du verrou PostgreSQL réel. Case laissée ouverte : aucun appel réel au modèle.

  Reste : clé serveur et activation ; essai réel sur vingt messages anonymisés, mesure de l'extraction et du coût ; qualification F10 (contrat, rétention, transferts) ; requêtes SQL `regexp_replace`, verrou de quota et rapprochement téléphonique jamais exécutés sur PostgreSQL réel ; spécification `order-intake.spec.ts:73` à corriger (RECETTE-2810) ; pas d'entrée « Depuis un message » dans le portail client (la grille de vérification la mentionnait, la décision C11 borne le flux au back-office : à trancher, RECETTE-2810) ; hors tranche : adresse e-mail de transfert et WhatsApp Business.

- [x] **ADMIN-1 — Étendre la supervision interne du SaaS.** Compléter l'espace SUPER_ADMIN existant pour consulter entreprises, état de souscription/pilote, droits/options, consommation, paiements réconciliés, alertes techniques, tickets et incidents. Prévoir recherche, filtres et accès au détail strictement audité, sans devenir un CRM.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  **Complexité : élevée — agrégations transversales, données financières et privilèges plateforme.**

  Terminé quand : seules les personnes plateforme explicitement autorisées accèdent aux vues ; accès sensibles journalisés ; aucune impersonation ni mutation de données client implicite ; métriques d'abonnement séparées des factures de livraison ; pagination côté serveur ; panne d'un fournisseur visible sans secret ; isolation et minimisation des données vérifiées.

  Source / dépendance / blocage : l'espace actuel liste entreprises/utilisateurs/livraisons et agrège les factures de prestations, mais ne connaît ni abonnements, options, paiements SaaS, pilotes, quotas ni incidents consolidés. Dépend de SAAS-01A/B, SAAS-02, OPS-03B et SUPPORT-1.

  Liste locale du 2026-10-25 : page `SUPER_ADMIN` `/admin/subscriptions`, recherche sur le nom, filtres formule/statut et pagination serveur 25/50/100. Lecture Prisma `count` + `findMany`, uniquement `COMMERCIAL`, éléments et formule effectifs à l'instant de lecture, compteurs de la période courante, options et sièges séparés. Business affiche les compteurs enregistrés, sans plafond calculé. Aucun snapshot, identifiant fournisseur, e-mail ou paiement brut. Une page non finie ou un skip non sûr est refusé. ADMIN-1 reste ouverte : pas de mutation, journal d'accès, alerte de coût, rapprochement Stripe, ni détail audité.

  File support du 2026-10-25 : page `SUPER_ADMIN` `/admin/support`, recherche sur le nom d'entreprise, filtres statut/priorité et pagination serveur 25/50/100. Lecture `count` + `findMany`. Le DTO ne contient que l'identifiant interne, l'entreprise, le statut, la priorité, le type admin/livreur, les références métier de commande et de livraison, et les dates. Sujet, messages, client, coordonnées et identifiants internes de commande ou de livraison exclus. Aucune réponse, changement de statut ni journal d'accès.

  File technique du 2026-10-25 : page `SUPER_ADMIN` `/admin/operations`. Recherche sur le nom d'entreprise, filtres statut/type et pagination 25/50/100. Lecture `count` + `findMany`. Un job `PROCESSING` verrouillé depuis au moins dix minutes est marqué bloqué, comme `getServiceHealth`. Une entreprise absente s'affiche « Plateforme ». `payload`, `jobKey` et `lastError` exclus. Aucune relance.

  Incidents du 2026-10-25 : page `SUPER_ADMIN` `/admin/incidents`. Recherche sur le nom d'entreprise, filtre de visibilité et pagination 25/50/100. Sources `kind === "INCIDENT"` dont la clé ne commence pas par `alert1:`. Lecture `count` + `findMany`, puis lecture des clés d'action limitées à `orderId` et `requestKey`. État dérivé : résolu, sinon commande clôturée par `isOperationalOrderClosed`, sinon pris en compte, sinon ouvert. Le DTO ne contient que l'identifiant, l'entreprise, la référence métier, la visibilité, l'état et la date. Contenu, auteur et clés internes exclus. Aucune action.

  Santé du 2026-10-25 : panneau en tête de `/admin/operations`, lecture de `getServiceHealth` sans nouveau contrôle. Le DTO ne contient que le statut global, la date, et pour la base, le stockage et la file : statut, durée ou compteurs échoués et bloqués. Configuration, secret, URL et erreur brute exclus. L'échec du panneau ne masque pas la file, et l'inverse. Une exception imprévue répond « Santé des services indisponible. ».

  Alerte commandes du 2026-10-25 : la liste `/admin/subscriptions` expose `usageAlertPercent` 80, 100, 120 ou null, calculé sur les compteurs déjà agrégés. Si le volume inclus est positif, le seuil vient de `orderUsageAlertPercent`. S'il est nul, l'alerte est null. L'écran affiche « Sous 80 % », « 80 % », « 100 % », « 120 % ou plus », ou « — ». 120 % ne bloque rien et n'ajoute aucun plafond.

  Entreprises du 2026-10-25 : `/companies` lit `GET /api/admin/companies` au lieu du tableau de bord. Recherche sur le nom, filtre de statut Prisma et pagination 25/50/100. Lecture `count` + `findMany`. Le DTO ne contient que l'identifiant, le nom, le statut, la date de création et les nombres d'utilisateurs et de livraisons. Contact, adresse, données légales, réglages et abonnement exclus. `/admin` reste sur la vue d'ensemble. Aucun détail ni mutation.

  Comptes du 2026-10-25 : un `SUPER_ADMIN` consulte `/users` sans création, modification ni suppression. `POST`, `PATCH` et `DELETE` répondent 403 avant le corps et avant l'appel métier. Les trois fonctions métier refusent ce rôle avant Prisma et avant le fournisseur. Sans `companyId`, la création répond `COMPANY_REQUIRED` : plus de première entreprise active choisie toute seule. `GET /api/users` et les parcours des rôles entreprise restent.

  Paramètres du 2026-10-25 : la navigation plateforme n'a plus « Facturation » ni « Paramètres ». `SUPER_ADMIN` est retiré des accès à `/settings`. Les API `/api/company/settings` et `/api/company/billing-settings` répondent 403 avant la recherche d'entreprise, le corps et l'appel métier. Les navigations et accès de `COMPANY_ADMIN` et `MINI_ADMIN` restent.

  Comptes plateforme du 2026-10-25 : « Utilisateurs » pointe vers `/admin/users`. Recherche sur prénom, nom ou entreprise, filtres rôle et statut, pagination 25/50/100. Lecture `count` + `findMany`. Le DTO ne contient que l'identifiant, le nom affiché, le rôle, le statut, l'entreprise éventuelle et la date de création. `GET /api/users` refuse `SUPER_ADMIN` avant lecture. `listAllUsers` est retiré. `/users` reste aux rôles entreprise. Aucune action.

  Routes d'interface du 2026-10-25 : les trois matrices envoient `SUPER_ADMIN` vers `/admin` et `/companies` seulement. Tableau de bord, dispatch, support, paramètres, comptes, onboarding, chauffeur et portail client restent aux rôles qui les avaient déjà. Cette tranche ferme les routes d'interface, pas l'ensemble des API.

  API tableau de bord du 2026-10-25 : `GET /api/back-office/dashboard`, `GET /api/back-office/analytics` et `GET`/`PATCH`/`DELETE /api/back-office/dashboard-layout` exigent `COMPANY_ADMIN` ou `MINI_ADMIN` via `requireRole`, juste après `requireStaffRole`. `SUPER_ADMIN` reçoit 403 avant l'entreprise, le corps et l'appel métier. Seule cette grappe est couverte.

  Lectures dispatch du 2026-10-25 : les six GET overview, charge, positions, carte chauffeurs, carte livraisons et chauffeurs éligibles exigent `COMPANY_ADMIN`, `MINI_ADMIN` ou `DISPATCHER` juste après `requireStaffRole`. `SUPER_ADMIN` reçoit 403 avant l'entreprise, les paramètres, le contrôle SaaS et l'appel métier. Seules ces lectures sont couvertes.

  Affectation du 2026-10-25 : `POST /api/dispatch/auto-assign` applique le même `requireRole` juste après `deliveries:dispatch`. `SUPER_ADMIN` reçoit 403 avant l'entreprise, le droit SaaS et la file. L'ordre autorisé reste authentification, rôle, entreprise, droit, traitement. Les réponses « offre non incluse » et « lecture seule » sont inchangées.

  Règles dispatch du 2026-10-25 : `GET` et `PATCH /api/company/dispatch` exigent `COMPANY_ADMIN` ou `MINI_ADMIN` juste après la permission. `SUPER_ADMIN` et `DISPATCHER` reçoivent 403 avant l'entreprise, le corps et le service. L'onglet « Règles dispatch » n'apparaît que si le rôle est administrateur ou mini-admin et possède à la fois `settings:read` et `settings:update`. La file, les cartes et l'affectation restent.

  Emplacements et tarifs du 2026-10-25 : `GET` et `PATCH` de `/api/company/location-settings` et `/api/company/tariffs` exigent `COMPANY_ADMIN` ou `MINI_ADMIN` juste après la permission. `SUPER_ADMIN` et `DISPATCHER` reçoivent 403 avant l'entreprise, le corps et le service. Seules ces deux paires sont couvertes.

  Lectures commandes du 2026-10-25 : les cinq GET liste, stats, tableau de bord, export et détail exigent `COMPANY_ADMIN`, `MINI_ADMIN` ou `DISPATCHER` juste après `orders:read`. `SUPER_ADMIN` reçoit 403 avant l'entreprise, les filtres, le service, le CSV et l'URL signée.

  Mutations commande du 2026-10-25 : `PATCH` et `DELETE /api/orders/[id]` appliquent le même rôle juste après `orders:update`. `SUPER_ADMIN` reçoit 403 avant l'entreprise, les paramètres, le corps et le service. Le conflit de statut reste. `GET` ne change pas.

  Lectures clients du 2026-10-25 : les deux GET `/api/clients` et `/api/clients/[id]` exigent `COMPANY_ADMIN`, `MINI_ADMIN` ou `DISPATCHER` juste après `orders:read`. `SUPER_ADMIN` reçoit 403 avant l'entreprise, les paramètres et le service. Aucun DTO ni écran ne change. Seules ces deux lectures sont couvertes.

  Lectures chauffeurs du 2026-10-25 : les deux GET `/api/drivers` et `/api/drivers/[id]` exigent les mêmes rôles juste après `drivers:read`. `SUPER_ADMIN` reçoit 403 avant l'entreprise, les paramètres et le service. L'erreur de chargement et le chauffeur introuvable restent. Seules ces deux lectures sont couvertes.

  Lectures livraisons du 2026-10-25 : les deux GET `/api/deliveries` et `/api/deliveries/[id]` exigent les mêmes rôles juste après `deliveries:read`. `SUPER_ADMIN` reçoit 403 avant l'entreprise, l'URL, les paramètres, le service et l'URL signée. `PATCH` du détail ne change pas dans cette lecture.

  Mutations livraisons du 2026-10-25 : `PATCH /api/deliveries/[id]` et `PATCH /api/deliveries/[id]/assign` exigent les mêmes rôles juste après `deliveries:update` et `deliveries:dispatch`. `SUPER_ADMIN` reçoit 403 avant l'entreprise, le corps, la validation, les paramètres et le service. Les conflits de statut et d'affectation restent. `GET` ne change pas. Seules ces deux mutations sont couvertes.

  Jobs d'exploitation entreprise du 2026-10-25 : `GET` et `POST /api/operations/jobs` exigent les mêmes rôles dans `resolveCompany`, juste après `deliveries:dispatch` et avant l'entreprise. `SUPER_ADMIN` reçoit 403 avant la santé et la relance. `/api/admin/operation-jobs` ne change pas. Seule cette route entreprise est couverte.

  Factures de prestation du 2026-10-25 : `GET /api/invoices/export`, `POST` et `PATCH /api/orders/[id]/invoice` exigent `COMPANY_ADMIN` ou `MINI_ADMIN` juste après leur permission. `SUPER_ADMIN` et `DISPATCHER` reçoivent 403 avant l'entreprise, l'URL, le corps, la validation, les paramètres et le service. Le volume d'export reste 422 et le conflit de facture reste 409. `/api/billing` ne change pas. Seuls ces trois accès sont couverts.

  Support entreprise du 2026-10-25 : `requireSupportStaff` exige `COMPANY_ADMIN`, `MINI_ADMIN` ou `DISPATCHER` juste après l'authentification, avant le contrôle mini-admin et l'entreprise. Les quatre méthodes liste, détail, message et statut répondent 403 à `SUPER_ADMIN` avant l'entreprise, les paramètres, le corps et les services. Un `MINI_ADMIN` sans `support:read` reste refusé avant l'entreprise. `/api/admin/support-tickets` ne change pas. Seules les routes support d'entreprise sont couvertes.

  Échanges entreprise du 2026-10-25 : `conversationAuth` exige les cinq rôles opérationnels juste après `requireAuth` et avant de construire l'acteur. Les huit méthodes de suivi, alertes et conversations répondent 403 à `SUPER_ADMIN` avant l'URL, le corps, les paramètres, le service et le job. L'acteur autorisé conserve identifiant, entreprise, rôle, permissions et nom. `/api/admin/incidents` ne change pas. Seule cette frontière partagée est couverte.

  Vue plateforme du 2026-10-25 : les entreprises récentes de `/admin` n'exposent plus `slug`. Le select garde identifiant, nom, statut et les deux compteurs. Tri, limite et factures de livraison ne changent pas.

  Santé SaaS du 2026-10-25 : les indicateurs sortent de `getPlatformOverview`. `GET /api/admin/saas-health` exige `dashboard:admin` avant le service SAAS-02 existant, répond sans cache, et une exception devient 500 avec seulement « Indicateurs SaaS indisponibles. ». Sur `/admin`, les compteurs et la section SaaS chargent séparément. Aucun calcul SAAS-02 ne change.

  Rôle plateforme du 2026-10-25 : les neuf GET sous `/api/admin` exigent `SUPER_ADMIN` juste après `dashboard:admin`. `COMPANY_ADMIN`, `MINI_ADMIN` et `DISPATCHER` reçoivent 403 avant l'URL et le service, même avec la permission simulée.

  Factures de livraison du 2026-10-25 : le compteur de la vue `/admin` s'appelle `paidDeliveryInvoiceRevenue`. Le libellé est « Factures de livraison payées ». L'agrégation des factures payées du mois ne change pas. `totalRevenue` est absent. Le panneau SAAS-02 reste séparé.

  Cache plateforme du 2026-10-25 : les neuf GET sous `/api/admin` portent `Cache-Control: no-store` sur le succès et sur leurs erreurs locales. Les neuf fetchs dédiés utilisent `cache: "no-store"`. Les contrôles et les chargements séparés ne changent pas.

  Inventaire plateforme du 2026-10-25 : un test découvre tous les `route.ts` sous `src/app/api/admin` et exige les neuf GET actuels, chacun avec `dashboard:admin`, le rôle exact `SUPER_ADMIN` et `Cache-Control: no-store`. Une route nouvelle hors de cette liste fait échouer le test. Aucun fichier applicatif ne change.

  Onboarding du 2026-10-25 : il n'existe pas de routes sous `src/app/api/company/onboarding`. La couverture réelle est `GET` et `PATCH /api/onboarding`, déjà réservés à `COMPANY_ADMIN` juste après la permission. `SUPER_ADMIN`, `MINI_ADMIN` et `DISPATCHER` reçoivent 403 avant l'entreprise, le corps et le service. L'administrateur d'entreprise conserve la réponse.

  Mutations clients du 2026-10-25 : `src/app/api/clients/route.ts` et `src/app/api/clients/[id]/route.ts` n'exportent que `GET`. Aucune mutation n'a été créée. Le `GET` reste refusé à `SUPER_ADMIN` avant l'entreprise. Les trois rôles entreprise conservent la réponse.

  Création de commande du 2026-10-25 : `POST /api/orders` n'existe pas. Aucune méthode n'a été créée. Le `GET` de la liste reste inchangé.

  Inventaire entreprise du 2026-10-25 : 33 fichiers et 46 méthodes hors `/api/admin` appellent `getCompanyId`. Le document `docs/operations/admin01/tenant-api-boundaries.md` note la permission et les rôles observés, ou « aucun » s'il n'y a pas de `requireRole`. Les résolutions indirectes via `conversationAuth` et `requireSupportStaff` restent dehors. Aucune garde nouvelle dans cet inventaire.

  Paramètres d'entreprise du 2026-10-25 : `GET` et `PATCH` de `/api/company/settings` et `/api/company/billing-settings` exigent `COMPANY_ADMIN` ou `MINI_ADMIN` juste après leur permission. Les comparaisons directes de `SUPER_ADMIN` sont retirées. `SUPER_ADMIN` et `DISPATCHER` reçoivent 403 avant l'entreprise, le corps et le service. L'inventaire nomme ces deux rôles pour les quatre méthodes. `/api/billing` ne change pas. Vérifié : `npm run test:admin01` 63/63 et `npm run check` 448/448. ADMIN-1 reste ouverte.

  Comptes d'entreprise du 2026-10-25 : `GET` et `POST` de `/api/users`, puis `PATCH` et `DELETE` de `/api/users/[id]`, exigent `COMPANY_ADMIN` ou `MINI_ADMIN` juste après leur permission. Les comparaisons directes de `SUPER_ADMIN` restent en défense supplémentaire. `SUPER_ADMIN` et `DISPATCHER` reçoivent 403 avant l'entreprise, les paramètres, le corps et le service. `COMPANY_ADMIN` et `MINI_ADMIN` conservent leurs réponses. L'inventaire nomme ces deux rôles pour `PATCH` et `DELETE`. Vérifié : `npm run test:admin01` 63/63 et `npm run check` 448/448. ADMIN-1 reste ouverte.

  Frontières indirectes du 2026-10-25 : 8 méthodes passent par `conversationAuth` et 4 par `requireSupportStaff`. Le document les liste. `conversationAuth` autorise `COMPANY_ADMIN`, `MINI_ADMIN`, `DISPATCHER`, `DRIVER` et `CLIENT`. `requireSupportStaff` autorise `COMPANY_ADMIN`, `MINI_ADMIN` et `DISPATCHER`. `SUPER_ADMIN` est exclu des deux. Un mini-admin sans `support:read` reste refusé avant l'entreprise. Aucun fichier applicatif modifié. Vérifié : `npm run test:admin01` 66/66 et `npm run check` 451/451. ADMIN-1 reste ouverte.

  Matrice du 2026-10-25 : `docs/operations/admin01/ACCEPTANCE.md` classe chaque capacité déjà couverte en « prouvé localement » ou « non prouvé », avec le fichier, le test et la limite. Le navigateur connecté reste non prouvé à cause du DNS Supabase. Journal d'accès, détail audité, paiements réconciliés, alerte de coût, pilotes et impersonation restent non prouvés. Aucun code ni test modifié. Vérifié : `npm run test:admin01` 66/66 et `npm run check` 451/451. ADMIN-1 reste ouverte.

  Impersonation du 2026-10-25 : les neuf routes `/api/admin` n'exportent que `GET`. Les surfaces admin n'ont aucun marqueur d'impersonation, ni création de session, de jeton ou de changement d'entreprise. La matrice ne prouve que cette absence locale. La configuration externe du fournisseur d'identité n'est pas auditée. Aucun fichier applicatif modifié. Vérifié : `npm run test:admin01` 68/68 et `npm run check` 453/453. ADMIN-1 reste ouverte.

  Facturation entreprise du 2026-10-25 : `GET` et `POST /api/billing`, puis `GET /api/billing/subscription`, sont exécutés localement. `SUPER_ADMIN`, `MINI_ADMIN` et `DISPATCHER` reçoivent 403 avant l'entreprise, le corps et le fournisseur. `COMPANY_ADMIN` atteint la lecture, l'aperçu, le changement, l'annulation et la vue d'abonnement avec des dépendances simulées. Aucun réseau, Stripe ou paiement réel. Aucune route modifiée. Vérifié : `npm run test:admin01` 70/70 et `npm run check` 455/455. ADMIN-1 reste ouverte.

  Page support plateforme du 2026-10-25 : le source de `/admin/support` utilise `useAdminSupportTickets`, les états chargement, erreur et vide, la recherche entreprise, les filtres statut et priorité, les tailles 25/50/100 et la pagination. Les colonnes restent entreprise, type, statut, priorité et références métier. `row.id` sert seulement de clé. Aucun sujet, message, coordonnée, action ou lien de détail. Aucun fichier applicatif modifié. Vérifié : `npm run test:admin01` 73/73 et `npm run check` 458/458. ADMIN-1 reste ouverte.

  File technique du 2026-10-25 : le source de `/admin/operations` utilise `useAdminOperationJobs`, la recherche entreprise, les filtres statut et type, les tailles 25/50/100, la pagination et les états chargement, erreur et vide de la file. Le statut `stale` s'affiche « Bloqué ». Les champs lus sont ceux du DTO. `payload`, `jobKey`, `lastError`, relance et lien de détail sont absents. Le panneau de santé garde son hook, son chargement et son erreur. Aucun fichier applicatif modifié. Vérifié : `npm run test:admin01` 76/76 et `npm run check` 461/461. ADMIN-1 reste ouverte.

  Journal d'accès du 2026-10-25 : les neuf GET `/api/admin` écrivent un événement après l'authentification staff. `SUPER_ADMIN` est `ALLOWED`, un autre rôle déjà authentifié est `DENIED`. L'événement garde l'identifiant, l'instant, l'échéance à 90 jours, l'acteur, le rôle, `GET`, la ressource et la décision. Pas d'URL, de nom, d'e-mail ni d'adresse IP. Les entrées échues sont purgées dans la même transaction. Si l'écriture d'un accès autorisé échoue, la route répond 503 avant la lecture. Si l'écriture d'un refus échoue, le 403 reste. Pas de page de consultation. La migration SQL est écrite et n'est pas appliquée. Vérifié : `npm run test:admin01` 78/78 et `npm run check` 463/463. ADMIN-1 reste ouverte.

  Consultation du journal du 2026-10-25 : `GET /api/admin/access-events` est réservé au `SUPER_ADMIN` après `dashboard:admin`. L'événement `ACCESS_EVENTS` est écrit avant la lecture de l'URL et du journal. Filtres optionnels `resource` et `decision`, pages 25/50/100, tri par date puis identifiant. Seules les entrées non échues sont comptées. Le DTO garde l'identifiant, l'instant, l'acteur, le rôle, la ressource et la décision. Pas de page ni de navigation. La migration n'est pas appliquée. Vérifié : `npm run test:admin01` 79/79 et `npm run check` 464/464. ADMIN-1 reste ouverte.

  Écran du journal du 2026-10-25 : `/admin/access-events` est en lecture seule, lié depuis la navigation plateforme sous « Journal d'accès ». Le fetch utilise `cache: "no-store"` et le hook n'a pas de `refetchInterval`. Filtres ressource et décision, tailles 25/50/100, pagination. États chargement, « Journal indisponible » et « Aucun accès journalisé ». L'écran affiche l'instant, l'acteur, le rôle, la ressource et la décision. `id` sert seulement de clé. Pas de recherche, d'action, d'export ni de détail. L'écran n'a pas été ouvert dans un navigateur connecté. La migration n'est pas appliquée. Vérifié : `npm run test:admin01` 83/83 et `npm run check` 468/468. ADMIN-1 reste ouverte.

  Détail entreprise du 2026-10-25 : `GET /api/admin/companies/[id]` est le premier détail audité. Réservé au `SUPER_ADMIN` après `dashboard:admin`. L'événement `COMPANY_DETAIL` est écrit avant les paramètres et le service, sans identifiant cible. Un échec d'écriture autorisée répond 503 avant la lecture. Le DTO et l'écran gardent le nom, le statut, la création et les deux compteurs. Une entreprise absente répond 404. Le nom de la liste ouvre `/companies/[id]`. Pas de coordonnées, de données légales, de réglages, d'abonnement ni d'action. L'écran n'a pas été ouvert dans un navigateur connecté. La migration n'est pas appliquée. Vérifié : `npm run test:admin01` 86/86 et `npm run check` 471/471. ADMIN-1 reste ouverte.

  Porte locale du 2026-10-25 : les sept phrases du « Terminé quand » sont reliées à leurs tests déjà exécutés par `test:admin01`. Le code est prouvé localement. Le fonctionnement connecté n'est pas prouvé. Les seuls blocages externes consignés sont la migration du journal, non appliquée, et le navigateur bloqué par le DNS Supabase. La case n'est pas cochée. Vérifié : `npm run test:admin01` 88/88 et `npm run check` 473/473. ADMIN-1 reste ouverte.

  Migration du journal du 2026-10-25 : seule `20261025220000_platform_access_events` est appliquée sur la préproduction autorisée. RLS est actif et `PUBLIC`, `anon` et `authenticated` n'ont aucun droit direct. Les cinq migrations encore en attente, surveillance, facturation sandbox et catalogue, ne sont pas appliquées. Le journal local redirige vers la connexion. L'authentification locale échoue parce que l'adresse Supabase de l'environnement local ne se résout pas. Aucun compte super-admin n'a ouvert l'écran. ADMIN-1 reste ouverte.

  Preuve de préproduction du 2026-10-25 : `docs/operations/admin01/PREPROD-ACCESS-EVENTS.md` décrit le catalogue de `platform_access_events` sans lire aucune ligne. Colonnes, clé primaire, index, valeurs `resource` et `decision`, RLS et absence de droits directs sont constatés. `20261025220000_platform_access_events` est terminée. Les cinq migrations en attente restent listées. Le statut global n'est pas propre. La navigation connectée reste non prouvée : 307 puis 401 `ENOTFOUND`. ADMIN-1 reste ouverte.
  Navigateur connecté du 2026-10-25 : un `SUPER_ADMIN` temporaire, sans entreprise, a ouvert l'application locale branchée à la préproduction autorisée. Login 200. Le journal affichait des accès `ALLOWED` pour la vue d'ensemble, la santé SaaS, les entreprises, le détail et le journal. Un nom de la liste a ouvert le détail : nom, statut, création et deux compteurs, réponse 200. Le compte d'authentification, l'utilisateur et ses lignes de journal ont été supprimés. Il ne reste aucun `SUPER_ADMIN`.
  Clôture du 2026-10-25 : les sept critères du « Terminé quand » sont prouvés localement, et le journal ainsi que le détail entreprise ont été ouverts dans le navigateur connecté. ADMIN-1 est cochée. Les détails de compte, ticket, job et incident, les paiements réconciliés, l'alerte de coût et l'état des pilotes restent non prouvés : ce sont des limites hors critère, pas des capacités livrées.
  Détail entreprise du 2026-10-25, après clôture : le propriétaire demande l'identité, l'abonnement, les options et le chiffre d'affaires au clic, plus un suivi de qui paie. Le détail affiche contact, raison sociale, SIREN/SIRET, facturation, CA des factures de livraison, formule, montant HT enregistré, options, sièges et suivi. La page Souscriptions compte les commerciaux à jour, à relancer, en résiliation et qui ne paient plus, avec contact et lien vers l'entreprise. Aucun paiement Stripe n'est lu. La case reste cochée.
  Contrôle en lecture seule du 2026-10-26 : les cinq migrations notées « en attente » ci-dessus ont été appliquées avec l'accord du propriétaire (rapport `docs/rapports/CLAUDE_STABILISATION_HANDOFF.md`). La préproduction compte dix-sept migrations terminées, 35 tables, RLS partout et aucun droit direct public.

  Suite du 2026-10-29 : l'inventaire des routes à périmètre d'entreprise (`tests/admin01-tenant-api-boundary-inventory.test.ts`, `docs/operations/admin01/tenant-api-boundaries.md`) passe de 58 routes / 40 fichiers à 66 routes / 46 fichiers avec les chantiers du 28 octobre (Factur-X, relances, commande par message, preuve, réglages du portail) ; à recompter si une autre branche ajoute des routes `getCompanyId`. Tâche inchangée (terminée).

- [ ] **DISPATCH-4 — Construire un outil de dispatch avancé.** Demande du propriétaire du 28 octobre 2026 : aller au-delà de l'auto-dispatch actuel, où la distance GPS ne sert qu'à départager deux livreurs à égalité (DEMO-3, tranche 3), pour proposer un vrai outil d'aide à l'affectation et d'organisation des tournées. Pistes à cadrer avec le propriétaire avant de coder (questionnaire) :
  1. **Score d'affectation pondéré et réglable** : distance ou temps de trajet réel jusqu'au retrait, charge, priorités, zones, compétences ou véhicule, créneau promis au client ; poids modifiables par l'entreprise, avec explication lisible du choix (« pourquoi ce livreur »).
  2. **Temps de trajet réel** au lieu de la distance à vol d'oiseau, via le service de trajet déjà utilisé (OSRM), avec cache et repli sans coût caché.
  3. **Tournées** : regroupement des commandes voisines, ordre de passage optimisé, respect des créneaux et de la capacité (lien avec DEMO-3, tranche 10).
  4. **Suggestions au dispatcher** : les 3 meilleurs livreurs proposés pour une commande, affectation en un clic, possibilité de forcer un choix manuel.
  5. **Réoptimisation en direct** : retard, livreur indisponible ou commande urgente, avec une alerte et une nouvelle proposition.
  6. **Mesure** : temps de dispatch, kilomètres à vide, retards évités ; comparaison avant/après sur une période.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : le périmètre retenu par le propriétaire est livré par tranches testées ; chaque choix automatique est explicable et réglable ; aucune coordonnée de livreur n'est exposée au client ; transaction d'affectation courte (leçon de DISPATCH-3) ; tests métier sur les cas difficiles (DISPATCH-1), `npm run check` vert, recette navigateur et essai avec positions réelles.

  Source / dépendance / blocage : demande du propriétaire du 28 octobre 2026. S'appuie sur DEMO-3 tranche 3 (distance de départage, `src/lib/dispatch/dispatch-proximity.ts`) et sur les réglages de Règles dispatch. Périmètre et priorité des pistes : décision du propriétaire. Coûts du service de trajet : COST-1.

  Cadrage du propriétaire du 29 octobre 2026 (questionnaire) :
  - **Priorités** : d'abord la piste 4 (les 3 meilleurs livreurs, avec le vrai temps de trajet et la raison du choix, affectation en un clic), et tout de suite après la piste 3 (tournées optimisées), jugée très importante. Puis les pistes 5 (imprévus) et 6 (mesure), moins prioritaires.
  - **Métier** : un mélange de courses express (un retrait, une livraison) et de tournées à plusieurs arrêts. Les deux doivent marcher.
  - **Contrôle** : les deux modes, au choix de l'entreprise dans ses réglages : suggestion validée par le dispatcher, ou affectation automatique réglable.
  - **Taille** : à court terme, petites entreprises (moins de 20 livreurs, 10 à 30 livraisons par jour). L'outil doit tenir sans refonte si un gros client arrive : performance et algorithmes dimensionnés pour une flotte plus grande.
  - **Coût des trajets** : service gratuit d'abord (OSRM, avec cache). Un service payant seulement si un client l'exige.
  - **Offre** : grille actuelle conservée et testée. Piste du propriétaire : un seul « Dispatch automatique » rendu intelligent, un peu plus cher. Proposition de l'orchestrateur, à valider par le propriétaire avant tout changement de prix : une option unique « Dispatch intelligent » qui remplace le dispatch automatique, à 39 € au lieu de 29 € en Starter, toujours incluse en Pro et Business. L'offre pilote après les 4 semaines gratuites reste à décider (OFFER-1).

  État : ouverte, cadrée ; découpage en tranches à faire.

- [ ] **CONFIG-MSG — Expliquer clairement pourquoi une configuration échoue.** Demande du propriétaire du 28 octobre 2026 : quand un réglage ou une fonction refuse de fonctionner pendant la configuration, l'écran doit dire précisément pourquoi et quoi faire, au lieu d'un message général. Cas constaté : en préproduction, le Factur-X d'une facture de démo restait indisponible côté client (« Votre prestataire doit compléter ses informations de facturation ») alors que les mentions légales étaient remplies. La vraie cause, trouvée en reproduisant le cas, était le « Motif d'exonération de TVA » manquant (règle EN 16931 BR-E-10 : les factures de démo sont sans TVA).
  1. Factur-X : lister côté back-office chaque champ manquant, avec un lien direct vers le champ ; signaler dès l'enregistrement des mentions légales ce qui bloquera l'export (exonération de TVA pour des factures sans TVA, IBAN pour un paiement par virement…) ; côté client, garder un message sobre, sans détail interne.
  2. Étendre la règle aux autres configurations : Stripe, e-mail, commande par message (clé absente), règles dispatch, preuve de livraison, invitations. Chaque refus de configuration affiche la cause et l'action attendue.
  3. Préremplir ou proposer les mentions usuelles quand c'est sans risque, par exemple « TVA non applicable, art. 293 B du CGI » pour une entreprise sans TVA, à valider par l'utilisateur.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : chaque refus de configuration inventorié affiche sa cause et l'action à faire ; test par cas (champ manquant, format invalide, service non configuré) ; le parcours Factur-X de la démo aboutit en suivant uniquement les messages ; `npm run check` vert et recette navigateur.

  Source / dépendance / blocage : essai du propriétaire en préproduction le 28 octobre 2026 ; FACTURX-1, INTAKE-1, POD-2, EMAIL.

  État : ouverte, non commencée.

- [ ] **UX-ALERTES — Alléger les alertes et les afficher aux endroits appropriés.** Retour de Marie accepté par le propriétaire le 28 octobre 2026 : les blocs « Alertes à suivre » répétés en haut de chaque page prennent trop de place et repoussent les informations utiles, notamment dans l'app livreur. Inventorier les alertes par rôle, gravité et écran ; conserver un résumé dans les vues de supervision et les alertes qui concernent réellement l'action en cours, avec un accès identifiable aux autres alertes. Réduire l'agressivité visuelle ; conserver la visibilité immédiate des erreurs bloquantes et urgences métier. Éviter les répétitions entre pages et déplacer les explications secondaires hors de l'en-tête.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : chaque bloc d'alerte restant a un rôle et un emplacement justifiés ; aucun écran n'affiche des alertes étrangères à son contexte ; les contenus et actions principaux sont visibles plus tôt sur mobile ; états sans alerte, avertissement, urgence et erreur testés ; aucune alerte critique ni action métier perdue ; `npm run check` vert et recette navigateur administrateur/client/livreur à 390 et 1 280 px.

  Source / dépendance / blocage : décision du propriétaire dans cette conversation, après résumé des retours de Marie. Complète UX-04 et DESIGN-2 ; ne modifie pas les règles de détection métier sans décision explicite. État : ouverte, non commencée.

- [ ] **MAP-INTERACTION — Regrouper les cartes du tableau de bord et rendre leurs informations utiles.** Retour de Marie accepté par le propriétaire le 28 octobre 2026 : remplacer les deux sections « livreurs » et « missions actives » par un même espace de carte avec bascule claire entre les deux vues. Rendre les marqueurs sélectionnables, afficher les informations opérationnelles utiles au rôle et donner accès à la fiche canonique. Employer des couleurs mesurées pour distinguer les statuts et la sélection : le noir et blanc ne doit pas donner l'impression d'un écran inactif. Conserver un fond cartographique sobre (MAP-3), une légende et des formes/libellés qui ne dépendent pas de la seule couleur. Ne pas inventer de précision GPS ni d'informations indisponibles ; préserver la minimisation des coordonnées et de l'identité du livreur côté client.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : une seule zone de carte permet de choisir Livreurs ou Livraisons ; la bascule et la sélection sont compréhensibles au clavier et sur mobile ; chaque marqueur donne une information utile et une action adaptée ; chargement, absence de position, position périmée, aucune mission et erreur fournisseur restent explicites ; permissions et isolation entre entreprises préservées ; `npm run check` vert et recette navigateur à 390 et 1 280 px.

  Source / dépendance / blocage : décision du propriétaire dans cette conversation ; prolonge MAP-3 et UX-03, sans nouveau fournisseur ni suivi permanent promis. État : ouverte, non commencée.

- [ ] **UX-NAV-SCROLL — Revenir en haut lors d'un changement de page, conserver la position au Retour.** Défaut encore reproduit le 28 octobre 2026 sur le code `4a99b6b`, Chrome réel sans interface, `tutelliv-dev`, 1 280 × 720 : clic dans le menu administrateur de `/settings` (scrollY 533) vers `/settings/billing` → scrollY 389, soit le bas de la nouvelle page ; clic côté client de `/portal/settings` (scrollY 1 332) vers `/portal/orders` → scrollY 53, également au bas de cette page. Les liens ont été réellement cliqués ; aucune navigation par remplacement direct d'URL dans le test. Le bouton Retour restaure respectivement 533 et 1 332 : comportement à préserver. Preuve locale : `outputs/verification-2026-10-28/navigation-evidence.json`, captures `navigation-admin.png` et `navigation-client.png` ; pas de diffusion de ces outputs.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : une navigation vers une autre page depuis un menu démarre en haut du contenu, dans les espaces administrateur/client/livreur et sur le site public ; Retour/Avancer restaurent la position ; les ancres, listes à pagination et mises à jour de filtres conservent un comportement explicite adapté ; tests sur les vrais conteneurs de défilement, 390 et 1 280 px ; `npm run check` vert et clics navigateur. Aucun correctif de scroll global aveugle qui casserait l'historique.

  Source / dépendance / blocage : retour de Marie et demande de vérification du propriétaire dans cette conversation ; test indépendant ciblé, sans changement du code. État : ouverte, défaut confirmé ; correction non commencée.

- [ ] **DESIGN-2 — Étendre le mode sombre à tout le site.** Demande du propriétaire du 28 octobre 2026 : le mode sombre du portail client est jugé réussi ; l'étendre au site public (landing, tarifs, fonctionnalités, démonstration), au back-office et dispatch, à l'espace `/admin`, et vérifier l'app livreur (pas encore contrôlée par le propriétaire). Même direction « Encre + Pastel » que le portail, choix Clair / Sombre / Système mémorisé, sans éclair au chargement.
  - **Carte en sombre** : le même plan que celui d'aujourd'hui, en version sombre et noire, assortie au thème (fond, routes, libellés, trajets et marqueurs lisibles), qui bascule avec le thème. Voir MAP-3.
  - Retirer la limite actuelle du thème au seul `/portal/**` (`src/lib/theme.ts`, ThemeSync) espace par espace, en gardant le Light identique à aujourd'hui.
  - **Surfaces sans dégradés — décision du propriétaire du 28 octobre 2026** : abandonner les dégradés décoratifs au profit de fonds unis et d'accents doux, dans l'esprit du Dark « Encre + Pastel ». Référence vérifiée dans `src/app/globals.css` : fond anthracite `#141716`, cartes `#1c1f1e`, accents verts doux ; les fonds eux-mêmes ne sont pas pastel. L'ancienne maquette admin mentionnée de mémoire n'a pas été retrouvée dans le dépôt : ne pas prétendre l'avoir validée. Proposer l'équivalent en Light avec des aplats clairs/pastel, sans changer les statuts ni le contraste métier.
  - **Lisibilité des surfaces et finitions** : mieux distinguer les tableaux du fond de page (blanc en Light, surfaces distinctes en Dark), notamment Chauffeurs ; harmoniser l'orange, les boutons et la typographie de Tarifs/Fonctionnalités, sans ajouter de couleurs décoratives. Montrer les propositions avant/après au propriétaire.
  - **Première livraison** : proposer le parcours au démarrage puis le rendre masquable ou le retirer de la navigation principale une fois terminé, en gardant un accès depuis l'aide et les fonctions disponibles dans leurs rubriques. Préserver reprise, étapes incomplètes et possibilité de consulter à nouveau le guide.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : chaque espace propose Clair / Sombre / Système ; contrastes AA vérifiés en Sombre ; carte sombre assortie dans les trois espaces ; captures Light et Dark à 390 et 1 280 px comparées et validées par le propriétaire ; aucune régression du Light ; `npm run check` vert.

  Source / dépendance / blocage : demande du propriétaire du 28 octobre 2026 ; suite de DESIGN-1 (tranche portail) et de MAP-3. Méthode : agent avec navigateur et captures de référence, comme pour le portail.

  État : ouverte, non commencée.

- [ ] **FACTURX-SAISIE — Rendre bloquants à l'enregistrement les champs qui bloquent la facture.** Constat du propriétaire du 28 octobre 2026 en préproduction : dans Réglages › Facturation › « Mentions légales et Factur-X » (`src/features/back-office/einvoicing-settings-card.tsx`), on peut enregistrer sans la mention des pénalités et de l'indemnité de retard (ni l'escompte, ni le motif d'exonération pour des factures sans TVA). L'enregistrement réussit, puis le téléchargement Factur-X est refusé plus tard. Ce qui empêche d'émettre la facture doit être signalé et bloquant au moment de la saisie.
  - Marquer comme obligatoires les champs exigés par l'export : SIREN, adresse complète (rue, code postal, ville), pénalités de retard et indemnité de 40 €, escompte, motif d'exonération si l'entreprise facture sans TVA, IBAN et BIC si le paiement se fait par virement.
  - Refuser l'enregistrement avec un message par champ, côté formulaire ET côté serveur (schéma Zod de `src/lib/validations/einvoicing.ts`), dès que l'entreprise active ou utilise la facture électronique. Une entreprise qui ne l'utilise pas n'est pas bloquée, mais voit ce qui manquerait.
  - Mêmes règles pour l'identité de facturation du client, si l'export en dépend.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : il est impossible d'enregistrer des mentions qui feraient ensuite échouer l'export Factur-X ; chaque champ manquant ou invalide a son message ; test serveur et formulaire par champ ; recette navigateur : après un enregistrement accepté, le téléchargement Factur-X réussit du premier coup ; `npm run check` vert.

  Source / dépendance / blocage : essai du propriétaire du 28 octobre 2026 ; à mener avec CONFIG-MSG et FACTURX-1.

  État : ouverte, non commencée.

- [ ] **LANDING-2 — Refaire la landing et la page de connexion, minimalistes et très visuelles.** Demande du propriétaire du 28 octobre 2026. La page de connexion est jugée laide. La landing est une « bonne base », mais elle a trop de texte et en fait trop. Objectif : quelque chose de plus original, qui reste efficace et « tac tac ». Le visiteur doit comprendre en quelques secondes ce que fait TutelLiv, pourquoi il est là, ce que l'outil va lui apporter, et où se connecter, voir la démo ou contacter quelqu'un. Tous les sujets sont abordés, mais de façon très claire et minimaliste.
  - **Inspiration** : Apple, Tesla, Uber. Grands visuels produit (les trois espaces : dispatch, portail client, app livreur), peu de mots, une idée par écran, beaucoup d'air, mouvement sobre. Le propriétaire laisse carte blanche et attend une proposition originale, pas un modèle de SaaS générique.
  - **Landing** : une promesse en une phrase, une preuve visuelle immédiate (produit en action), 3 ou 4 bénéfices au plus, la mini-démo (DEMO-3) mise en valeur, les tarifs en un coup d'œil, un contact facile, et des appels à l'action toujours visibles (Démo, Se connecter, Contact).
  - **Connexion** : page sobre et belle, cohérente avec la landing, rapide sur mobile, avec les messages d'erreur clairs (CONFIG-MSG) et l'accès à la démo.
  - Mode clair et mode sombre (DESIGN-2). Accessibilité AA, cibles de 44 px, performances préservées.
  - Méthode : 2 ou 3 directions visuelles montrées au propriétaire (captures ou maquettes) avant de coder ; agent avec navigateur et captures avant/après ; skills de design du dépôt (impeccable, modern-frontend, apple-design).

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : direction validée par le propriétaire ; landing et connexion livrées en Light et Dark, à 390 et 1 280 px ; chaque information clé (ce qu'on fait, bénéfices, démo, connexion, contact, tarifs) est trouvable en moins de 5 secondes ; aucune promesse au-delà de ce que le produit fait réellement (GROWTH-1) ; scores Lighthouse au moins égaux à aujourd'hui ; `npm run check` vert et recette navigateur.

  Source / dépendance / blocage : demande du propriétaire du 28 octobre 2026 ; prolonge GROWTH-1 et la mini-démo DEMO-3 ; mode sombre avec DESIGN-2. Choix de la direction visuelle : propriétaire (questionnaire).

  État : ouverte, non commencée.

- [ ] **MOBILE-WEB — Revoir toute l'application au format téléphone, dans le navigateur.** Demande du propriétaire du 29 octobre 2026 : passer en revue chaque page des trois espaces (administration et dispatch, portail client, app livreur), ainsi que le site public et `/admin`, sur un écran de téléphone (390 px, et 360 px pour les petits Android), dans le navigateur, sans application native.
  - Inventaire page par page : ce qui déborde, ce qui est trop petit à toucher (cibles d'au moins 44 px), les tableaux illisibles, les menus, les cartes, les formulaires et les modales.
  - Corriger écran par écran, en gardant le comportement ordinateur identique. Priorité aux parcours du quotidien : livreur en tournée, client qui commande et suit, dispatcher qui affecte en déplacement.
  - Tableaux longs : version en cartes sur mobile. Actions principales accessibles au pouce, sans débordement horizontal.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : chaque page listée est vérifiée à 390 et 360 px, en Light et Dark, avec capture avant/après ; aucun débordement horizontal ; cibles d'au moins 44 px ; parcours principaux cliqués de bout en bout sur mobile ; `npm run check` vert.

  Source / dépendance / blocage : demande du propriétaire du 29 octobre 2026. À mener après DESIGN-2, MAP-INTERACTION et UX-ALERTES pour ne pas retoucher deux fois les mêmes écrans. Complète MOB-01C (essais sur téléphone réel).

  État : ouverte, non commencée.


- [ ] **CROSS-BROWSER — Même rendu sur tous les navigateurs courants.** Demande du propriétaire du 29 octobre 2026 : le site ne s'affiche pas pareil sur Edge que sur Chrome. L'écart exact reste à préciser, avec la page et une capture du propriétaire si possible. Aujourd'hui, les tests E2E ne tournent que sur Chrome (`playwright.config.ts`, canal `chrome`) ; WebKit et le Chromium de Playwright sont installés sur le Mac depuis le 29 octobre.
  - Ajouter des projets Playwright Firefox et WebKit (Safari), et lancer Edge par le canal `msedge` s'il est installé.
  - Comparer, en Clair et en Sombre, à 1 280 et 390 px : le site public, la connexion, le tableau de bord, le dispatch, le portail client et l'app livreur.
  - Points à surveiller : polices (`next/font`), `backdrop-filter`, `dvh`, `color-mix`/`oklch`, barres de défilement, champs de date, mode sombre automatique d'Edge, traduction automatique.
  - Corriger écran par écran sans changer le rendu Chrome.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : les pages listées ont le même rendu sur Chrome, Edge, Safari et Firefox (captures côte à côte) ; une suite E2E courte tourne sur les trois moteurs ; `npm run check` est vert.

  Source / dépendance / blocage : demande du propriétaire du 29 octobre 2026. À mener après LANDING-2 et MOBILE-WEB.

  État : ouverte, non commencée.
- [x] **AUTH-ROLE — Refuser côté serveur les pages du mauvais rôle.** Aujourd'hui, le middleware vérifie seulement qu'une session existe (`src/middleware.ts`) et les layouts des espaces contrôlent le rôle dans le navigateur. Un client connecté qui ouvre `/dashboard`, `/dispatch` ou `/driver/missions` (ou un livreur qui ouvre `/portal/orders`) reçoit donc la page en HTTP 200 avant la redirection côté client. Les API restent protégées : `/api/invoices` renvoie 403 au client, au livreur et au dispatcher, et aucune fuite de données n'a été constatée.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : chaque espace (back-office/dispatch, portail client, app livreur, `/admin`) refuse côté serveur un rôle non autorisé, par redirection 307 vers l'espace du rôle ou par refus explicite, sans rendre la page ; la démo et le changement de persona fonctionnent toujours ; tests unitaires de la règle et recette HTTP `redirect: "manual"` pour chaque couple rôle × espace ; `npm run check` vert.

  Source / dépendance / blocage : recette serveur indépendante de Codex du 28 octobre 2026 (`outputs/recette-codex/rapport.md`, sur cda66cd). Défaut préexistant sur `preproduction` (9234600), non introduit par l'intégration. Prioritaire pour la série suivante.

  État : **terminée le 29 octobre 2026** (branche `agent/auth-role`). Le middleware passe en runtime Node. Avant tout rendu, préchargements et requêtes RSC compris, il relit en base le rôle, les permissions, les modules mini-admin, le compte, l'entreprise et la persona de démo, puis applique une table unique (`src/lib/permissions/page-access.ts`).
  - Réponses : mauvais espace → 307 vers l'accueil du rôle ; aucun écran ouvert → 403 ; compte ou entreprise indisponible → `/login` ; base en panne → 503.
  - Preuves : `tests/auth-role-real-guard.test.ts` (vrai chemin, compte désactivé, entreprise suspendue, démo expirée) ; `tests/e2e/auth-role-pages.spec.ts` 7/7 ; vérificateur final : 307 en HTML, RSC et préchargement, 0 erreur console.
  - Limites acceptées : rôle gardé 5 s en mémoire par instance ; écrans déjà en cache client jusqu'à 180 s après le retrait d'un module ou une suspension (les API relisent la base à chaque appel).
  - Rapport : `docs/rapports/agents/2026-10-29-auth-role.md`.

- [ ] **RECETTE-2810 — Défauts mineurs de la recette du 28 octobre.** Reprendre les défauts mineurs et les points à trancher relevés par les deux recettes navigateur de l'intégration `integration/2026-10-28` (`outputs/recette-agents/integration/rapport.md` sur fcc0a5c et `outputs/recette-agents/integration-correctifs/rapport.md` sur 013d1fc puis 557e9d5), sans bloquer l'intégration : aucun défaut bloquant ni important n'a été relevé.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : chaque point ci-dessous est corrigé et vérifié, ou explicitement accepté ou tranché par le propriétaire avec la décision consignée ; les trois spécifications E2E en échec passent ; `npm run check` est vert ; les parcours concernés sont rejoués dans le navigateur.

  Source / dépendance / blocage : deux recettes sur tutelliv-dev, audit Codex et rapports de branche. Décisions produit des points 6, 7, 11 et 12 : propriétaire (questionnaire).

  État : ouverte, non commencée (liste établie le 29 octobre 2026). Le défaut 1 est un défaut de spécification, pas du produit : manuellement, l'interrupteur persiste.

  Avancement du 29 octobre 2026 :
  - **Fait** : point 1 (trois specs réparées, attente du PATCH, assertion alignée) ; point 3 (`favicon.ico` et `icon.png`) ; point 2 en partie (titre accessible de la boîte de preuve, dimensions du logo ; avertissements LCP non traités).
  - **Relances e-mail (audit Codex C5)** : classement des réponses Resend, contenu figé à la première tentative, fenêtre de 23 h, état « Envoi non confirmé », limiteur de connexion corrigé sous concurrence ; verrous exercés sur PostgreSQL réel (`npm run test:pg-locks`). Rapport : `docs/rapports/agents/2026-10-29-relances-email.md`.
  - **Nouveaux points du vérificateur final** :
    - 16. `tests/e2e/demo3-payments.spec.ts:30-35` compte les boutons « Relancer » sans attendre la liste, donc il est toujours ignoré ; et il attend « Relancée » désactivé alors qu'une relance non envoyée (e-mail désactivé) laisse « Relancer » actif. À réécrire.
    - 17. Une relance refusée avec certitude deux fois de suite (403 ou 422) peut s'afficher « Envoi non confirmé » et bloquer « Relancer » 24 h (`invoice-reminder.service.ts:323`, `:406`). Pas de double envoi.
    - 18. Limiteur : un pool saturé (P2024) refuse toutes les connexions 5 s en 503 (choix documenté, à surveiller en préproduction).
    - 19. La carte du dispatch est sur `/dispatch/map` : préciser la non-régression du skill de recette.
  - **Limite acceptée** : une relance héritée close en NOT_SENT_* après un 500 accepté par l'ancien code reste indétectable. Aucun environnement n'a jamais eu Resend configuré, donc aucun envoi accepté hérité n'existe.

  Défauts mineurs de la recette de l'intégration :

  1. Spécifications E2E en échec (défaut de spec) : `demo3-payments.spec.ts:60` et `facturx.spec.ts:33` rechargent juste après le clic « Enregistrer » sans attendre le PATCH (corriger avec `waitForResponse`) ; `order-intake.spec.ts:73` attend « Informations absentes du message » alors que le brouillon simulé n'a aucun champ manquant. Résultat des sept fichiers : 15 réussies, 3 échecs, 6 ignorées (série interrompue après l'échec dans `facturx` et `demo3-payments`).
  2. Console : `DialogContent requires a DialogTitle` à l'ouverture de la boîte de preuve (application livreur, 390 px) ; avertissement d'image du logo (largeur ou hauteur seule) à 390 px ; avertissements LCP.
  3. `/favicon.ico` répond 404 sur toutes les pages (« Failed to load resource » en console ; déjà présent en préproduction).
  4. Super-administrateur sur `/admin` : 403 sur `/api/operational-alerts` et `/api/order-conversations/notifications`.
  5. La fiche commande du back-office affiche « En attente » pour une facture échue, alors que Paiements affiche « En retard · 5 j » (le statut stocké ne change qu'au passage du cron).
  6. À trancher, relance sans e-mail : l'API garde `canRemind: true` après une relance non envoyée ; la spécification attend « Relancée » désactivé pendant 24 h. Relance possible tant qu'elle n'est pas partie ?
  7. À trancher, preuve : « Valider la livraison » s'active avec photo et signature mais sans nom (le commentaire de la spécification dit « reste désactivé »). Nom du réceptionnaire obligatoire ou non ?
  8. Après la validation d'une preuve, un bouton « Réessayer maintenant » est apparu un instant dans l'application livreur alors que le PATCH renvoyait 200 et que tout était enregistré (non reproduit ensuite).
  9. Le premier job « Prise en charge » est resté `PENDING` plus d'une minute (traité par le cron) alors que les suivants passaient aussitôt.
  10. Le cron répond 503 dès qu'une tâche échoue (e-mail désactivé en développement), ce qui masque le succès des autres tâches.
  11. À trancher, commande par message : aucune entrée « Depuis un message » dans le portail (le rapport de l'agent ne la prévoit pas ; la grille de vérification la mentionnait).

  Défauts mineurs de la recette ciblée des correctifs :

  12. La fiche commande côté client n'affiche pas le livreur à l'écran (l'API le renvoie) ; seules la fiche livraison et l'assistance l'affichent. Constat, pas un défaut démontré : à trancher.
  13. Erreur console « 404 Failed to load resource » sans URL identifiée sur `/dashboard`, `/portal/orders` et `/driver/missions` (aucune réponse 404 interceptée sur la page).
  14. Un 403 sur `/api/portal/dashboard` relevé pendant la séquence client, non attribué ni reproduit de façon fiable.
  15. Le premier lancement après redémarrage a renvoyé des 503 sur `/api/auth/login` pendant environ une minute (pool de connexions en mode session libéré progressivement).

  Ajouts issus des rapports de branche :

  16. Généraliser `updateSettingsWithClaim` (réclamation sur `updatedAt`) aux autres réglages : dispatch, localisation, tarifs, tableaux de bord, préférences client et démo font encore une lecture-réécriture sans réclamation (documenté dans `docs/FACTURX.md`).
  17. `PATCH /api/company/dispatch` renvoie une erreur 500 sur un corps JSON invalide (défaut préexistant, hors périmètre du chantier Dispatch GPS) : attendu 400.

  Reste : tout ce qui précède. Non testé par les recettes : analyse IA réelle, envoi réel d'e-mails, Stripe et Supabase Storage côté navigateur (aucune requête observée, donc aucun rapport CSP), mode hors ligne de la preuve et GPS réel (téléphone), MINI_ADMIN, 429 sur compte livreur ou client, thème Sombre de chaque page du portail à 390 px (couvert par la spécification verte), HSTS (développement).

- [ ] **PROPRIO-2810 — Actions du propriétaire avant mise en ligne.** Liste unique des actions que seul le propriétaire peut faire pour mettre en ligne les neuf chantiers intégrés le 28 octobre 2026. Le 28 octobre 2026, l'intégration a été poussée sur `preproduction` (dd8a835, déploiement Vercel prêt, aucune erreur) et les cinq migrations ont été appliquées à la base de préproduction ; les autres actions ci-dessous restent à faire.

  **Modèle conseillé : GPT‑6 Luna · effort faible.**

  Terminé quand : chaque ligne est constatée par un agent (secret présent, migration appliquée avec un schéma sans écart, réglage visible) ; aucun secret n'est affiché ni versionné ; promotion décidée explicitement.

  Source / dépendance / blocage : `docs/rapports/agents/2026-10-28-grille-verification.md` (section « Actions du propriétaire avant mise en ligne »), rapports des chantiers et audit Codex (`outputs/verification-2026-10-28/rapport.md`, compléments 1 à 3). Ce suivi ne remplace pas la liste « Interventions du propriétaire » du tableau de pilotage : il la détaille pour ce lot.

  État : ouverte. Migrations appliquées sur tutelliv-dev uniquement : `20261028090000_fk_indexes`, `20261028100000_order_intake_usage`, `20261028120000_pod_signature`, `20261028180000_auth_login_failures`, `20261028230000_invoice_reminders`. Aucune migration sur la préproduction ni la production ; aucun push ; `main` inchangé.

  Reste (dans l'ordre conseillé) :

  1. **Décider de la fusion** de l'intégration (non poussée) dans `preproduction` et de son push, après relecture ; aucun déploiement n'est implicite.
  2. **Migrations de préproduction, uniquement sur accord explicite**, dans cet ordre : `20261028090000_fk_indexes` (12 `CREATE INDEX IF NOT EXISTS` ; en production, `CONCURRENTLY`), `20261028100000_order_intake_usage` (table d'usage de la commande IA, RLS + REVOKE), `20261028120000_pod_signature` (colonnes nullables sur `deliveries`), `20261028180000_auth_login_failures` (sans elle la limitation des connexions est inactive), puis `20261028230000_invoice_reminders` (`ALTER TYPE "OperationJobType" ADD VALUE 'DELIVERY_INVOICE'` et table `invoice_reminders`, RLS + REVOKE). Vérifier ensuite le schéma sans écart. Aucune promotion de production autorisée.
  3. **Cron des tâches de fond** : secrets GitHub `PREPROD_BASE_URL`, `PREPROD_CRON_SECRET` et, si la protection l'exige, `VERCEL_AUTOMATION_BYPASS_SECRET` ; environnement GitHub `preproduction` sans restriction de branche ; le workflow planifié ne tourne que depuis `main` (OPS-FIAB).
  4. **Node 22 sur Vercel**, aligné sur `.nvmrc` 22.18.0 (OPS-FIAB, ENV-2).
  5. **`CONTACT_HMAC_SECRET`** dans Vercel (le changer remet les compteurs Contact à zéro) (SEC-AUDIT).
  6. **Supabase Auth** : activer la protection contre les mots de passe compromis (HaveIBeenPwned), action du tableau de bord (SEC-AUDIT, SEC-05).
  7. **Commande par message** : fournir `ANTHROPIC_API_KEY` côté serveur, faire activer la fonction par l'administration d'une entreprise de recette, faire qualifier la fiche F10 de `docs/legal/SOUS_TRAITANTS.md` (contrat, rétention, transferts) avant toute donnée réelle (INTAKE-1).
  8. **Factur-X** : valider un fichier fictif avec Mustang ou le validateur FNFE (PDF/A-3b strict, franchise en base BT-32) ; choisir une plateforme agréée (FACTURX-1).
  9. **Décisions produit** : nom du réceptionnaire obligatoire ou non, relance possible tant que non partie, entrée « Depuis un message » dans le portail, livreur affiché sur la fiche commande client (RECETTE-2810).
  10. **Essais sur téléphone réel** : signature tactile, mode avion et reprise, départage GPS par la distance (POD-2, MOB-01C, DEMO-3).
  11. **Domaine, expéditeur et fournisseur d'e-mails** pour recevoir réellement les relances, factures, prises en charge et liens de preuve (EMAIL, SEC-05).
  12. **Revue visuelle différée** du portail en Dark et du reste de DESIGN-1.
  13. **Document juridique** `docs/legal/J5_AUDIT_FACTUEL_DEV.md` : cite encore `provision-company-admin.ts` (supprimé) ; à faire traiter par le fondateur dans ChatGPT puis, si besoin, à fournir exploitable dans le dépôt (LEGAL-1).
  14. **Promotion de la production** (`main`) : seulement sur décision explicite, après RELEASE-1.

- [ ] **RELEASE-1 — Réaliser la recette de mise en vente.** Rejouer sécurité, livraison, GPS promis, abonnement, support, exports et restauration ; revue des défauts ouverts et charge représentative.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : Aucun défaut bloquant connu ouvert ; responsabilités opérationnelles définies ; décision de lancement explicite et surveillance prête.

  Source / dépendance / blocage : Toutes les portes pertinentes ci-dessous ; pas de déploiement implicite.

- [ ] **SMS — Ajouter seulement les extensions justifiées.** Prioriser SMS, intégrations, optimisation avancée, IA ou app native selon problèmes répétés et disposition à payer.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : Chaque extension a un problème mesuré, un coût, un critère de réussite et une place validée dans la roadmap.

  Source / dépendance / blocage : Différé ; ancien SMS conservé, aucun fournisseur imposé.

## Portes de sortie

- **V1 interne prête à être essayée :** V1-GO passe sur données fictives, y compris essais GPS terrain pour la promesse de localisation. Parcours prioritaire fiable, droits vérifiés, limites connues et fonctions non qualifiées hors promesse. Aucun client prospect nécessaire à cette recette interne.
- **A — Données réelles autorisables :** ENV-1, SEC-01 à SEC-06, isolation, conservation/accès et cadre contractuel adaptés ; aucune fuite ou augmentation de droits connue laissée ouverte.
- **B — Noyau utilisable :** V1-GO, historique, preuves, messages, statut et GPS validés pour les conditions annoncées ; récurrences/missions spéciales/facturation avancée seulement si qualifiées.
- **C — Pilote payant prêt :** A + B, restauration/alertes/support opérationnels, périmètre comptable décidé, contrat et données cadrés, offre et onboarding prêts. Un abonnement géré manuellement peut suffire.
- **D — Libre-service prêt :** pilote concluant, abonnements automatisés testés, RELEASE-1 et décision explicite de lancement. Aucun paiement ou déploiement réel autorisé par la seule présence de cette TODO.

## Sources et traçabilité

Rapports sources archivés dans `docs/rapports/2026-09-27/` : audit-tutelliv-saas.md, rapport-tests.md, validation-audit-tutelliv.txt, perimetre-audit-tutelliv.txt. La validation locale est antérieure aux tests E2E : ses mentions « build non exécuté » décrivent sa propre étape et sont remplacées, pour l’état actuel, par le rapport E2E.

L’audit visuel reprend les mêmes constats que le rapport SaaS ; fixtures.json et api-results.json de la tâche constituent les preuves opérationnelles sans mots de passe. Les scripts de travail et secrets ne sont pas à archiver dans la documentation.

- 2026-10-20 — L’ancienne carte fournie par le propriétaire est conservée dans `docs/references/design/ancienne-carte-tutelliv.png`. MAP-3 est rouverte pour reprendre sa hiérarchie visuelle précise ; DESIGN-1 est ajouté en P2 pour harmoniser ensuite l’ensemble des trois espaces dans une direction plus sobre. La jauge compte désormais 68 tâches, dont 45 terminées.
- 2026-10-21 — Nouvelle roadmap SaaS autonome fusionnée après inspection du schéma, des routes, des pages, des services, des tests et des documents existants. Huit responsabilités réellement absentes sont ajoutées : DEMO-2, SIGNUP-1, SAAS-03, SAAS-04, SALES-1, PERF-02, COST-1 et ADMIN-1. SAAS-01A/B, OFFER-1, ONBOARD-1 et GROWTH-1 sont précisés sans doublon. Commissions corrigées à 15/25/35 %, options annuelles sans remise de deux mois, dépassements facturés sur la période et accès dispatch du mini-admin consignés. Rapport : `docs/rapports/2026-10-21/audit-roadmap-saas-autonome.md`.
- 2026-10-21 — Les 31 tâches ouvertes sont réorganisées autour de deux jalons indépendants : V1 exploitable par trois pilotes avec création manuelle autorisée, puis SaaS autonome de la découverte au paiement et à la première livraison. DEMO-2 devient le premier chantier, SAAS-01A précède SIGNUP-1, COST-1 commence par une estimation documentaire sans test payant et SALES-1 reste limité à l'attribution et au calcul théorique. Les dépendances extérieures sont séparées du travail réalisable immédiatement ; aucun identifiant historique ni tâche terminée n'est supprimé.
- 2026-10-21 — C7 ferme les sept familles de règles commerciales : dispatcher 0/1/1 puis 8 € HT/mois ; augmentations immédiates après paiement du prorata et diminutions au renouvellement ; dépassements mensuels non bloquants avec alertes 80/100/120 % ; restrictions d'impayé J0/J3/J7/J14/J30 ; résiliation en fin de période et remboursements exceptionnels tracés ; support standard sous un jour ouvré comme objectif interne et priorité sans délai court garanti ; quotas mensuels même sur l'annuel. Aucun paiement réel ni déploiement de production n'est autorisé par cette décision.
- 2026-10-22 — SAAS-01A terminée : catalogue C7, souscriptions/pilotes/historique, droits, sièges et consommation mensuelle sont appliqués côté serveur. Les fonctions payantes sont protégées sur leurs routes, les entreprises existantes restent sans abonnement payant inventé et les sessions démo reçoivent un pilote de huit heures. Migration additive appliquée uniquement à la préproduction : 29 tables RLS, trois migrations, zéro drift ; restauration 29/29, 295 tests et build 103 pages réussis. Rapport : `docs/rapports/2026-10-22/saas-01a.md`.

Correspondance avec l’ancien backlog : RUN-1 → RUN-1A/B + TEST-2 + MOB-01C ; F-2/F-1 → SEC-03/04 ; P1 → POD-1/ALERT-1 ; P0 → ALERT-1/SAAS-02 ; PERF-LOGIN/NAV/T2–T12 → PERF-01/UX-02 ; UI-1 → UI-2. Les autres identifiants historiques restent présents. Audit OPS-03 → ENV-1/DB-1/TEST-2/CI-1/OPS-03A/B/LEGAL-1/DATA-02 ; SAAS-01 → SAAS-01A/B/SAAS-02 ; PROD-01 de l’audit → PROD-01–04/ONBOARD-1/SUPPORT-1/DEMO-1/GROWTH-1.

- 2026-10-18 — Décisions commerciales intégrées : France, cible B2B 5–20 livreurs, exclusions V1, export comptable, grille Starter/Pro/Business, pilote proposé, commissions, Resend, objectifs RPO/RTO et priorités P0–P5. PROD-01 et BILL-01A terminées. Chiffrage préproduction, protocole mobile, politique de conservation, architecture offres/quotas/commissions et support MAP-3 préparés. Aucune ressource, dépense, DNS, envoi, migration, suppression ou déploiement effectué.
- 2026-10-18 — LEGAL-1 avancée localement : dossier de revue France, douze pièces à valider, matrice RGPD par traitement, registre préparatoire fournisseurs, inconnues, sources officielles et checklist avant données réelles. Aucun avis juridique, contrat final, identité fictive ou contact externe ; la tâche reste ouverte pour identité, contrats fournisseurs et validation professionnelle.

Les tests distants d’augmentation des privilèges n’ont pas été autorisés par le contrôle automatique ; la demande de plan actuelle ne lève pas ce blocage spécifique. Analyse et tests locaux restent possibles.

## Journal historique conservé

- 2026-10-15 — Le propriétaire demande qu’un clic sur une commande en retard la mette immédiatement en évidence dans le dispatch. DISPATCH-2 ajoutée avec sélection par URL, focus visuel et clavier, cas mobile/desktop, filtres/pagination et permissions.

- 2026-10-15 — Le propriétaire demande de revoir le design des cartes, actuellement jugées trop chargées, et préfère l’ancien rendu sobre blanc/noir de type Uber. MAP-3 ajoutée juste après PERF-01 ; validation visuelle du propriétaire requise avant de cocher la tâche.

- 2026-10-15 — Le propriétaire constate que la navigation générale du site local est très lente. L’ancienne tâche PERF-LOGIN est élargie en PERF-01 aux trois espaces et placée en priorité immédiate, avec mesures à froid/chaud, séparation des causes serveur/base/réseau/JavaScript/rendu et preuve avant/après. Aucune optimisation revendiquée à ce stade.

- 2026-09-26 — Audit initial : TypeScript OK ; lint OK avec 24 avertissements ; aucun test automatisé existant. Base distante, accès non testés. Modification utilisateur préexistante dans `.cursor/rules/perf-handoff.mdc` préservée comme source historique.
- 2026-09-26 — Préparation terminée : `npm run check` réussi (TypeScript OK, lint sans erreur avec les 24 avertissements existants, 7 tests réussis). `git diff --check` et syntaxe du script OK. Script de démarrage testé dans un dossier temporaire avec commandes simulées : échec de génération bloquant sans mémorisation du hash, réussite mémorisée, schéma inchangé sans régénération, aucune commande de base exécutée. Build et parcours navigateur non exécutés ; ENV-1 / RUN-1 restent ouverts. Aucun serveur, envoi e-mail/SMS, seed, migration ou déploiement lancé.

- 2026-09-27 — Tests autorisés sur la base distante sans données réelles (confirmation utilisateur). Deux entreprises E2E créées. Cycle API commande → affectation → démarrage → photo → livraison → facture/PDF réussi ; course → collecte → échec motivé réussie. Inscription, connexions et commande navigateur vérifiées. Fuite interentreprises du support reproduite (ticket B rattaché à commande A). Compteurs livraison incohérents après facturation. GPS réel et permissions mini-admin restent non validés ; test de modification de privilèges refusé par contrôle automatique. Rapport complet dans les outputs/e2e de la tâche Codex. ENV-1 reste ouvert : environnement dédié toujours absent.

- 2026-09-27 — Consolidation des rapports et du backlog en plan de mise en vente. Statuts harmonisés avec les tests récents. Aucun code applicatif modifié et aucune correction marquée comme terminée par cette planification.

- 2026-09-27 — SEC-02 terminée localement : contrôles client + entreprise sur commandes/livraisons du support, réponse uniforme 404, anciens tickets invalides exclus de liste/détail/messages. `npm run check` réussi (10 tests, types OK, 24 avertissements lint existants) ; 23 vérifications HTTP réussies sur copie locale corrigée et comptes E2E autorisés. Quatre tickets et un message de test ajoutés. Aucun déploiement ni suppression. Rapport : outputs/sec02/rapport.md de la tâche Codex. Prochaine tâche recommandée : SEC-01.

- 2026-09-27 — SEC-01 terminée localement : rattachement limité à un client vérifié de la même entreprise, relations enfants et parent contrôlées, propriétaires existants préservés, transaction commune. Connexion/création client/script de test adaptés. `npm run check` réussi : 16 tests, types OK, 24 avertissements existants. 31 assertions API/base réussies sur fixtures A/B partageant le même e-mail ; PDF étrangers refusés. Audit en lecture seule : aucun ancien rattachement client interentreprises sur commandes/livraisons/factures. Quatre chaînes fictives et un compte client ajoutés. Aucun déploiement/migration/réparation massive. Rapport : outputs/sec01/rapport.md de la tâche. Prochaine étape : SEC-03 ; autorisation spécifique du test distant de privilèges toujours requise.

- Cadrage client démarré : objectif confirmé par le propriétaire (gestion des commandes clients et des livreurs). Guide de découverte préparé dans docs/CADRAGE_CLIENT.md ; aucun entretien ni choix de segment déclaré validé. PROD-01–04 restent ouverts. Aucun code modifié.

- Réorientation V1 demandée par le propriétaire après cadrage : temps, organisation et visibilité des étapes + GPS confirmés comme difficultés observées ; portail client confirmé comme entrée principale. Entretiens et prospection différés sans suppression. Les 53 tâches initiales, leurs identifiants et les statuts acquis sont conservés ; six tâches ajoutées pour recette, prise en charge, échanges, suivi partagé, mesures internes et validation V1. Aucun code applicatif modifié.

- Reprise V1 — PROD-03 et V1-RECETTE formalisées dans docs/RECETTE_V1.md : périmètre retenu selon cadrage propriétaire, exclusions explicites et 14 scénarios avec rôle, action, attendu, état de preuve et tâches liées. Lecture ciblée : démarrage horodaté présent, fil tripartite de commande non trouvé, erreurs GPS ignorées et envois hors mission observés dans le code. Aucune nouvelle exécution navigateur, aucun code applicatif modifié. Les cases de scénarios et V1-GO restent ouvertes. Prochaine correction technique : SEC-03 en local.

- 2026-09-27 — SEC-03 corrigée et testée localement : délégation réservée aux administrateurs principaux, périmètre entreprise conservé, aucun droit implicite ; interface adaptée. 28 tests réussis, types et lint OK avec 24 avertissements. R13 reste ouverte pour suspension, Storage et recette complète. Tentative SEC-04 refusée avant exécution par le contrôle automatique pour risque sur l’authentification globale ; proposition préparée, aucun changement SEC-04 appliqué.

- 2026-09-28 — SEC-04 terminée localement après autorisation explicite : statuts contrôlés et droits relus à chaque requête ; synchronisation suspendue refusée avant écriture ; démo contrôlée. `npm run check` réussi : 39 tests dont 11 nouveaux, types/lint OK (24 avertissements préexistants). Tests en mémoire avec I/O simulées, pas de suspension distante ni de déploiement. Coût des lectures et E2E connecté à vérifier avant mise en service. Suite : SEC-05/06.

- 2026-09-28 — SEC-05 implémentée localement : invitations, récupération, confirmation de l’inscription entreprise, suppression des mots de passe temporaires et de leur persistance, purge héritée et déconnexion contrôlée. 52 tests réussis ; contrôles navigateur isolés. SEC-05 reste ouverte pour configuration SMTP/Supabase et recette e-mail réelle. Modèles et protocole livrés ; aucun envoi distant ni déploiement.

- 2026-10-05 — SEC-06 terminée : six tests dédiés, 58 tests locaux réussis et matrice connectée 41/41 sur deux entreprises, admin, mini-admin, client et chauffeur. Exposition REST verrouillée sur 17 tables ; Prisma opérationnel ; lectures/écritures/PDF/messages/photos isolés ; lien signé expiré refusé. Mini-admin temporaire supprimé de la base et de l’authentification. Aucun déploiement ni contenu métier modifié.
- 2026-10-05 — OPS-02A terminée : création standard/coursier et parcours internes regroupés en transactions ; pannes commande/articles/livraison sans donnée partielle. 63 tests locaux réussis. Recette connectée standard + course réussie, données fictives supprimées et zéro résidu. Aucun schéma, migration ou déploiement modifié. Suite : OPS-02B.
- 2026-10-05 — Statuts audités et copies synchronisées : 14 éléments terminés sur 65 dans la TODO, 1 scénario terminé sur 14 dans la recette. Preuves des tâches cochées retrouvées ; SEC-05 reste volontairement ouverte. Les mentions obsolètes de SEC-06 et OPS-02A ont été corrigées. Règle de synchronisation ajoutée à AGENTS.md.
- 2026-10-08 — OPS-02B terminée : idempotence des commandes, tâches persistantes pour dispatch/notifications, reprises bornées, visibilité et relance des échecs. 75 tests locaux réussis, build production valide et recette connectée concurrente réussie ; affectation sans chauffeur refusée, nouvelle table protégée, données fictives nettoyées. Aucun déploiement. Suite : DISPATCH-1 et ACK-1.
- 2026-10-09 — DISPATCH-1 terminée : conflits d’affectation et de capacité sérialisés, règles dures non forçables, réaffectation et annulation après démarrage tracées, suppressions destructrices limitées. 81 tests locaux, build production et 14 scénarios connectés réussis ; zéro fixture résiduelle. R03 validé, R04 partiellement avancé. Aucun schéma ni déploiement. Suite : ACK-1.
- 2026-10-09 — ACK-1 inspectée et préparée : confirmation distincte du départ nécessaire ; date nullable proposée, scripts non appliqués et recette détaillée prêts. Escalade modèle/DB-1 signalée avant mutation du schéma. Contrôle de référence : 81/81 tests réussis ; ACK-1 et R04 restent ouvertes, aucune nouvelle validation fonctionnelle ni modification de base.

- 2026-10-11 — Clôture ACK-1 après recette du 10 octobre : prise en charge explicite distincte du départ, refus/réaffectation et concurrence protégés. 93 tests, build, 26 contrôles connectés et 5 scénarios navigateur réussis ; zéro fixture résiduelle. Migration additive contrôlée, aucune acceptation historique fabriquée. R04 cochée ; DB-1 et MAP-1 restent ouvertes avec limites consignées. Rapport : docs/rapports/2026-10-11/ack1.md. Suite : BILL-02.

- 2026-10-12 — Clôture BILL-02 après recette du 11 octobre : facture et paiement indépendants des états logistiques, permissions dédiées, compteurs et dates préservés, concurrence sans écrasement. 102 tests, build et 72 contrôles connectés réussis ; zéro fixture résiduelle. Reprise historique préparée et testée sur fixture uniquement. R11 cochée ; aucune migration ni publication. Suite : COMM-1.

- 2026-10-12 — COMM-1 terminée : échanges client/admin/chauffeur par commande, notes internes protégées, notifications durables et accès réévalués après réaffectation. 113 tests locaux, build et 64 contrôles connectés réussis ; migration additive vérifiée, zéro fixture résiduelle. R05 cochée ; DB-1 et MAP-1 restent ouvertes. Rapport : docs/rapports/2026-10-12/comm1.md. Suite : ALERT-1.

- 2026-10-12 — ALERT-1 terminée : dépassement de date demandée et incidents COMM-1 traitables, actions/résolution durables et droits réévalués. 128 tests locaux et build réussis ; recette A/B et navigateur, concurrence et nettoyage documentés. Aucun schéma ni canal externe ajouté. Limite audit P1017 après cleanup explicitée ; R10, DB-1 et MAP-1 restent ouverts. Rapport : docs/rapports/2026-10-12/alert1.md. Suite : TRACK-1.

- 2026-10-13 — TRACK-1 terminée : suivi commun et règles de publication/exposition service/mission, fraîcheur explicite, historique filtré et droits A/B. 144 tests, build, 79 assertions connectées et captures des trois rôles ; audit global zéro résidu, préexistants conservés. Aucun schéma ni déploiement. R06/R07/R08 restent ouvertes pour qualification complète et téléphone réel. Rapport : docs/rapports/2026-10-12/track1.md. Suite : POD-1.
- 2026-10-13 — POD-1 terminée : validation structure/taille avant stockage, preuves privées sans chemin brut, retry idempotent, conflit explicite et nettoyage des uploads non attachés/orphelins. 148 tests, build et 55 assertions connectées ; empreinte préexistante restaurée, zéro résidu. R09 reste ouverte uniquement pour coupure réelle pendant upload/reconnexion, traitée avec MOB-01B. Rapport : docs/rapports/2026-10-13/pod1.md. Suite : DATA-01.

- 2026-10-14 — DATA-01 terminée : historique admin/client paginé, recherché et filtré côté serveur ; exports CSV complets, stables et cloisonnés. 152 tests, build et recette connectée sur 1 000 commandes A + 7 B réussis ; empreinte préexistante restaurée. R12 cochée. Rapport : docs/rapports/2026-10-14/data01.md. Suite : MOB-01A.

- 2026-10-14 — MOB-01A terminée : états GPS et réseau honnêtes visibles, succès fondé sur la confirmation serveur, péremption locale/partagée cohérente et arrêt hors service effectif. Erreur SSR Leaflet de navigation corrigée. 157 tests, build et recette connectée réussis ; empreinte préexistante restaurée. R07/R08 restent ouvertes pour appareils physiques et parcours terrain. Rapport : docs/rapports/2026-10-14/mob01a.md. Suite : UX-01.

- 2026-10-15 — UX-01 terminée : progression immédiate, attentes GPS/proximité bornées à 6 + 8 s, confirmation hors zone explicite et réutilisation du signal frais sans acquisition répétée. 163 tests, types/lint, build et recette navigateur isolée réussis ; aucune donnée distante touchée. Rapport : docs/rapports/2026-10-15/ux01.md. Suite : MOB-01B/C et MAP-1/2 selon leurs dépendances.

- 2026-10-15 — PERF-01 terminée : navigation et connexion des trois espaces mesurées avant/après en dev et production ; auth fraîche, agrégations, pool borné, préchargement ciblé, revalidation et accès photo privé corrigés. 195 tests, build et budgets de référence réussis ; retour visuel 1,3 ms, portail monté frais en 13,93 s après annulation admin. Empreinte métier restaurée et zéro fixture résiduelle ; aucun serveur temporaire conservé. La stratégie expérimentale de jointure a ensuite été retirée le 16 octobre après une panique reproductible sous concurrence, sans réintroduire de cache d'autorisation. Rapport : docs/rapports/2026-10-15/perf01.md. Suite : MAP-3.

- 2026-10-16 — MAP-3 techniquement terminée : direction noir/blanc commune aux cartes admin/client/livreur, fond monochrome, trajets, marqueurs, panneaux, HUD, progression et panne fournisseur simplifiés. 199 tests, build 96 pages et recette locale ordinateur/mobile réussis ; preuves dans `docs/rapports/2026-10-15/map3.md`. Case laissée ouverte uniquement pour la validation visuelle explicite du propriétaire, exigée par son critère de fin.

- 2026-10-16 — MOB-01B terminée : statuts et preuves chauffeur conservés avant envoi dans une file IndexedDB isolée, reprise automatique et bornée, état d'attente/refus visible et une seule action par mission. Rejeux serveur sans deuxième transition ni deuxième photo. 209 tests, build 96 pages et recette Chrome IndexedDB réussis ; aucune base distante touchée. R09 cochée. Rapport : `docs/rapports/2026-10-16/mob01b.md`. Suite indépendante : ONBOARD-1 ou UX-02 ; MOB-01C attend les téléphones.

- 2026-10-16 — UX-02 terminée : le lien connexion → inscription quitte la transition client RSC qui constituait l'unique couche défaillante de l'ancienne recette et utilise une navigation document fiable. Accès direct, chargement, retour, cache chaud et rechargement validés dans Chrome ; clics modifiés préservés. 211 tests, types/lint et build 96 pages réussis ; aucune donnée distante touchée. Rapport : `docs/rapports/2026-10-16/ux02.md`.

- 2026-10-16 — UI-2 terminée : huit écrans essentiels admin/client/chauffeur rendus utilisables au clavier et à 390 px, erreurs de commande reliées et visibles, menu mobile à focus maîtrisé, suivi borné, contrôles nommés et contrastes AA vérifiés. 214 tests, build 96 pages et deux recettes Chrome réussis ; aucune donnée métier touchée. Rapport : `docs/rapports/2026-10-16/ui2.md`.

- 2026-10-16 — TEST-2 terminée : une commande unique rejoue 214 tests locaux, une recette connectée A/B avec livraison, échec et facture, puis les trois rôles dans Chrome avec refus d’accès et panne 503 visible. Toutes les fixtures temporaires sont supprimées, le contrôle anti-secret passe, le build produit 96 pages et aucune trace persistante n’est conservée. Rapport : `docs/rapports/2026-10-16/test2.md`. Point d’entrée prêt pour CI-1 : `npm run test:v1`.

- 2026-10-16 — SUPPORT-1 terminée : boîte de réception équipe, historique, réponse, statuts, notifications client et réouverture intégrés ; canal TutelLiv et objectif d'un jour ouvré affichés. 217 tests, recette A/B sans résidu, parcours Chrome des rôles, concurrence réponse/résolution, build 98 pages et frontières 403 validés. L'e-mail reste dans EMAIL. Rapport : `docs/rapports/2026-10-16/support1.md`.

- 2026-10-16 — DOC-1 terminée : documentation courante réconciliée avec l'architecture, les vingt modèles, le RBAC, les variables, commandes et limites ; index, exploitation et dépannage ajoutés. Vérification de 29 documents, installation neuve, génération Prisma, 217 tests, serveur local et `/login` 200 réussis sans secret ni base distante. L'audit npm signale séparément 28 entrées vulnérables à traiter dans CI-1. Rapport : `docs/rapports/2026-10-16/doc1.md`.

- 2026-10-16 — LINT-1 terminée : les 20 avertissements encore présents dans 15 fichiers sont supprimés et `next lint` remplacé par ESLint strict sur le code applicatif, sans désactivation globale. Types, lint, 217 tests locaux, deux parcours E2E, build 98 pages, documentation et diff-check réussis. Rapport : `docs/rapports/2026-10-16/lint1.md`.

- 2026-10-16 — CI-1 avancée sans déploiement : Next.js critique corrigé de 15.5.19 à 15.5.28, PostCSS/Sharp sécurisés et audit de production ramené à zéro vulnérabilité. Installation propre, 217 tests, deux E2E et build 98 pages réussis. Six alertes restent circonscrites au linter de développement faute de correctif compatible. CI-1 reste ouverte pour la préproduction et le retour arrière. Rapport : `docs/rapports/2026-10-16/ci1-dependencies.md`.

- 2026-10-16 — ONBOARD-1 avancée : un écran guidé regroupe sept étapes fondées sur l'état réel. Entreprise fictive, trois rôles, commande et livraison avec preuve atteignent 7/7 en 45,4 s automatisées, puis nettoyage sans résidu ; 220 tests, 3/3 scénarios E2E et build de 100 pages réussis. Le jalon reste ouvert pour un pilote réel, les invitations e-mail et la décision d'import. Rapport : `docs/rapports/2026-10-16/onboard1-internal.md`.

- 2026-10-16 — OPS-01 terminée : les commandes récurrentes deviennent des occurrences durables uniques avant avancement, le worker draine les lots et signale tout reliquat/échec, et les dates UTC conservent l'ancre de fin de mois. 100 échéances simulées, reprise après panne, recette connectée, 226 tests et build de 100 pages réussis ; zéro résidu, aucune migration ni publication. Rapport : `docs/rapports/2026-10-16/ops01.md`. Suite indépendante : SPECIAL-1.

- 2026-10-16 — SPECIAL-1 terminée par qualification et exclusion pilote : demande multi-adresses, conversion après accord externe, affectation, preuve, facture et frontières A/B réussies en recette connectée ; transitions trompeuses bloquées, catégorie désactivée par défaut, limites visibles et zéro résidu. 230 tests, types/lint, documentation et build de 100 pages réussis. Le devis chiffré/versionné et son acceptation client restent absents, donc la fonction n'est pas promise au pilote. Rapport : `docs/rapports/2026-10-16/special1.md`. Suite : BILL-01A attend une décision propriétaire ; poursuivre une tâche indépendante non bloquée.

- 2026-10-16 — DEMO-1 terminée : chaque navigateur reçoit une entreprise fictive et trois personas isolés ; une reconnexion conserve sa session, un reset A ne touche pas B. La recette à deux sessions + reset réussit en 36,7 s après parallélisation, puis nettoyage sans résidu ; 230 tests, documentation et build de 100 pages passent. Aucun schéma, compte Supabase, migration ou entreprise réelle modifié. Rapport : `docs/rapports/2026-10-16/demo1.md`. Suite indépendante : préparer les éléments locaux d'OPS-03A/B sans prétendre valider l'hébergeur.
- 2026-10-16 — OPS-03B avancée localement : santé publique/profonde, contrôle base/Storage/file, incidents structurés des crons et erreurs serveur non gérées, nettoyage des secrets et procédure d'incident ajoutés. Une panique Prisma 5.22 sous 20 lectures auth concurrentes a été reproduite puis supprimée en retirant la stratégie expérimentale `relationJoins` ; 20/20 lectures réussissent ensuite, sans mutation. 235 tests, documentation et build de 100 pages passent. Le jalon reste ouvert pour le branchement d'un vrai canal, la désignation d'un responsable et une panne simulée sur préproduction. Rapport : `docs/rapports/2026-10-16/ops03b-local.md`.

- 2026-10-17 — CI-1 avancée : workflow GitHub Actions ajouté avec contrôles locaux sans secret et recette TEST-2 manuelle sur environnement protégé. La chaîne locale exacte a été rejouée dans une copie neuve sans `.env.local` ; 235 tests, 36 documents, audit de production et build de 100 pages passent. Scanner local : zéro détection sur 792 fichiers. Le dépôt `origin` existe mais aucun push, secret de préproduction, déploiement ou retour arrière n'a été effectué ; CI-1 reste ouverte derrière ENV-1 et DB-1. Rapport : `docs/rapports/2026-10-17/ci1-workflow.md`.

- 2026-10-17 — ENV-1 inventoriée localement sans secret : une seule cible de test est configurée, avec origine locale, Supabase distant, runtime poolé et accès direct séparé. GitHub/Vercel sont reliés localement, mais aucune préproduction ou production distincte n'est identifiée ; e-mails réels et webhook restent désactivés. La matrice de création et de contrôle des trois cibles est écrite. Zéro mutation et zéro valeur dévoilée ; ENV-1 reste ouverte pour accès fournisseur, coût et création effective. Rapport : `docs/rapports/2026-10-17/env1-inventory.md`.

- 2026-10-17 — DB-1 avancée en lecture seule : le diff initial de onze opérations a révélé cinq actions référentielles et un défaut de colonne déjà déployés mais mal représentés. `schema.prisma` est aligné, client régénéré et diff cible → schéma ramené à zéro sans mutation distante. Baselines Prisma et sécurité générées comme brouillons hors migrations ; vingt tables RLS, aucun droit public et absence de `_prisma_migrations` consignés. DB-1 reste ouverte jusqu'à l'essai sur préproduction, au marquage contrôlé et à la reprise. Rapport : `docs/rapports/2026-10-17/db1-inventory.md`.

- 2026-10-18 — V1-GO automatisable complétée : R01, R02, R06 et R10 rejouées dans Chrome sur le build de production. Double clic, collecte obligatoire, proximité, vraie preuve PNG, échec motivé et vues client/admin concordantes passent en 4,1 minutes ; contrôles accessibles nommés, cinq captures, aucune erreur de page et zéro résidu. V1-GO reste ouverte uniquement derrière MOB-01C, e-mails réels, préproduction isolée et restauration. Une jauge automatique affiche désormais l'avancement global en tête de TODO et synchronise la copie de partage du projet.

- 2026-10-18 — DATA-02 avancée : archive privée JSON + preuves originales et manifeste SHA256, vérificateur hors ligne, garde-fous entreprise/commande/livraison et copie bornée. Huit tests dédiés, 243 tests totaux, recette A/B finale et nettoyage DB/Storage sans résidu réussis. Conservation, remise et restauration restent ouvertes ; rapport `docs/rapports/2026-10-18/data02-proof-archive.md`.

- 2026-10-18 — DATA-02 avancée : exécuteur de lot et route de cron locale préparés pour les seules démos expirées déjà éligibles. Double garde secret/autorisation, lot borné à 100, reliquat et incidents agrégés sans identifiant ; 271 tests réussis. Aucun horaire, déploiement ou nettoyage connecté en écriture activé ; DATA-02 reste ouverte. Rapport `docs/rapports/2026-10-18/data02-demo-scheduler.md`.

- 2026-10-18 — DATA-02 avancée : les anciennes sessions sans échéance sont maintenant fermées au rejeu de cookie et inventoriées sans identifiant. Les 51 candidates ont uniquement l'échéance absente ; graphes DB, Storage et références interentreprises sont propres, sans aucune mutation. 275 tests et build 102 pages réussis. Toute adoption ou suppression reste une décision explicite. Rapport `docs/rapports/2026-10-18/data02-legacy-demos.md`.
- 2026-10-20 — Démo permanente de préproduction installée sur la cible isolée : un compte Auth, une entreprise modèle, huit utilisateurs et huit livraisons fictives. Les visiteurs obtiennent une société temporaire distincte, supprimée lors d'une déconnexion explicite ou rendue inaccessible après huit heures. La fixture CI préserve le modèle exact et refuse tout autre état préalable. Parcours réel connexion → session isolée → déconnexion → retour au seul modèle vérifié. Première création mesurée à 83 s et nettoyage serveur à 39 s : régression P0 enregistrée avant ouverture publique. L'ancienne cible et ses 51 démonstrations restent intactes.

- 2026-10-18 — Jauge et documentation réconciliées : la copie externe `TODO-TutelLiv-vente.md` est désormais synchronisée automatiquement depuis une configuration locale ignorée par Git, avec recalcul idempotent vérifié. Document de vision commerciale actualisé aux fonctions réellement qualifiées au 18 octobre : navigation, support, reprise réseau, retards, onboarding interne et export privé ; aucune validation terrain ou commerciale ajoutée.

- 2026-10-18 — BILL-01B terminée sur la branche export V1 décidée par BILL-01A : CSV comptable privé versionné, 29 colonnes, périodes UTC/statuts explicites, Decimal, lecture cohérente par lots, limites de volume, versions et données historiques qualifiées. 261 tests, build isolé 101 pages, recette connectée 1 001 documents A + 1 B avec écriture concurrente entre lots et zéro résidu ; relevé opérationnel de 160 lignes/neuf pages contrôlé. Aucune émission réglementaire, avoir automatique ou immutabilité légale complète revendiqués. Rapport `docs/rapports/2026-10-18/bill01b.md`.

- 2026-10-20 — ENV-1 terminée : branche `preproduction`, Preview Vercel protégée, projet Supabase isolé et secrets propres configurés sans modifier `main` ni la cible historique. La chaîne GitHub distante du commit `f6e19cc` réussit la garde, 279 tests, TEST-2, trois parcours Chromium, la preuve nettoyée et le nettoyage `always()` ; Vercel confirme le déploiement. Le contrôle direct final retrouve zéro utilisateur Auth, deux migrations, zéro drift, RLS partout et bucket privé. Rapport `docs/rapports/2026-10-20/preproduction-ci.md`. Suite : CI-1 pour le retour arrière applicatif, DB-1/OPS-03A pour la restauration base + Storage.

- 2026-10-20 — CI-1 terminée : la Preview isolée a été ramenée vers le commit sain `f6e19cc` en 1 min 39 s, puis remise sur le commit courant `04a0a35` en 2 min 11 s. Les deux reconstructions sont `Ready`, l'alias de branche suit le commit courant, la base reste conforme et vide d'utilisateur Auth, `main` et la production n'ont pas bougé. Sur Preview Hobby, le retour arrière documenté redéploie le commit sain avec les réglages actuels car Instant Rollback est indisponible. Rapport `docs/rapports/2026-10-20/ci1-rollback.md`.

- 2026-10-21 — DB-1 terminée : les deux migrations ont reconstruit deux schémas temporaires strictement bornés sur la préproduction isolée ; un graphe fictif couvrant les vingt tables a été exporté et restauré avec vingt empreintes identiques. RLS, références RBAC, absence de drift et rejeu sans migration restante passent. Les schémas temporaires ont été supprimés et le schéma public, ses données ainsi que Storage sont restés inchangés. La cible historique et ses 51 démonstrations n'ont pas été touchées. Rapport `docs/rapports/2026-10-21/db1-migration-restore.md` ; restauration complète du service et de Storage suivie dans OPS-03A.

- 2026-10-21 — Deux exigences UX ajoutées sans modifier le produit : UX-03 fait de la livraison la fiche opérationnelle centrale avec client, délais, chronologie et preuve, tandis que la référence de commande devient secondaire mais reste accessible ; UX-04 réduit les boutons, rangées et explications permanentes en exigeant des actions compréhensibles par leur emplacement et leur nom. Les deux tâches complètent DESIGN-1 et conservent les acquis d'accessibilité, de sécurité et de performance.

- 2026-10-21 — La cible Supabase historique a été mise en pause après confirmation que ses données restantes étaient fictives. L'inventaire final a trouvé cinquante-deux anciennes sessions et une société démo de base ; aucune donnée n'a été supprimée. La préproduction est restée entièrement conforme. Un emplacement Free est désormais disponible pour la cible temporaire de restauration OPS-03A. Rapport `docs/rapports/2026-10-21/supabase-legacy-pause.md`.

- 2026-10-21 — OPS-03A terminée : l'export officiel de la cible historique a été restauré sur un troisième projet Supabase Free isolé. Les 58 tables attendues et tous leurs compteurs correspondent ; 25 comptes Auth sont visibles, les vingt tables publiques ont RLS active, 438 commandes et 438 livraisons sont retrouvées. Les deux preuves PNG du bucket privé sont restaurées et identiques par téléchargement direct et URL signée. Import SQL 2 min 12 s, phase Storage 3,298 s, manifeste SHA-256 vert, aucun secret dans les preuves. Rapport `docs/rapports/2026-10-21/ops03a-provider-restore.md`. Le RPO d'une heure reste une porte de RELEASE-1 car le plan Free n'automatise pas ce point et n'inclut pas les fichiers Storage.

- 2026-10-22 — SIGNUP-1 terminée : cinq étapes persistantes de l'offre à l'activation, prix et quotas serveur, confirmation e-mail gérée, paiement fictif Preview, transaction atomique, bienvenue durable et passage vers ONBOARD-1. Paiements refusés/en attente/rejoués, mensuel/annuel, concurrence SIREN, isolation et première livraison fictive réussissent ; 308 tests, build de 106 pages et quatre migrations SIGNUP-1 de préproduction passent, avec nettoyage exact. Aucun paiement réel ni changement Production. Rapport : `docs/rapports/2026-10-22/signup-1.md`.

- 2026-10-23 — Régression de confirmation SIGNUP-1 corrigée : les journaux Supabase montrent que le premier clic avait bien validé l'adresse mais redirigeait vers la Site URL restée sur `localhost`, puis les rejeux étaient normalement refusés. La Site URL et la redirection exacte de Preview sont corrigées ; l'application traite désormais le fragment de session du modèle Supabase gratuit et conserve le mode `TokenHash` futur. 309 tests, types/lint et build de 106 pages passent ; aucune donnée de production touchée.

- 2026-10-23 — Renvoi de confirmation SIGNUP-1 ajouté : bouton avec compte à rebours de trente secondes, garde serveur persistante et réservation atomique empêchant les doubles envois concurrents. Migration additive appliquée uniquement à la préproduction isolée et enregistrée dans Prisma ; 311 tests, types, lint, build, CI et Preview passent. La limite Supabase gratuite reste de soixante secondes jusqu'au SMTP personnalisé ; aucun changement Production.

- 2026-10-23 — SIGNUP-1 : retour arrière avant paiement. Formule, options et informations d'entreprise restent corrigeables jusqu'à confirmation du paiement fictif ; l'e-mail déjà vérifié reste verrouillé. Aucun paiement réel ni changement Production.

- 2026-10-23 — SIGNUP-1 : confirmation Auth orpheline rattachée au rafraîchissement, et retour arrière autorisé tant qu'aucun utilisateur TutelLiv n'existe encore pour ce compte.

- 2026-10-23 — SIGNUP-1 vérifiée après reprise externe : 315 tests, types/lint, garde préproduction, scanner de secrets, build de 106 pages, CI distante, Preview et recette connectée passent avec nettoyage exact. Le clic réel Entreprise → Options → Entreprise conserve les saisies ; un saut vers une étape future sans enregistrer les options, découvert pendant la recette, est désormais interdit. Supabase conserve un intervalle fournisseur de 60 s tant qu'aucun SMTP personnalisé n'est configuré.

- 2026-10-23 — OPS-03B terminée : la préproduction protégée est sondée depuis Supabase toutes les trente minutes grâce à un jeton Vercel dédié conservé dans Vault. Baseline réelle HTTP 200 et dépendances `ok`, panne fictive alertée en 80 ms, reprise réelle alertée en 1 369 ms, état final sain et un seul cron actif. Le schéma privé est inaccessible à `anon` et `authenticated`, le scanner trouve zéro secret et aucune donnée métier n'a été mutée. Le canal e-mail réel reste suivi séparément dans EMAIL. Rapport `docs/rapports/2026-10-23/ops03b-preproduction-monitor.md`.

- 2026-10-27 — TRACK-2 terminée : dernier signal sous le nom du livreur sur toutes les cartes ; livreur qui roule comme un GPS le long de l'itinéraire calculé par le serveur (virages ralentis, feux simulés, jamais de ligne droite), trace effacée derrière lui ; pastille verte, jaune (estimé) puis rouge (signal perdu après 3 min, arrêt au point atteint) ; démo en direct/estimé/perdu alignée sur les cartes. `npm run check` vert (660 tests) ; conduite (30 km/h, ralentis 8–20 km/h, arrêts aux feux), fluidité, trace, pastilles, suivi client, axe et console contrôlés en démo. Aucune migration ni push. Suite : MOB-01C pour le GPS physique.

- 2026-10-27 — DATA-02, export en flux : export et archive écrits par pages de 100 lignes dans une même transaction en lecture répétable ; `company.json` écrit en flux et plafonné à 1 Gio sur disque. Contrat 5/5, archive 8/8, `npm run check` 689/689, recette connectée `tutelliv-dev` réussie sous Node 22.18.0 sans résidu, pages de 1 et de 100 identiques sur une base réelle. DATA-02 reste ouverte (LEGAL-1, remise chiffrée, sauvegardes). Aucune migration ni push.

- 2026-10-27 — SAAS-03, moyen de paiement et factures : portail Stripe limité au changement de carte et aux factures, ouverture journalisée sans le lien, lien « Voir la facture » limité à `invoice.stripe.com`. Tests 6/6, `npm run check` 700/700, Playwright sur le serveur déjà lancé, essai réel sur le compte Stripe de test. SAAS-03 reste ouverte (options en libre-service, export, concurrence A/B). Aucune migration ni push.

- 2026-10-27 — SAAS-02, rapprochement fournisseur : script en lecture seule qui compare le journal aux factures Stripe facture par facture, avec l'encaissé du mois à la date de paiement. Tests 10/10, `npm run check` 706/706, essai réel concordant (5 comptes, 8 factures, 764,78 € HT, aucun écart). PERF-02 et la clôture d'ENV-2 sont reportées : elles lancent leur propre serveur Next ou un build, alors que l'agent design utilise le même `.next` (port 3121). Aucune migration ni push.

- 2026-10-27 — SAAS-02, remboursements : déduits du net de la santé SaaS (HT au prorata, mois de la facture), le brut restant inchangé. Tests 11/11, `npm run check` 710/710, lecture réelle identique au rapprochement (756,45 € HT nets). Recette navigateur de `/admin` à faire avec un compte super-administrateur. Aucune migration ni push.

- 2026-10-27 — SAAS-03, options en libre-service : ajout et retrait d'options et de comptes depuis « Mon abonnement », par l'aperçu et le changement existants. Tests 24/24, `npm run check` 712/712, Playwright, aperçu réel sur le compte Stripe de test. Constat : `test:saas01b` échoue depuis `a44721a` (verrou gardé après un refus fournisseur), aussi sur le dernier commit ; à aligner. Aucune migration ni push.

- 2026-10-27 — UX-03, inventaire : fiches par rôle et entrées vers une livraison consignées dans `docs/operations/ux03/INVENTORY.md` ; trois écrans différents pour une même livraison dans le back-office. Choix de la fiche canonique soumis au propriétaire. Aucun code modifié.

- 2026-10-27 — UX-03, page livraison : `/dashboard/deliveries/[id]` créée selon la décision du propriétaire ; la ligne de dispatch, la carte et le support y mènent. `npm run check` 714/714, Playwright sur une livraison démo réelle. Aucune migration ni push.

- 2026-10-27 — UX-03, retard et prochaine action : règle serveur `deliveryTiming` (même retard que le tableau de bord), affichée en tête de la fiche livraison. `npm run check` 716/716, Playwright. Aucune migration ni push.

- 2026-10-27 — SAAS-01B/SAAS-03, verrou : un refus Stripe ne bloque plus le compte pour de bon ; le verrou n'est gardé qu'en cas d'effet partiel (`BILLING_PARTIAL_EFFECT`). `test:saas01b` vert (17 contrôles), `npm run check` 719/719. Aucune migration ni push.

- 2026-10-27 — UX-03, variantes et alertes : alertes et tableau de bord vers la fiche livraison ; échéance et retard pour le client et le livreur, sans consigne interne. Playwright 4/4 sur la démo, `npm run check` 721/722 (seul échec : test de la mini-démo d'accueil en cours chez l'agent design). Aucune migration ni push.

- 2026-10-29 — Bilan de l'intégration du 28 octobre (`integration/2026-10-28`, neuf chantiers : fiabilité, sécurité, design du portail, preuve de livraison, Factur-X, commande par message, dispatch GPS, facturation et correctifs Codex). `npm run check` 1145/1145 sur 557e9d5, build à 146 pages, recette navigateur sans défaut bloquant ni important, audit Codex favorable côté code au complément 3 (C3 et C4 corrigés), avec réserves. Cinq migrations appliquées sur tutelliv-dev uniquement ; rien n'est poussé et la préproduction n'est pas mise à jour. DEMO-3 (tranches 1, 2, 3, 5, 6) et DESIGN-1 (tranche portail) restent ouvertes avec leur état ; sept tâches ajoutées : FACTURX-1, INTAKE-1, POD-2, OPS-FIAB, SEC-AUDIT, RECETTE-2810 et PROPRIO-2810, toutes ouvertes. Aucune case cochée : aucune validation terrain, pilote ou propriétaire.
