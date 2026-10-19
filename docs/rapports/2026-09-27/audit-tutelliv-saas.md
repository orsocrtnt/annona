# TutelLiv — Audit de préparation à la vente SaaS

Date : 27 septembre 2026. Objectif confirmé : abonnements à plusieurs entreprises de livraison.

## Verdict

TutelLiv est une base métier substantielle, mais pas encore un SaaS prêt à ouvrir librement à plusieurs entreprises. Recommandation : conserver l’architecture, traiter les frontières de données et la fiabilité des opérations, puis organiser un pilote accompagné. Le code ne permet pas à lui seul de prouver une demande commerciale ni la volonté de payer.

## Périmètre et niveau de preuve

Inventaire de 401 fichiers source (40 055 lignes), 41 pages et 71 fichiers de routes API ; cartographie des gardes de routes et dépendances, lecture ciblée des parcours auth, comptes, entreprises, commandes, dispatch, chauffeur/GPS, preuve photo, récurrences, factures/PDF, support, démo et administration. Schéma Prisma, scripts, configuration, documentation et backlog inclus.

Il s’agit d’un audit transversal avec lectures approfondies des flux critiques, pas d’une revue exhaustive de chaque ligne ni d’un pentest. Aucun accès à la base distante, aucun login réel, aucune écriture de production, aucun lancement du serveur et aucun déploiement. Aucun fichier du dépôt modifié pendant cet audit. Aucun secret reproduit.

Vérifications : les contrôles de préparation avaient passé (types, lint avec 24 avertissements, 7 tests). Une nouvelle exécution est consignée dans le fichier de validation joint. Quatre sondes locales chargent le code réel avec dépendances simulées : rattachement inter-entreprises, permissions mini-admin vides, relations support non contrôlées et échéance récurrente avancée malgré un échec. Elles démontrent des comportements du code ; elles ne prouvent pas qu’un incident a eu lieu sur la production.

Non vérifiés : RLS et triggers réellement déployés, politiques Storage existantes, validité des secrets, réglages Supabase/Vercel, sauvegardes, vulnérabilités de toutes les dépendances, performances et rendu navigateur/appareils. L’absence d’un élément dans le dépôt ne prouve pas son absence dans un service externe.

## Ce qui mérite d’être conservé

- Trois espaces métier complémentaires : administrateur/dispatch, client et chauffeur.
- Commandes standard, coursier et missions spéciales ; récurrences et tarification configurables.
- Attribution manuelle/automatique, contrôles de capacité et transitions de livraison déjà présents ; prise de mission protégée par une mise à jour conditionnelle.
- Preuves photo privées avec URL signée, contrôles de mission chauffeur et contrôles companyId sur de nombreuses routes métier.
- Authentification Supabase, permissions serveur, validation Zod, Prisma, séparation des fonctionnalités et services.
- Portail de commandes, factures, adresses, notifications et support ; démo multi-personas.
- Base de travail structurée par AGENTS.md / TODO.md et contrôle local reproductible.

Ces éléments sont observés dans le code ; leur réussite de bout en bout reste à tester. Pas de raison démontrée de réécrire toute l’application ou de passer aux microservices.

## Constats prioritaires

P0 = bloquant avant données réelles de plusieurs entreprises. P1 = indispensable au pilote fiable ou à la promesse concernée. P2 = amélioration avant diffusion large. Ce sont des priorités de lancement, pas des scores CVSS.

### SEC-01 · P0 — Rattachement de données entre entreprises

**Preuve :** Reproduit avec Prisma simulé ; impact production non testé.

linkPortalDataToClient rattache les commandes orphelines par e-mail sans companyId. Le login et la création d’un client appellent ce service ; les lectures portail filtrent ensuite sur customerId.

**Conséquence :** Un client de A peut recevoir des commandes, livraisons et factures de B si des commandes orphelines portent le même e-mail. La présence de telles données en production n’a pas été vérifiée.

**Correction proposée :** Exiger companyId et le rôle client pour le rattachement ; contrôler tous les objets liés. Définir explicitement si une identité peut appartenir à plusieurs entreprises.

