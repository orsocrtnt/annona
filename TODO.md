# TODO TutelLiv — du produit existant au SaaS vendable


<!-- TODO_PROGRESS_START -->
## Progression globale

**45 tâches terminées sur 67 — 67 %**

`█████████████░░░░░░░` · 22 tâches restantes

_Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->
Mise à jour : 18 octobre 2026. Source unique des priorités du projet. Cette version consolide l’audit initial, l’audit SaaS, les sondes locales et les tests E2E. La copie dans les outputs de la tâche doit rester synchronisée avec ce fichier.

## Objectif actuel : une V1 fiable prête à être essayée

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

Priorités confirmées le 18 octobre 2026 pour les tâches encore ouvertes :

- **P0 — Sécurité, stabilité et blocages :** DB-1, LEGAL-1, DATA-02. PERF-01 et les principales frontières SEC sont déjà terminées ; toute régression mesurable redevient P0.
- **P1 — Préproduction et exploitation :** ENV-1, SEC-05, CI-1, OPS-03A, OPS-03B, EMAIL, MOB-01C.
- **P2 — Validation V1 et préparation des pilotes :** MAP-3, ONBOARD-1, V1-GO, PROD-02, PROD-04.
- **P3 — Offres, quotas et permissions :** BILL-01B, OFFER-1, SAAS-01A, SAAS-02.
- **P4 — Pilotes et commercialisation autonome :** PILOT-1, PILOT-2, GROWTH-1, RELEASE-1.
- **P5 — Paiement et extensions commerciales :** SAAS-01B, SMS. L'attribution et les commissions sont intégrées à SAAS-01A/B sans créer un CRM.

Les dépendances de sécurité et de validation priment sur le numéro : une tâche P3 peut être préparée localement, mais ne doit pas contourner une porte P0/P1 pour utiliser des données réelles.

1. **PERF-01 terminée le 15 octobre 2026.** Navigation des trois espaces mesurée en dev et production, causes dominantes corrigées et budgets de référence vérifiés. Rapport : docs/rapports/2026-10-15/perf01.md.
2. **MAP-3 est techniquement terminée ; revue visuelle groupée différée par le propriétaire.** Le rendu noir/blanc est en place et ne bloque pas les tâches indépendantes.
3. **DISPATCH-2 terminée le 16 octobre 2026.** Les retards ouvrent la livraison exacte dans le dispatch et sur la carte, avec URL, pagination, focus et frontière entreprise vérifiés.
4. PROD-03, V1-RECETTE et V1-MESURE sont établies. La baseline automatisée reste distincte de la future mesure humaine et des gains clients.
5. SEC-01/02/03/04/06 sont terminées. SEC-05 reste ouverte pour la configuration e-mail réelle ; préparer ENV-1 et DB-1 lorsque les accès sont disponibles.
6. OPS-02A, OPS-02B, DISPATCH-1, ACK-1, BILL-02, COMM-1, ALERT-1, TRACK-1, POD-1 et DATA-01 sont terminées.
7. TRACK-1, MOB-01A/B, UX-01 et MAP-1/2 sont terminées. MOB-01C reste à valider sur téléphones avec l’opérateur disponible.
8. Après PERF-01, MAP-3 et DISPATCH-2, terminer les jalons internes d’onboarding, tests, exploitation et recette V1. Les dépendances techniques de chaque tâche priment sur cet ordre de lecture.
9. Reprendre entretiens, offre et pilotes plus tard, puis automatiser les abonnements. Leur report ne bloque pas le travail sur données fictives, mais ne supprime pas les exigences avant usage réel ou vente.

La réorganisation du plan n’autorise pas à implémenter tout le backlog. La reprise a permis de formaliser PROD-03 et V1-RECETTE ; la recette complète V1-GO reste ouverte.

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

