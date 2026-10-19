# BILL-01B — Export comptable des prestations V1

18 octobre 2026. Exécution GPT-6.1 Sol, repli de disponibilité Astra autorisé par le propriétaire/routeur. Une seule tâche, sans agent parallèle.

## Résultat

BILL-01B est terminée pour la branche export retenue par BILL-01A : export exploitable des documents de prestations existants, traçable et réservé à l'entreprise, avec contrat CSV versionné. La tâche n'est pas présentée comme une émission finale réglementaire. La TODO reprend explicitement ce critère adapté.

Le nouvel export se télécharge depuis Commandes après choix des dates de création UTC et du statut. Il exige `invoices:read`, refuse les paramètres inconnus/doublons et n'accepte pas d'entreprise venant de l'URL. Un identifiant de commande/client lié à une autre entreprise interrompt le fichier sans exposer cette ressource. Le contenu est privé sans cache.

Le CSV UTF-8/BOM à virgules distingue une ligne DOCUMENT pour le total et des lignes LINE pour le détail. Son contrat `tutelliv-delivery-v1` comprend 29 colonnes, dont entreprise/document/commande/client, référence et e-mail enregistrés sur la commande, statut, dates UTC, source des lignes, quantités et montants. Le SHA256 identifie la version des champs exportés. Aucun nom actuel d'entreprise, e-mail actuel de compte ou tarif courant ne réécrit les montants enregistrés. L'importeur déduplique entreprise + document + version et ne somme pas le détail avec les totaux. Le contrat et les règles d'import se trouvent dans [la procédure](../../operations/bill01b/README.md).

La transaction PostgreSQL RepeatableRead conserve le même instantané sur tous les lots de 250, triés par ID et parcourus par clé. Les plafonds de 10 000 documents, 50 000 enregistrements et 20 Mio, ainsi que le délai de 60 s, donnent un refus explicite sans CSV partiel. Les données restent en mémoire : ces plafonds ne valent pas qualification de charge multi-tenant.

La création des documents utilise désormais Decimal pour les unités arrondies au centime, sommes et TVA demi-supérieure ; les saisies non finies, sous-centimes ou hors capacité du champ sont refusées. L'export conserve les anciens totaux au lieu de les recalculer. Les lignes anciennes absentes, invalides ou non concordantes portent une qualification explicite.

L'interface et les PDF qualifient les documents de relevés opérationnels, sans confusion avec l'abonnement SaaS. Le PDF pagine les lignes/libellés/notes longs, répète l'en-tête des colonnes et garde la qualification opérationnelle et les pages. Les routes/noms historiques `invoices` restent compatibles.

## Vérifications réalisées

