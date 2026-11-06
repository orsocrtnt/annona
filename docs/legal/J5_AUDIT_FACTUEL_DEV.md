# J5 — Audit factuel du dépôt, des données et des environnements

> **Photo du 22 octobre 2026, non mise à jour.** État actuel : [vérification du 2 novembre 2026](VERIFICATION_2026-11-02.md). Par exemple, `provision-company-admin.ts` cité plus bas n'existe plus.

**Date de l'audit :** 22 octobre 2026  
**Périmètre :** branche locale `preproduction`, schéma Prisma, code applicatif, tests, preuves de préproduction déjà produites et configurations documentées.  
**Nature du document :** constat technique destiné à la préparation de J5. Ce document n'est ni un avis juridique, ni une validation RGPD, ni une autorisation de traiter des données réelles.

> **Complément du 22 octobre 2026.** Les onze fichiers J5 ont ensuite été rendus accessibles en lecture depuis le dossier Google Drive communiqué par le fondateur. La comparaison clause par clause, les corrections documentaires et techniques et l'étude Vercel Pro/Scaleway figurent dans [`J5_COMPARAISON_CONTRACTUELLE.md`](./J5_COMPARAISON_CONTRACTUELLE.md). Le constat technique ci-dessous reste la photographie de l'implémentation auditée.

## 1. Résumé exécutif

Annona dispose d'un socle fonctionnel réel : trois espaces opérationnels, permissions applicatives, séparation par entreprise, preuve photo privée, géolocalisation bornée aux missions actives, catalogue SaaS et quotas côté serveur. La base de préproduction isolée a été contrôlée avec 29 tables applicatives, RLS active, absence de droits directs pour les rôles publics du navigateur et absence de dérive Prisma. Des restaurations isolées de la base, de Supabase Auth et de fichiers Storage ont été exercées.

Le produit ne doit toutefois pas accueillir de données réelles de pilotes à ce stade. Les principaux blocages sont contractuels et techniques : Vercel est documenté en formule Hobby, laquelle est réservée par les conditions publiées à un usage personnel/non commercial et n'est pas couverte par le DPA Vercel ; les textes J5 à comparer ne sont pas présents ; les essais GPS sur téléphones physiques ne sont pas faits ; l'usage commercial des services cartographiques publics n'est pas validé ; les photos originales conservent potentiellement leurs métadonnées EXIF ; l'export/effacement complet d'une entreprise ne couvre pas encore Auth, tous les objets Storage, les sauvegardes et les nouvelles tables SaaS ; aucun cycle de sauvegarde hors site avec RPO démontré ni canal d'alerte réel n'est actif.

Le parcours commercial autonome reste planifié. `SAAS-01A` fournit le catalogue et les contrôles serveur, mais le choix de l'offre à l'inscription, Stripe, la gestion autonome de l'abonnement et les 60 jours premium ne sont pas actifs. Ils ne doivent pas être présentés comme vendus ou disponibles.

### Statut global

| Domaine | État factuel | Porte actuelle |
|---|---|---|
| Parcours livraison et trois espaces | **Implémenté/testé**, avec limites terrain | Démonstration fictive possible |
| Isolation applicative A/B et Storage privé | **Implémenté/testé** sur cas couverts | Contrôles à maintenir à chaque nouvelle route |
| GPS | **Partiel** | Appareils réels et rétention à valider avant pilote réel |
| Export, suppression et rétention | **Partiel** | DATA-02 à terminer avant données réelles |
| Sauvegarde/restauration | **Partiel** | Restauration prouvée ; fréquence/RPO et périmètre continu non prouvés |
| E-mails d'authentification | **Présent mais désactivé/non testé en réel** | Domaine, expéditeur et recette requis |
| Catalogue SaaS et quotas | **Implémenté/testé** | Pas encore relié à un parcours payant autonome |
| Paiement et self-service | **Absent** | Aucun paiement réel autorisé |
| Cadre juridique J5 | **Non vérifiable/incomplet** | Sources J5 absentes et identité légale incomplète |

## 2. Méthode, sources et limites

L'audit est fondé sur :

- le schéma [`prisma/schema.prisma`](../../prisma/schema.prisma), les migrations et les données de référence ;
- le code des domaines Auth, commandes, livraisons, GPS, Storage, export, démonstration, opérations et SaaS ;
- les tests locaux et les rapports versionnés sous `docs/rapports/` ;
- les preuves structurées sous `outputs/db1/`, `outputs/ops03a/` et `outputs/data02/` ;
- les noms et états non secrets des variables locales et de préproduction ;
- les documents officiels des fournisseurs cités en annexe.

Les secrets n'ont pas été affichés. Aucun changement de base, schéma, configuration distante, donnée, DNS ou déploiement n'a été effectué.

Lors du premier passage, les fichiers annoncés dans le dossier J5 n'étaient présents ni dans le dépôt, ni dans la pièce jointe reçue. Ils ont depuis été lus dans le dossier Google Drive communiqué par le fondateur : `00`, `01_CGV`, `02_CONTRAT/CGU`, `03_CONFIDENTIALITE`, `04_DPA`, `05_MENTIONS/COOKIES`, `06_CONVENTION_PILOTE`, `07_NOTICE_GPS`, `08_MATRICE_RETENTION`, `10_CHECKLIST` et `11_SOURCES`. Leur comparaison est désormais réalisée dans le document complémentaire cité ci-dessus ; les fichiers sources eux-mêmes n'ont pas été modifiés.

L'identité envisagée fournie par le fondateur est **Carotenuto - Marchetti Orso (EI), 10 traverse de la gaye, 13009 Marseille**. Le SIREN/SIRET n'est pas disponible et n'est pas inventé. L'adresse de contact juridique et le canal de support à publier ne sont pas encore confirmés.

## 3. Blocages P0 avant un pilote avec données réelles

