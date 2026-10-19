# SEC-06 — Accès directs et preuves de livraison

État final vérifié le 5 octobre 2026 : correction locale et verrouillage distant appliqués, **SEC-06 et R13 terminées**.

## Faille distante confirmée

Les 17 tables métier du schéma public ont RLS désactivé. Les rôles anon et authenticated disposent de privilèges directs. Quatre requêtes REST utilisant uniquement la clé publique, sans session utilisateur, ont renvoyé HTTP 200 avec au moins une ligne : users, orders, deliveries et invoices. Seuls les identifiants ont été demandés ; les valeurs ne sont pas conservées dans le rapport. Aucune tentative d’écriture anonyme effectuée. Les droits INSERT/UPDATE/DELETE sont présents, mais leur exploitation n’a pas été testée.

Cette exposition contournait les contrôles de l’application et bloquait l’utilisation avec des données réelles. Le verrouillage décrit plus bas a été appliqué après autorisation explicite.

## Correction locale

Un chemin de photo fourni en JSON par un livreur est maintenant refusé. Les photos doivent être téléversées via le serveur ; leur chemin est vérifié contre l’entreprise et la livraison avant signature. Les téléversements ont un nom unique et ne remplacent pas les fichiers existants. Taille maximale 5 Mio, types PNG/JPEG avec vérification de signature initiale (pas un décodage intégral). Un bucket public est refusé, et un échec de préparation peut être retenté. Les commandes, livraisons, cartes, factures, PDF, modèles de nouvelle commande et missions chauffeur répètent désormais la frontière d’entreprise en plus du propriétaire ou du chauffeur.

Validation finale : `npm run check` réussi, **58 tests**, types et lint sans erreur (24 avertissements existants). Six tests SEC-06 couvrent les chemins étrangers, le bucket public, les fichiers invalides, le refus de références JSON et la double frontière propriétaire/entreprise pour les lectures client, la carte et les missions. `git diff --check` réussi.

## Stockage distant

Le bucket delivery-pods est privé, limité à 5 Mio. Les tables Storage ont RLS activé et aucune politique n’a été trouvée dans public/storage. Sur un objet existant, l’URL publique répond 400, le lien signé de deux secondes répond 206 avant expiration puis 400 après quatre secondes. Aucun fichier de preuve n’a été modifié ; une lecture limitée à un octet a servi au contrôle.

## Verrouillage appliqué et contrôlé

Après autorisation du propriétaire, `verrouillage.sql` a activé RLS et retiré les droits directs de anon, authenticated et PUBLIC sur les 17 tables explicitement listées. Il n’a touché ni les lignes métier, ni les schémas auth/storage, ni les droits service_role. L’opération transactionnelle a réussi.

Le contrôle après exécution confirme RLS actif et zéro privilège direct restant pour anon, authenticated ou PUBLIC sur les 17 tables. Une requête REST valide avec la seule clé publique renvoie HTTP 401 sur chacune des 17 tables. Les lectures Prisma réussissent sur chacune d’elles.

## Matrice A/B connectée

La recette reliée à la base de test compte 41 contrôles réussis sur 41 : six connexions, trois refus sans authentification, lectures autorisées pour admin, mini-admin, client et chauffeur, refus interentreprises en 404, séparation des interfaces par rôle en 403, écritures étrangères refusées pour admin, mini-admin, client et chauffeur, PDF propre téléchargeable et étranger refusé, messages support isolés et photos signées accessibles uniquement après autorisation applicative. Le mini-admin temporaire a été supprimé de la base et de Supabase Auth après la recette. Aucun contenu métier n’a été modifié.

`retour-arriere.sql` reste disponible en urgence, mais son utilisation réouvrirait l’exposition et n’est pas recommandée. Les droits par défaut des futures tables restent à traiter dans DB-1. SEC-05 reste séparément en attente de configuration et de recette e-mail réelle.

Preuves : final-verification.json, matrix-e2e.json, storage-metadata.json, storage-access.json, direct-access.json, grants-before.json, lockdown-result.json et app-smoke.json. Aucun secret ni contenu de ligne dans ces fichiers. Aucun déploiement ni envoi d’e-mail réalisé.
