# Analyse d'impact type (AIPD) et décision automatisée du Dispatch intelligent

3 novembre 2026. Document de travail préparé par l'agent pour LEGAL-1. **Ce n'est ni un avis juridique ni une AIPD faite** : c'est une trame pré-remplie avec ce que fait réellement Annona, que l'entreprise cliente (responsable du traitement, voir [R1 et R2](RESPONSABILITES_RGPD.md)) complète pour son propre usage. Les faits techniques renvoient au code ; les points marqués « à compléter par le client » ou « à qualifier » ne sont pas tranchés.

## 1. Faut-il une AIPD ?

| Repère | Source | Application à Annona |
| --- | --- | --- |
| AIPD obligatoire si risque élevé pour les personnes (art. 35) | [RGPD](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra) | Le client décide ; Annona l'assiste (art. 28, point f) |
| Liste CNIL : surveillance constante de l'activité des employés ; localisation à large échelle | [Liste CNIL](https://www.cnil.fr/sites/cnil/files/atoms/files/liste-traitements-aipd-requise.pdf) | Le suivi GPS pendant le service touche la première rubrique dès que les livreurs sont salariés |
| Neuf critères du CEPD ; deux remplis suffisent en général | [CNIL](https://www.cnil.fr/fr/ce-quil-faut-savoir-sur-lanalyse-dimpact-relative-la-protection-des-donnees-aipd) | Surveillance systématique (GPS) et personnes vulnérables au sens du CEPD (salariés face à l'employeur) : **deux critères**. Le Dispatch intelligent ajoute un traitement automatisé, sans notation des personnes (section 3) |

**Recommandation** : chaque entreprise cliente qui active le suivi GPS de livreurs salariés fait une AIPD avant les données réelles. En cas de doute (indépendants, petit effectif), la CNIL recommande de la faire. Annona fournit cette trame et répond aux questions techniques.

## 2. Trame pré-remplie

### 2.1 Description du traitement

| Rubrique | Ce que fait Annona (vérifié dans le code le 3 novembre 2026) | À compléter par le client |
| --- | --- | --- |
| Finalités | Organiser et suivre les livraisons ; prouver la remise ; estimer l'heure d'arrivée pour le client destinataire ; proposer ou faire l'affectation des livraisons | Finalités propres retenues ; interdiction écrite d'un usage disciplinaire du GPS hors cadre prévu |
| Personnes | Livreurs (salariés ou indépendants), destinataires des colis, contacts des clients donneurs d'ordre | Statut réel des livreurs |
| GPS | Envoi pendant le service seulement : toutes les 5 s en mission, 15 s sans mission, réglable par l'entreprise de 2 à 60 s et de 5 à 120 s ([driver-location-settings.ts](../../src/lib/validations/driver-location-settings.ts)). **Seule la dernière position est gardée** (une ligne par livreur, [schéma](../../prisma/schema.prisma), modèle `DriverLocation`) ; elle est effacée à la prise de service suivante ([driver-location.service.ts](../../src/domains/driver/driver-location.service.ts) (ex-`tracking.service.ts`), `setDriverService`) | Justification de la fréquence ; information des livreurs ; consultation des représentants du personnel s'il y en a |
| Positions gardées avec la livraison | Position au moment des changements de statut et de la preuve (`podLatitude`, `podLongitude` sur la livraison, coordonnées des événements de suivi) | Durée de conservation (DATA-02, [projet](../operations/data02/RETENTION_POLICY_DRAFT.md)) |
| Ce que voit le client destinataire | Une estimation en minutes, sans coordonnée du livreur, d'après le code (`client-live-eta.ts`, retiré avec l'ancien produit, NET-1 : à revoir) ; non rejoué en navigateur pour ce document | Faut-il afficher le prénom du livreur |
| Preuve de livraison | Photo sans métadonnées ([pod.ts](../../src/lib/storage/pod.ts)), signature, nom du destinataire, motif d'échec ; stockage privé | Consignes de cadrage des photos ; durée |
| Téléphone du livreur | Actions en attente d'envoi gardées sur l'appareil, effacées à l'envoi et au plus tard sept jours après leur création ([offline-action-queue.ts](../../src/features/driver/offline-action-queue.ts)) | Téléphone personnel ou professionnel |
| Destinataires | L'entreprise de livraison (dispatch, administrateurs) ; fournisseurs techniques listés dans [SOUS_TRAITANTS.md](SOUS_TRAITANTS.md) | Accès réels accordés en interne |

### 2.2 Nécessité et proportionnalité

| Question | Éléments fournis par Annona | À compléter par le client |
| --- | --- | --- |
| Base légale | Aucune décidée par Annona pour le compte du client | Intérêt légitime ou exécution du contrat, motivé |
| Minimisation | Pas d'historique de trajet ; pas de suivi hors service ; minutes seulement côté destinataire ; métadonnées des photos retirées | Fréquence choisie et pourquoi |
| Durées | Dernière position : jusqu'au service suivant ; file sur l'appareil : sept jours au plus | Durées des livraisons, preuves et événements |
| Information des personnes | Page [Confidentialité](../../src/app/confidentialite/page.tsx) pour les traitements propres de Annona | Notice aux livreurs (modèle J5 à compléter, [vérification](VERIFICATION_2026-11-02.md) section 6) ; information des destinataires |
| Droits | Export des données de l'entreprise ([company-export.service.ts](../../src/domains/data-lifecycle/company-export.service.ts)) | Procédure interne d'accès, d'opposition et d'effacement |
| Fin de service | Le livreur arrête lui-même son service dans l'application ; plus aucun envoi de position ensuite | Règle sur les pauses |

