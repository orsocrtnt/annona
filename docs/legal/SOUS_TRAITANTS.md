# Registre préparatoire des fournisseurs et destinataires

18 octobre 2026. Inventaire fondé sur le code et les procédures existantes, sans accès aux contrats des comptes fournisseurs. **Ce n'est pas encore la liste contractuelle de sous-traitants autorisés.** Un service public, un lien externe ou un fournisseur de paiement ne devient pas automatiquement un sous-traitant RGPD.

## Champs communs à compléter pour chaque fiche

Identité légale contractante ; adresse ; service/plan et compte concerné ; rôle RGPD par finalité ; contrat/DPA et version acceptée ; catégories de données ; région primaire et sauvegardes ; pays d'accès support/administration ; sous-traitants ultérieurs ; mécanisme de transfert et analyse applicable ; sécurité/audits ; suppression/export et sauvegardes ; délai/contact incident ; personne ayant vérifié, date et autorisation client.

**Tous ces champs contractuels sont INCONNUS dans le présent dossier**, sauf le service et les flux décrits ci-dessous. Une région technique, une marque commerciale ou un pays supposé ne démontre ni l'absence de transfert ni l'acceptation d'un DPA. Les transferts hors EEE doivent être qualifiés et encadrés selon le mécanisme applicable. [CNIL — transferts hors UE](https://www.cnil.fr/fr/les-outils-de-la-conformite/transferer-des-donnees-hors-de-lue), [RGPD, chapitre V](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra).

## F01 — Supabase : base, Auth et Storage