**Critère de sortie :** Fixtures de deux entreprises avec e-mail commun : aucune lecture, écriture ou association croisée, y compris PDF et photos.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/domains/client-portal/client-data.service.ts:7`; `src/domains/auth/auth.service.ts:43`; `src/domains/invoice/invoice.service.ts:227`.

### SEC-02 · P0 — Références de support non contrôlées

**Preuve :** Absence de contrôle reproduite avec Prisma simulé.

createClientTicket accepte relatedOrderId et relatedDeliveryId sans vérifier leur propriétaire ; la réponse inclut leurs références.

**Conséquence :** Un client connaissant un identifiant étranger peut créer un lien vers une ressource hors de son périmètre et obtenir sa référence.

**Correction proposée :** Vérifier entreprise ET client avant l’insertion ; rejeter uniformément les identifiants étrangers.

**Critère de sortie :** Un ticket lié à une commande/livraison étrangère est rejeté et ne révèle aucune référence.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/domains/support/support.service.ts:29`; `src/app/api/portal/support/route.ts:33`.

### SEC-03 · P0 — Délégation mini-admin trop large

**Preuve :** Observé dans le code.

Le module accounts donne users:update/create. L’API permet de modifier tout mini-admin de la même entreprise, y compris soi-même, sans comparer les modules demandés aux droits de l’acteur. Les réglages absents ou vides donnent tous les modules dans le helper.

**Conséquence :** Un mini-admin chargé des comptes peut s’accorder ou déléguer des modules supplémentaires. Le formulaire valide les tableaux non vides, donc le défaut vide concerne surtout des réglages anciens ou invalides.

**Correction proposée :** Réserver la délégation sensible à l’administrateur principal ou appliquer un plafond de délégation serveur ; adopter un refus par défaut.

**Critère de sortie :** Un mini-admin limité ne peut ni augmenter ses droits ni créer un compte plus privilégié ; réglages absents n’accordent pas tous les droits.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/lib/permissions/mini-admin.ts:99`; `src/domains/user/user.service.ts:341`; `src/app/api/users/[id]/route.ts:10`.

### SEC-04 · P1 — Suspension et retrait des droits incomplets

**Preuve :** Observé dans le code.

Le contexte auth ne rejette pas les statuts User/Company inactifs ou suspendus. Le cache garde les permissions 60 secondes ; updateMiniAdminByAdmin n’appelle pas clearAuthCache.

**Conséquence :** Une suspension applicative ne garantit pas un refus d’accès ; un retrait de module peut tarder à prendre effet, notamment entre instances.

**Correction proposée :** Contrôler les statuts dans la garde serveur et définir une stratégie de révocation cohérente entre instances.

**Critère de sortie :** Compte et entreprise suspendus refusés sur chaque API protégée ; délai de révocation connu et testé.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/lib/api/server-auth.ts:106`; `src/lib/api/auth-cache.ts:11`; `src/domains/user/user.service.ts:341`.

### SEC-05 · P1 — Identifiants et vérification e-mail à revoir

**Preuve :** Observé dans le code.

Les mots de passe temporaires sont générés avec Math.random et sauvegardés en clair dans localStorage (effacés au logout, sans expiration individuelle). L’inscription confirme l’e-mail via l’API admin ; le login peut aussi confirmer automatiquement un e-mail non confirmé.

**Conséquence :** La possession réelle de l’adresse n’est pas démontrée ; exposition accrue des identifiants dans un navigateur partagé ou compromis.

**Correction proposée :** Invitations à usage unique, définition du mot de passe par son propriétaire, vérification e-mail et limitation des tentatives. Éliminer les mots de passe persistants côté admin.

**Critère de sortie :** Invitation expirée/invalide rejetée ; aucun mot de passe stocké dans localStorage ; inscription non vérifiée ne prend pas possession de données client.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/domains/user/user.service.ts:185`; `src/lib/storage/pending-credentials.ts:43`; `src/domains/auth/provision-company-admin.ts:46`; `src/app/api/auth/login/route.ts:52`.

### OPS-01 · P1 — Occurrences récurrentes perdues en cas d’échec

**Preuve :** Perte après échec reproduite avec Prisma simulé.

Le worker avance nextRunAt avant createClientOrder ; en cas d’échec il ne remet pas l’occurrence en attente. Le cron tourne quotidiennement et traite au plus 25 récurrences par appel.

**Conséquence :** Livraisons récurrentes oubliées ; retard accumulé quand le volume dépasse la capacité du traitement.

**Correction proposée :** Créer une occurrence durable et unique, états/reprises d’erreur, traitement par lots drainés et alerte ; définir le fuseau et les règles de fin de mois.

**Critère de sortie :** Panne injectée après le claim : l’occurrence est rejouée une seule fois ; 100 échéances traitées sans perte ni duplication.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/domains/client-portal/recurring-order.service.ts:307`; `src/lib/query/list-limits.ts:20`; `vercel.json:5`.

