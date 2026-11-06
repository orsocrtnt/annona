# MAP-2 — Fournisseurs, zoom et indisponibilités

15 octobre 2026. Corrections locales dans Annona GPT ; worktree préexistant préservé. Aucun accès base, migration, seed/reset, push ou déploiement. Aucun abonnement ou coût fournisseur engagé.

## Défauts corrigés

MAP-1 reproduisait les images Esri « Map data not yet available » au zoom chauffeur 18. Le fond Esri est remplacé par OSM standard, commun aux cartes admin/client/chauffeur, aperçus d’adresse et historique. Zoom autorisé 1–19, borné par le niveau natif configuré ; navigation bornée à min(18, plafond). Attribution rendue en permanence, avec liens OSM, BAN/IGN, OSRM et correction de carte. La recette a révélé un chevauchement avec les boutons admin : le bandeau est remonté sur les cartes pleine page. Le décalage de suivi chauffeur est corrigé pour que sa position reste sous le HUD, dans la zone visible.

Une tuile en erreur ou une attente de 10 s affiche « Fond de carte indisponible » et « Réessayer la carte » ; les marqueurs restent. Ce délai signale l’échec, sans prétendre annuler les chargements natifs d’images. HTTP/JSON/NoRoute/route incohérente ou délai 8 s renvoient une route nulle : aucune ligne droite de secours, aucun zéro minute, aucune ancienne route maintenue après échec. HUD explicite, GPS absent distingué du calcul, Google Maps accessible. Navigation toutes les 30 s, sans recalcul par chaque mise à jour GPS, un appel en cours et réponses anciennes ignorées.

Le secours de géocodage inventait Paris ou des positions calculées depuis le code postal. Il est retiré, avec passage de l’ancien endpoint BAN à l’API IGN actuelle. Score minimum 0,6, coordonnées validées, délai 8 s, cache/déduplication et limites locales. Les livraisons et adresses restent dans les listes ; seules leurs destinations inconnues et marqueurs correspondants deviennent absents. Les cartes admin/client/chauffeurs acceptent cette absence sans crash ; message « Adresse non localisée ». Création de commandes et arrêts possible avec coordonnées nulles, pas de fausse estimation tarifaire, pas de point inventé persisté, proximité non confirmée. La première collecte indisponible ne devient pas la collecte suivante.

## Preuves

- `npm run check` final : types OK, lint sans erreur, **24 avertissements existants**, **183/183 tests** réussis (15 nouveaux MAP-2 ; scénario TRACK-1 enrichi pour géocodage absent admin/client/livreurs). Log `outputs/map2/check-final.log`.
- Tests : route valide/absente/HTTP429/timeout/JSON invalide/zéro/coordonnée invalide, requête ou corps bloqué, plafond d’appels, déduplication/cache géocodage, score faible, lot de huit, absence de persistence inventée, cible chauffeur manquante, première collecte, estimation/proximité, destination nullable, HUD dégradé, import historique sans window. Dépendances simulées, aucune base.
- `npm run build` final : réussi, **96 pages** générées. Log `outputs/map2/build-final.log`. Harnais isolé avec `.next` propre ; aucun serveur utilisateur partageant le cache.
- `git diff --check` : réussi.
- Recette CUA en **1280×720 / 390×844** : navigation réelle, cartes admin/client, marqueurs, attribution visible après correction, zoom clavier de 18 vers 19 puis tentative supplémentaire bornée à 19. Tuiles OSM réelles chargées, deux marqueurs navigation, pas de débordement horizontal sur les mesures enregistrées. Captures `outputs/map2/captures/`.
- Panne tuiles (URL locale 404), bouton de reprise, panne itinéraire 503, réponse itinéraire retardée 12 s : messages lisibles ; après expiration à 8 s, pas de route/ETA inventée. Adresse destination nulle : livraison conservée, message explicite et seul marqueur chauffeur présent. Le harnais utilise les composants, parseur OSRM, délai et styles réels ; GPS/lectures métier et serveur d’itinéraire substitués, pas d’authentification ni base.
- Deux sondes publiques ponctuelles : IGN HTTP200, adresse publique d’exemple à Amiens, score 0,97072 et géométrie Point ; OSRM HTTP200/Ok sur coordonnées de fixture parisiennes, distance 2 045,8 m / durée 346,5 s. `outputs/map2/live-provider-probe.json`. Elles valident la réponse observée, sans SLA ni preuve générale de qualité des trajets.

## Reproductibilité et périmètre

Harnais archivé dans `outputs/map2/harnais/` avec suffixes `.txt`. Retirer ces suffixes, convertir `__` en `/`, lier `node_modules` du dépôt, adapter les chemins absolus, lancer depuis un dossier temporaire sur 127.0.0.1:4318. Le proxy de configuration ne substitue que l’URL des tuiles en scénario `?tileFailure` et la base OSRM vers la route locale ; le code fournisseur applicatif reste exécuté. Scénarios `/navigation`, `/navigation?routeFailure`, `/navigation?routeTimeout`, `/navigation?tileFailure`, `/admin`, `/portal`, `/portal?geocodeFailure`. Le serveur local est arrêté après recette ; aucun serveur durable livré.

Le journal navigateur final ne contient pas d’erreur applicative (`final-browser-errors.json`). Les erreurs réseau volontairement injectées et les notifications Statsig/Cloudflare du runtime CUA sont distinguées de la console applicative ; elles ne sont pas une panne Annona. Les premières captures prises pendant une transition de viewport avaient des dimensions incohérentes ; elles ont été reprises avant archivage final.

Les coordonnées anciennes inventées depuis un code postal ne sont pas toutes identifiables a posteriori. Aucune correction massive ni lecture de base n’a été effectuée. Les points historiques déjà enregistrés restent à auditer séparément si nécessaire. Essais GPS physiques, appareils mobiles réels, qualité mondiale des itinéraires et accès des rôles restent les recettes dédiées.

## Gratuit et décision avant vente

Le guide `docs/operations/map-providers.md` consigne les sources officielles consultées, variables, limites, données transmises et dimensionnement. OSM public n’offre ni capacité commerciale illimitée ni SLA. IGN publie 50 requêtes/s/IP ; les bornes locales ne garantissent pas ce quota entre instances. OSRM/FOSSGIS publie un plafond d’un appel/s et un usage sans charge lourde. Ses conditions commerciales complètes n’ont pas pu être lues derrière le contrôle anti-robot : **le démonstrateur public n’est pas qualifié pour une offre SaaS payante**. Aucun service payant n’est activé.

Avant vente : choix contractuel ou auto-hébergement, couverture, capacité, budget mensuel et seuils d’arrêt/alertes, contrôle global des volumes, conditions commerciales et confidentialité. Cette clôture technique MAP-2 ne lève pas ces décisions ni V1-GO. Budget nouveau fournisseur engagé : **0 €**, sans prétendre que l’hébergement applicatif est gratuit.