1. **Hébergement Vercel incompatible avec le pilote commercial dans l'état documenté.** Le projet est documenté sur Vercel Hobby. Les [conditions Vercel](https://vercel.com/legal/terms) réservent Hobby à un usage personnel/non commercial. Le [DPA Vercel](https://vercel.com/legal/dpa) s'applique aux offres Pro et Enterprise, pas à Hobby. Les conditions publiées indiquent aussi un régime de contenu particulier pour Hobby et certains essais Pro. Le forfait réellement attaché au projet et les conditions acceptées doivent être confirmés ; aucune donnée personnelle réelle ne doit être déposée sur Hobby entre-temps.
2. **Textes J5 absents et identité éditrice incomplète.** Les documents contractuels, notices, DPA et matrice de conservation ne peuvent pas être confrontés au produit. Le SIREN/SIRET et les canaux publics restent à compléter avant signature ou publication.
3. **GPS non validé sur iPhone/Android physiques.** Le code borne la collecte aux missions démarrées et au service actif, mais aucun essai réel avec verrouillage, arrière-plan, économie d'énergie, coupure réseau et refus de permission n'a été exécuté. Aucune promesse de suivi continu ne peut être faite.
4. **Cartographie publique non validée pour un SaaS réel.** Par défaut, le navigateur transmet des coordonnées à OSRM public et charge les tuiles OpenStreetMap ; les adresses sont géocodées via IGN/BAN. Les conditions, capacités, DPA éventuels et limites d'usage commercial doivent être validés ou ces services remplacés/configurés.
5. **Photos et données hors ligne insuffisamment minimisées.** Les JPEG/PNG de preuve sont stockés dans leur forme originale ; aucune suppression EXIF n'est prouvée. La file IndexedDB du livreur peut conserver photo, coordonnées, notes et prix sans durée d'expiration ni purge de déconnexion démontrée.
6. **Sortie d'un Client incomplète.** L'archive exporte le métier principal et les photos, mais omet les tables SaaS ajoutées, Supabase Auth et des données techniques. La suppression réelle coordonnée DB/Auth/Storage/logs/sauvegardes n'existe pas. Le test actuel ne supprime que des fixtures synthétiques strictement ciblées.
7. **Sauvegarde continue et alertes non opérationnelles.** La restauration isolée est prouvée, mais le plan gratuit ne fournit pas le RPO horaire attendu, Storage n'est pas inclus dans une sauvegarde de base standard et aucun canal d'alerte réel n'est configuré. Un processus récurrent, chiffré, vérifié et surveillé est requis.
8. **E-mails d'accès réels désactivés.** Confirmation, invitation et récupération existent dans le code, mais `AUTH_EMAIL_LINKS_ENABLED` et le transport applicatif sont désactivés dans les configurations inspectées. Domaine, expéditeur, modèles, anti-abus et recette réelle sont nécessaires pour un pilote sécurisé.
9. **Contrôles d'administration du fournisseur non vérifiés.** MFA/2FA des comptes Supabase, Vercel et GitHub, personnes ayant accès hors UE, chiffrement SSL obligatoire de PostgreSQL et journaux d'accès administrateur n'ont pas pu être confirmés depuis le dépôt.

Une démonstration sur données entièrement fictives reste possible pendant la fermeture de ces points.

## 4. Priorités P1 avant la vente

- finaliser et publier des textes juridiques versionnés, puis enregistrer la version acceptée par entreprise et acteur ;
- terminer l'inscription autonome, le paiement fictif puis Stripe sandbox, la gestion d'abonnement et la découverte premium avant toute activation réelle ;
- ajouter MFA ou une politique d'authentification renforcée pour les administrateurs, protection anti-abus, en-têtes de sécurité et stratégie CSRF explicitement testée ;
- automatiser les durées approuvées, la purge complète, la traçabilité des demandes et la disparition des sauvegardes ;
- définir les rôles internes Annona, l'approbation des accès support et un journal d'audit de ces accès ;
- documenter cookies et stockage local, avec mécanisme de consentement seulement pour les traceurs qui l'exigeraient ;
- activer monitoring, alertes, registre d'incident/violation, durée des journaux et exercices périodiques ;
- contractualiser les fournisseurs actifs, leurs sous-traitants et les transferts hors EEE ;
- remplacer ou contractualiser les fournisseurs cartographiques publics adaptés au trafic et aux données traitées ;
- mesurer performance, capacité, coûts et restauration sur un scénario représentatif avant engagements commerciaux.

## 5. Matrice factuelle principale

Les niveaux utilisés sont : **implémenté/testé**, **partiel**, **absent**, **non vérifiable**.