- [x] **SEC-06 — Vérifier toutes les frontières d’accès et le stockage.** Couvrir API, exports, PDF, photos, rôles et accès directs Supabase ; inspecter politiques réellement déployées, sans supposer leur absence.

  Terminé quand : Matrice A/B × admin/mini-admin/client/chauffeur documentée ; refus lecture/écriture/téléchargement hors périmètre, y compris URL signées expirées.

  État final vérifié le 2026-10-05 : faille distante confirmée puis verrouillée après autorisation explicite. RLS activé et zéro droit direct anon/authenticated/PUBLIC sur les 17 tables métier ; REST avec la seule clé publique renvoie 401 sur les 17. Prisma reste opérationnel. Chemins de photos et frontières d’entreprise renforcés sur commandes, livraisons, cartes, factures/PDF, modèles de nouvelle commande et missions chauffeur. `npm run check` : 58 tests réussis, types/lint OK (24 avertissements existants). Bucket privé ; URL publique refusée, lien signé lisible avant expiration puis refusé après expiration.

  Recette connectée : 41/41 contrôles réussis sur A/B × admin/mini-admin/client/chauffeur, dont lectures autorisées, accès et écritures étrangers en 404, interfaces d’un autre rôle en 403, PDF, messages et photos. Le mini-admin fictif temporaire a été supprimé de la base et de Supabase Auth. Aucun contenu métier modifié. Script de retour arrière conservé mais non exécuté. Rapport : docs/rapports/2026-10-01/sec06.md. Aucun déploiement.

  Source / dépendance / blocage : Terminé ; les droits par défaut des futures tables restent dans DB-1.

- [ ] **DB-1 — Versionner les évolutions de base.** Comparer schéma et état de la cible, établir une base de migrations et une stratégie de retour arrière.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : Migration sur copie isolée et procédure de restauration vérifiées ; aucune synchronisation implicite au démarrage.

  Avancement ciblé ACK-1 vérifié le 2026-10-10 : ajout nullable versionné, testé sur copie de 32 livraisons avec export/restauration identiques puis appliqué explicitement à la base de test. Valeurs initiales et RLS préservées. Cette copie partielle ne valide pas baseline globale, relations/politiques complètes, droits des futures tables ou restauration base+photos ; DB-1 reste ouverte. Procédure : `docs/operations/ack1/README.md`.

  Avancement local vérifié le 2026-10-17 : audit de schéma reproductible ajouté. Le premier diff cible → Prisma contenait onze opérations : remplacement de cinq clés étrangères dont l'action de mise à jour déployée était `NO ACTION`, et retrait du défaut déjà présent sur `operation_jobs.updated_at`. Le schéma Prisma a été aligné sur la cible existante, sans écriture distante ; le diff est maintenant vide. La base contient vingt tables publiques, toutes avec RLS, zéro politique et zéro droit direct `anon`/`authenticated`/`PUBLIC`, mais aucune table `_prisma_migrations`. L'empreinte catalogue est strictement identique avant/après. Deux brouillons séparés ont été générés : baseline Prisma de 119 instructions et complément sécurité des vingt tables. Ils sont marqués non applicables et ne couvrent pas Auth/Storage. Validation : 235 tests, types/lint stricts, scripts d'audit lintés, 38 documents, scanner sans détection sur 802 fichiers, diff-check et build de 100 pages réussis. Procédure `docs/operations/db1/README.md`, rapport `docs/rapports/2026-10-17/db1-inventory.md`, preuves `outputs/db1/`.

  Reste à faire : remplacer les identifiants signalés, exécuter TEST-2 sur la Preview, tester une migration additive et sa reprise, puis traiter la cible historique seulement après sauvegarde et autorisation. DB-1 reste ouverte.

  Avancement préproduction du 2026-10-19 : migration initiale versionnée sous `prisma/migrations/20261019000000_initial`, appliquée avec succès sur la cible isolée vide. Le contrôle connecté confirme vingt tables métier, une migration terminée, RLS sur les vingt-et-une tables publiques avec le registre, zéro politique ou droit public, zéro utilisateur Auth, bucket privé conforme et zéro drift Prisma. Script reproductible : `npm run db1:verify-preproduction`. DB-1 reste ouverte pour la rotation des identifiants, TEST-2, une migration additive avec reprise et le traitement séparé de la cible historique après sauvegarde et autorisation.

  Avancement du 2026-10-20 : identifiants remplacés et ancienne clé serveur révoquée. La migration additive `20261019010000_rbac_reference_data` versionne six rôles, trente-trois permissions et cent neuf liaisons ; son application puis un second `migrate deploy` sans migration en attente sont vérifiés. TEST-2 passe sur la cible isolée et la vérification finale retrouve deux migrations, zéro drift, zéro utilisateur Auth et les références exactes. DB-1 reste ouverte pour une restauration complète base + Storage et le traitement séparé de la cible historique après sauvegarde et autorisation.

  Source / dépendance / blocage : Avant nouveaux changements de schéma ; ENV-1.

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

  Terminé quand : une même direction visuelle noir/blanc est cohérente dans les trois espaces sur mobile et desktop ; les informations essentielles restent compréhensibles en quelques secondes ; marqueurs sélectionnés/non sélectionnés, trajet, regroupements, panneau et états dégradés sont distinguables ; comparaison visuelle avant/après validée par le propriétaire.

  Source / dépendance / blocage : préférence explicite du propriétaire le 15 octobre 2026 : les cartes actuelles sont jugées trop chargées et l’ancien style blanc/noir « type Uber » était préféré. Après PERF-01 afin de ne pas confondre refonte visuelle et diagnostic de lenteur. Réutiliser les garanties fonctionnelles de MAP-1/2 et ne pas choisir un fournisseur payant sans décision.

  État technique au 16 octobre 2026 : thème commun noir/blanc appliqué aux cartes administrateur, client et livreur ; fond monochrome, trajets à halo blanc/ligne noire, marqueurs et sélection contrastés, panneaux blancs, HUD et progression simplifiés, panne fournisseur et attribution préservées. Recette locale 1280 × 720 et 390 × 844 sans débordement, `npm run check` réussi (199/199 tests), build Next.js réussi (96 pages) et `git diff --check` réussi. Preuves avant/après et rapport : `docs/rapports/2026-10-15/map3.md`. Blocage restant avant de cocher : validation visuelle explicite du propriétaire, requise par le critère de fin.

  Support de revue préparé le 2026-10-18 : critères et captures disponibles dans `docs/operations/map3/REVIEW.md`. Une nouvelle série homogène admin/client/livreur sera produite sur préproduction avec mission active ; la case reste ouverte jusqu'à l'accord du propriétaire.

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