### OPS-02 · P1 — Commande et livraison non atomiques

**Preuve :** Observé dans le code.

createClientOrder crée la commande, puis des articles et la livraison par opérations séparées. Auto-dispatch et notifications utilisent des promesses lancées sans attente durable.

**Conséquence :** Commande enregistrée sans livraison si une étape échoue ; un retry peut créer un doublon ; dispatch/e-mail non garantis si le processus s’arrête.

**Correction proposée :** Transactions pour les écritures liées, clé d’idempotence et outbox avec worker durable pour les effets externes.

**Critère de sortie :** Pannes injectées à chaque étape et requêtes répétées : une seule commande complète et effets rejouables.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/domains/order/order.service.ts:185`; `src/domains/order/order.service.ts:355`; `src/domains/order/order.service.ts:435`; `src/domains/client-portal/notify.service.ts:76`.

### DATA-01 · P1 — Historique tronqué sans pagination serveur

**Preuve :** Observé dans le code.

Les listes sont plafonnées (80 commandes entreprise, 50 factures client, etc.). DataGrid pagine et recherche uniquement le tableau reçu.

**Conséquence :** Une ancienne commande paraît disparue même si elle existe ; recherche et exploitation incomplètes dès les premiers clients actifs.

**Correction proposée :** Pagination et recherche serveur avec filtres, total/curseur et export complet autorisé.

**Critère de sortie :** Une entreprise avec 1 000 commandes retrouve la plus ancienne et exporte toutes les lignes autorisées.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/lib/query/list-limits.ts:2`; `src/components/ui/data-grid.tsx:51`; `src/domains/order/order.service.ts:442`.

### BILL-01 · P1 — Factures de livraison insuffisantes pour une promesse comptable

**Preuve :** Observé dans le code.

Référence générée à partir de Date.now en base 36 ; une facture PENDING peut être remplacée. Le PDF n’a qu’une page et ne porte pas de champs structurés pour toutes les mentions commerciales (identifiant entreprise, adresse acheteur, etc.). Les données entreprise sont relues au téléchargement.

**Conséquence :** Collisions possibles, absence de séquence continue, documents anciens modifiables et lignes hors page. Ne pas vendre ce module comme une facturation française complète.

**Correction proposée :** Décider d’un connecteur comptable/plateforme agréée ou d’un chantier dédié : séquences par entreprise, instantané immuable, avoirs, montants décimaux, mentions et pagination PDF.

**Critère de sortie :** Émissions concurrentes uniques ; facture émise figée ; tests de montants et PDF long ; validation du périmètre réglementaire français par un spécialiste.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/domains/invoice/invoice.service.ts:13`; `src/domains/invoice/invoice.service.ts:132`; `src/lib/pdf/invoice-pdf.ts:40`; `src/app/api/portal/invoices/[id]/pdf/route.ts:23`.

### BILL-02 · P1 — État financier mélangé à la livraison

**Preuve :** Observé dans le code.

Émettre une facture remplace le statut de toutes les livraisons de la commande par INVOICED. L’endpoint vérifie orders:update, pas invoices:create.

**Conséquence :** Une opération comptable modifie l’état logistique ; un gestionnaire de commandes peut émettre une facture sans module facturation.

**Correction proposée :** Séparer états opérationnels et financiers, vérifier les permissions de facturation et définir les transitions autorisées.

**Critère de sortie :** Facturer ne change pas une mission en cours et ne donne pas accès à un rôle non autorisé.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/domains/invoice/invoice.service.ts:168`; `src/app/api/orders/[id]/invoice/route.ts:10`.

### SAAS-01 · P1 — Abonnements et pilotage SaaS manquants