| # | Affirmation contractuelle possible | État réel | Preuve précise et résultat | Impact RGPD / contrat | Correctif recommandé | Criticité pilote réel / vente |
|---:|---|---|---|---|---|---|
| 1 | Annona sépare les espaces administrateur, client et livreur. | **Implémenté/testé** | Arborescence `src/app/(back-office)`, `src/app/(client-portal)`, `src/app/(driver-app)` ; `tests/account-access.test.ts`, `tests/tenant-boundaries.test.ts`, `tests/client-data.test.ts`. | Permet l'information par profil et la limitation des accès. | Maintenir une matrice de droits et tester chaque nouvelle route. | Pilote : haute ; vente : haute. |
| 2 | Un dispatcher n'accède ni à la facturation ni à la sécurité/gestion des utilisateurs. | **Implémenté/testé** pour le rôle `DISPATCHER` ; **partiel** pour `MINI_ADMIN`. | `prisma/reference-data.ts` limite `DISPATCHER` aux commandes, livraisons, chauffeurs, véhicules, support et tableau de bord ; `tests/saas-core.test.ts` refuse utilisateurs, paramètres, factures et entreprises. `MINI_ADMIN` reste large par défaut et dépend des délégations. | Le contrat et les guides doivent distinguer le dispatcher dédié du mini-admin configurable. | Utiliser `DISPATCHER` pour cette promesse ; documenter les délégations mini-admin. | Pilote : moyenne ; vente : haute. |
| 3 | Les entreprises A et B sont isolées. | **Implémenté/testé sur les scénarios couverts** | Gardes `companyId` dans les services/routes ; matrices A/B dans `tests/tenant-boundaries.test.ts`, `tests/account-access.test.ts`, `tests/saas-core.test.ts` et recette SEC-06 dans `docs/RECETTE_V1.md`. Préproduction : 29 tables RLS, aucun grant direct public/anon/authenticated, rapport `outputs/db1/preproduction-validation.json`. | La RLS sans policy bloque les accès directs, mais le serveur privilégié reste responsable de tous les filtres. Il ne s'agit pas d'une preuve formelle exhaustive. | Ajouter un test d'isolation pour toute nouvelle entité/route ; journaliser les accès internes. | Pilote : critique ; vente : critique. |
| 4 | Les preuves photo sont privées et accessibles seulement par lien temporaire autorisé. | **Implémenté/testé** | `src/lib/storage/pod.ts` : bucket privé, chemin entreprise/livraison, validation JPEG/PNG, 5 Mo, lien signé 3 600 s ; `tests/pod-access.test.ts`, `tests/performance.test.ts`. Préproduction : bucket privé et MIME restreints. | Réduit l'exposition directe ; un destinataire du lien peut encore le partager pendant sa validité. | Réduire la durée si possible, journaliser les accès sensibles et définir la rétention. | Pilote : haute ; vente : haute. |
| 5 | Les métadonnées cachées des photos sont minimisées. | **Absent** | `src/lib/storage/pod.ts` téléverse les octets originaux après validation structurale ; aucun traitement EXIF trouvé. `src/domains/data-lifecycle/company-archive.service.ts` archive aussi l'original. | Une photo peut contenir coordonnées GPS, appareil, date et autres métadonnées non nécessaires. | Supprimer les métadonnées côté serveur avant conservation, ou démontrer et documenter leur nécessité. | Pilote : P0 ; vente : P0. |
| 6 | Le GPS est inactif hors service et hors mission démarrée. | **Implémenté/testé côté application/serveur** | `src/features/driver/driver-location-tracker.tsx`, `src/features/driver/use-driver-live-position.ts`, `src/domains/driver/driver-location.service.ts` ; `tests/tracking.test.ts`. Le serveur exige chauffeur actif, service actif, mission démarrée ; le changement de service supprime la position courante. | Correspond au principe de limitation au temps de travail, sous réserve du comportement réel des navigateurs. | Conserver ce double verrou et faire la recette physique MOB-01C. | Pilote : critique ; vente : critique. |
| 7 | Annona garantit un suivi GPS continu sur mobile, y compris écran verrouillé. | **Non vérifiable et ne doit pas être promis** | Aucun test iPhone/Android réel. `docs/operations/mob01c/README.md` décrit seulement le protocole. Le tracker utilise l'API navigateur `watchPosition`. | Les navigateurs peuvent suspendre une PWA en arrière-plan ; une promesse continue serait trompeuse. | Présenter une position datée et son état ; décider d'une app native seulement si le terrain le justifie. | Pilote : P0 ; vente : haute. |
| 8 | La position affichée est datée et signalée comme périmée. | **Implémenté/testé** | `src/domains/tracking/tracking.policy.ts` et `tests/tracking.test.ts` : fraîcheur par défaut 45 s, coordonnées masquées si mission/service inactifs ou signal périmé, état et horodatage conservés. | Évite de présenter une position ancienne comme du direct. | Afficher partout la date, la précision disponible et un libellé « dernière position reçue ». | Pilote : haute ; vente : haute. |
| 9 | La fréquence GPS est exactement celle annoncée dans la configuration. | **Partiel** | `use-driver-live-position.ts` utilise `watchPosition` (`maximumAge` 2 s, `timeout` 15 s) et une cadence d'envoi calculée par `Math.min(intervalleConfiguré, 4 000 ms)`. Valeur active par défaut 5 s, donc envoi borné à environ 4 s ; le réglage idle 15 s n'est pas utilisé hors mission car le tracker s'arrête. | Le texte contractuel ne doit pas annoncer une cadence fixe non conforme au code/réseau. | Corriger ou expliciter la cadence, puis mesurer sur appareils réels. | Pilote : moyenne ; vente : moyenne. |
| 10 | Le client donneur d'ordre voit seulement sa livraison et la position utile du chauffeur assigné. | **Implémenté/testé sur les routes couvertes** | `src/domains/tracking/tracking.service.ts`, `tracking.policy.ts`, routes portail ; tests `tracking.test.ts`, `client-data.test.ts`, `tenant-boundaries.test.ts`. Le fil client ne reçoit pas les coordonnées historiques des événements. | Limite la surveillance et l'accès inter-entreprises. | Ajouter cette règle à la notice et maintenir les tests sur chaque vue cartographique. | Pilote : critique ; vente : critique. |
| 11 | Annona dispose d'un export complet du Client. | **Partiel** | `src/domains/data-lifecycle/company-export.service.ts` exporte entreprise, utilisateurs/rôles, adresses, position courante, notifications, récurrences, commandes/articles/étapes/livraisons/événements, messages, factures, support, jobs et chemins de preuves. Les neuf modèles SaaS, Supabase Auth, journaux fournisseur et secrets techniques ne sont pas tous exportés. | Une promesse de portabilité/sortie complète serait excessive. | Versionner un export v2 incluant les données SaaS nécessaires et un inventaire séparé Auth/logs. | Pilote : haute ; vente : P1. |
| 12 | L'archive de sortie contient les photos originales et un manifeste d'intégrité. | **Implémenté/testé sur fixtures** | `company-archive.service.ts`, `outputs/data02/connected.json` : JSON, fichiers originaux, SHA-256, rejet d'objet manquant/étranger et entreprise B intacte. Limites : 1 000 fichiers, 5 Mo/fichier, 256 Mo/archive, JSON 10 Mo. | L'intégrité technique ne constitue pas à elle seule une valeur probatoire juridique. L'archive n'est pas chiffrée par ce service. | Définir canal de remise chiffré, authentification du demandeur, expiration et journal d'audit. | Pilote : haute ; vente : haute. |
| 13 | La suppression d'une entreprise efface DB, Auth, Storage, logs et sauvegardes. | **Absent** pour le parcours réel ; **test partiel** sur fixtures DB. | `docs/operations/data02/README.md`, `outputs/data02/connected.json` : suppression ciblée d'une fixture A, B inchangée ; suppression Auth et sauvegardes non exécutée ; Storage limité aux objets exacts de fixture. | Une promesse d'effacement immédiat et total serait fausse. Les délais doivent distinguer chaque système. | Construire une procédure idempotente DB/Auth/Storage, gérer orphelins et rotation des sauvegardes, avec preuve par étape. | Pilote : P0 ; vente : P0. |
| 14 | Des durées réelles de conservation sont appliquées automatiquement. | **Absent/partiel** | `docs/operations/data02/RETENTION_POLICY_DRAFT.md` contient des hypothèses (GPS 60 j, démo ≤24 h, pilote 30 j après export). Seules des sessions de démonstration synthétiques strictement identifiées disposent d'un nettoyage ciblé ; aucun purgeur général GPS/messages/POD/support/logs. | Les durées ne peuvent pas être présentées comme effectives. | Faire valider les durées par finalité, les rendre paramétrables, puis implémenter et journaliser les purges. | Pilote : P0 ; vente : P0. |
| 15 | Les données hors ligne du livreur sont temporaires et supprimées à la déconnexion. | **Absent/non démontré** | `src/features/driver/offline-action-queue.ts` utilise IndexedDB `annona-driver-actions`, store `mission-status`, avec statut, latitude/longitude, photo Blob, notes, prix, acteur et erreurs. Suppression après envoi réussi, sans TTL ni purge de déconnexion identifiée. | Données personnelles et preuves peuvent persister sur un appareil perdu ou partagé. | Ajouter TTL, purge à la déconnexion/changement d'entreprise, chiffrement ou réduction des champs et information utilisateur. | Pilote : P0 ; vente : P0. |
| 16 | Les mots de passe sont stockés par Annona dans sa base métier. | **Faux ; ils sont gérés par Supabase Auth** | Le modèle `User` conserve `authId`, pas de hash de mot de passe ; authentification via `@supabase/ssr`. `tests/password-link.test.ts` couvre liens à usage unique et révocation de sessions sur changement. | Le DPA/inventaire doit séparer Supabase Auth et la base métier. | Décrire le fournisseur, les sessions et les durées réelles du tableau de bord Supabase. | Pilote : haute ; vente : haute. |
| 17 | MFA/2FA est imposé aux utilisateurs ou administrateurs. | **Absent dans l'application ; non vérifiable chez les fournisseurs** | Aucun flux AAL2/MFA applicatif trouvé. État MFA des comptes Supabase/Vercel/GitHub non accessible depuis le dépôt. | Risque accru sur comptes administrateurs et support. | Imposer MFA aux comptes fournisseurs et étudier MFA applicatif pour rôles sensibles. | Pilote : haute ; vente : P1. |
| 18 | Les secrets ne sont jamais envoyés au navigateur ni versionnés. | **Implémenté/partiel** | Variables serveur dans `.env*.local` ignorées ; service-role utilisé dans services serveur ; scan de secrets dans `.github/workflows/ci.yml`. Les clés publiques Supabase sont volontairement client. | Bonne séparation, sous réserve de l'historique distant et des consoles fournisseurs. | Scanner l'historique, limiter les scopes, documenter rotation et détenteurs d'accès. | Pilote : haute ; vente : haute. |
| 19 | Les sessions sont protégées et leur durée est documentée. | **Partiel** | Cookies Supabase SSR ; middleware `src/services/supabase/middleware.ts` valide les claims et replie sur utilisateur. Cookies démo `httpOnly`, `sameSite=lax`, `secure` en production ; session démo 8 h, persona 30 j. La durée exacte Auth dépend du fournisseur et n'est pas consignée ici. | Les durées et révocations doivent correspondre aux textes. | Relever la configuration Auth distante, documenter expiration/refresh et tester vol/révocation de session. | Pilote : haute ; vente : haute. |
| 20 | Les API sont protégées contre abus, CSRF et attaques navigateur. | **Partiel** | Validations, contrôles d'acteur et cookies SameSite existent. Aucun rate limiter/CAPTCHA applicatif généralisé, aucun jeton CSRF ou validation Origin systématique, aucune CSP/en-têtes de sécurité dédiés dans `next.config.ts`. | Mesures de sécurité à compléter avant exposition commerciale. | Ajouter limites ciblées Auth/écriture, CSP et en-têtes, stratégie CSRF documentée et tests. | Pilote : moyenne ; vente : P1. |
| 21 | Les données sont chiffrées en transit et au repos. | **Preuve fournisseur partielle ; configuration DB non vérifiée** | Supabase documente AES-256 au repos et TLS pour API ; Vercel documente AES-256 au repos et TLS 1.2+. Les URL DB inspectées n'imposent pas explicitement `sslmode`, et l'option d'enforcement PostgreSQL du projet n'a pas été vérifiée. | Ne pas affirmer un chiffrement bout en bout sans contrôle du projet et des exports locaux. | Vérifier SSL enforcement, stockage des archives et sauvegardes, puis consigner captures/date. | Pilote : P0 vérification ; vente : haute. |
| 22 | Une sauvegarde complète et récurrente avec RPO 1 h est opérationnelle. | **Absent** | `docs/operations/ops03a/README.md` : plan gratuit sans sauvegarde horaire gérée ; Storage hors sauvegarde DB standard. Aucun job hors site récurrent. | Perte potentielle supérieure à l'engagement ; aucune promesse RPO 1 h possible. | Choisir une solution adaptée, chiffrer, automatiser, surveiller et tester périodiquement sans dépense non autorisée. | Pilote : P0 ; vente : P0. |
| 23 | La restauration DB, Auth et Storage a été testée sur une cible isolée. | **Implémenté/testé avec limites** | `outputs/db1/migration-restore-rehearsal.json` : 29/29 tables, 3 migrations, pas de dérive, données source inchangées. `outputs/ops03a/provider-restore.json` et rapport OPS-03A : 58/58 tables fournisseur, 20/20 tables publiques RLS, 25 utilisateurs Auth visibles, 2 objets Storage identiques. | Prouve la procédure ponctuelle, pas une sauvegarde continue ni un SLA contractuel. | Répéter sur la version actuelle, inclure nouveaux modèles, mesurer RPO/RTO et conserver des preuves. | Pilote : haute ; vente : haute. |
| 24 | Les incidents déclenchent une alerte réelle et sont suivis jusqu'à résolution. | **Partiel/absent en réel** | `src/lib/operations/incident-reporter.ts` anonymise plusieurs champs et sait appeler un webhook ; les variables d'alerte sont absentes des environnements inspectés. Pas de Sentry/Datadog ni registre de violation connecté. | Une panne ou violation peut ne pas être détectée dans les délais. | Configurer un canal de test puis réel, astreinte, escalade, registre et exercice. | Pilote : P0 ; vente : P0. |
| 25 | Les journaux ne contiennent pas de données personnelles et ont une durée maîtrisée. | **Non vérifiable/partiel** | Le reporter d'incident masque e-mails, jetons et URL ; d'autres `console.error` subsistent. Durées Vercel/Supabase et accès aux logs non consignés. | Risque de contenu, identifiants, IP et contexte utilisateur dans les journaux. | Inventorier tous les logs, centraliser la redaction, définir rétention et droits d'accès. | Pilote : haute ; vente : P1. |
| 26 | Les cookies et stockages locaux sont strictement nécessaires et documentés. | **Partiel** | Cookies Supabase Auth ; cookies démo : persona 30 j et session 8 h ; `localStorage` pour préférence d'affichage démo et suppression d'une ancienne clé ; IndexedDB pour file hors ligne. Aucun traceur publicitaire/analytics tiers trouvé. | Auth peut relever de l'exemption de consentement ; préférence et stockage hors ligne doivent être décrits et qualifiés. | Publier une liste exacte, confirmer les noms/durées Supabase et réévaluer si analytics ajouté. | Pilote : moyenne ; vente : P1. |
| 27 | Annona n'utilise aucun analytics, publicité ou profilage tiers. | **Implémenté dans le code inspecté, sous réserve des plateformes** | Aucun Google Analytics, GTM, Segment, PostHog, Meta Pixel, Sentry ou outil publicitaire trouvé. Vercel/Supabase produisent toutefois leurs journaux techniques propres. | Aucun bandeau marketing tiers n'est actuellement justifié par le code ; les journaux techniques restent à documenter. | Maintenir un registre et une revue avant ajout de script. | Pilote : faible ; vente : moyenne. |
| 28 | Les données restent en France parce que Supabase est en région Paris. | **Faux** | Projet préproduction documenté en `eu-west-3` Paris. La [FAQ Supabase sur la résidence](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq) indique que DB/Auth/Storage et sauvegardes sont principalement dans la région choisie, mais que logs, CDN et support peuvent impliquer d'autres régions et accès mondiaux. | Le DPA doit décrire les transferts et garanties ; « hébergé à Paris » ne suffit pas à promettre « aucune sortie de l'EEE ». | Lister sous-traitants, accès support, SCC et choix de région par environnement. | Pilote : P0 documentaire ; vente : P0. |
| 29 | Les accès support Annona sont limités et audités. | **Partiel/absent** | Un rôle `SUPER_ADMIN` plateforme existe ; les rôles entreprise sont isolés. Aucun workflow d'approbation temporaire, justification ni journal dédié des consultations internes trouvé. | Annona peut devenir responsable de ses propres accès et journaux ; risque d'accès excessif. | Créer rôle support minimal, accès à durée limitée et journal immuable consultable. | Pilote : haute ; vente : P1. |
| 30 | Le catalogue Starter/Pro/Business, options et quotas sont appliqués côté serveur. | **Implémenté/testé** | Modèles `SaasCatalogVersion` à `SaasSeatReservation`, migration `20261021010000_saas_core`, `src/domains/saas/saas.service.ts`, `tests/saas-core.test.ts`, validation préproduction DB-1. | Le catalogue peut être décrit comme fondation technique, pas comme parcours vendu. | Conserver la version du catalogue dans chaque souscription et tester les changements. | Pilote : faible ; vente : haute. |
| 31 | Un visiteur choisit une offre, paie et obtient automatiquement son entreprise. | **Absent** | `SIGNUP-1` ouvert. L'inscription actuelle crée encore une entreprise `LEGACY` après vérification e-mail et bloque si le transport n'est pas configuré. Aucun orchestration offre/paiement/activation autonome. | Ne pas publier une promesse d'activation autonome. | Construire le parcours avec faux paiement idempotent avant Stripe sandbox. | Pilote : non bloquant si création manuelle ; vente : P0. |
| 32 | Stripe, la facturation récurrente et les webhooks sont actifs. | **Absent** | Aucun SDK/secret Stripe dans dépendances/configuration. `SAAS-01B` ouvert ; aucun paiement réel autorisé. | Aucun encaissement ni facture d'abonnement ne peut être annoncé. | Adapter en sandbox, décider TVA/facturation, puis activation live après autorisation. | Pilote gratuit : non bloquant ; vente : P0. |
| 33 | Le Client gère lui-même offre, options, factures et résiliation. | **Absent** | `SAAS-03` ouvert ; pas de page ni API « Mon abonnement » complète. | Les obligations d'information/changement/résiliation ne sont pas servies. | Implémenter après le moteur d'événements de facturation. | Pilote : non bloquant ; vente : P0. |
| 34 | Starter/Pro bénéficient automatiquement de 60 jours premium sans surcoût. | **Absent** | `SAAS-04` ouvert ; aucun cycle d'activation/expiration trouvé. | Ne pas inclure cette promesse dans un contrat actif avant tests. | Ajouter dates, droits temporaires, alertes et expiration sans facturation automatique. | Pilote : non bloquant ; vente : haute. |
| 35 | Les e-mails de confirmation, invitation et récupération sont actifs. | **Code présent, activation réelle absente** | `src/domains/auth/password-link.service.ts`, `provision-company-admin.ts`, `tests/password-link.test.ts`, `docs/AUTH_EMAIL_SETUP.md`. Flags/transport désactivés dans les environnements inspectés ; Resend non configuré. | Les utilisateurs ne peuvent pas dépendre d'un canal non testé pour récupérer leur compte. | Acheter/configurer domaine quand décidé, SPF/DKIM/DMARC, SMTP Auth séparé, tests de délivrabilité. | Pilote : P0 ; vente : P0. |
| 36 | Annona peut offrir un SLA ou un délai contractuel court. | **Absent/non démontré** | Pas de mesure continue, canal d'alerte réel ni astreinte. Les décisions commerciales définissent seulement un objectif interne de réponse sous un jour ouvré pour Starter/Pro, sans garantie courte. | Un SLA chiffré serait sans preuve opérationnelle. | Garder un objectif non contractuel jusqu'aux mesures, processus et ressources. | Pilote : moyenne ; vente : haute. |