## 4 — Rendre la V1 simple, testable et exploitable

Préparer ces éléments maintenant. Aucun contact commercial nécessaire pour les jalons internes ; ne pas confondre une archive du code avec une restauration de service.

- [ ] **ONBOARD-1 — Guider jusqu’à la première livraison.** Configuration entreprise, invitation client/chauffeur, tarifs utiles, import validé et première commande avec aide minimale.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Un pilote réalise une livraison test ; temps et interventions mesurés ; import invalide ne corrompt rien.

  Source / dépendance / blocage : Après PROD-03, sécurité et cycle métier.

  Jalon interne prioritaire : rejouer la première livraison avec une entreprise fictive et les trois rôles, en consignant le temps et les aides nécessaires. La validation par un pilote réel reste ultérieure ; ne pas cocher l’ensemble sur la seule recette interne.

  Jalon interne réalisé le 2026-10-16 : écran `/onboarding` réservé à l'administrateur, sept étapes calculées depuis l'état réel et liens vers services, comptes, tarifs, dispatch, commandes et livraison. Une entreprise fictive isolée passe de 2/7 à 5/7, 6/7 puis 7/7 en 45 372 ms automatisées ; tâches asynchrones attendues et résidu nul. 220 tests locaux, test Chrome de l'écran et refus client/livreur réussis. L'invitation e-mail réelle et l'import restent explicitement non validés. Rapport `docs/rapports/2026-10-16/onboard1-internal.md`, procédure `docs/operations/onboard1/README.md`, preuve `outputs/onboard1/connected.json`.

  Reste à faire avant de cocher : exécution par un pilote réel, mesure du temps humain et des interventions, réception des invitations après configuration e-mail, puis décision et validation atomique d'un format d'import si le pilote en a besoin.

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

  Terminé le 2026-10-20 : workflow et branche publiés, job local GitHub vert et Preview Vercel créée sans modifier `main`. La chaîne connectée distante du commit `f6e19cc` est entièrement verte : garde d'isolation, 279 tests, recette A/B, montage temporaire, trois parcours Chromium, preuve sans secret, nettoyage de six sociétés temporaires et artefact de preuve publié. Le contrôle direct final retrouve zéro utilisateur Auth et une base conforme. Le retour arrière Preview vers `f6e19cc` réussit en 1 min 39 s, puis le rétablissement du commit courant `04a0a35` réussit en 2 min 11 s ; l'alias stable suit de nouveau le commit courant. Vercel Hobby ne propose pas l'Instant Rollback pour une Preview : la procédure redéploie le commit sain avec les réglages actuels. Rapport `docs/rapports/2026-10-20/ci1-rollback.md`. La restauration base + Storage reste suivie séparément par DB-1 et OPS-03A.