**Preuve :** Manque identifié dans le dépôt ; outils externes éventuels non consultés.

Aucun modèle d’abonnement, paiement SaaS ou webhook de facturation identifié. Le revenu du tableau plateforme additionne les factures de livraison des entreprises, pas les abonnements TutelLiv. La page entreprises est une liste.

**Conséquence :** Pas de cycle essai → paiement → renouvellement/impayé/résiliation ; indicateur de revenu trompeur pour l’éditeur.

**Correction proposée :** Pour un pilote, contrat et paiement manuels possibles avec droits explicites. Avant libre-service : abonnements, quotas mesurés, webhooks idempotents, export/résiliation, tableau revenu SaaS séparé.

**Critère de sortie :** Paiement confirmé côté serveur ; événement reçu deux fois sans double effet ; impayé et résiliation testés sans perte de données.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `prisma/schema.prisma:193`; `src/domains/admin/platform.service.ts:58`; `src/app/(back-office)/companies/page.tsx:28`.

### MOB-01 · P1 — Fiabilité terrain et suivi GPS non démontrés

**Preuve :** Observé dans le code.

Le suivi repose sur navigator.geolocation ; les envois ne contrôlent pas res.ok. Le tracker conserve un état actif même après erreur réseau et envoie aussi hors mission tant que la page est montée. Pas de file hors ligne identifiée.

**Conséquence :** Positions périmées interprétées comme actuelles ; pertes d’actions en zone blanche ; usage hors service à encadrer.

**Correction proposée :** Afficher la fraîcheur et l’échec de synchronisation, mode prise/fin de service, reprise d’actions idempotente, tests iPhone/Android et écran verrouillé. Une app native n’est à décider qu’après les essais.

**Critère de sortie :** Parcours livraison réel en réseau faible : aucune preuve perdue et état de synchronisation honnête ; arrêt explicite du suivi hors service.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/features/driver/driver-location-tracker.tsx:12`; `src/features/driver/driver-location-tracker.tsx:58`; `src/features/driver/use-driver-live-position.ts:63`.

### OPS-03 · P1 — Exploitation et conformité à établir

**Preuve :** Absence dans le dépôt ; configuration hébergeurs non vérifiée.

Pas de CI, historique de migrations, instrumentation d’erreurs dédiée ou procédures de restauration identifiés dans le dépôt. Tests actuels : sept scénarios locaux seulement. Photos et géolocalisation sont traitées, sans politique de conservation/suppression identifiée ici.

**Conséquence :** Impossible de démontrer la reprise après incident, la non-régression entre entreprises et la maîtrise des données sensibles.

**Correction proposée :** Staging isolé, tests intégration/E2E multi-entreprises, CI, migrations, alertes, sauvegarde restaurée, journal des actions sensibles, export et politique de conservation ; vérifier ce qui existe chez les hébergeurs.

**Critère de sortie :** Restauration répétée sur cible isolée, déploiement contrôlé, alerte testée, export/suppression par entreprise et dossier contractuel adapté.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `prisma/schema.prisma:410`; `src/lib/storage/pod.ts:3`; `package.json:25`.

### MAP-01 · P2 — Dépendances cartographiques sans stratégie de service

**Preuve :** Observé dans le code.

Routes OSRM publiques, BAN et tuiles externes sont codées dans le projet. Un échec OSRM retourne une ligne droite et zéro distance/durée.

**Conséquence :** La carte peut afficher une information ambiguë ; dépendance aux quotas, disponibilités et conditions d’usage externes.

**Correction proposée :** Configurer les fournisseurs, timeouts et budgets, distinguer itinéraire indisponible de durée nulle ; vérifier droits d’usage et attribution pour l’offre commerciale.

**Critère de sortie :** Panne du fournisseur simulée : état dégradé explicite, pas d’estimation présentée comme fiable.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/lib/maps/osrm-route.ts:61`; `src/lib/maps/osrm-route.ts:53`; `src/lib/geocoding.ts:51`.

### PROD-01 · P2 — Acquisition, onboarding et support incomplets

**Preuve :** Observé dans le code.

La landing pousse surtout vers les connexions. Un portail de tickets existe, mais aucun flux de réponse staff trouvé dans les routes inspectées. Démo partagée réinitialisée au login.

