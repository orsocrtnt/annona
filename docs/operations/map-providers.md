# Fournisseurs cartographiques — décision MAP-2

Vérifié le 15 octobre 2026. Aucun compte créé, abonnement souscrit, moyen de paiement ajouté ni service payant activé. Les variables existantes privées ne sont pas modifiées.

## Configuration retenue pour les essais

- Fond unique OpenStreetMap standard : `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, zooms 1–19. Esri Light Gray est retiré : MAP-1 a prouvé son image « Map data not yet available » au zoom chauffeur 18. Un fond cartographique n’acquiert pas davantage de détails en zoomant au-delà des niveaux couverts ; ici aucun agrandissement au-delà du niveau natif.
- Toutes les cartes utilisent le même fournisseur et la même attribution visible, y compris aperçu d’adresse et historique. Les positions restent affichées en cas d’échec du fond ; message après erreur de tuile ou 10 s d’attente et reprise manuelle. Le délai signale la dégradation ; il ne prétend pas annuler les téléchargements natifs d’images du navigateur.
- Géocodage serveur : `https://data.geopf.fr/geocodage/search`, index `address`, score minimum local 0,6. L’ancien domaine BAN est déprécié, avec retrait annoncé fin janvier 2026. [Documentation BAN actuelle](https://adresse.data.gouv.fr/outils/api-doc/adresse), [documentation IGN du géocodage](https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/geocodage/).
- Itinéraires : protocole OSRM, démonstrateur public existant `https://router.project-osrm.org` par défaut pour essais. Réponse validée (coordonnées, distance/durée positives, étapes), HTTP/JSON/absence/timeout rendent `null`. Aucun faux trait de navigation ni durée zéro. Une route devenue indisponible est retirée, Google Maps reste un lien externe choisi par le chauffeur, sans SDK ni clé facturable.
- Délai maximal réseau + corps JSON : 8 s. Pas de retry immédiat ; navigation toutes les 30 s, un seul appel en cours, arrêt à la sortie/changement de cible et réponses anciennes ignorées. Les mises à jour GPS ne recalculent pas chacune la route. Les appels rapprochés sont plafonnés à un départ par 1,1 s dans le module navigateur ; l’appel refusé devient explicitement indisponible.
- Géocodage : déduplication simultanée, cache positif 24 h, négatif 30 s, plafond de 1 000 adresses en mémoire, huit appels simultanés maximum par processus, huit adresses par lecture de carte, pause locale de 5 s après erreur. Les coordonnées déjà enregistrées exploitables sont réutilisées pour la navigation. Échec : coordonnées nulles, marqueur absent, pas d’estimation tarifaire inventée ni de point persistant ; navigation/proximité explicites. Les géocodages manquants ne bloquent pas la création d’une commande.

## Conditions vérifiées et limites du gratuit

