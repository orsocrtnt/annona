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

## Décision d'autorisation

**Recommandation** : aucune fiche n'est marquée « validée ». Recueillir les pièces, confronter les flux au navigateur/serveur sur préproduction, puis faire qualifier les rôles, transferts et exigences contractuelles par le juriste. Une autorisation de sous-traitance ultérieure et une procédure d'information des changements doivent être organisées lorsqu'elles sont applicables. [CNIL — bonnes pratiques responsable/sous-traitant](https://www.cnil.fr/fr/responsable-de-traitement-et-sous-traitant-6-bonnes-pratiques-pour-respecter-les-donnees).