- [ ] **OPS-03A — Vérifier sauvegarde et restauration.** Inventorier hébergement, base, photos et politiques existantes ; fixer objectifs de perte acceptable et délai de reprise.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : Restauration complète sur cible isolée chronométrée ; contrôle des commandes et photos ; procédure écrite.

  Source / dépendance / blocage : Accès hébergeur requis ; ne pas supposer sauvegardes absentes.

  Acquis partiel : archive locale complète créée et vérifiée après SEC-02, avant SEC-01. Elle ne couvre ni la base Supabase distante ni Storage ; cette tâche reste ouverte.

  Avancement local du 2026-10-17 : inventaire en lecture seule reproductible ajouté. La cible de test utilise PostgreSQL 17.6 (~15 Mio), vingt tables publiques avec RLS, et un bucket `delivery-pods` privé contenant deux objets correspondant à deux références de preuve. Aucun outil `pg_dump` n'est présent dans les emplacements usuels ; la baseline de migrations globale manque toujours. Objectif interne avant vente fixé à RPO ≤ 1 h pour base/photos et RTO ≤ 4 h, sans en faire une promesse avant exercice. Procédure `docs/operations/ops03a/README.md`, rapport `docs/rapports/2026-10-17/ops03a-inventory.md`, preuve `outputs/ops03a/inventory.json`.

  Reste à faire : vérifier plan/rétention dans le compte hébergeur, disposer d'une cible Supabase isolée et des outils compatibles, restaurer base + objets + configuration, chronométrer puis rejouer santé, RLS, Auth, commandes et photos. Aucun de ces contrôles ne peut être remplacé par l'inventaire ; la case reste ouverte.

  Décision du 2026-10-18 : RPO ≤ 1 h et RTO ≤ 4 h retenus comme cibles techniques, sans garantie contractuelle avant exercice. Les simulations sont autorisées exclusivement sur préproduction. L'estimation montre qu'un PITR Supabase 7 jours coûte environ 100 $/mois en plus du plan et couvre PostgreSQL, pas à lui seul les fichiers Storage ; validation de dépense et stratégie de copie des photos requises avant activation.

