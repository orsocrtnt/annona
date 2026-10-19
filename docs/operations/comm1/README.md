# COMM-1 — fil opérationnel et évolution additive de base

Le fil d’une commande est distinct des tickets d’assistance. Questions, instructions, modifications et incidents sont partagés avec le client propriétaire, le personnel habilité de l’entreprise et les chauffeurs actuellement affectés à une livraison de cette commande. Les notes internes sont réservées au personnel ; ni corps, ni titre, ni compteur, ni notification de note ne sont exposés au client ou au chauffeur.

Le personnel doit disposer de `orders:read` ou `deliveries:read` pour lire, puis de `orders:update`, `deliveries:update` ou `deliveries:dispatch` pour publier. Les permissions mini-admin sont filtrées. Une réaffectation retire immédiatement les accès aux nouvelles requêtes de l’ancien chauffeur, y compris le rejeu d’un message et la lecture de ses anciennes notifications. Le nouveau chauffeur voit l’historique partagé. Une requête déjà autorisée avant la réaffectation peut avoir lu des données ; une révocation ne peut effacer ce qui a déjà été affiché. Le prochain rafraîchissement (10 secondes, ou action explicite) masque le fil si l’accès est révoqué.

Une commande annulée, ou dont toutes les livraisons sont terminées/échouées/annulées, reste consultable en lecture seule. Une facture payée ne ferme pas le fil d’une livraison encore active. Un rejeu déjà connu après clôture rend son message existant sans ajout. Les nouvelles demandes après fin relèvent du support. Les messages sont immuables ; modification et incident désignent une catégorie de message, pas une mutation automatique des instructions ou du statut logistique.

## Persistance et concurrence

`order_messages` conserve l’auteur et son rôle au moment de l’envoi, sa date, la visibilité et une clé de tentative unique par auteur/commande. `order_thread_reads` conserve le dernier message marqué comme lu par utilisateur. La colonne nullable `client_notifications.order_message_id` rattache les notifications à un message et permet de réévaluer les droits en base. Les anciennes routes de notifications excluent ces nouvelles notifications, également du nettoyage et du marquage générique.

Le message et sa tâche OPS-02B sont créés dans la même transaction. Le worker produit uniquement des notifications internes génériques, sans corps du message ni e-mail, avec identifiant déterministe et contrôle du périmètre courant. Les lectures sont paginées par date puis identifiant (50 messages). Le dernier message effectivement affiché est envoyé pour le marquage ; le watermark ne recule jamais et ne consomme pas un message arrivé ensuite. Sous verrou de commande, la date du message croît strictement. L’écriture chauffeur verrouille aussi sa livraison et revalide son affectation ; les conflits de sérialisation sont réessayés de façon bornée.

## Application explicite du SQL

`apply.sql` est une migration additive ciblée, exécutée indépendamment du démarrage. Elle ne contient ni backfill, ni suppression, ni synchronisation Prisma globale. Une seconde exécution échoue volontairement. Les nouvelles tables ont RLS active et aucun droit `PUBLIC`, `anon` ou `authenticated`. Le compte Prisma propriétaire conserve son accès serveur. `rollback.sql` documente le retour applicatif conservant les données.

Le 12 octobre 2026 : préflight PostgreSQL 17.6 ; copies locales PostgreSQL 15.14 des tables parentes `orders`, `users`, `client_notifications` (34, 30 et 12 lignes), types, enums, clés primaires et RLS. Application puis export/restauration identiques. Le SQL a ensuite été appliqué explicitement sur la base de test autorisée, avec vérification des données historiques identiques, nouvelles tables vides, RLS actives et zéro droit public. Preuves : `outputs/comm1/db-preflight.json`, `db-isolated.json`, `db-applied.json` dans le dossier de travail Codex.

Cette copie est limitée aux trois tables parentes ; leurs anciennes relations, politiques et le stockage photo ne sont pas clonés. Elle ne valide pas la restauration globale du service ni la baseline DB-1. DB-1 reste ouverte. Aucun seed, reset, push ou déploiement n’est réalisé.