### 2.3 Risques

| Risque | Ce qui le réduit dans Annona | Reste à traiter |
| --- | --- | --- |
| Surveillance excessive du livreur (vitesse, pauses, localisation hors travail) | Pas de suivi hors service ; pas d'historique de trajet ; aucune note ni classement de livreur | Le client s'interdit d'en faire un outil de contrôle disciplinaire non prévu |
| Accès illégitime aux positions ou aux photos | Isolement par entreprise ; stockage privé des preuves ; rôles | Revue des comptes ; durcissement SEC-AUDIT |
| Perte de preuve ou fuite depuis le téléphone | Aucun chiffrement propre à Annona : la protection est celle du téléphone ; file effacée après sept jours au plus | Verrouillage du téléphone (consigne du client) |
| Conservation trop longue | Purges partielles | Durées DATA-02 à décider puis appliquer |
| Affectation automatique perçue comme injuste | Voir section 3 | Voir section 3 |

### 2.4 Validation

À remplir par le client : rédacteur, avis du délégué à la protection des données s'il y en a un, avis des représentants du personnel s'il y en a, décision, date de revue. Aucun de ces champs n'est rempli par l'agent.

## 3. Décision automatisée du Dispatch intelligent

### 3.1 Ce que fait le code

- **Option désactivée par défaut** : l'entreprise l'active dans Paramètres, catégorie par catégorie (`enabled`, `autoAssignCategories` dans `dispatch-settings.ts` (retiré avec l'ancien produit, NET-1 : à revoir)). Les tournées ne sont affectées sans validation que si `rounds.autoAssign` est activé, également faux par défaut.
- **Critères** : un score de 0 à 100 calculé sur les livreurs éligibles : trajet jusqu'au retrait 50 %, charge en cours 30 %, zone 10 %, priorité fixée par l'entreprise 10 % (`dispatch-score.ts`, retiré le 6 novembre 2026 avec l'affectation automatique). L'éligibilité dépend des règles posées par l'entreprise : livreur actif ou en pause, catégories autorisées, zones, codes postaux, charge maximale, capacité du véhicule.
- **Aucune évaluation de la personne** : pas de note client, de vitesse, de taux de réussite, d'ancienneté ni de comportement dans le score.
- **Explication gardée** : la raison est écrite dans l'historique de la livraison (« Meilleur score (trajet, charge, zone) » ou « Suggestion validée par le dispatch »).
- **Intervention humaine** : le dispatcher peut réaffecter à tout moment ; le livreur peut être mis en pause, ce qui l'exclut.

### 3.2 Analyse

| Question | Repère | Analyse de l'agent, à confirmer |
| --- | --- | --- |
| Décision fondée exclusivement sur un traitement automatisé produisant des effets juridiques ou affectant la personne de façon significative (art. 22) | [RGPD art. 22](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra) ; [CNIL, profilage et décision automatisée](https://www.cnil.fr/fr/profilage-et-decision-entierement-automatisee) | Pour un **salarié**, recevoir une livraison plutôt qu'une autre relève de l'organisation courante du travail : effet significatif peu probable. Pour un **indépendant payé à la livraison**, le nombre de livraisons reçues peut peser sur son revenu : effet significatif **à qualifier**. Dans ce cas, garder l'intervention humaine possible, l'information et le droit de contester |
| Profilage | Même source | Le score utilise la position et la charge du moment, pas un profil durable. Pas de profilage au sens d'une évaluation d'aspects personnels, sous réserve de confirmation |
| Gestion algorithmique du travail via une plateforme | [Directive (UE) 2024/2831](https://eur-lex.europa.eu/eli/dir/2024/2831/oj/fra), à transposer en droit français ; texte non relu pour ce document | Champ d'application (« plateforme de travail numérique ») **à qualifier** pour une entreprise de livraison utilisant un logiciel de dispatch. Ne rien déclarer avant cette lecture |

### 3.3 Mesures recommandées avant le premier pilote

1. Garder l'option désactivée par défaut et laisser au client le choix explicite, catégorie par catégorie (déjà le cas).
2. Mentionner le Dispatch intelligent, ses critères et le moyen de contester dans la notice aux livreurs (modèle J5).
3. Ne jamais ajouter au score une mesure de performance individuelle sans nouvelle analyse.
4. Si un pilote emploie des indépendants payés à la livraison : faire qualifier l'article 22 et la directive 2024/2831 avant d'activer l'affectation automatique.
5. Dans la page Confidentialité, section 11 : ne rien déclarer sur la décision automatisée tant que ces points ne sont pas confirmés ([vérification](VERIFICATION_2026-11-02.md), section 6).

## 4. Non vérifié

- Écrans du portail client et du suivi public non rejoués en navigateur pour ce document : l'absence de coordonnée côté destinataire repose sur le code commenté.
- Texte de la directive 2024/2831 et état de sa transposition non relus.
- Aucune durée de conservation décidée : elles restent à la section 4 de la [vérification](VERIFICATION_2026-11-02.md).