## 6. Inventaire des données personnelles et assimilées

### 6.1 Base PostgreSQL applicative

| Ensemble | Champs/catégories constatés | Personnes concernées et usage |
|---|---|---|
| `User` et rôles | `authId`, e-mail, nom, téléphone, avatar, rôle, statut, paramètres, dernière connexion, entreprise | Administrateurs, dispatchers, mini-admins, clients, livreurs ; compte, droits, opérations et sécurité. |
| `Company` | raison sociale/nom, adresse, téléphone/e-mail, logo, paramètres et statut | Entreprise cliente et ses contacts ; exécution du service et administration SaaS. |
| `ClientNotification` | destinataire, titre/contenu, lien, lecture, dates | Information opérationnelle du client connecté. |
| `Order`, `OrderItem`, `OrderStop` | e-mail client, références, descriptions, marchandises/prix, adresses de collecte/livraison, coordonnées, instructions, notes, dates et statuts | Contacts du donneur d'ordre, expéditeurs/destinataires et détails de livraison. |
| `Delivery` | chauffeur, nom affiché, adresses/coordonnées, horaires, statut, résultat, note et chemin de preuve photo | Livreurs, expéditeurs/destinataires ; exécution et preuve. |
| `DriverLocation` | latitude, longitude, précision, horodatage, chauffeur/entreprise | Livreurs en service avec mission active ; position courante. |
| `TrackingEvent` | événement, libellé/description, latitude/longitude facultatives, acteur et date | Historique de mission et positions ponctuelles ; aucune purge générale effective. |
| `OrderMessage`, `OrderThreadRead` | auteur, rôle, texte, nature publique/interne, lecture, date | Échanges entre client, personnel et chauffeur ; incident/support opérationnel. |
| `Invoice` | identifiants, montants, lignes, notes, dates, statut, URL de PDF | Facturation opérationnelle historique ; peut contenir coordonnées professionnelles. |
| `SupportTicket`, `SupportTicketMessage` | type de contact, sujet, corps, priorité, auteur, statut et dates | Demandeurs et agents support. |
| `CustomerAddress` et `RecurringOrder` | libellés, contacts, adresses, coordonnées, instructions, articles et planification | Clients récurrents, expéditeurs/destinataires. |
| `OperationJob` | type, état, charge utile, empreinte, erreur, dates | Identifiants de ressources et contexte technique ; peut contenir des éléments liés à une commande/utilisateur. |
| Tables SaaS | entreprise, offre, options, sièges, période/volume, identifiants fournisseur futurs, instantanés commerciaux | Contacts/entreprises abonnées, consommation et historique contractuel ; export v1 incomplet pour ces tables. |

