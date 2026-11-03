# LEGAL-1 — Vérification de conformité du 2 novembre 2026

**Pour qui :** le propriétaire, et tout professionnel consulté plus tard.
**Portée :** contrôle documentaire fait par un agent, à partir de sources officielles lues le 2 novembre 2026, du code de `preproduction` et de l'état des comptes consultable. Ce n'est ni un avis juridique ni une attestation : **aucune conformité n'est déclarée**. Les décisions et les engagements restent au propriétaire. Cette vérification remplace le recours obligatoire à un juriste (décision du 1er novembre) ; un avis reste possible au besoin.

## 1. Ce qui est permis aujourd'hui

| Usage | Verdict | Conditions |
|---|---|---|
| Démonstration avec des données fictives | Possible | Dire « données fictives » |
| Entretiens de recherche avec des professionnels | Possible | Numéro et adresse professionnels, sujet lié à leur activité, identité indiquée, refus possible et respecté ; aucun prix ni offre sans SIREN |
| Vendre ou facturer | **Non** | SIREN, CGV, paiement réel et offre d'hébergement commerciale d'abord |
| Pilote avec de vraies données | **Non** | Lever les blocages de la section 3 |

## 2. Matrice des exigences

Verdicts : **Cohérent** (constat conforme au texte lu), **Écart** (à corriger), **Pièce manquante**, **À décider**, **Non vérifié**.

### Entreprise et site