**Tuiles OSM.** Les données ouvertes ne garantissent pas un hébergement illimité gratuit. Le service public fonctionne sans garantie, peut bloquer un usage excessif et retirer l’accès commercial. Attribution visible, Referer navigateur et cache HTTP normal sont requis ; téléchargement massif, préchargement et usage hors ligne interdits. Aucune fonctionnalité de préchargement n’est ajoutée. [Politique officielle OSMF](https://operations.osmfoundation.org/policies/tiles/).

**Géocodage IGN/BAN.** Usage des géoservices gratuit sauf licence spécifique ; API publique unitaire sans compte dans la documentation, limite publiée 50 requêtes/s/IP. La BAN décrit des réponses 429 et blocage initial 5 s. Réutilisation soumise aux licences des données et CGU, attribution BAN/IGN affichée. Le service n’ouvre pas droit à indemnisation en cas d’indisponibilité. Les offres Premium d’hébergement de données ne sont pas souscrites. [CGU IGN, annexes 2/3](https://cartes.gouv.fr/cgu/), [quota BAN](https://adresse.data.gouv.fr/outils/api-doc/adresse).

**OSRM public.** Le wiki actuel renvoie au service FOSSGIS : plafond annoncé un appel/s, absence de scraping/usage lourd, attribution OSRM/OSM et lien de correction. Les requêtes sont journalisées. Le wiki contient également d’anciennes conditions (serveur précédent), dont interdiction de revendre l’accès et accès derrière paywall ; elles ne constituent pas une autorisation commerciale actuelle. La page complète FOSSGIS est protégée par un contrôle anti-robot lors de cette vérification. L’usage en SaaS payant n’est donc **pas validé** et doit être remplacé ou expressément autorisé avant vente ; aucune promesse de disponibilité commerciale. [Politique du projet](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy), [conditions résumées par l’opérateur actuel](https://routing.openstreetmap.de/about.html), [conditions complètes à faire vérifier](https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/).

## Variables de changement de fournisseur

Configurer puis reconstruire pour les variables `NEXT_PUBLIC_*` :

- `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` : paire obligatoire pour utiliser un fond XYZ personnalisé. Attribution HTML provenant exclusivement d’une configuration de confiance, jamais d’un champ client. Sans la paire, repli OSM.
- `NEXT_PUBLIC_MAP_MAX_NATIVE_ZOOM` : entier 1–19 correspondant à la couverture documentée du fond personnalisé. Valeur invalide : plafond conservateur 1. Ne pas recopier 19 pour un fond limité à 16. Le cadrage chauffeur est borné par ce plafond.
- `NEXT_PUBLIC_OSRM_URL` : base d’un endpoint compatible `/route/v1/driving/...` ; pas un adaptateur universel Google/Mapbox/IGN. Prévoir un adaptateur séparé si le format change. Aucun secret serveur dans une variable publique.
- `GEOCODING_URL` : endpoint serveur compatible recherche GeoJSON IGN/BAN. Toute autre API exige un adaptateur et ses conditions vérifiées.

Les adresses sont envoyées à IGN côté serveur ; les coordonnées de départ/arrivée à OSRM côté navigateur ; les demandes de tuiles exposent la zone affichée, IP et Referer. Le lien Google Maps transmet l’adresse et éventuellement la position seulement lors de son ouverture. Information des utilisateurs et prestataires autorisés à confirmer avant usage réel.

## Décisions commerciales restant au propriétaire avant vente

1. Choisir couverture/pays, volumes, disponibilité et support attendus. Décider fond/itinéraires autorisés pour produit payant : auto-hébergement ou offre contractuelle, sans engager de dépense automatiquement.
2. Fixer budget mensuel maximal, alertes à 50/80/100 %, quota central par entreprise/IP et arrêt des dépassements. Les bornes actuelles sont locales à un navigateur/processus, **pas un contrôle de budget multi-instance ni une garantie du quota global**. Un réseau partagé/NAT ou plusieurs instances peuvent dépasser les limites publiques.
3. Dimensionnement : navigation continue ≈120 requêtes/h/chauffeur ; 8 h ×22 jours ≈21 120/mois/chauffeur, hors changements de cible. Dix chauffeurs ≈211 200/mois. Les tuiles dépendent du viewport et des déplacements, le géocodage des adresses nouvelles/cache. Mesurer ces trois volumes au pilote avant de chiffrer une offre. Aucun tarif fournisseur ni prix client n’est déduit.
4. Faire confirmer les conditions FOSSGIS actuelles si son démonstrateur est envisagé, les droits/licences du fond final et les obligations de confidentialité. Si aucun fournisseur d’itinéraires exploitable n’est retenu, proposer explicitement les positions et liens de navigation externes.

Budget de nouveaux fournisseurs engagé par MAP-2 : **0 €**. Cela n’affirme ni gratuité illimitée ni absence de coût d’hébergement applicatif/auto-hébergement. MAP-2 valide la correction et la documentation des limites ; V1-GO reste ouverte pour l’autorisation commerciale et la recette terrain.