- [ ] **OPS-03B — Installer diagnostics et alertes utiles.** Suivre erreurs API, jobs, uploads, disponibilité et actions sensibles sans secrets ; procédure d’incident et responsable.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Panne simulée déclenche une alerte exploitable ; diagnostic et reprise documentés.

  Source / dépendance / blocage : Après environnement isolé.

  Avancement local du 2026-10-16 : sonde publique minimale et diagnostic profond protégé ajoutés. La base, le bucket privé et les tâches échouées/bloquées sont contrôlés sans identifiant métier ; un état dégradé renvoie 503. Les crons signalent désormais les échecs terminaux et les files non vidées via un événement structuré, nettoyé avant journal ou webhook HTTPS. Procédure : `docs/operations/ops03b/README.md` ; rapport : `docs/rapports/2026-10-16/ops03b-local.md`.

  Validation locale : 235/235 tests, types/lint stricts, 34 documents, diff-check et build Next.js de 100 pages réussis. La recette connectée en lecture seule confirme 20 lectures auth concurrentes, base/Storage/file sains et zéro mutation. Elle a aussi permis de reproduire puis corriger une panique Prisma 5.22 sous concurrence en retirant `relationJoins`, sans cache d'autorisation. Preuve : `outputs/ops03b/connected.json`.

  Reste à faire : brancher un vrai moniteur/canal sur la préproduction d'ENV-1, désigner son responsable, simuler une panne, recevoir l'alerte puis mesurer le retour à la normale. La case reste ouverte jusque-là.

  Décision du 2026-10-18 : démarrer avec des alertes par e-mail, suivies initialement par le propriétaire. Couvrir indisponibilité, base, sauvegarde, tâches critiques, sécurité et paiement futur ; aucun Slack requis en V1. Le destinataire opérationnel et le domaine d'envoi restent à configurer avec EMAIL.

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

  Source / dépendance / blocage : Clé Resend et domaine vérifié requis ; OPS-02B.

  Limite V1 : les e-mails servent aux invitations, à la récupération et aux alertes utiles ; ils ne redeviennent pas le lieu principal de coordination des missions. Pas d’import automatique des commandes par e-mail prévu dans le noyau.

  Décision du 2026-10-18 : Resend retenu en principe ; la boîte de réception de test choisie est configurée uniquement dans l'environnement local ignoré par Git. Préparer `no-reply@…` et `support@…`, mais aucun domaine n'est acheté/confirmé : ne pas inventer `tutelliv.fr` ou `.com`, ne pas modifier le DNS et ne pas activer d'envoi réel avant validation.

  Avancement local du 2026-10-18 : transport métier sécurisé par trois modes explicites (disabled, test, live). Le mode recette redirige tous les messages vers une boîte contrôlée et affiche cet état dans le portail ; le dépôt reste désactivé par défaut. Configuration partielle refusée, délai borné, sujets neutralisés, clés d'idempotence stables, erreurs sans contenu sensible, frontières d'entreprise et préférences vérifiées. Les échecs de livraison/facture restent visibles et rejouables dans la file durable. Validation : 266 tests, types/lint stricts, build isolé 101 pages, 55 documents, scanner 855 fichiers et diff-check réussis. Aucun envoi ni secret utilisé. Procédure `docs/operations/email/README.md`, rapport `docs/rapports/2026-10-18/email-transport-local.md`, preuve `outputs/email/verification.json`.

  Reste à faire avant de cocher : confirmer le domaine et les expéditeurs, configurer Resend et le SMTP/modèles Supabase sur ENV-1, recevoir les messages dans la boîte de test configurée hors Git, tester expiration/limitations, panne/reprise et doublons sur la cible isolée. Aucun envoi réel n'a été effectué.

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

  Reste à faire avec intervention : MOB-01C sur iPhone/Android physiques, SEC-05/EMAIL avec expéditeur réel, TEST-2 sur la préproduction isolée d'ENV-1 et restauration OPS-03A sur cible isolée. Ces contrôles sont reportés et la case reste ouverte ; ils ne bloquent pas les travaux locaux indépendants.

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

  Qualification legacy vérifiée le 2026-10-18 : un ancien cookie ne peut plus rouvrir une session sans échéance exacte ; la prochaine connexion crée une session bornée. Inventaire connecté strictement en lecture seule : 51/51 anciennes candidates ont le marqueur et le roster synthétique attendus, aucune référence DB de logo/avatar/photo/PDF ou job actif, aucun objet Storage et aucune référence interentreprises ; toutes portent un graphe métier et aucune n'a d'échéance persistée. Elles restent inaccessibles et conservées : aucune adoption, date inventée ou suppression sans décision explicite. Validation : 275 tests, types/lint stricts, build isolé de 102 pages, 57 documents, scanner de 867 fichiers et diff-check réussis. Rapport `docs/rapports/2026-10-18/data02-legacy-demos.md`, preuve agrégée `outputs/data02/demo-legacy-inventory.json`.

  Reste à faire avec intervention/décision : politique légale de conservation par pays, canal chiffré de remise, traitement Supabase Auth/Storage et sauvegardes, restauration de l'export sur cible isolée, décision explicite sur les 51 anciennes démos, nettoyage des futurs cas avec assets, puis activation et observation de l'horaire sur préproduction. Aucune route destructive générique n'est exposée ; la route démo étroitement gardée n'est pas planifiée. DATA-02 reste ouverte.

  Proposition France préparée le 2026-10-18 : GPS 60 jours par défaut, archivage commercial probatoire jusqu'à cinq ans si justifié, pièces comptables dix ans, démos sous 24 h et pilotes supprimés sous 30 jours après export, avec séparation active/archive. Toute suppression définitive de données réelles reste interdite avant validation juridique ; seule la tranche de données démo explicitement autorisée ci-dessus est implémentée. `docs/operations/data02/RETENTION_POLICY_DRAFT.md`.