- **État constaté (2 novembre 2026)** : projets `annona-preproduction` et `annona-dev` distincts, région de Paris, offre gratuite. Entité et transferts relevés dans le [DPA public](https://supabase.com/legal/dpa) (Supabase Pte Ltd, Singapour ; clauses types), couverture de l'offre gratuite à confirmer.
- **Flux envisagés en exploitation** : comptes, graphe opérationnel, GPS, messages et photos privées. Les trois services doivent être couverts, pas seulement PostgreSQL.
- **Rôle proposé** : sous-traitant ultérieur pour les données métier, à confirmer ; traitements propres éventuels du fournisseur à examiner.
- **À obtenir** : entité, DPA, régions DB/Auth/Storage/backups, liste des intervenants, accès support et transferts, rotation des sauvegardes, restitution et effacement. Aucun lieu d'hébergement réel n'est certifié ici.

## F02 — Vercel : hébergement envisagé et planification

- **État constaté (2 novembre 2026)** : `annona.fr` tourne sur une préversion Vercel (branche `preproduction`, Node 22). Le dépôt documente une offre Hobby : usage non commercial, contenus utilisables pour l'entraînement d'IA, DPA réservé aux offres Pro et Enterprise. Passage en Pro décidé avant le premier pilote.
- **Flux possibles si retenu** : requêtes applicatives, IP, métadonnées, secrets serveur et données transitant dans les fonctions ; journaux, cache et fichiers temporaires à inventorier.
- **Rôle proposé** : hébergeur/sous-traitant ultérieur à qualifier.
- **À obtenir** : régions d'exécution et CDN, journalisation/redaction/rétention, contrats, accès transfrontaliers, cron, sous-traitants et limites de suppression.

## F03 — Resend et acheminement des e-mails

- **État constaté (2 novembre 2026)** : domaine `annona.fr` vérifié, envois réels reçus (authentification, alertes Contact), réception des commandes par e-mail sur `commandes.annona.fr` (région Irlande). Le contenu des e-mails reçus transite donc par Resend. Contrat et DPA non relus ; voir [EMAIL/SEC-05](../AUTH_EMAIL_SETUP.md).
- **Flux prévus** : destinataire, contenu d'invitation/récupération ou alerte ; distinguer SMTP Auth et notifications métier. Éviter de transmettre photos, GPS détaillé ou contenu de dossiers dans les alertes.
- **Rôle proposé** : sous-traitant ultérieur pour l'acheminement ; rôle propre et métriques à examiner.
- **À obtenir** : domaine réel, expéditeur, DPA, région, conservation des messages/logs, traitement des rebonds, pixels de suivi éventuels et sous-traitants. La boîte personnelle retenue pour recevoir les tests n'est pas un canal support de production validé.

## F04 — OpenStreetMap : tuiles publiques

- **État constaté** : fond par défaut des essais, requêtes depuis le navigateur.
- **Flux** : IP, zone affichée et Referer ; la demande de tuile peut révéler un contexte géographique sans transporter un nom.
- **Rôle** : destinataire/prestataire à qualifier, pas de DPA constaté.
- **À obtenir** : opérateur et conditions réellement applicables au service choisi, journalisation, pays, transferts, autorisation d'usage commercial et alternative contractuelle. Ne pas confondre licence des données et conditions de l'hébergement public.

## F05 — IGN / Géoplateforme : géocodage

- **État constaté** : géocodage serveur vers l'endpoint public Géoplateforme ; [MAP-2](../operations/map-providers.md).
- **Flux** : adresses recherchées et IP serveur ; pas de nom nécessaire dans la requête.
- **Rôle** : service destinataire à qualifier selon les conditions ; aucune qualification de sous-traitance présumée.
- **À obtenir** : conditions et information de confidentialité du service exact, conservation des requêtes, intervenants, destinataires, base de transmission et minimisation.

## F06 — OSRM public : calcul d'itinéraires (retiré le 3 novembre 2026)

- **Mise à jour du 3 novembre 2026** : le navigateur n'appelle plus OSRM. Les itinéraires passent par le serveur Annona (`/api/maps/route`) vers la Géoplateforme IGN (`DRIVE_ROUTE_IGN_URL`), ou vers un OSRM privé s'il est configuré ; la position et l'adresse IP du livreur ne partent plus chez FOSSGIS. Nouveau destinataire : IGN (service public français, sans compte) ; conditions d'usage commercial du calcul d'itinéraire à confirmer auprès de l'IGN. Le texte ci-dessous décrit l'état antérieur.
- **État constaté** : démonstrateur public par défaut, requêtes navigateur ; usage SaaS commercial non validé par MAP-2.
- **Flux** : départ/arrivée, potentiellement position du livreur, IP et métadonnées réseau.
- **Rôle** : destinataire/prestataire à qualifier ; identité contractante de l'opérateur effectif INCONNUE dans ce dossier. La documentation technique renvoie à FOSSGIS, ce qui ne vaut pas contrat vérifié.
- **À obtenir** : fournisseur final ou auto-hébergement, conditions d'usage, confidentialité, localisation, rétention des requêtes et mécanisme de transfert. Point bloquant avant données réelles sur cette dépendance.

## F07 — Google Maps : lien externe volontaire

- **État constaté** : lien de navigation choisi par le chauffeur, pas de SDK intégré dans le parcours documenté.
- **Flux possible à l'ouverture** : destination et éventuellement position ; l'utilisateur quitte le contexte Annona.
- **Rôle** : destinataire externe à qualifier et à expliquer ; ne pas le présenter automatiquement comme un sous-traitant engagé par Annona.
- **À obtenir** : paramètres effectivement envoyés, information avant transmission et choix d'alternative. Pays, conditions, conservation et rôle propres non vérifiés.

## F08 — GitHub et outillage de développement

- **État constaté** : dépôt distant configuré et workflow local ; aucun nouveau push ou service activé par cette préparation.
- **Flux documentés** : code, métadonnées de collaboration et, si exécutée, CI. Aucune donnée réelle ne doit être déduite de l'existence de ces outils.
- **À obtenir** : visibilité, comptes, habilitations, secrets, logs/artifacts, intégrations et chaîne d'outillage réellement autorisée. Inventorier séparément sauvegarde locale, synchronisation et assistance IA avant d'y confier une donnée de client.

## F09 — paiement, plateforme de facturation, alertes et assistance future

- **État** : Stripe seulement à l'étude ; plateforme agréée de facturation, moniteur/canal d'alerte et boîte support de production non sélectionnés ou non configurés.
- **Flux futurs** : identité du payeur, factures, encaissements, incidents et tickets selon les choix définitifs.
- **À obtenir** : fiche complète pour chaque fournisseur effectivement retenu ; ne pas publier ces candidats comme des sous-traitants actifs.

## F10 — Anthropic : commande par message (fonction facultative)

- **État constaté (2 novembre 2026)** : code intégré, **désactivé par défaut par entreprise**. La variable `ANTHROPIC_API_KEY` existe sur la préproduction ; il faut aussi une activation explicite par l'administration de l'entreprise. Selon les [conditions commerciales](https://www.anthropic.com/legal/commercial-terms) : pas d'entraînement sur les contenus clients, DPA intégré. Fonctionnement : [order-intake](../operations/order-intake/README.md).
- **Finalité** : transformer un message reçu (e-mail, SMS, WhatsApp) collé par un dispatcher en brouillon de commande, relu et validé par un humain avant toute création.
- **Données envoyées** : le texte collé, qui peut contenir des noms, téléphones, e-mails et adresses de tiers (donneur d'ordre, contacts d'enlèvement et de livraison) ; l'expéditeur déclaré s'il est saisi ; la date du jour. Ne sont pas envoyés : identifiants Annona, fiches clients, coordonnées GPS, historique de commandes.
- **Conservation côté Annona** : le texte et l'expéditeur ne sont pas stockés. Seul un journal d'usage est conservé (entreprise, modèle, issue, nombre de jetons, horodatage) pour le quota et le coût ; sa durée de conservation reste à fixer (LEGAL-1).
- **Conservation côté fournisseur** : **INCONNUE dans ce dossier**. Durée de rétention des entrées et sorties de l'API, usage éventuel pour l'entraînement, région de traitement et transferts hors EEE (fournisseur établi aux États-Unis) restent à vérifier dans les conditions et le DPA applicables au compte réellement souscrit.
- **Rôle proposé** : sous-traitant ultérieur pour cette finalité, à qualifier.
- **E-mails reçus (MAIL-COMMANDE, non activé)** : Resend reçoit et conserve les e-mails transférés à l'adresse de commande, puis leur texte part chez Anthropic. Durée de conservation chez Resend et information des expéditeurs à qualifier avant toute donnée réelle (voir aussi F03).
- **Mention affichée** : l'écran d'activation indique que le texte est transmis au sous-traitant Anthropic et qu'aucune validation juridique n'est acquise.
- **À obtenir** : entité contractante, DPA et version, rétention et éventuelle option de non-conservation, région et mécanisme de transfert, sous-traitants ultérieurs, information des personnes dont les coordonnées figurent dans les messages transmis.

## F11 — Google : lecture du fichier de prospection (API Google Sheets)

**À valider par le propriétaire (LEGAL-1).** Fiche factuelle, sans qualification juridique.

- **État constaté (6 novembre 2026)** : code écrit (ADMIN-ESPACE lot 5), **non branché** : aucune variable posée, aucun compte de service créé. Mise en place : [SHEET.md](../operations/prospection/SHEET.md).
- **Finalité** : afficher au super-administrateur, dans `/admin/prospection`, des totaux et les rappels du fichier de prospection `Annona_Suivi_Prospection_2026`, qui reste tenu par les commerciaux dans Google Sheets.
- **Fonctionnement** : un compte de service Google, sans rôle, lit la Sheet partagée avec lui en lecteur (portée `spreadsheets.readonly`, API Google Sheets v4). Annona n'écrit rien dans la Sheet.
- **Données lues** : coordonnées professionnelles de prospects telles qu'elles figurent dans la Sheet (nom d'entreprise, ville, étape, dates de rappel et de dernier contact, nom du commercial ; les autres colonnes du fichier, comme les coordonnées, sont aussi lues sur la plage demandée). Données transmises par Annona à Google : l'identifiant de la Sheet et l'assertion signée du compte de service.
- **Conservation côté Annona** : rien n'est écrit en base ; un résumé (totaux, au plus 15 rappels : entreprise, ville, commercial, date) reste en mémoire du serveur 5 minutes. Le navigateur ne reçoit que ce résumé.
- **Conservation et localisation côté fournisseur** : **INCONNUES dans ce dossier** (le fichier est déjà hébergé chez Google, indépendamment de Annona). Entité contractante, conditions applicables au compte Google utilisé, régions et transferts hors EEE à vérifier.
- **Rôle** : à qualifier.

## Décision d'autorisation

**Recommandation** : aucune fiche n'est marquée « validée ». Recueillir les pièces, confronter les flux au navigateur/serveur sur préproduction, puis faire qualifier les rôles, transferts et exigences contractuelles par le juriste. Une autorisation de sous-traitance ultérieure et une procédure d'information des changements doivent être organisées lorsqu'elles sont applicables. [CNIL — bonnes pratiques responsable/sous-traitant](https://www.cnil.fr/fr/responsable-de-traitement-et-sous-traitant-6-bonnes-pratiques-pour-respecter-les-donnees).