| Exigence | Source | Constat | Verdict | Qui, avant quoi |
|---|---|---|---|---|
| Déclarer l'activité sur le Guichet unique, au plus tard 15 jours après le début (les sources diffèrent : 15 ou 30 jours) | [Service Public](https://entreprendre.service-public.gouv.fr/vosdroits/F36746?lang=en), [Urssaf](https://www.urssaf.fr/accueil/services/services-independants/debut-activite-guichet-unique.html) | Pas encore de numéro le 1er novembre ; la date de début d'activité n'a pas été qualifiée | **Écart** | Propriétaire, maintenant |
| Mentions du site d'un EI : nom, adresse, e-mail, téléphone, immatriculation, TVA si applicable, directeur de publication, hébergeur avec nom, adresse et téléphone. Sanction citée : 75 000 € | [Service Public F37351](https://entreprendre.service-public.gouv.fr/vosdroits/F37351) | [Page](../../src/app/mentions-legales/page.tsx) : nom et adresse présents. Manquent e-mail, téléphone, SIREN, directeur de publication et téléphone des hébergeurs | **Écart** | Propriétaire fournit, agent publie, dès le SIREN |
| Information sur les données : finalités, base légale, destinataires, transferts, durée, droits | [CNIL](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence), [Service Public F37351](https://entreprendre.service-public.gouv.fr/vosdroits/F37351) | [Page](../../src/app/confidentialite/page.tsx) présente et reliée aux formulaires. Pas de base légale ni de transfert indiqués ; durées absentes hors prospection | **Traité en partie** le 2 novembre : bases légales et destinataires publiés ; transferts indiqués sans mécanisme ; autres durées à définir | Section 4 |
| Cookies : consentement seulement pour les traceurs non essentiels | [Service Public F37351](https://entreprendre.service-public.gouv.fr/vosdroits/F37351) | Aucun outil de mesure ou de publicité dans `package.json` ni dans le code. Cookies de session, d'inscription et de démo ; stockage local du navigateur (thème, préférences d'affichage, file hors ligne du livreur) | **Cohérent** dans le code | Agent : page complétée ce jour |

### Contrats

| Exigence | Source | Constat | Verdict | Qui, avant quoi |
|---|---|---|---|---|
| CGV communicables à un professionnel qui les demande ; refus sanctionné | [Service Public F37351](https://entreprendre.service-public.gouv.fr/vosdroits/F37351), [F33527](https://entreprendre.service-public.gouv.fr/vosdroits/F33527) | Projet J5 lu le 2 novembre, non publiable : écarts en section 6 | **Écart** | Décisions du propriétaire, puis mise à jour, avant toute offre |
| Accord de traitement (article 28) dès qu'un client confie des données | [RGPD](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra), [CNIL](https://www.cnil.fr/fr/sous-traitant) | Projet J5 lu le 2 novembre, annexes à compléter : section 6 | **Écart** | Avant le premier pilote |
| Protections possibles pour une entreprise de 5 salariés ou moins, contrat hors établissement et hors activité principale | [Service Public F33527](https://entreprendre.service-public.gouv.fr/vosdroits/F33527) | Déjà signalé dans le plan de démarchage. Application à un logiciel métier non tranchée | **À décider** | Avant la première vente |
| Résiliation en ligne des abonnements | [Service Public F37351](https://entreprendre.service-public.gouv.fr/vosdroits/F37351) (articles L215-1-1 et suivants du Code de la consommation) | Pas de parcours autonome. Application aux clients professionnels non tranchée ; à prévoir dans SAAS-03 | **À décider** | Avant la vente en ligne |
| **Nouveau — Data Act :** un client peut changer de fournisseur. Applicable depuis le 12 septembre 2025, SaaS inclus, export lisible par machine, plus de frais de changement à partir du 12 janvier 2027 | [Commission européenne](https://digital-strategy.ec.europa.eu/en/factpages/data-act-explained), [texte](https://eur-lex.europa.eu/eli/reg/2023/2854/oj/eng) | Absent du dossier précédent. Export réservé à l'opérateur, sans remise au client (DATA-02). Aucune exemption micro-entreprise trouvée sur ce chapitre, mais le texte complet n'a pas pu être lu par l'outil (préavis de 2 mois et transition de 30 jours relevés seulement en extraits) | **Écart** | Agent : DATA-02. CGV : à relire dans le texte |

### Données personnelles, GPS et photos

| Exigence | Source | Constat | Verdict | Qui, avant quoi |
|---|---|---|---|---|
| GPS : arrêt hors temps de travail, pas de surveillance permanente, pas de contrôle de vitesse | [CNIL](https://www.cnil.fr/fr/la-geolocalisation-des-vehicules-des-salaries) (page signalée en cours de mise à jour) | Une seule dernière position par livreur (`driver_locations`) ; effacée à chaque changement de service ([tracking.service.ts](../../src/domains/tracking/tracking.service.ts)). Bouton de service présent. Non essayé sur téléphone (MOB-01C) | **Cohérent** dans le code, **Non vérifié** sur appareil | Propriétaire : MOB-01C |
| GPS : conservation de 2 mois en principe, 1 an si la preuve ne peut pas être apportée autrement | [CNIL](https://www.cnil.fr/fr/la-geolocalisation-des-vehicules-des-salaries) | Position de preuve (`pod_latitude`, `pod_longitude`) sans durée ni purge ; aucune tâche de purge dans `src/app/api/cron` | **Écart** | Agent après décision : DATA-02 |
| GPS : salariés informés, représentants informés ou consultés, inscription au registre | [CNIL](https://www.cnil.fr/fr/la-geolocalisation-des-vehicules-des-salaries) | Obligation de l'employeur, donc du client. Modèle de notice J5 à compléter : section 6 | **Écart** | Propriétaire, avant le premier pilote |
| Analyse d'impact si risque élevé. La liste CNIL vise la surveillance constante des employés et la localisation à large échelle ; en cas de doute, la faire | [CNIL](https://www.cnil.fr/fr/ce-quil-faut-savoir-sur-lanalyse-dimpact-relative-la-protection-des-donnees-aipd), [liste](https://www.cnil.fr/sites/cnil/files/atoms/files/liste-traitements-aipd-requise.pdf) | Elle revient d'abord au client responsable du traitement, avec l'aide de TutelLiv. Trame pré-remplie le 3 novembre : [AIPD_TYPE.md](AIPD_TYPE.md) ; GPS de salariés = deux critères du CEPD, AIPD recommandée à chaque client | **Trame prête**, AIPD du client à faire | Client, avec la trame, avant les données réelles |
| Photos : minimisation | [RGPD](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra) | Métadonnées retirées au dépôt ([pod.ts](../../src/lib/storage/pod.ts)), espace de stockage privé. Durée non fixée, consignes de cadrage à écrire | **Écart** partiel | À décider : section 4 |
| Données sur l'appareil | [RGPD](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra) | La file hors ligne du livreur est rattachée à son compte. Depuis le 3 novembre, chaque action est effacée dès son envoi et au plus tard sept jours après sa création, tous comptes de l'appareil confondus ([offline-action-queue.ts](../../src/features/driver/offline-action-queue.ts), `purgeExpiredDriverActions`, lancée à l'ouverture de l'application livreur) ; durée provisoire, à confirmer avec la section 4 ; page Confidentialité complétée. Testé sur un stockage simulé, pas encore sur téléphone | **Traité** côté code | Propriétaire confirme la durée |
| Conservation limitée, par catégorie | [CNIL](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees) | [Projet](../operations/data02/RETENTION_POLICY_DRAFT.md) rédigé, non appliqué. Aucune purge des messages Contact trouvée | **Écart** | Propriétaire valide, agent applique : DATA-02 |
| Prospection par e-mail entre professionnels : intérêt légitime si le sujet touche à la profession, opposition simple, identité de l'expéditeur | [CNIL](https://www.cnil.fr/fr/la-prospection-commerciale-par-courrier-electronique) | Plan et page Confidentialité alignés. La boîte `no-reply@` empêche de recevoir un refus : boîte réelle obligatoire avant le premier envoi | **Écart** tant que la boîte n'existe pas | Propriétaire, avant le premier message |
| Appels : depuis le 11 août 2026, consentement exigé pour les consommateurs | [CNIL](https://www.cnil.fr/fr/demarchage-commercial), [décret 2026-662](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054483939) | Les pages lues ne visent que les consommateurs. **Aucun texte officiel lu ne confirme l'exclusion des professionnels** : c'est une déduction. Prudence : joindre uniquement sur une ligne professionnelle, en semaine, de 14 h à 17 h comme prévu | **Décidé** le 2 novembre : appels maintenus avec prudence, risque accepté | Propriétaire |
| Violations : remontée au client sans délai, 72 h pour le responsable si notification requise | [CNIL](https://www.cnil.fr/fr/services-en-ligne/notifier-une-violation-de-donnees-personnelles) | Registre, délai interne et suppléant absents | **Pièce manquante** | Avant le premier pilote |

### Fournisseurs

| Fournisseur | Source | Constat | Verdict |
|---|---|---|---|
| **Vercel** | [Conditions du 19 octobre 2026](https://vercel.com/legal/terms), [DPA](https://vercel.com/legal/dpa) | Hobby : « personal or non-commercial use » seulement ; contenus utilisables pour entraîner des IA et partageables avec des tiers ; DPA réservé aux offres Pro et Enterprise. Le dépôt documente une offre Hobby ; offre réelle non lisible par l'outil | **Écart bloquant** : usage commercial et vraies données exclus sur cette offre |
| **Supabase** | [DPA](https://supabase.com/legal/dpa) | Offre gratuite constatée sur le compte. DPA lié aux conditions, clauses types pour les transferts vers Singapour, région de Paris configurée. Couverture de l'offre gratuite non confirmée. SSL actif côté serveur, obligation non vérifiée | **Non vérifié** ; passage en Pro déjà prévu |
| **OpenStreetMap, OSRM public** | [Règles des tuiles](https://operations.osmfoundation.org/policies/tiles/) | Sans garantie, accès retirable sans préavis, mise en garde pour les services commerciaux, pas de données personnelles à leur soumettre. Le code y envoie des requêtes depuis le navigateur, dont la position réelle du livreur (OSRM public) ; valeurs de configuration en ligne non relues. Corrigé le 3 novembre : itinéraires calculés par le serveur (`/api/maps/route`) vers l'IGN, le navigateur n'appelle plus OSRM (CSP mise à jour) ; OpenFreeMap gardé ([map-providers.md](../operations/map-providers.md), dernière section). Repli raster OSM encore présent | **Traité** côté code, en ligne après déploiement et réglage de `DRIVE_ROUTE_IGN_URL` ; usage commercial IGN à confirmer |
| **Anthropic** (INTAKE-1, facultatif) | [Conditions commerciales](https://www.anthropic.com/legal/commercial-terms) | Pas d'entraînement sur les contenus clients, DPA intégré. Activation en ligne non relue ; durée de conservation et région à vérifier | **Non vérifié** ; à laisser éteint avec de vraies données |
| **Resend** | Contrat non lu | Transporte les alertes du formulaire Contact, donc de vraies données de visiteurs. Destinataire ajouté à la page ce jour | **Pièce manquante** (DPA, région) |

### Facturation

| Exigence | Source | Constat | Verdict |
|---|---|---|---|
| Recevoir des factures électroniques : toutes les entreprises depuis le 1er septembre 2026 ; émettre : micro et PME au 1er septembre 2027 | [impots.gouv.fr](https://www.impots.gouv.fr/professionnel/questions/partir-de-quand-suis-je-concerne-par-la-reforme-de-la-facturation) | Obligation déjà en cours pour une entreprise déclarée : plateforme à ouvrir avec le SIREN (Super PDP choisie le 30 octobre). « Relevé » reste adapté tant que le document n'est pas une facture réglementaire | **Pièce manquante** (compte), MOTS-UNIFIES peut garder « Relevé » |
| Pénalités de retard et mentions de paiement | [Service Public F23211](https://entreprendre.service-public.gouv.fr/vosdroits/F23211) | À intégrer aux CGV | **Pièce manquante** |

## 3. Blocages du 22 octobre : où ils en sont

| # | Blocage | État au 2 novembre |
|---|---|---|
| 1 | Hébergement commercial et DPA | **Ouvert**, conditions relues et confirmées |
| 2 | Identité et textes | **Ouvert** : nom et adresse publiés, SIREN à venir, textes hors dépôt |
| 3 | GPS sur téléphone | **Ouvert** : MOB-01C |
| 4 | Cartographie publique | **Ouvert** |
| 5 | Photos et hors ligne | **Traité côté code** : métadonnées retirées ; file hors ligne effacée au plus tard après sept jours (3 novembre). Reste la durée de conservation des photos (section 4) |
| 6 | Export et suppression | **Partiel** : export complété, remise au client et suppression réelle absentes |
| 7 | Sauvegardes et alertes | **Ouvert** : Supabase gratuit constaté ; le reste suit OPS-FIAB, non rejoué ici |
| 8 | E-mails d'accès | **Non revérifié** : l'alerte Contact arrive depuis le 1er novembre ; liens d'authentification non testés ici |
| 9 | Accès aux consoles | **Ouvert** : double authentification et détenteurs d'accès inconnus |

## 4. Ce qu'il faut au propriétaire

**À fournir**
- SIREN, e-mail et téléphone publiables. Directeur de publication : le propriétaire, confirmé le 2 novembre 2026.
- **Droit d'exercer depuis les États-Unis :** la checklist J5 demande de confirmer la capacité à exercer sous visa J-1, et la cohérence de la résidence fiscale avec l'activité française. Elle demande aussi de vérifier la reprise de ton **ancien SIREN**. Rien de cela n'est tranché dans le dossier : à confirmer avant toute vente, idéalement avant le dépôt au Guichet unique. L'agent ne conclut pas sur ces points.

**Décidé le 2 novembre**
- Page Confidentialité : bases légales publiées (intérêt légitime pour le contact et la prospection, contrat pour le compte) ; messages Contact conservés trois ans après le dernier échange. La purge reste à écrire (DATA-02).
- Vercel Pro et vraie production : avant le premier pilote ou la première vente. D'ici là, démo fictive et entretiens seulement ; le site public reste sur l'offre documentée pendant le démarchage, risque accepté.
- Appels aux professionnels : maintenus avec prudence (lignes professionnelles, en semaine de 14 h à 17 h, sujet lié à l'activité, refus respecté), risque accepté.
- Textes J5 : accès au Drive donné par le propriétaire pour ce travail, en lecture seule. Rien n'a été modifié sur Drive.

**À décider**
- Durées de conservation du [projet DATA-02](../operations/data02/RETENTION_POLICY_DRAFT.md).
- Faire confirmer ou non les points incertains par un professionnel.
- Clauses marquées « choix contractuel » dans les CGV et le DPA (section 6).

## 5. Non vérifié

- Le texte complet du Data Act, la version finale du « Digital Omnibus » et l'article L. 223-1 lui-même : outil en échec sur ces pages. La fiche DGCCRF sur le démarchage a répondu 403.
- Les comptes fournisseurs côté contrat : aucune signature ni version de DPA relue.
- L'offre Vercel réellement souscrite, et les variables en ligne.
- La mention « empreinte chiffrée » de l'adresse IP sur le formulaire Contact, relue dans la page seulement.
- Les règles sociales propres aux livreurs indépendants, et le droit du transport applicable aux clients : hors du logiciel, à charge du client.
- Les fichiers J5 `09_PROMPTS` et `11_SOURCES` : non lus, sans effet sur les écarts ci-dessus. Les textes J5 ne sont pas copiés dans le dépôt.

## 6. Textes J5 du 21 octobre comparés au produit actuel

Lus sur Drive le 2 novembre 2026, avec l'accord du propriétaire. Complète [la comparaison du 22 octobre](J5_COMPARAISON_CONTRACTUELLE.md), en notant ce qui a changé depuis. Tous ces textes restent des projets non publiables.

| Texte | Ne correspond plus au produit, ou manque | À faire |
|---|---|---|
| **CGV, article 3** | Business annoncé « illimité » : le catalogue prévoit 20 livreurs inclus, 50 au plus, 9 € au-delà de 20. Option à 49 € pour le dispatch : devenue « Dispatch intelligent », 39 € en Starter, incluse en Pro et Business (C12). Administrateur supplémentaire réservé à Business : 12 € sur toutes les offres | Reprendre le catalogue en vigueur (C9 à C12) |
| **CGV, article 6** | Baisse de formule : refusée tant que des comptes dépassent la limite (C10) | Préciser |
| **CGV, article 7** | Découverte de 60 jours : s'arrête au premier échec de paiement et dès une demande de résiliation (C10) | Ajouter |
| **CGV, article 11** | Rien sur le changement de fournisseur (Data Act) ; durée d'accès après la fin non fixée | Ajouter après lecture du texte |
| **CGV, articles 16 et 17** | Plafond de responsabilité et préavis de 30 jours encore au stade de propositions | Décision du propriétaire |
| **CGU, article 2** | « Dispatcher / mini-administrateur » réunis ; le code a deux rôles distincts (`DISPATCHER`, `MINI_ADMIN`) | Séparer |
| **CGU, articles 6 et 7** | Faits à inscrire : position lue pendant le service, dernière position seule en base, effacée à chaque changement de service ; métadonnées des photos retirées. Signature et nom du destinataire absents | Compléter |
| **CGU, article 14** | Acceptation enregistrée avec version et date : aucun champ de ce type trouvé dans `prisma/schema.prisma` ni dans l'inscription | Développement avant la vente |
| **Confidentialité, section 11** | Le Dispatch intelligent peut affecter un livreur automatiquement (C12). Analyse du 3 novembre ([AIPD_TYPE.md](AIPD_TYPE.md), section 3) : critères sans évaluation de la personne, option désactivée par défaut ; article 22 et directive 2024/2831 à qualifier si des indépendants payés à la livraison sont affectés automatiquement. Ne rien déclarer avant | Propriétaire : qualifier pour le premier pilote concerné |
| **Confidentialité, section 5** | Manquent Anthropic, les services de notification des navigateurs et GitHub. OpenFreeMap et les itinéraires IGN ajoutés le 3 novembre, OSRM retiré | Compléter le reste |
| **DPA, annexe A** | Manquent signature, nom du destinataire et motif de refus de signer, commande par lien public, messages collés ou e-mails reçus (INTAKE-1) | Compléter |
| **DPA, annexe C et article 6** | Fournisseurs à compléter comme ci-dessus. **Le propriétaire travaille depuis New York : son accès aux données est un accès hors de l'Espace économique européen**, à inventorier et analyser avant le premier pilote, comme le prévoit l'article 6 | Analyse et inscription |
| **DPA, annexes B et D** | Mesures à n'inscrire qu'avec preuve. Export : archive opérateur disponible, canal de remise, délais et preuve de suppression absents | DATA-02 |
| **Convention pilote, article 4** | Conditions préalables aux vraies données : (a) isolation testée sur les cas couverts, (f) restauration prouvée sans suivi continu, et (b), (c), (d), (e), (g), (h) non réunies | Bloque les données réelles |
| **Notice livreurs, sections 2, 3 et 6** | Sections 2 et 3 complétables avec les faits ci-dessus, après l'essai sur téléphone (MOB-01C). Durées à fixer. Affichage du nom du livreur au client à décider (POD-2) | Compléter |
| **Mentions légales** | Le propriétaire est directeur de la publication, confirmé le 2 novembre 2026. Le téléphone des hébergeurs reste à trouver. L'accord pour publier l'adresse personnelle reste à cocher dans la checklist J5 | Propriétaire |
