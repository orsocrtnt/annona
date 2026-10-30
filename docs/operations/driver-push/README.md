# Notifications « Nouvelle mission » au livreur

Quand une mission est confiée à un livreur (dispatcher, dispatch automatique ou tournée), une tâche durable `DRIVER_NOTIFICATION` est inscrite dans la même transaction, puis envoyée après la réponse. Le cron `/api/cron/operations` reprend les tâches restées en attente. Une mission prise par le livreur lui-même ne déclenche rien.

## Contenu et données

- Le message est générique : « Nouvelle mission », sans référence, adresse ni nom. Il transite chiffré par le service de notification du fabricant de l'appareil.
- La table `driver_push_subscriptions` garde par appareil l'adresse d'abonnement et ses clés, sans lecture possible depuis le client (RLS active, droits retirés).
- À l'envoi, la mission est relue : si elle a été retirée ou réaffectée, rien ne part. Les abonnements expirés (404, 410) sont supprimés.
- La déconnexion depuis le profil retire l'abonnement du téléphone.

## Configuration

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY`, créées et posées par `npm run push:setup-keys` (fichiers locaux et Vercel, branche `preproduction`), à lancer une fois puis à suivre d'un redéploiement : la clé publique est lue au build. Sans elles, la tâche est close sans envoi avec `SKIPPED:DRIVER_PUSH_NOT_CONFIGURED`. Changer la paire invalide tous les abonnements existants.

## Activer sur un téléphone

Dans l'espace livreur : **Profil → Notifications → Activer les notifications**. Sur iPhone (iOS 16.4 ou plus récent), il faut d'abord ajouter le site à l'écran d'accueil depuis une page de l'espace livreur, puis l'ouvrir depuis cette icône. Cette installation a sa propre session : il faut se reconnecter une fois.
