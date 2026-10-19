# TutelLiv — tests du 27 septembre 2026

La base distante a été explicitement autorisée par l’utilisateur pour les tests : elle n’est pas une base dédiée, mais ne contient pas de données réelles. Deux entreprises fictives isolées ont été créées ; aucun compte préexistant n’a été modifié et aucun reset démo n’a été exécuté.

## ✅ Parcours vérifiés
- Build production réussi ; serveur local sur 127.0.0.1:3100, copie isolée du code et e-mails Resend désactivés.
- Inscription entreprise et ouverture du tableau de bord dans le navigateur ; création de comptes client/chauffeur via l’API applicative ; connexions des trois rôles dans le navigateur.
- Commande standard via API → affectation → démarrage → livraison avec upload PNG synthétique → statut DELIVERED côté client → facture accessible au client et téléchargement PDF valide (%PDF-, 1849 octets). Montants : 25 € HT + 5 € TVA = 30 € TTC. Mise en page PDF non auditée.
- Course via API : collecte obligatoire, passage en livraison puis échec avec motif ABSENT ; statut FAILED relu côté client.
- Commande standard créée par le formulaire client : CMD-30037026, détail et livraison associée affichés. Démarrage et validation des achats de 12,50 € dans l’interface chauffeur.
- Formulaire de commande vide refusé ; mission non démarrée refusée ; livraison sans photo refusée ; échec sans motif refusé ; saut de collecte coursier refusé.
- Adresse enregistrée, ticket support et notifications via API. Récurrence créée avec date en 2099 puis mise en PAUSED immédiatement : aucun déclenchement planifié testé.
- Client interdit sur /api/users et chauffeur interdit sur /api/orders (403).
- Entreprise B interdite d’accès direct à la commande A ; client B interdit d’accès direct à la commande et facture A (404).
- Neuf contrôles anonymes précédents réussis ; page connexion chauffeur lisible en largeur mobile 390 pixels.

## ❌ Défauts reproduits
1. **Isolation du support défaillante.** Le client de l’entreprise fictive B a pu créer un ticket lié à la commande de A (HTTP 201). La réponse révèle sa référence CMD-77747025. Les accès directs à la commande et facture sont pourtant refusés. Corriger la vérification d’appartenance avant toute commercialisation.
2. **Statistiques après facturation.** Le client affiche « Livrées ce mois : 0 » après une livraison réussie puis facturée. Le statut opérationnel devient INVOICED, ce qui masque la livraison dans ce compteur. Le même compteur chauffeur montrait zéro.
3. **Lien public d’inscription.** Plusieurs clics sur « Créer un compte » depuis /login n’ont pas navigué pendant la première session ; /register directement fonctionne, et l’inscription réelle a réussi. Cause non isolée.

## ⚠️ Limites et observations
- Une erreur serveur `window is not defined` a été relevée initialement dans le module Leaflet chauffeur. Pendant la session authentifiée, l’écran navigation s’est ouvert, y compris après accès direct : ne pas conclure à un crash systématique.
- GPS indisponible dans le navigateur de test : « GPS en attente » et « Calcul du guidage… ». Le guidage réel, déplacements, suivi en arrière-plan et proximité physique ne sont pas validés. Les tests API utilisent explicitement la confirmation hors zone.
- Confirmation des achats : attente visible avant succès, sans chargement immédiat ; le code attend jusqu’à trois tentatives de géolocalisation avant d’envoyer la mutation. Aucun chronométrage précis effectué.
- SMS, e-mails réels, paiement, charge, navigateurs/appareils multiples et exécution cron non testés.
- Test d’élargissement des droits d’un mini-admin non exécuté : contrôle automatique d’autorisation refusé, exigeant une autorisation spécifique pour créer le rôle fictif, modifier ses permissions sur sa propre entreprise de test puis restaurer ces permissions. Le défaut suspecté dans l’audit statique reste non confirmé en exécution.

## Données laissées
Deux entreprises E2E, cinq comptes fictifs, trois commandes dont une course, une facture, une adresse, deux tickets support et une récurrence en pause. Références et comptes sans mots de passe dans fixtures.json. Résultats API sans cookies ni mots de passe dans api-results.json. Les identifiants temporaires ne figurent pas dans les livrables.

Aucune correction du code applicatif effectuée pendant ces tests. Les résultats ne constituent pas une certification de préparation à la vente. Priorité : fermer la fuite du support, séparer statut livraison et facturation, puis compléter GPS et permissions sur scénario autorisé.

## Clôture navigateur
La commande CMD-30037026 a également été clôturée dans le navigateur chauffeur avec une image synthétique et confirmation explicite hors zone GPS. Le portail client relu via API retourne DELIVERED. La mission disparaît de la liste des missions actives.
