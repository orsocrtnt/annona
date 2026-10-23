# J5 — Comparaison contractuelle avec l'implémentation réelle

**Date :** 22 octobre 2026  
**Statut :** documentation de travail — **NO-GO pour toute donnée personnelle réelle**  
**Périmètre :** comparaison des onze fichiers J5 fournis par Google Drive avec le dépôt `preproduction`, les preuves DB/Storage/Auth, les configurations documentées et [`J5_AUDIT_FACTUEL_DEV.md`](./J5_AUDIT_FACTUEL_DEV.md).

Ce document ne valide pas juridiquement les textes. Il indique ce qui correspond au logiciel, ce qui doit rester conditionnel, ce qui doit être corrigé dans les documents et ce qui exige encore une correction technique. Aucun fichier Drive, code, environnement, déploiement ou abonnement n'a été modifié.

## 1. Sources J5 comparées

| Fichier | Source | Usage dans cette comparaison |
|---|---|---|
| `00_LIRE_EN_PREMIER.txt` | [Drive](https://drive.google.com/file/d/11WTPrIcuU-YyB0XzwuOD3IlWXHpmebfz/view) | Statut, identité pressentie et avertissements de publication. |
| `01_CGV_SAAS_B2B.txt` | [Drive](https://drive.google.com/file/d/17kar2nK1j3dVLc--2ltvnVomsoo88Tpv/view) | Offre, facturation, droits, disponibilité et sortie. |
| `02_CONTRAT_DE_SERVICE_ET_CGU.txt` | [Drive](https://drive.google.com/file/d/1UppExl2XVp2KEtg8c3mRO9s_vVGtctdJ/view) | Rôles, GPS, preuves, sécurité et acceptation. |
| `03_POLITIQUE_DE_CONFIDENTIALITE.txt` | [Drive](https://drive.google.com/file/d/1WLqHMoBpCqYhmTaJLLzR0K6huW6tLyYA/view) | Finalités propres, sous-traitance, transferts et droits. |
| `04_DPA_ACCORD_TRAITEMENT_RGPD.txt` | [Drive](https://drive.google.com/file/d/1rnMAByRUkEAkyvHpjtywW43MqnmmeyZt/view) | Article 28, sécurité, sous-traitants, export et effacement. |
| `05_MENTIONS_LEGALES_ET_COOKIES.txt` | [Drive](https://drive.google.com/file/d/1n3ImFeQGILgJDLCUZDjjA83KYeW-UH82/view) | Éditeur, hébergeur, cookies et contacts. |
| `06_CONVENTION_PILOTE_GRATUIT.txt` | [Drive](https://drive.google.com/file/d/1zsS2cr1cct6gBgUshRgj41TMy04hMEUy/view) | Conditions suspensives et sortie d'un pilote réel. |
| `07_NOTICE_GEOLOCALISATION_LIVREURS.txt` | [Drive](https://drive.google.com/file/d/1aekfYVuvWXTpJA9VLnfHe3aQC8w42Xmo/view) | Information des livreurs et réalité du suivi. |
| `08_MATRICE_DONNEES_ET_RETENTION.txt` | [Drive](https://drive.google.com/file/d/1-g1v7PVHW22kiy6BNPain9JE7V3QvKAk/view) | Inventaire et durées proposées. |
| `10_CHECKLIST_PUBLICATION_ET_J5.txt` | [Drive](https://drive.google.com/file/d/1XYFsuy3JpKxse6uYg-RFPkCQLboLr3qu/view) | Portes de publication et de lancement. |
| `11_SOURCES_ET_HYPOTHESES.txt` | [Drive](https://drive.google.com/file/d/1oc6EzXmC9Vm1yk5LsLdXncSYCf_qot9W/view) | Origine des hypothèses juridiques. |

## 2. Conclusion de la comparaison

Les documents sont prudents et, dans l'ensemble, évitent de présenter les fonctions futures comme déjà disponibles. Ils correspondent bien à la séparation Client responsable / TutelLiv sous-traitant envisagée, aux trois espaces, aux limites du GPS navigateur, à l'absence de SLA et à l'interdiction de conversion automatique des pilotes.

Ils ne sont cependant pas prêts à signer ou publier :

- les champs d'identité, contacts, hébergement et annexes Client sont incomplets ;
- le terme « dispatcher / mini-administrateur » crée une ambiguïté : le rôle technique `DISPATCHER` est limité, tandis qu'un `MINI_ADMIN` peut recevoir des droits plus larges ;
- les annexes du DPA ne reflètent pas encore les fournisseurs, transferts, mesures et limites effectivement vérifiés ;
- les durées de conservation sont correctement présentées comme proposées, mais aucun mécanisme général ne les applique ;
- les textes parlent d'export/effacement, de sauvegarde, d'alerte et d'accès support qui ne sont pas encore complets pour un Client réel ;
- la convention pilote pose de bonnes conditions suspensives, mais plusieurs sont encore en échec ou non testées ;
- les CGV décrivent plusieurs comportements commerciaux futurs — souscription, prorata, impayés, résiliation self-service et premium 60 jours — qui ne pourront devenir contractuels qu'après implémentation et recette.

La décision reste donc : **NO-GO pour un pilote avec données réelles**. Une démonstration avec données entièrement fictives reste possible.

## 3. Matrice clause juridique → réalité → correction

### 3.1 CGV SaaS B2B

| Clause | Comportement réel vérifié | Conformité / écart | Correction documentaire ou technique |
|---|---|---|---|
| Art. 1 — TutelLiv est un logiciel B2B et non un transporteur/employeur. | Le code organise commandes, affectations, suivi et preuves ; il n'exécute pas le transport. | **Conforme au produit.** Qualification juridique finale à confirmer. | Conserver. Décrire clairement les responsabilités du Client dans le bon de commande et la convention. |
| Art. 2 — Administrateur, dispatcher, livreur et espace client. | Trois espaces existent. Un rôle `DISPATCHER` technique existe ; `MINI_ADMIN` est un autre rôle configurable. | **Écart documentaire de vocabulaire.** « Dispatcher (mini-administrateur) » les confond. | Remplacer par « dispatcher dédié » ; expliquer séparément qu'un mini-admin peut recevoir une délégation, sans bénéficier automatiquement du profil dispatcher limité. |
| Art. 2 — Fonctions futures non garanties, pas de GPS permanent/native app/facturation certifiée. | Aucun suivi navigateur continu garanti, aucune app native, aucune facturation SaaS complète. | **Conforme et nécessaire.** | Conserver tant que les fonctions ne sont pas qualifiées. |
| Art. 3 — Prix et quotas Starter/Pro/Business. | Migration SaaS : 79/790 €, 179/1 790 €, 349/3 490 € ; chauffeurs 5/10/illimités ; commandes 1 000/3 000/6 000 ; admins 1/1/2 ; dispatchers 0/1/1 ; overages 0,10/0,08/0,06 €. | **Implémenté/testé dans SAAS-01A**, pas encore vendu. | Ajouter l'identifiant/version du catalogue au récapitulatif contractuel. Ne publier qu'avec le parcours commercial prêt. |
| Art. 3 — Options et sièges annuels sur 12 mensualités. | Catalogue C8 : auto-dispatch 29 € Starter (inclus Pro/Business), GPS 39/49 €, analytics/support 29 €, livreurs 12/10 €, admin extra 12 € toutes offres, dispatcher 8 € ; montant annuel ×12. | **Conforme à C8.** | Retirer « à vérifier » après recette du catalogue public, tout en conservant la version. |
| Art. 3 — Alertes 80/100/120 et dépassements non bloquants. | Calcul et événements serveur testés ; notification complète au Client non encore qualifiée. | **Partiel.** Compteur fiable, canal d'alerte utilisateur incomplet. | Garder la formule conditionnelle « lorsque les notifications sont opérationnelles » jusqu'à tests UI/e-mail. |
| Art. 3 — Définition d'une commande facturable et politique Business raisonnable. | Le compteur est incrémenté côté serveur, mais annulation/doublon/rejeu et usage raisonnable Business ne sont pas contractualisés intégralement. | **Décision restante.** | Définir l'événement facturable, corrections et plafonds d'abus avant vente. |
| Art. 4 — Activation après acceptation et paiement valide. | L'inscription actuelle crée une entreprise `LEGACY` après vérification e-mail ; aucun paiement n'est relié. `SIGNUP-1` et `SAAS-01B` sont absents. | **Fonction future, non activable.** | Laisser la balise ; ne pas proposer le parcours payant avant activation idempotente testée. |
| Art. 5–7 — Renouvellement, changements, prorata et 60 jours premium. | Règles décidées et représentables par le schéma, mais moteurs Stripe/self-service/premium absents. | **Absent techniquement.** | Présenter comme politique projet, pas comme service en vigueur. Tests nécessaires dans SAAS-01B/03/04. |
| Art. 8 — Pilote séparé, sans conversion automatique. | Modèle pilote présent dans SAAS-01A ; aucun paiement automatique. | **Conforme à l'architecture.** | Conserver et enregistrer explicitement dates/statut du pilote. |
| Art. 9 — Facturation SaaS distincte, pas de carte en clair. | Aucun Stripe ni émission de factures d'abonnement ; l'application a seulement des factures opérationnelles historiques. | **Absent pour la vente.** | Ne pas annoncer la facturation SaaS. Concevoir Stripe sandbox et une solution de facture conforme avant live. |
| Art. 10 — Impayés J0/J3/J7/J14/J30. | Statuts SaaS `RESTRICTED`/`READ_ONLY` peuvent limiter certaines actions, mais calendrier, relances, paiement et réactivation ne sont pas implémentés de bout en bout. | **Partiel/futur.** | Conserver `[À ACTIVER]` ; tests horloge, livraisons en cours, export et régularisation requis. |
| Art. 11 — Export et effacement après résiliation. | Export JSON/photos/manifeste testé sur fixtures ; tables SaaS, Auth, logs, sauvegardes et purge réelle restent incomplets. | **Écart technique P0.** | Ne promettre aucun délai. Terminer DATA-02 avant données réelles. |
| Art. 13 — Support par tickets, objectif indicatif un jour ouvré, sans SLA. | Tickets intégrés ; canal e-mail et alerte opérationnelle non actifs. | **Partiel mais formulation prudente.** | Identifier heures, responsable et canal de secours. Garder l'absence de SLA. |
| Art. 19 — Acceptations et textes complets traçables. | Aucun registre de version/acceptation contractuelle autonome relié à SIGNUP-1. | **Absent pour vente.** | Ajouter version, empreinte/texte, acteur, entreprise et horodatage avant self-service. |

### 3.2 Contrat de service / CGU

| Clause | Comportement réel vérifié | Conformité / écart | Correction documentaire ou technique |
|---|---|---|---|
| §2 — Permissions serveur et isolation par entreprise. | Contrôles `companyId`, rôles, tests A/B, RLS sans grants directs et Storage privé. | **Conforme sur les cas testés.** Le serveur privilégié reste le point de contrôle. | Conserver sans déclarer une garantie absolue. Ajouter tests à chaque nouvelle route. |
| §2 — Dispatcher sans paiements/paramètres sensibles. | `DISPATCHER` est refusé sur comptes, facturation et paramètres. `MINI_ADMIN` peut être plus large. | **Conforme seulement pour `DISPATCHER`.** | Corriger les occurrences assimilant dispatcher et mini-admin. |
| §3 — Invitation et vérification selon les mécanismes réellement disponibles. | Code présent, mais transport réel désactivé. | **Formulation compatible**, service non prêt pour pilote réel. | Renseigner le mode de création manuelle temporaire ou terminer SEC-05/EMAIL. |
| §6 — Arrêt GPS hors service, date/heure, pas de permanence garantie. | Double garde navigateur/serveur, suppression de la position courante à l'arrêt, état périmé après 45 s. Aucun test physique. | **Partiellement conforme.** | Remplacer `[À CONFIRMER DEV]` par les déclencheurs exacts ; garder la réserve mobile jusqu'à MOB-01C. |
| §7 — Photos strictement nécessaires et isolées. | Bucket privé, liens signés 1 h, contrôle entreprise/livraison, formats JPEG/PNG 5 Mo. Octets originaux/EXIF conservés. | **Écart P0 de minimisation.** | Ajouter suppression EXIF et politique de purge ; indiquer la durée de lien signée si publiée. |
| §8 — Export et suppression vérifiés. | Export partiel et aucune purge Client réelle complète. | **Écart P0.** | Laisser les modalités indéterminées et renvoyer vers l'annexe DATA-02 validée. |
| §9 — Quotas côté serveur, overages non bloquants. | SAAS-01A contrôle droits, sièges et compteurs serveur. | **Conforme techniquement.** | Ne l'activer contractuellement qu'avec le parcours payant. |
| §10–12 — Support, incident, sécurité et révocation. | Support intégré, révocation de sessions testée ; alertes externes, MFA fournisseur et registre d'incident non prouvés. | **Partiel.** | Décrire seulement les mesures attestées dans l'annexe B du DPA. |
| §14 — Acceptation versionnée. | Absente. | **Écart vente.** | Implémenter avec SIGNUP-1/LEGAL-2 avant souscription autonome. |

### 3.3 Politique de confidentialité

| Clause | Comportement réel vérifié | Conformité / écart | Correction documentaire ou technique |
|---|---|---|---|
| §1 — TutelLiv responsable pour prospection, abonnement, support et sécurité ; sous-traitant des opérations Client. | Répartition cohérente avec l'architecture. | **Compatible, qualification à confirmer.** | Compléter identité/contacts et le registre par traitement. |
| §3 — Données propres à TutelLiv. | Comptes, sécurité, support et catalogue existent ; prospection/CRM/paiement futur ne sont pas des modules actifs. | **Partiel.** | Distinguer clairement « collecté aujourd'hui » et « collecté après activation commerciale ». |
| §4 — Inventaire opérationnel. | Commandes, adresses, contacts, statuts, GPS, incidents, messages, POD et factures opérationnelles existent. | **Globalement conforme mais incomplet.** | Ajouter notifications, adresses récurrentes, file IndexedDB, données Auth, logs, jobs et données SaaS. |
| §5–6 — Fournisseurs et transferts. | Supabase/Vercel/GitHub/OSM/OSRM/IGN/BAN actifs ; Resend/Stripe futurs ; accès et sous-traitants mondiaux possibles. | **Annexe incomplète.** | Remplacer `[À CONFIRMER DEV]` par l'inventaire de ce document et dater les listes de sous-traitants. |
| §7 — Durées. | Aucune durée générale appliquée ; seulement nettoyage démo ciblé non planifié. | **Écart P0.** | Conserver toutes les durées en « proposée » jusqu'à décision et mécanismes testés. |
| §8 — Pas de surveillance permanente et photos restreintes. | GPS borné ; photo privée mais EXIF conservé. | **Partiel.** | Ajouter limites mobiles, EXIF et stockage hors ligne. |
| §9 — Sécurité. | RBAC/A-B/Storage privé/restauration ponctuelle présents ; MFA, alertes et sauvegarde continue incomplets. | **Formulation prudente compatible.** | Annexe technique datée avec preuve par contrôle, sans « conformité garantie ». |
| §10 — Droits. | Aucun workflow DSR complet ; export opérateur seulement. | **Partiel.** | Décrire canal et délais après mise en place ; prévoir routage Client/TutelLiv. |
| §11 — Décisions automatisées. | Dispatch automatique attribue une mission selon disponibilité/charge ; aucun effet juridique significatif démontré, mais analyse métier/juridique non faite. | **Non vérifié juridiquement.** | Décrire logique, intervention/override humain et conséquences réelles avant conclure. |
| §12 — Traceurs. | Auth, cookies démo, préférence localStorage et IndexedDB ; aucun analytics/publicité tiers. | **Inventaire partiel.** | Publier les clés/familles et durées ; ne pas déployer de CMP marketing sans traceur concerné. |

### 3.4 DPA article 28 et annexes

| Clause | Comportement réel vérifié | Conformité / écart | Correction documentaire ou technique |
|---|---|---|---|
| §1–3 — Instructions et confidentialité. | L'application exécute les actions Client par rôles, mais aucune procédure interne signée d'habilitation/confidentialité n'est vérifiable dans le dépôt. | **Technique partielle, organisation non vérifiable.** | Établir registre des personnes habilitées, engagements et revue périodique. |
| §4 / Annexe B — Sécurité et séparation. | Préproduction séparée, RLS/grants, contrôles serveur, Storage privé et restauration isolée prouvés. | **Partiellement attestable.** | Inscrire uniquement les contrôles réellement testés, avec date et limites. |
| §5 / Annexe C — Sous-traitants. | Inventaire source incomplet ; GitHub, OSRM, BAN et IndexedDB/appareil n'y sont pas correctement qualifiés. | **Écart documentaire P0.** | Compléter la liste active, rôle, entité, pays, données, sous-traitants et préavis. |
| §6 — Transferts hors EEE. | Supabase et Vercel peuvent impliquer accès/transferts internationaux malgré Paris. | **Formulation correcte, annexe absente.** | Ajouter mécanismes DPA/SCC et analyse des accès, sans promettre « France uniquement ». |
| §7 — Assistance aux droits. | Export partiel ; pas de workflow demande/rectification/effacement complet. | **Partiel.** | Créer procédure, journal, contrôle identité, délais et responsabilités. |
| §8 — Violation de données. | Reporter local et runbook présents ; aucun canal réel, responsable désigné ou exercice complet. | **Écart P0 opérationnel.** | Ne pas adopter l'objectif 24 h avant OPS-03B et une astreinte réaliste. |
| §10 — Audit. | Rapports/preuves techniques disponibles, mais pas de processus de demande/audit Client formalisé. | **Partiel organisationnel.** | Définir canal, périmètre, fréquence, confidentialité et coûts sans limiter les droits légaux. |
| §11 — GPS. | Arrêt côté code testé ; aucun test physique. | **P0 non testé.** | Compléter après MOB-01C seulement. |
| §12 / Annexe D — Restitution/effacement. | Archive JSON/photos/manifeste testée ; canal, chiffrement, Auth, SaaS, logs, backups et purge finale manquent. | **Écart P0.** | DATA-02 complet avant signature avec données réelles. |
| Annexe A — Données. | Liste proche du réel. | **Incomplète.** | Ajouter Auth, notifications, logs, file hors ligne, factures opérationnelles, adresses récurrentes, données SaaS et fournisseurs carto. |

### 3.5 Mentions légales, cookies et convention pilote

| Clause | Comportement réel vérifié | Conformité / écart | Correction documentaire ou technique |
|---|---|---|---|
| Mentions §1 — Éditeur. | Nom/adresse fournis ; SIREN/SIRET/TVA/registre/contact/téléphone et statut final non confirmés. | **Non publiable.** | Compléter après immatriculation et décision de contact public. |
| Mentions §2 — Hébergeur. | Site préproduction sur Vercel ; DB/Auth/Storage Supabase. | **Incomplet.** | Site : Vercel Inc., adresse officielle déjà relevée. Téléphone général Vercel non vérifié : ne pas recycler le numéro DMCA. Décrire Supabase dans confidentialité/sous-traitants. |
| Mentions §6 — Cookies/traceurs. | Aucun analytics/pub ; cookies Auth/démo, localStorage et IndexedDB existent. | **Partiel.** | Remplacer les champs DEV par l'inventaire réel et les durées connues ; durée Auth à relever dans Supabase. |
| Pilote art. 1–3 — 4 semaines, gratuit, sans paiement ni conversion. | Architecture pilote séparée et aucun paiement actif. | **Conforme.** | Compléter dates, comptes, fonctions et mode de secours par entreprise. |
| Pilote art. 4 — Huit conditions avant données réelles. | Plusieurs conditions sont FAIL/NON TESTÉ : hébergement, DPA final, mobiles, rétention, backup continu, incidents, identité. | **Condition suspensive non levée.** | Conserver exactement le NO-GO. La signature seule ne lève pas les contrôles techniques. |
| Pilote art. 9 — Mesures agrégées. | Pas d'analytics pilote complet ; données opérationnelles permettent certains comptages. | **Partiel.** | Définir métriques minimales sans évaluation individuelle des livreurs. |
| Pilote art. 11 / annexe 3 — Sortie. | Export partiel ; aucune date/purge complète garantie. | **P0.** | Ne renseigner les délais qu'après DATA-02 et exercice complet. |
| Notice livreurs §2–4 — Déclenchement, fréquence, arrêt, accès. | Mission démarrée + service actif ; `watchPosition`, envoi environ toutes les 4 s avec réglage actuel ; position courante périmée à 45 s ; admin et client de la livraison peuvent voir la position fraîche et le nom du chauffeur. | **Peut être complété techniquement**, sous réserve mobile. | Décrire ces faits, préciser le rôle `DISPATCHER`, la visibilité Client et les limites d'arrière-plan. |
| Notice §6 — Durées. | Aucune purge GPS/historique générale. | **Ne pas renseigner 60 jours comme durée effective.** | Conserver « proposée » jusqu'à décision et implémentation. |
| Notice §7 — Photos supprimées à échéance. | Pas de purge générale ; EXIF conservé. | **Écart P0.** | Corriger techniquement avant toute promesse. |
| Matrice §9 — Démo sous 24 h. | Sessions ont une échéance de 8 h ; route de nettoyage bornée préparée mais non planifiée/activée. | **Partiel.** | Dire « session expire après 8 h ; suppression planifiée non active ». |
| Matrice §10 — Pilote supprimé sous 30 jours. | Hypothèse seulement. | **Non implémenté.** | Ne pas contractualiser avant décision et preuve de purge de toutes les couches. |

## 4. Les neuf blocages P0 détaillés

| P0 | Preuves techniques | Risque concret | Correctif attendu | Tâche DEV correspondante |
|---:|---|---|---|---|
| 1. Hébergement commercial et DPA | `.vercel/project.json`, `docs/operations/preproduction/README.md` : Vercel Hobby ; `vercel.json` sans région. Conditions Vercel : Hobby personnel/non commercial ; DPA Pro/Enterprise. | Usage contractuellement inadéquat, absence de cadre sous-traitant Vercel sur Hobby, localisation d'exécution non consignée. | Choisir Vercel Pro ou migration validée ; accepter/archiver DPA, lister sous-traitants, configurer région/spend/MFA et tester. | **Nouveau `HOST-1` proposé**, lié à ENV-1/LEGAL-1. |
| 2. Dossier juridique et identité non finalisés | Fichiers J5 avec SIREN/SIRET/TVA/contact/signatures/annexes vides ; aucune acceptation versionnée. | Contrat non signable, information incomplète, absence de preuve d'acceptation. | Compléter identité et contacts, corriger les clauses de ce rapport, finaliser annexes Client puis validation appropriée. | **LEGAL-1** ; intégration future avec SIGNUP-1/LEGAL-2. |
| 3. GPS mobile non testé | `watchPosition` et gardes dans le code ; seulement protocole `docs/operations/mob01c/README.md`. | Suivi suspendu ou position trompeuse ; promesse impossible ; risque de collecte hors contexte selon appareil. | Essais iPhone/Android réels : verrouillage, arrière-plan, refus, coupure, économie, arrêt service, reprise, captures et résultat signé. | **MOB-01C** puis V1-GO. |
| 4. Cartographie publique non qualifiée | `docs/operations/map-providers.md`, `src/lib/geocoding.ts`, composants carte : OSM/OSRM depuis navigateur, IGN/BAN serveur. | Transmission de coordonnées/adresses/IP sans garanties adaptées, quotas/SLA insuffisants, indisponibilité. | Choisir fournisseurs commerciaux ou auto-hébergement adapté ; DPA/conditions, région, quotas, fallback et tests. | **Nouveau `MAP-4` proposé**, distinct du design MAP-3. |
| 5. POD/stockage hors ligne non minimisés | `src/lib/storage/pod.ts` conserve les octets originaux ; `offline-action-queue.ts` garde photo/coordonnées/notes sans TTL. | EXIF GPS ou appareil divulgué ; données persistantes sur terminal perdu/partagé. | Suppression EXIF serveur, TTL et purge logout/changement de compte, réduction des champs, tests d'orphelins/export. | **Nouveau `POD-2` proposé**, lié à DATA-02/MOB-01C. |
| 6. Export, rétention et effacement incomplets | `company-export.service.ts`, `company-archive.service.ts`, `outputs/data02/connected.json` ; Auth/backups non supprimés, tables SaaS omises. | Impossibilité de respecter la sortie Client et les demandes ; résidus inter-systèmes. | Export v2 complet, canal chiffré, suppression idempotente DB/Auth/Storage/logs, rotation backup et preuve A/B. | **DATA-02**. |
| 7. Sauvegarde continue et alertes absentes | OPS-03A prouve une restauration ponctuelle ; plan Free sans RPO 1 h et Storage séparé. Reporter présent mais webhook non configuré. | Perte de données non détectée, réponse incident tardive, engagements DPA non tenables. | Sauvegarde chiffrée planifiée DB/Auth/Storage, supervision des échecs, alertes réelles, exercice RPO/RTO. | **OPS-03A — extension exploitation** + **OPS-03B**. |
| 8. E-mails d'accès non actifs | SEC-05 code/tests ; `AUTH_EMAIL_LINKS_ENABLED=false`, transport désactivé, aucun domaine/expéditeur qualifié. | Invitations/récupération impossibles ou non fiables ; comptes partagés/manuels ; incident d'accès. | Domaine et expéditeur, SMTP Auth/transactionnel, SPF/DKIM/DMARC, tests d'expiration/abus/délivrabilité. | **SEC-05** + **EMAIL**. |
| 9. Administration fournisseurs non vérifiée | Aucun état probant MFA, SSL enforcement PostgreSQL, détenteurs d'accès/pays, logs admin ou rotation des secrets. | Compromission d'une console, accès international non documenté, transfert/sécurité non démontrés. | Inventaire des accès, MFA obligatoire, moindre privilège, revue périodique, SSL enforcement, rotation et preuves datées. | **Nouveau `SEC-07` proposé**, lié à LEGAL-1. |

Les nouveaux identifiants sont des propositions de découpage ; ils ne sont pas ajoutés à `TODO.md` par cette étape documentaire.

## 5. Changements obligatoires avant pilotes réels

Ces éléments sont nécessaires même si le pilote est gratuit et les comptes créés manuellement :

1. lever les neuf P0 ci-dessus et refaire une revue V1-GO/PILOT-J5 sur preuves datées ;
2. compléter et signer convention pilote, DPA et annexes avec l'identité réelle, les fournisseurs actifs et les personnes habilitées ;
3. fournir au Client la notice livreurs personnalisable et vérifier qu'il a informé les personnes concernées ;
4. n'autoriser que les fonctions testées, avec mode alternatif en cas d'incident ;
5. définir les données admises, les métriques, la période, les comptes et le canal de sécurité de chaque pilote ;
6. tester l'isolement des trois entreprises, les photos, le GPS physique et la sortie complète ;
7. exécuter et observer sauvegarde/restauration/alerte sur l'environnement pilote ;
8. consigner une décision écrite **GO données réelles**. Sans elle, les environnements restent fictifs.

## 6. Fonctions nécessaires uniquement à la commercialisation payante

Ces fonctions ne bloquent pas un pilote gratuit créé manuellement, mais bloquent une vente autonome :

- `SIGNUP-1` : choix offre/options, identité entreprise, acceptation versionnée et activation idempotente ;
- `SAAS-01B` : Stripe sandbox, webhooks, prorata, renouvellement, impayés et facturation testés ;
- `SAAS-03` : « Mon abonnement », changement, résiliation, documents, export et confirmations de dépense ;
- `SAAS-04` : 60 jours premium, expiration sans achat automatique ;
- règles finales de commande facturable, politique Business raisonnable et gestion des corrections d'overage ;
- moteur de factures SaaS compatible avec les obligations françaises et régime TVA réel ;
- pages légales publiques versionnées et preuve d'acceptation ;
- tarif et disponibilité réellement affichés, sans fonction de roadmap présentée comme active.

## 7. Vercel Pro ou Scaleway Serverless Containers

Prix consultés le 22 octobre 2026. Ils sont indicatifs, hors taxes et peuvent changer. Aucun abonnement n'a été souscrit.

| Critère | Vercel Pro | Alternative étudiée : Scaleway Serverless Containers Paris |
|---|---|---|
| Prix de base | [Tarif officiel](https://vercel.com/pricing) : **20 USD/mois** pour le plan Pro affiché, avec **20 USD de crédit d'usage** ; sièges développeur supplémentaires et dépassements facturés. TVA en plus selon facturation. | [Tarif officiel](https://www.scaleway.com/en/pricing/serverless/) : 0,000002 €/GB-s et 0,00001 €/vCPU-s après free tiers de 400 000 GB-s et 200 000 vCPU-s. Paiement à l'usage. |
| Ordre de grandeur TutelLiv | Minimum d'environ 20 USD/mois pour un propriétaire/développeur, tant que l'usage reste dans le crédit ; surveiller builds, compute, transfert et logs. | Conteneur 0,5 vCPU/1 Go toujours actif sur 30 jours : environ **15,34 € HT/mois** après free tier. À 1 vCPU/1 Go : environ **28,30 € HT/mois**. Registry, logs, réplicas et autres services peuvent s'ajouter. Avec scale-to-zero, coût inférieur mais cold starts. |
| Next.js | Intégration native, Preview automatique, CDN, rollback, variables et cron déjà utilisés. | Next.js officiellement documenté via Docker/Container Registry et `next start`. Dockerfile, image, CI/CD, secrets, cron, previews et rollback doivent être construits/configurés. |
| Charge de migration | Faible : changement de plan et durcissement de la configuration, sans refonte de déploiement. | Moyenne à élevée : conteneurisation, pipeline, environnements, observabilité, rollback, URL/cron et tests de parité. |
| Préproduction | Déjà opérationnelle par branche/Preview. | Il faut créer un conteneur préproduction distinct et une stratégie d'URL/versions ; pas de Preview par branche équivalente prête à l'emploi. |
| Contrat/RGPD | [DPA Vercel](https://vercel.com/legal/dpa) applicable à Pro/Enterprise ; entité américaine, sous-traitants et transferts à documenter avec garanties. Pro retire le blocage Hobby, mais ne signifie pas « données en France ». | [DPA Scaleway](https://www-uploads.scaleway.com/DPA_2024_FR_0230ccdb42.pdf) avec entité française ; services localisés par défaut dans l'UE et région choisie par le Client. Les sous-traitants, accès et éventuels transferts restent à inventorier. |
| Localisation/latence | Région d'exécution actuelle non fixée dans `vercel.json`; à configurer près de Supabase Paris et vérifier dans le projet. CDN global et journaux peuvent traverser plusieurs régions. | Conteneur déployable à Paris ; rapprochement de Supabase Paris possible. La région ne dispense pas d'analyser support, logs, registry et sous-traitants. |
| Exploitation | Moins de maintenance, excellente compatibilité Next.js ; facturation en USD et dépendance forte à Vercel. | Plus de contrôle européen et facturation en euros ; responsabilité accrue sur image, mises à jour, capacité, cold starts et pipeline. |
| Risque de dépense | Pro dispose de spend management mais les dépassements restent à configurer/surveiller. | Usage variable ; min=1 produit une dépense continue, autoscaling peut augmenter la facture ; alertes de facturation à configurer. |

### Recommandation à ce stade

Pour atteindre rapidement trois pilotes, **Vercel Pro est l'option la moins risquée techniquement** parce que la préproduction, les previews et les rollbacks existent déjà. Il faut néanmoins vérifier le plan effectif, accepter/archiver le DPA, configurer la région d'exécution, imposer MFA, limiter les accès et activer des plafonds/alertes de dépense. Cette voie implique des transferts et une relation avec une entité américaine à documenter.

**Scaleway Serverless Containers est une alternative crédible si la priorité devient l'hébergement applicatif en France/UE et un cocontractant français.** Elle ne supprime pas les enjeux Supabase, cartographie, e-mail ou appareils, et elle ajoute une migration technique qui doit être traitée comme une tâche séparée. Son coût peut être inférieur à Vercel Pro à faible charge avec scale-to-zero, ou comparable/supérieur avec une instance toujours chaude.

Décision recommandée avant correction :

1. obtenir le coût réel affiché par Vercel pour l'équipe actuelle et confirmer le DPA/plan ;
2. estimer le besoin de cold-start et la charge pilote ;
3. si Vercel Pro est accepté, le retenir pour les pilotes et réévaluer l'hébergement à partir des mesures ;
4. si un engagement France/UE est exigé par les pilotes, préparer un prototype Scaleway séparé et une recette complète avant bascule ;
5. ne souscrire ni migrer sans autorisation explicite du fondateur.

## 8. Corrections documentaires immédiates, sans développement

Les fichiers J5 peuvent déjà être corrigés sur ces points, tout en restant non publiables :

- remplacer partout « dispatcher / mini-administrateur » par deux notions distinctes ;
- remplir l'annexe fournisseur avec les statuts **actif**, **futur** ou **non vérifié** de ce rapport ;
- ajouter GitHub, OSRM, BAN/IGN, appareils/IndexedDB et journaux de plateforme à l'inventaire ;
- inscrire les déclencheurs GPS exacts, la cadence approximative actuelle, le seuil de péremption et les rôles visibles, avec réserve mobile ;
- inscrire bucket privé, lien signé d'une heure, formats et limite 5 Mo, plus la lacune EXIF ;
- marquer toute durée GPS/POD/pilote/log/backup comme **proposée et non appliquée** ;
- indiquer que l'export est une archive opérateur testée sur fixtures et non un portail Client complet ;
- déclarer Resend et Stripe « pressentis/inactifs » ;
- ne pas publier de téléphone général Vercel tant qu'une source officielle appropriée n'est pas trouvée ;
- conserver les balises SIREN/SIRET/TVA/contact/signature et le statut non publiable jusqu'à leur résolution.

## 9. Porte de sortie de cette phase

Cette comparaison documentaire est terminée lorsque :

- les sources J5 sont référencées ;
- chaque écart est associé à une correction documentaire ou technique ;
- les neuf P0 et leurs tâches sont identifiés ;
- pilote gratuit et commercialisation payante sont séparés ;
- le choix d'hébergement reste une décision explicite, sans dépense automatique.

Elle ne ferme pas `LEGAL-1`, `DATA-02`, `MOB-01C`, `OPS-03B`, `SEC-05`, `EMAIL` ou V1-GO. Le prochain jalon de conformité reste une revue PASS/FAIL sur preuves après correction, avec **NO-GO données réelles** tant qu'un P0 est ouvert.