### 6.2 Supabase Auth

Supabase Auth conserve l'identité d'authentification : e-mail, vérificateur de mot de passe, identités, métadonnées, jetons, sessions et événements techniques du fournisseur. Le code métier ne stocke pas le mot de passe. Ces données ne sont pas incluses dans l'export métier actuel et leur suppression doit être orchestrée séparément.

### 6.3 Storage et appareils

- bucket privé `delivery-pods` : photos JPEG/PNG originales, chemin rattaché à l'entreprise et la livraison ; EXIF non supprimé ;
- archive opérateur locale DATA-02 : export JSON, photos originales, manifeste SHA-256 ; dossier parent privé exigé, mais pas de chiffrement applicatif de l'archive ;
- IndexedDB du navigateur livreur : actions en attente, coordonnées, photo Blob, notes, prix, identifiants de mission/utilisateur et erreurs ;
- cookies Supabase : session/refresh selon le SDK et la configuration Auth distante ;
- cookie démo persona : 30 jours ; cookie session démo : 8 heures ; tous deux `httpOnly`, `sameSite=lax`, `secure` en production ;
- `localStorage` : préférence d'affichage de la barre démo ; l'ancienne clé de credentials n'est plus lue et est supprimée ;
- cache navigateur/PWA et journaux appareils : contenu et durées non vérifiés.