- [x] **DEMO-1 — Isoler les démonstrations.** Éviter qu’un login remette à zéro la session d’un autre prospect ; jeu fictif et remise à zéro limitée.

  **Modèle conseillé : GPT‑6.1 Sol · effort moyen.**

  Terminé quand : Deux démos simultanées indépendantes ; aucun impact sur entreprises réelles.

  Source / dépendance / blocage : Audit PROD-01 ; avant diffusion de démos.

  Validation : chaque navigateur reçoit une entreprise fictive propre, avec cookie HTTP-only de huit heures et trois personas isolés. Deux sessions simultanées de huit livraisons ont été créées ; reset de A sans perte du marqueur B, puis reconnexion B sans reconstruction. La recette complète est passée de 85,7 à 36,7 s après parallélisation et a laissé zéro résidu. Les réglages de dispatch utilisent la clé courante. Suite complète 230/230, types/lint stricts, 33 documents, diff-check et build de 100 pages réussis. Les sessions expirées restent à traiter par la future politique DATA-02/OPS-03B avant trafic public important. Rapport `docs/rapports/2026-10-16/demo1.md`, guide `docs/operations/demo1/README.md`, preuve `outputs/demo1/connected.json`.

## 6 — Reprendre la validation commerciale quand le propriétaire sera disponible

Prospection, entretiens et pilotes différés à sa demande ; aucune prise de contact prévue. Conserver leurs critères, sans les considérer validés par les tests internes.

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

  Source / dépendance / blocage : Après PROD-02 ; pas de gain chiffré inventé.

  Statut de planification : différé, conservé ; ne bloque pas le développement de la V1 sur données fictives. Les validations externes restent nécessaires au critère de clôture.

- [ ] **OFFER-1 — Valider la grille cible et l'offre pilote.** Confronter les formules Starter 79 € HT/mois, Pro 179 € et Business 349 €, leurs annuels, options, plafonds et dépassements aux coûts et prospects. Pilote proposé : trois entreprises, quatre semaines, gratuit, usage encadré, accompagnement direct, export final et aucune obligation de souscription.

  **Modèle conseillé : GPT‑6 Astra · effort moyen.**

  Terminé quand : Offre acceptée par prospects ; coûts infrastructure/cartes/stockage/messages/support mesurés ; pas d’illimité non maîtrisé.

  Source / dépendance / blocage : grille et pilote décidés par le propriétaire le 2026-10-18 ; acceptation, rentabilité et limites Business à vérifier. L'ancienne hypothèse 199 € est abandonnée. Référence : `docs/DECISIONS_PRODUIT_COMMERCIALES.md` et estimation `docs/operations/env1/COSTS.md`.

  Statut de planification : différé, conservé ; ne bloque pas le développement de la V1 sur données fictives. Les validations externes restent nécessaires au critère de clôture.

- [ ] **SAAS-01A — Implémenter les droits, quotas et contrats configurables.** Registre de pilote ou souscription, version de catalogue, période et droits côté serveur ; séparation entre abonnement TutelLiv et prestations ; fin de contrat avec export. Prévoir attribution de la vente initiale et commissions 25/35/50 % sur montants HT encaissés pendant douze mois maximum, sans CRM complexe.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : Pilote gratuit ou souscription manuelle produit des droits et plafonds cohérents ; catalogue accepté figé ; revenu TutelLiv distinct de la livraison ; attribution initiale auditable ; accès cohérent à l'échéance sans perte de données.

  Source / dépendance / blocage : architecture préparée dans `docs/SAAS_OFFERS_ARCHITECTURE.md` ; après revue OFFER-1 et cadre contractuel. Aucun paiement réel nécessaire au pilote gratuit.

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

## 7 — Vente autonome et extensions après validation

Conserver ces chantiers dans la roadmap. Ne pas investir maintenant dans les forfaits complexes, les intégrations multiples ou les fonctions sans lien avec le problème prioritaire.

