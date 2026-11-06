# DATA-02 — Projet de politique de conservation France

Date de référence : 18 octobre 2026. Cette proposition traduit les orientations produit en règles techniques. Elle doit être validée par le futur responsable juridique avant activation sur des données réelles.

## Politique proposée

| Catégorie | Base active proposée | Archivage ou suppression | Conséquence technique |
|---|---|---|---|
| Positions GPS détaillées | 60 jours maximum | Suppression automatique ; extension jusqu'à un an seulement si une finalité probatoire documentée ne peut pas être satisfaite autrement | Purge quotidienne par entreprise, GPS arrêté hors service, journaux de purge sans coordonnées |
| Dernière position opérationnelle | Pendant la mission puis jusqu'à clôture technique courte | Effacement ou dissociation après clôture et expiration du délai GPS | Ne pas conserver indéfiniment le dernier point dans le profil livreur |
| Commandes, livraisons, statuts et échanges | Relation contractuelle et consultation opérationnelle | Archivage intermédiaire jusqu'à cinq ans pour preuve commerciale si justifié, avec accès restreint | Séparer base active et archive ; rendre les données archivées invisibles au dispatch courant |
| Photos et preuves de livraison | Durée nécessaire au suivi et aux contestations | Même horizon probatoire que la livraison uniquement si nécessaire ; suppression plus tôt si la preuve structurée suffit | Règle par objet Storage, manifeste de suppression et absence de lien signé après purge |
| Factures et pièces comptables | Accès actif selon besoin | Dix ans à compter de la clôture de l'exercice | Archive immuable et séparée ; ne pas supprimer avec le compte opérationnel |
| Contrat SaaS et correspondance commerciale | Relation contractuelle | Cinq ans après sa fin, sous réserve d'une règle spéciale | Archivage intermédiaire réservé aux personnes habilitées |
| Comptes et droits | Durée du contrat ou de la mission de l'utilisateur | Désactivation immédiate puis suppression/anonymisation après les obligations associées | Révocation des sessions et séparation des traces de sécurité nécessaires |
| Prospects | Jusqu'au dernier contact utile | Trois ans après collecte ou dernier contact du prospect | Purge ou demande de renouvellement explicite ; conserver seulement l'opposition nécessaire |
| Données de démonstration | Huit heures pour la session actuelle | Suppression automatique au plus tard sous 24 heures, hors preuve technique anonymisée | Job de nettoyage ciblé et alerte en cas d'échec |
| Pilotes | Durée du pilote plus export et clôture | Suppression sous 30 jours après confirmation de l'export, sauf archive légalement nécessaire | Date de fin obligatoire et état de purge vérifiable |
| Sauvegardes | Rotation documentée selon le plan retenu | Expiration automatique ; aucune restauration ne doit réintroduire durablement une donnée déjà purgée | Registre des purges et procédure de reprise post-restauration |

## Fondements à conserver dans le dossier juridique

La CNIL indique une conservation de principe des données de géolocalisation de deux mois, avec une possibilité d'un an pour l'optimisation des tournées ou la preuve d'interventions lorsqu'aucun autre moyen ne convient, et cinq ans pour le suivi du temps de travail. Annona ne retient pas par défaut ces exceptions : [CNIL — géolocalisation des véhicules](https://www.cnil.fr/fr/la-geolocalisation-des-vehicules-des-salaries).

Les données nécessaires à l'exécution du contrat restent actives pendant la relation contractuelle, puis seules celles justifiées par une obligation ou un contentieux passent en archivage intermédiaire. La prescription commerciale de droit commun est de cinq ans. Sources : [CNIL — durées de conservation](https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees), [Code de commerce L110-4](https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000027725867/2023-08-16) et [Service Public — documents d'entreprise](https://entreprendre.service-public.fr/vosdroits/F10029).

Les pièces comptables, bons de commande, bons de livraison et factures sont généralement conservés dix ans à compter de la clôture de l'exercice. Cette durée ne justifie pas de garder dix ans toutes les positions GPS, conversations ou photos.

## Sortie et suppression vérifiable

Avant clôture, l'entreprise reçoit une archive chiffrée contenant les données exploitables et les preuves autorisées. Le téléchargement doit être authentifié, limité dans le temps et journalisé sans exposer le contenu.

La suppression suit un plan : désactivation des accès, export, délai contradictoire, purge de la base active, purge Storage/Auth, production d'un manifeste de suppression, puis expiration normale des sauvegardes. Les archives légales sont isolées, en lecture restreinte, avec la finalité et la date de fin inscrites.

Aucune suppression automatique définitive de données réelles ne peut être activée avant validation juridique, exercice sur fixtures A/B et test de restauration sur cible isolée.