- `npm run check` : types valides, lint source zéro avertissement, **261 tests réussis**. Dix tests BILL-01B couvrent dates/statuts/paramètres, décimaux et demi-centime, stabilité/version, qualité historique et annulations, CSV/Unicode/formules, 1 001 documents par lots, vide et limite 10 000, erreurs privées, document long et vraie garde serveur. Les régressions BILL-02 restent vertes.
- Gardes réelles exécutées par la route dans un harnais local avec `getServerAuth` substitué : anonyme 401, client/chauffeur 403 même avec permission lecture, mini-admin commandes seul 403, administrateur/dispatcher habilités 200 et super-admin sans entreprise 403. Absence d'entreprise, requête invalide, dépassement 422 et exception 503 sans contenu de l'exception vérifiés. Aucun nouveau test navigateur authentifié n'est revendiqué.
- Recette connectée finale sur la base de test existante explicitement autorisée : deux entreprises fictives avec UUID, deux commandes, 1 001 documents A dans la période, deux documents A hors période et un B. Le CSV A contient 1 001 DOCUMENT + 1 001 LINE, somme exacte 300,30 €. B fournit un seul document de 99,00 €, sans mélange. Les cinq statuts donnent chacun 200 documents, sauf DRAFT à 201.
- Bornes `2026-10-25T00:00:00.000Z` et `23:59:59.999Z` incluses, instants adjacents exclus. C'est le jour du changement d'heure France ; la période est explicitement UTC.
- Lecteur CSV indépendant : guillemets doubles, virgules, CRLF intégrés, texte chinois/accents et formules préfixées retrouvés. Deux téléchargements sont identiques octet pour octet. Changement de tarifs/nom d'entreprise sans effet ; révision PENDING modifie la version. Une référence volontairement corrompue vers l'autre entreprise est refusée. Ces mutations portent uniquement sur les fixtures de l'exécution.
- Lecture concurrente réelle : après lecture du premier lot dans la transaction d'export, une seconde connexion modifie le dernier document. Le CSV reste identique à l'instantané initial ; la fixture est restaurée avant les contrôles suivants.
- Nettoyage exact dans `finally` : zéro entreprise, commande et document de cette exécution ; empreinte des ID/updatedAt et compteurs des préexistants inchangés après nettoyage (56 entreprises, 430 commandes, 113 documents). Aucun compte Auth, fichier ou job créé.
- Build de production dans `/private/tmp/tutelliv-bill01b-build`, copie sans `.env.local` ni secrets, dépendances du projet et seules valeurs publiques factices `.invalid` : compilation et **101 pages réussies**. Aucun serveur utilisateur arrêté ou démarré. Un premier essai sandbox échouait uniquement au téléchargement Google Fonts ; le même build a réussi avec l'accès réseau autorisé.
- PDF synthétique : **160 lignes, neuf pages**, total 48,00 €, dernière note et pied final extraits ; qualification opérationnelle présente sur chaque page. Toutes les pages rendues avec Poppler et contact visuel contrôlé. Le premier contrôle a détecté un chevauchement du titre/référence, corrigé avant le rendu final. Le remplacement historique des glyphes hors Latin-1 par `?` subsiste dans le PDF ; le CSV conserve Unicode intégralement.

Preuves : `outputs/bill01b/connected.json`, `pdf-verification.json`, `pdf-contact-sheet.png`, `operational-long.pdf`, `verification.json`. Les sorties ne contiennent ni identifiants de fixture, ni données réelles, ni secrets. Les ID de fixture restent seulement en mémoire pendant la recette.

## Limites et suite

Le modèle ne contient pas d'instantané légal complet et immuable des identités/adresses/mentions, pas d'avoir lié à une émission antérieure, ni d'archive serveur des exports. PENDING reste révisable et les statuts/règlements évoluent. Les références/e-mails de commande éventuellement modifiés sont reflétés dans l'empreinte ; le PDF reprend encore des coordonnées et un pied de page courants. Un CSV ancien déjà téléchargé reste intact, mais le service ne promet pas de régénérer une facture finale immuable.

Une annulation exporte son montant positif d'origine et son état CANCELLED ; elle ne crée jamais un faux avoir négatif. Une annulation logistique ne produit pas automatiquement de correction comptable. Les documents TOTAL_ONLY/INVALID_LINES/TOTAL_MISMATCH nécessitent rapprochement externe. Aucune imputation de compte tiers, validation fiscale, mention légale ou conformité n'est inventée.

Les futurs abonnements/commissions restent dans le domaine SaaS séparé ; aucun paiement n'est impliqué. Une future intégration avec un outil comptable ou une plateforme agréée devra décider les instantanés, la correction/les avoirs, la séquence et les exigences validées par spécialiste avant émission finale. Ce chantier dépasse volontairement BILL-01B V1 et ne bloque pas l'export qualifié.

L'escalade réseau de la première recette distante a d'abord été refusée par la revue automatique faute de preuve suffisante sur la cible. Sans contournement, la date de modification de `.env.local` (19 août, avant les recettes autorisées d'octobre), la classification ENV-1 et l'autorisation AGENTS ont été présentées lors d'un réexamen, qui a accepté les essais sur cette même base de test. La recette finale est réussie et aucun blocage d'approbation ne reste.

Aucun schéma/migration, déploiement, push, paiement, envoi, donnée réelle ou processus utilisateur modifié. Le travail préexistant a été conservé. La prochaine tâche relève du coordinateur et des autorisations en cours ; aucune autre tâche n'a été engagée ici.