### 6.4 Flux GPS et cartographiques

1. Le navigateur du livreur demande sa position via `navigator.geolocation.watchPosition` quand le service est actif et une mission a démarré.
2. Le navigateur envoie latitude, longitude, précision et horodatage à l'API Annona ; le serveur revérifie rôle, entreprise, service et mission.
3. PostgreSQL conserve une position courante dans `DriverLocation`. Des événements d'étape peuvent aussi conserver des coordonnées historiques dans `TrackingEvent`.
4. L'administrateur habilité reçoit les positions fraîches des chauffeurs de son entreprise. Le client voit la position fraîche du chauffeur assigné pour sa commande ; le chauffeur voit sa mission.
5. Par défaut, les itinéraires sont demandés depuis le navigateur au serveur OSRM public, qui reçoit les coordonnées et l'adresse IP/référent. Les tuiles OSM sont chargées depuis le navigateur. Le géocodage IGN/BAN est appelé côté serveur avec les adresses et l'IP de sortie Vercel. Le lien Google Maps est une action explicite du chauffeur et transmet alors la destination, voire la position choisie, à Google.

### 6.5 Journaux, sauvegardes et fournisseurs

Les logs Vercel/Supabase peuvent contenir IP, user-agent, route, horodatage, identifiants et erreurs selon leur configuration. Le dépôt ne permet pas d'établir leurs champs exacts, durées, localisation ni les personnes les ayant consultés. Les sauvegardes/restaurations exercées incluent des données DB, Auth et Storage ; leur cycle de rétention permanent n'est pas configuré par l'application.

## 7. Finalités et répartition des rôles à confirmer juridiquement

| Traitement | Finalité technique observée | Qualification de travail, à confirmer |
|---|---|---|
| Commandes, livraisons, destinataires, messages, GPS et POD | Exécuter les instructions de l'entreprise cliente et lui fournir suivi/preuve | Le Client détermine généralement les finalités ; Annona agit comme sous-traitant pour ces données. Cas particuliers à analyser. |
| Comptes des représentants, sécurité, logs de plateforme, gestion contractuelle et facturation SaaS | Fournir, sécuriser et administrer le service Annona | Annona peut être responsable pour ses finalités propres. Base, information et durées à confirmer. |
| Support | Résoudre une demande ; peut donner accès à des données de livraison | Rôle variable selon le contenu. Accès minimal, instruction Client et journal nécessaires. |
| Démonstration fictive | Présenter le produit sans données personnelles réelles | Ne pas importer de données réelles ; nettoyage ciblé des sessions synthétiques. |
| Pilote futur | Évaluer usage, fiabilité et valeur sur période limitée | Convention, DPA, notices, mesures et durées spécifiques requis avant démarrage. |

Le produit ne contient pas de mécanisme autorisant une réutilisation commerciale des adresses, positions, messages ou photos. Aucune finalité secondaire d'entraînement, prospection ou publicité ne doit être présumée. Les conditions des fournisseurs, notamment Vercel Hobby, créent néanmoins un risque contractuel externe qui doit être écarté avant toute donnée réelle.

## 8. Fournisseurs et environnements