**Conséquence :** Un prospect peut ne pas comprendre le gain ni atteindre sa première livraison seul ; plusieurs démos peuvent se gêner.

**Correction proposée :** Page orientée bénéfice et segment, demande de démo, onboarding guidé/import, canal support effectivement surveillé ; démo isolée par visiteur ou session de vente.

**Critère de sortie :** Un nouveau client configure son entreprise et réalise une livraison de test avec une aide mesurée ; chaque ticket obtient une réponse traçable.

Sources locales (chemins relatifs à `/Users/orso/Developer/tutelliv`) : `src/features/landing/home-landing.tsx:94`; `src/domains/support/support.service.ts:63`; `src/app/api/auth/login/route.ts:127`.

## Produit vendable : hypothèses à tester

### H1 — Cibler les petites entreprises de livraison locale

Hypothèse initiale : entreprises francophones de 3 à 20 chauffeurs, avec clients récurrents et opérations aujourd’hui réparties entre téléphone, messagerie et tableur. Ce segment n’a pas été validé par des entretiens. Éviter au départ de promettre une solution pour toute la logistique, les transports réglementés ou les grandes flottes.

Promesse proposée : « Recevez les commandes de vos clients, affectez vos chauffeurs et retrouvez les preuves de livraison au même endroit. »

Expérience : dix entretiens sur des journées de travail réelles, trois pilotes accompagnés après correction des P0. Relever temps de dispatch, appels de suivi, commandes oubliées, délais d’encaissement et outils actuels. Critère proposé : au moins deux pilotes choisissent de payer pour poursuivre, avec un gain observé et des raisons documentées. Ces nombres sont des objectifs d’expérience, pas des résultats existants.

### H2 — La simplicité et la fiabilité paient davantage qu’une longue liste de modules

Noyau V1 : onboarding entreprise, comptes et droits, commande → attribution → mission → preuve, historique consultable, suivi honnête, support joignable et export. Les fonctionnalités déjà codées mais non garanties peuvent être masquées ou explicitement marquées en pilote.

Différer l’IA, les tableaux personnalisables supplémentaires, le SMS généralisé, les connecteurs multiples et une app native tant qu’ils ne résolvent pas un blocage payé par les premiers clients. Conserver les trois espaces ; ne pas promettre un fonctionnement GPS permanent écran éteint avant essais.

### H3 — Une offre simple, avec coûts variables maîtrisés

Tester une offre pilote unique plutôt que trois forfaits immédiatement : par exemple 199 € HT/mois, jusqu’à cinq chauffeurs actifs et un volume mensuel défini pendant les entretiens. Ce prix est une hypothèse de vente, pas un prix de marché établi ni une recommandation validée. SMS, stockage supplémentaire et onboarding intensif doivent être mesurés ou facturés séparément. Ne pas promettre l’illimité avant de connaître les coûts.