- [ ] **SAAS-01B — Automatiser abonnement et paiement.** Après pilotes, choisir le fournisseur — Stripe est prioritaire à l'étude — puis souscription mensuelle/annuelle, découverte premium de 60 jours pour Starter/Pro, options, renouvellement, changement de plan, dépassements, impayé et webhooks idempotents. Le client doit pouvoir gérer son abonnement sans intervention commerciale.

  **Modèle conseillé : GPT‑6 Astra · effort élevé.**

  Terminé quand : En sandbox : succès, événement dupliqué/désordonné, impayé, annulation et remboursement si proposé ; pas de droits accordés sur simple retour navigateur.

  Source / dépendance / blocage : après PILOT-2 ; fournisseur non définitif, coûts et accès sandbox requis. Architecture préparatoire : `docs/SAAS_OFFERS_ARCHITECTURE.md`.

  Statut de planification : différé, conservé ; ne bloque pas le développement de la V1 sur données fictives. Les validations externes restent nécessaires au critère de clôture.

- [ ] **SAAS-02 — Mesurer le revenu et la santé du SaaS.** Séparer revenu abonnement, frais et coûts des factures de livraison ; activation, rétention, conversion et consommation par entreprise. Mesurer commandes, livreurs et options, y compris l'usage Business annoncé illimité, avec alertes de coût sans plafond caché.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Indicateurs réconciliés avec paiements ; définitions écrites ; quotas et alertes de coûts testés.

  Source / dépendance / blocage : Après SAAS-01A/B et PROD-04.

  Statut de planification : différé, conservé ; ne bloque pas le développement de la V1 sur données fictives. Les validations externes restent nécessaires au critère de clôture.

- [ ] **GROWTH-1 — Aligner site, démo et onboarding sur la valeur prouvée.** Page bénéfices pour le segment retenu, offre lisible, demande de démo/essai et preuves autorisées ; aucun témoignage inventé.

  **Modèle conseillé : GPT‑6.1 Sol · effort élevé.**

  Terminé quand : Un prospect comprend pour qui est le produit, le gain, les limites, le prix et la prochaine étape.

  Source / dépendance / blocage : Après PILOT-2, OFFER-1, DEMO-1 ; publication sur instruction.

  Statut de planification : différé, conservé ; ne bloque pas le développement de la V1 sur données fictives. Les validations externes restent nécessaires au critère de clôture.

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

- 2026-10-18 — Jauge et documentation réconciliées : la copie externe `TODO-TutelLiv-vente.md` est désormais synchronisée automatiquement depuis une configuration locale ignorée par Git, avec recalcul idempotent vérifié. Document de vision commerciale actualisé aux fonctions réellement qualifiées au 18 octobre : navigation, support, reprise réseau, retards, onboarding interne et export privé ; aucune validation terrain ou commerciale ajoutée.

- 2026-10-18 — BILL-01B terminée sur la branche export V1 décidée par BILL-01A : CSV comptable privé versionné, 29 colonnes, périodes UTC/statuts explicites, Decimal, lecture cohérente par lots, limites de volume, versions et données historiques qualifiées. 261 tests, build isolé 101 pages, recette connectée 1 001 documents A + 1 B avec écriture concurrente entre lots et zéro résidu ; relevé opérationnel de 160 lignes/neuf pages contrôlé. Aucune émission réglementaire, avoir automatique ou immutabilité légale complète revendiqués. Rapport `docs/rapports/2026-10-18/bill01b.md`.

- 2026-10-20 — ENV-1 terminée : branche `preproduction`, Preview Vercel protégée, projet Supabase isolé et secrets propres configurés sans modifier `main` ni la cible historique. La chaîne GitHub distante du commit `f6e19cc` réussit la garde, 279 tests, TEST-2, trois parcours Chromium, la preuve nettoyée et le nettoyage `always()` ; Vercel confirme le déploiement. Le contrôle direct final retrouve zéro utilisateur Auth, deux migrations, zéro drift, RLS partout et bucket privé. Rapport `docs/rapports/2026-10-20/preproduction-ci.md`. Suite : CI-1 pour le retour arrière applicatif, DB-1/OPS-03A pour la restauration base + Storage.

- 2026-10-20 — CI-1 terminée : la Preview isolée a été ramenée vers le commit sain `f6e19cc` en 1 min 39 s, puis remise sur le commit courant `04a0a35` en 2 min 11 s. Les deux reconstructions sont `Ready`, l'alias de branche suit le commit courant, la base reste conforme et vide d'utilisateur Auth, `main` et la production n'ont pas bougé. Sur Preview Hobby, le retour arrière documenté redéploie le commit sain avec les réglages actuels car Instant Rollback est indisponible. Rapport `docs/rapports/2026-10-20/ci1-rollback.md`.