| Fournisseur/service | État et environnement | Entité/région connue | Données/flux | Hors EEE et accès support | Conclusion |
|---|---|---|---|---|---|
| Supabase | **Actif** en local historique et préproduction isolée ; Auth, PostgreSQL, Storage. Realtime n'est pas démontré comme utilisé par le code. | Projet préproduction documenté en Paris `eu-west-3`. Contractant publié : Supabase Pte Ltd, Singapour pour le service direct. | Comptes Auth, données métier, photos, journaux et sauvegardes. | Le [DPA Supabase](https://supabase.com/legal/customer-resources/data-processing-addendum) prévoit sous-traitants et SCC ; la [FAQ résidence](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq) mentionne logs/CDN/support et accès mondiaux possibles. | Actif, à inscrire au DPA et au registre ; liste des sous-traitants/accès à dater. |
| Vercel | **Actif** pour Preview/préproduction ; projet documenté Hobby. | Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis. | Code déployé, requêtes HTTP, IP/user-agent, logs, variables serveur et appels sortants. | Traitement/transferts décrits par le DPA ; le DPA publié vise Pro/Enterprise. | **P0 :** forfait contractuellement inadéquat pour pilote commercial réel tant que non corrigé/confirmé. |
| GitHub | **Actif** pour dépôt et CI. | Région et entité de contrat propres au compte, non vérifiées ici. | Code, historique, logs CI ; secrets CI chiffrés côté plateforme. | Accès administrateurs et sous-traitants non vérifiés. | Documenter compte, organisation, MFA et DPA avant vente. |
| Resend | **Pressenti/inactif** | Plus Five Five, Inc., États-Unis selon le [DPA Resend](https://resend.com/legal/dpa). | Futurs e-mails transactionnels, adresses, contenu et métadonnées. | Transferts et sous-traitants à documenter si activé. | Ne pas le déclarer actif ; choisir/configurer après domaine. |
| Supabase Auth SMTP | **Non vérifiable/inactif côté application** | Dépend du SMTP réellement configuré dans le dashboard. | E-mails d'authentification et métadonnées. | Dashboard non inspecté pour le transport distant. | Identifier le fournisseur distinct avant e-mails réels. |
| Stripe | **Absent/pressenti** | Aucun compte, SDK ni environnement prouvé. | Futurs contacts de facturation, souscription, paiement et événements. | À documenter au moment de la sandbox puis du live. | Ne pas le déclarer actif. |
| OpenStreetMap tiles | **Actif par défaut** | Service public OSM ; contrat/SLA spécifique non vérifié. | IP, user-agent, référent et zone cartographique depuis le navigateur. | À qualifier. | Remplacer ou contractualiser un fournisseur adapté avant charge commerciale. |
| OSRM public | **Actif par défaut pour itinéraires** | Instance publique du projet OSRM ; entité contractante/DPA non établis. | Coordonnées exactes, IP/référent depuis le navigateur. | Non documenté. | **P0 données réelles :** ne pas transmettre sans base contractuelle/solution adaptée. |
| IGN Géoplateforme / BAN | **Actifs par défaut côté serveur** | Services français ; conditions et sous-traitants à relever. | Adresse complète et IP de sortie serveur pour géocodage/recherche. | Non vérifié. | Inscrire au registre et valider conditions/quotas. |
| Google Maps | **Lien externe facultatif** | Google selon l'appareil/compte du chauffeur. | Destination et éventuellement position si l'utilisateur ouvre le lien. | Possible transfert hors EEE selon service. | Informer du basculement externe ; ne pas le présenter comme sous-traitant actif automatique. |
| Monitoring/analytics/pub | **Absents** dans le code inspecté | Aucun Sentry, Datadog, GA, GTM, PostHog ou pixel. | Journaux natifs Vercel/Supabase seulement. | Selon les plateformes. | Toute addition impose une nouvelle revue cookies/sous-traitants. |

## 9. Cookies, traceurs et stockage local

| Clé/famille | Support | Finalité | Durée constatée | Consentement à qualifier |
|---|---|---|---|---|
| Cookies Supabase Auth | Cookie sécurisé géré par `@supabase/ssr` | Session, refresh et protection des espaces | Dépend de la configuration/token Supabase, non relevée précisément | En principe strictement nécessaire si limité à l'authentification ; information obligatoire. |
| Cookie persona démo | Cookie HTTP-only | Conserver le rôle fictif choisi | 30 jours | Fonctionnel ; nécessité et durée à justifier. |
| Cookie session démo | Cookie HTTP-only | Rattacher une session fictive isolée | 8 heures | Fonctionnel/nécessaire à la démo. |
| Préférence barre démo | `localStorage` | Interface seulement | Jusqu'à suppression navigateur | Préférence ; information et qualification nécessaires. |
| File actions chauffeur | IndexedDB | Rejouer actions/photos hors connexion | Jusqu'au succès ou nettoyage manuel du navigateur ; pas de TTL | Nécessaire au mode dégradé, mais durée et sécurité insuffisantes. |
| Analytics/publicité | Aucun trouvé | Sans objet | Sans objet | Aucun consentement analytics actuel ; réévaluer dès ajout. |

## 10. Sauvegarde, restauration, alertes et incidents

- **Restauration de schéma/migrations :** réussie sur cible isolée avec 29 tables, 3 migrations, zéro dérive et source inchangée (`outputs/db1/migration-restore-rehearsal.json`).
- **Restauration fournisseur :** preuve ponctuelle de tables plateforme, Auth visible et deux objets Storage identiques (`outputs/ops03a/provider-restore.json`, `docs/rapports/2026-10-21/ops03a-provider-restore.md`).
- **Limites :** exercice antérieur à certaines évolutions, absence de sauvegarde programmée hors site, Storage séparé, rétention/rotation non démontrées, RPO 1 h non tenu, RTO observé non contractuel.
- **Alertes :** code de webhook présent et assaini, mais aucune destination active dans les environnements inspectés.
- **Incidents/violations :** runbooks partiels ; aucun registre opérationnel intégré, aucune preuve d'exercice complet de notification et aucune durée de logs confirmée.

## 11. État du parcours commercial

| Chantier | État réel au 22 octobre 2026 | Ce qui peut être affirmé |
|---|---|---|
| `SAAS-01A` | **Implémenté/testé** : catalogue versionné, plans/options, affectation, droits, quotas, sièges, usage et dépassements côté serveur. | « Fondation technique du catalogue et des droits disponible en préproduction. » |
| `SIGNUP-1` | **Absent** | L'inscription autonome avec offre et faux paiement reste à développer. |
| `SAAS-01B` | **Absent** | Stripe sandbox et facturation fictive restent à développer. Aucun paiement réel. |
| `SAAS-03` | **Absent** | Aucun espace autonome complet de gestion de l'abonnement. |
| `SAAS-04` | **Absent** | Les 60 jours premium ne sont pas automatisés. |
| Pilotes | **Préparation seulement** | Des entreprises peuvent être préparées manuellement sur données fictives ; aucune autorisation de données réelles n'est donnée par cet audit. |

## 12. Mentions légales : informations factuelles disponibles

| Élément | Valeur vérifiée ou statut |
|---|---|
| Éditeur envisagé | Carotenuto - Marchetti Orso (EI), 10 traverse de la gaye, 13009 Marseille — information fournie par le fondateur, non vérifiée par registre. |
| SIREN/SIRET | **Non disponible — ne pas inventer.** |
| Directeur de publication | Le propriétaire, confirmé le 2 novembre 2026. |
| Contact légal/RGPD | Non confirmé. L'e-mail ancien `orsocarot@gmail.com` a été utilisé dans le projet pour certains contacts, mais sa publication comme adresse légale/RGPD doit être décidée explicitement. |
| Canal support | Fonction de tickets intégrée, mais aucun engagement d'e-mail public réellement actif. |
| Hébergeur du site | Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis, selon les documents officiels Vercel. |
| Téléphone général de Vercel | **Non vérifié.** Le numéro publié dans la politique DMCA est celui de l'agent copyright et ne doit pas être recyclé comme téléphone général de l'hébergeur. |
| Hébergeur des données applicatives | Supabase Pte Ltd, 65 Chulia Street #38-02/03 OCBC Centre, Singapore 049513, pour la relation directe décrite dans les [conditions Supabase](https://supabase.com/terms). Infrastructure de région Paris pour le projet préproduction, sans garantie d'absence de transfert. |
| Domaine public Annona | Non acheté/configuré selon l'état documenté ; URL temporaire Vercel seulement. |

## 13. Inconnues explicites à ne pas transformer en affirmations

- contenu exact des CGV, CGU/contrat, DPA, politique de confidentialité, convention pilote, notice GPS et matrice J5 ;
- SIREN/SIRET, directeur de publication, adresse e-mail juridique/RGPD et numéro de téléphone publiable ;
- offre Vercel réellement souscrite au moment du pilote et version des conditions acceptées ;
- identité, pays et droits de chaque administrateur GitHub/Vercel/Supabase, dont accès hors UE ;
- MFA/2FA activé sur chaque compte fournisseur ;
- configuration Auth distante : durée des sessions, SMTP, modèles, rate limits, CAPTCHA, journaux ;
- SSL enforcement PostgreSQL dans Supabase et paramètres réseau réels ;
- champs, durées et accès exacts aux logs Vercel/Supabase/GitHub ;
- sous-traitants effectifs et listes datées de chaque fournisseur ;
- comportement GPS réel sur iPhone/Android, écran verrouillé et arrière-plan ;
- conditions contractuelles adéquates pour OSM/OSRM/IGN/BAN à l'échelle visée ;
- durées légales/finales par catégorie et base juridique retenue ;
- besoin d'une AIPD, d'un DPO et qualifications de responsables/sous-traitants, à analyser juridiquement ;
- politique de chiffrement et canal de remise des exports opérateur ;
- ressources humaines d'incident/support et capacité à tenir un engagement de service.

## 14. Réponses minimales à renvoyer au fondateur

| Question | Réponse minimale nécessaire | Pourquoi |
|---|---|---|
| Peux-tu fournir les fichiers J5 complets ? | CGV, CGU/contrat, politique, DPA, mentions, convention pilote, notice GPS et matrice de conservation. | Permettre la comparaison ligne par ligne et le remplacement des `[À CONFIRMER DEV]`. |
| Quelle entité signera ? | Confirmer EI, puis SIREN/SIRET dès disponibilité, directeur de publication, contact légal/RGPD et contact support. | Mentions, contrats, DPA, facturation et responsabilité. |
| Acceptes-tu une offre d'hébergement adaptée avant données réelles ? | Décision seulement après devis/conditions ; aucune dépense par cet audit. | Hobby ne convient pas au pilote commercial selon les conditions publiées. |
| Qui a accès aux consoles ? | Liste interne des rôles/détenteurs, pays d'accès, MFA et procédure de retrait, sans publier d'identité dans les documents clients. | Sécurité, transferts, support et traçabilité. |
| Quelles durées valides-tu après conseil approprié ? | Durées distinctes pour GPS courant/historique, POD, messages, support, factures, logs, comptes, pilotes et sauvegardes. | DATA-02 ne peut pas automatiser des hypothèses. |
| Quel niveau de preuve photo est nécessaire ? | Cadrage, métadonnées, accès, contestation/retrait et durée. | Minimisation, EXIF et archive. |
| Quel canal d'e-mail et domaine ? | Domaine acheté plus tard, expéditeur, fournisseur Auth/transactionnel et boîtes support/sécurité. | Invitations, récupération, notices et incidents. |
| Quels appareils fournir pour la recette ? | Au moins un iPhone Safari/PWA et un Android Chrome/PWA, trajet fictif supervisé. | MOB-01C et absence de promesse GPS non testée. |

## 15. Preuves principales

- `prisma/schema.prisma` et `prisma/reference-data.ts` : 29 modèles, rôles et permissions.
- `prisma/migrations/20261021010000_saas_core/` : noyau SaaS.
- `src/domains/saas/saas.service.ts` et `tests/saas-core.test.ts` : droits, quotas, sièges et dépassements.
- `src/domains/driver/driver-location.service.ts`, `src/domains/tracking/tracking.policy.ts`, `src/features/driver/use-driver-live-position.ts` et `tests/tracking.test.ts` : GPS et visibilité.
- `src/lib/storage/pod.ts`, `tests/pod-access.test.ts` et `tests/performance.test.ts` : bucket privé, liens signés et contrôle d'accès.
- `src/domains/data-lifecycle/company-export.service.ts`, `company-archive.service.ts`, `outputs/data02/connected.json` et `docs/operations/data02/README.md` : export et limites d'effacement.
- `outputs/db1/preproduction-validation.json` : base de préproduction, migrations, RLS/grants et Storage.
- `outputs/db1/migration-restore-rehearsal.json` : restauration du schéma courant.
- `outputs/ops03a/provider-restore.json` et `docs/rapports/2026-10-21/ops03a-provider-restore.md` : restauration fournisseur DB/Auth/Storage.
- `.github/workflows/ci.yml`, `.env.example`, `docs/operations/preproduction/README.md` : CI, désactivation des effets externes et séparation des environnements.
- `src/domains/auth/password-link.service.ts`, `tests/password-link.test.ts`, `docs/AUTH_EMAIL_SETUP.md` : authentification e-mail présente mais non activée en réel.
- `src/lib/operations/incident-reporter.ts` et `src/domains/operations/service-health.service.ts` : santé et alertes non branchées.
- `docs/operations/map-providers.md` et `tests/map-providers.test.ts` : fournisseurs cartographiques par défaut et limites.
- `docs/RECETTE_V1.md`, `docs/RBAC.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md` : synthèse des contrôles et limites reconnues.

## 16. Références officielles fournisseurs

- [Vercel — Terms of Service](https://vercel.com/legal/terms)
- [Vercel — Data Processing Addendum](https://vercel.com/legal/dpa)
- [Vercel — Privacy Notice](https://vercel.com/legal/privacy-notice)
- [Vercel — DMCA Policy](https://vercel.com/legal/dmca-policy)
- [Supabase — Terms of Service](https://supabase.com/terms)
- [Supabase — Data Processing Addendum](https://supabase.com/legal/customer-resources/data-processing-addendum)
- [Supabase — Data residency and transfers FAQ](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq)
- [Supabase — Security](https://supabase.com/security)
- [Supabase — Available regions](https://supabase.com/docs/guides/platform/regions)
- [Resend — Data Processing Addendum](https://resend.com/legal/dpa)
- [Resend — Subprocessors](https://resend.com/legal/subprocessors)

## Conclusion

Le socle technique est suffisamment avancé pour continuer les démonstrations et les tests avec des données synthétiques. Le feu vert pour des pilotes contenant des données personnelles réelles est **NO-GO** tant qu'au moins un P0 reste ouvert. Ce constat ne ferme ni `LEGAL-1` ni `DATA-02` et ne constitue pas une attestation de conformité.