Repères publics consultés : Onfleet Launch annonce un départ à 619 USD/mois pour 2 500 tâches ; OptimoRoute Lite annonce 35,10 USD/chauffeur/mois en facturation annuelle. Périmètres et maturité différents : ces prix ne prouvent ni l’équivalence de TutelLiv ni une disposition de ses clients à payer. Sources : [Onfleet](https://onfleet.com/pricing), [OptimoRoute](https://optimoroute.com/pricing/).

Calcul à instrumenter par entreprise : abonnement encaissé hors taxes − coûts variables infrastructure/cartes/messages/paiement − temps de support valorisé. Puis déduire les coûts fixes, développement et acquisition au niveau de l’activité. Le chiffre d’affaires des livraisons des entreprises ne constitue pas le revenu de TutelLiv.

### H4 — Un pilote accompagné avant le libre-service

Pour les premiers clients, une souscription et un paiement gérés manuellement peuvent éviter d’investir trop tôt dans une intégration complète. Cela ne dispense ni de contrats ni de factures ni d’un contrôle effectif des accès. Avant ouverture en libre-service : modèle d’abonnement séparé, essai borné, droits côté serveur, événements de paiement idempotents, gestion des impayés et résiliation/export.

## Points France / données à cadrer avant commercialisation

Hypothèse géographique : marché français, à confirmer ; ne pas appliquer ces conclusions telles quelles à un autre pays.

**Factures :** Bercy demande notamment une numérotation chronologique continue et des mentions structurées d’identité, de prix et de paiement. Le module PDF actuel présente des écarts techniques manifestes ; son périmètre légal doit être validé avant d’en faire un argument commercial. [Mentions obligatoires — Bercy](https://www.economie.gouv.fr/entreprises/gerer-son-entreprise-au-quotidien/gerer-sa-comptabilite-et-ses-demarches/mentions-obligatoires-dune-facture-tout-savoir).

Pour les entreprises/opérations françaises concernées, réception électronique depuis le 1er septembre 2026, émission selon la taille (2026 pour grandes entreprises/ETI, 2027 pour PME/micro). Un PDF ordinaire n’est pas à lui seul une intégration conforme à cette réforme. Recommandation produit : connecter une solution/plateforme adaptée plutôt que revendiquer immédiatement un système comptable complet. [Calendrier officiel](https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises).

**GPS :** prévoir information, accès limités, journalisation, durée de conservation et désactivation hors temps de travail. La fiche CNIL dédiée indique ces principes et précise qu’elle est en cours de mise à jour ; les durées/finalités applicables doivent être confirmées selon les usages. [CNIL — géolocalisation des salariés](https://www.cnil.fr/fr/la-geolocalisation-des-vehicules-des-salaries).

Livrables à faire valider : CGV/contrat SaaS et niveaux de support, politique de confidentialité, accord de traitement de données, liste des sous-traitants et régions d’hébergement, modalités d’export/suppression, conservation des photos/GPS et gestion des incidents. Il s’agit d’un chantier de mise en vente à instruire avec les professionnels concernés, pas d’une certification juridique issue de cet audit.

## Ordre d’exécution proposé et portes de sortie

### Étape A — Frontières de confiance

Créer/identifier le staging et les jeux de données A/B ; corriger SEC-01 à SEC-05 et le contrôle des références support. Ajouter les tests des routes réellement utilisées (les sept tests actuels ne couvrent pas les garde-fous serveur réels). Critère : aucun accès croisé, aucun accroissement de droits non autorisé et suspensions effectives. Ne pas importer de vraies données client avant ce résultat.

### Étape B — Une livraison fiable

Corriger OPS-01/02, pagination et état financier/logistique ; preuve photo avec contrôle du type/taille serveur avant stockage, nettoyage des fichiers orphelins ; erreurs et retries visibles. Tests de bout en bout sur les trois rôles, requêtes concurrentes et réseau interrompu. Critère : aucune perte/duplication dans les scénarios de panne, historique complet et tests sur téléphones réels.

### Étape C — Service exploitable

CI, build de staging, migrations versionnées, restauration de sauvegarde, alertes, procédure d’incident, journal des actions sensibles, isolation de la démo, support opérationnel. Inspecter les services déjà configurés avant d’en acheter d’autres. Critère : déployer, restaurer et diagnostiquer sans manipulation improvisée des données de production.

### Étape D — Pilote payant encadré

Valider le segment et l’offre, contractualiser le périmètre, préparer une configuration/import assistés. Faire trois pilotes sur un cycle de travail représentatif (objectif initial : quatre semaines, non estimation du développement). Mesurer adoption, incidents, temps gagné, coût du support et conversion payante. Une fonctionnalité réglementaire non prête doit rester hors promesse, pas seulement hors tests.

### Étape E — Libre-service

Automatiser abonnements et onboarding après validation des pilotes ; ajouter suivi activation/rétention, limites de consommation, export et résiliation. Développer les intégrations demandées par plusieurs clients avant les options de confort isolées.

## Décisions restant au propriétaire du produit

Confirmer le segment et le pays visés, identifier deux ou trois prospects pilotes, préciser si TutelLiv doit émettre des factures finales ou préparer les données pour un outil comptable, et définir la disponibilité/support que l’entreprise peut réellement assurer. Les autres choix techniques courants peuvent être pris à partir de ce plan sans questions répétées.

Le premier chantier recommandé est SEC-01/02/03 avec tests multi-entreprises, avant les couleurs, nouvelles fonctions ou abonnement automatique. Cet audit propose un plan ; il n’a appliqué aucune correction au dépôt.
