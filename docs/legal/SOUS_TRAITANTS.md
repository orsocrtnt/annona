# Registre préparatoire des fournisseurs et destinataires

18 octobre 2026. Inventaire fondé sur le code et les procédures existantes, sans accès aux contrats des comptes fournisseurs. **Ce n'est pas encore la liste contractuelle de sous-traitants autorisés.** Un service public, un lien externe ou un fournisseur de paiement ne devient pas automatiquement un sous-traitant RGPD.

## Champs communs à compléter pour chaque fiche

Identité légale contractante ; adresse ; service/plan et compte concerné ; rôle RGPD par finalité ; contrat/DPA et version acceptée ; catégories de données ; région primaire et sauvegardes ; pays d'accès support/administration ; sous-traitants ultérieurs ; mécanisme de transfert et analyse applicable ; sécurité/audits ; suppression/export et sauvegardes ; délai/contact incident ; personne ayant vérifié, date et autorisation client.

**Tous ces champs contractuels sont INCONNUS dans le présent dossier**, sauf le service et les flux décrits ci-dessous. Une région technique, une marque commerciale ou un pays supposé ne démontre ni l'absence de transfert ni l'acceptation d'un DPA. Les transferts hors EEE doivent être qualifiés et encadrés selon le mécanisme applicable. [CNIL — transferts hors UE](https://www.cnil.fr/fr/les-outils-de-la-conformite/transferer-des-donnees-hors-de-lue), [RGPD, chapitre V](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra).

## F01 — Supabase : base, Auth et Storage

- **État constaté** : service distant configuré pour les tests autorisés ; préproduction distincte absente selon [ENV-1](../operations/env1/README.md).
- **Flux envisagés en exploitation** : comptes, graphe opérationnel, GPS, messages et photos privées. Les trois services doivent être couverts, pas seulement PostgreSQL.
- **Rôle proposé** : sous-traitant ultérieur pour les données métier, à confirmer ; traitements propres éventuels du fournisseur à examiner.
- **À obtenir** : entité, DPA, régions DB/Auth/Storage/backups, liste des intervenants, accès support et transferts, rotation des sauvegardes, restitution et effacement. Aucun lieu d'hébergement réel n'est certifié ici.

## F02 — Vercel : hébergement envisagé et planification

- **État constaté** : lien de projet local détecté ; aucune cible préproduction/production distincte validée. Pas de nouveau déploiement effectué.
- **Flux possibles si retenu** : requêtes applicatives, IP, métadonnées, secrets serveur et données transitant dans les fonctions ; journaux, cache et fichiers temporaires à inventorier.
- **Rôle proposé** : hébergeur/sous-traitant ultérieur à qualifier.
- **À obtenir** : régions d'exécution et CDN, journalisation/redaction/rétention, contrats, accès transfrontaliers, cron, sous-traitants et limites de suppression.

## F03 — Resend et acheminement des e-mails

- **État constaté** : choix de principe du propriétaire, configuration/envois réels non qualifiés ; voir [EMAIL/SEC-05](../AUTH_EMAIL_SETUP.md).
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

## F06 — OSRM public : calcul d'itinéraires

- **État constaté** : démonstrateur public par défaut, requêtes navigateur ; usage SaaS commercial non validé par MAP-2.
- **Flux** : départ/arrivée, potentiellement position du livreur, IP et métadonnées réseau.
- **Rôle** : destinataire/prestataire à qualifier ; identité contractante de l'opérateur effectif INCONNUE dans ce dossier. La documentation technique renvoie à FOSSGIS, ce qui ne vaut pas contrat vérifié.
- **À obtenir** : fournisseur final ou auto-hébergement, conditions d'usage, confidentialité, localisation, rétention des requêtes et mécanisme de transfert. Point bloquant avant données réelles sur cette dépendance.

## F07 — Google Maps : lien externe volontaire

- **État constaté** : lien de navigation choisi par le chauffeur, pas de SDK intégré dans le parcours documenté.
- **Flux possible à l'ouverture** : destination et éventuellement position ; l'utilisateur quitte le contexte TutelLiv.
- **Rôle** : destinataire externe à qualifier et à expliquer ; ne pas le présenter automatiquement comme un sous-traitant engagé par TutelLiv.
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

- **État constaté (28 octobre 2026)** : code présent sur la branche `agent/commande-ia`, **désactivé par défaut**. Il faut à la fois la variable serveur `ANTHROPIC_API_KEY` et une activation explicite par l'administration de l'entreprise. Aucune clé n'est configurée et aucun appel réel n'a été effectué. Fonctionnement : [order-intake](../operations/order-intake/README.md).
- **Finalité** : transformer un message reçu (e-mail, SMS, WhatsApp) collé par un dispatcher en brouillon de commande, relu et validé par un humain avant toute création.
- **Données envoyées** : le texte collé, qui peut contenir des noms, téléphones, e-mails et adresses de tiers (donneur d'ordre, contacts d'enlèvement et de livraison) ; l'expéditeur déclaré s'il est saisi ; la date du jour. Ne sont pas envoyés : identifiants TutelLiv, fiches clients, coordonnées GPS, historique de commandes.
- **Conservation côté TutelLiv** : le texte et l'expéditeur ne sont pas stockés. Seul un journal d'usage est conservé (entreprise, modèle, issue, nombre de jetons, horodatage) pour le quota et le coût ; sa durée de conservation reste à fixer (LEGAL-1).
- **Conservation côté fournisseur** : **INCONNUE dans ce dossier**. Durée de rétention des entrées et sorties de l'API, usage éventuel pour l'entraînement, région de traitement et transferts hors EEE (fournisseur établi aux États-Unis) restent à vérifier dans les conditions et le DPA applicables au compte réellement souscrit.
- **Rôle proposé** : sous-traitant ultérieur pour cette finalité, à qualifier.
- **Mention affichée** : l'écran d'activation indique que le texte est transmis au sous-traitant Anthropic et qu'aucune validation juridique n'est acquise.
- **À obtenir** : entité contractante, DPA et version, rétention et éventuelle option de non-conservation, région et mécanisme de transfert, sous-traitants ultérieurs, information des personnes dont les coordonnées figurent dans les messages transmis.

## Décision d'autorisation

**Recommandation** : aucune fiche n'est marquée « validée ». Recueillir les pièces, confronter les flux au navigateur/serveur sur préproduction, puis faire qualifier les rôles, transferts et exigences contractuelles par le juriste. Une autorisation de sous-traitance ultérieure et une procédure d'information des changements doivent être organisées lorsqu'elles sont applicables. [CNIL — bonnes pratiques responsable/sous-traitant](https://www.cnil.fr/fr/responsable-de-traitement-et-sous-traitant-6-bonnes-pratiques-pour-respecter-les-donnees).
