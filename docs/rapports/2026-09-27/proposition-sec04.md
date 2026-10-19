# Proposition SEC-04 — à autoriser avant modification

Objectif : une suspension ou un retrait de module enregistré en base doit être pris en compte dès la prochaine requête protégée, quelle que soit l’instance serveur. Une requête déjà autorisée peut finir ; il ne s’agit pas d’annuler une opération en cours.

Modifications proposées, uniquement dans le code local :

1. Ajouter `src/lib/auth/account-access.ts` : compte ACTIVE requis ; entreprise ACTIVE ou TRIAL requise et cohérente avec companyId ; seul SUPER_ADMIN peut être sans entreprise. Autres statuts refusés.
2. Modifier `src/lib/api/server-auth.ts` pour lire le compte et ses permissions à chaque requête et contrôler le compte de base ainsi que l’éventuelle persona de démonstration. Conserver uniquement la déduplication React à l’intérieur d’une requête.
3. Retirer le cache de permissions entre requêtes de `src/lib/api/auth-cache.ts` et ses usages dans le service d’authentification de démonstration et les routes de persona/réinitialisation. Cela évite une invalidation non propagée entre instances.
4. Appliquer le contrôle de statut dans `src/domains/auth/auth.service.ts` avant la synchronisation d’un compte existant et dans les routes de connexion/synchronisation, avec réponse explicite de refus. Ne pas réactiver automatiquement un compte suspendu.
5. Ajouter des tests locaux : matrice des statuts utilisateur/entreprise ; absence d’entreprise ; suspension après une première requête ; retrait de module sans attendre un TTL ; deux résolveurs simulant deux instances ; compte démo suspendu ; erreurs de lecture refusées. Relancer types, lint et tests ; consigner le délai et les limites.

Risques à vérifier : coût de lectures supplémentaires en base ; comptes anciens sans entreprise ; connexion et démonstration. Aucun test de suspension de comptes distants, aucune migration ni aucun déploiement ne sont proposés dans cette autorisation. Les sessions Supabase et les politiques d’accès direct Storage nécessitent des contrôles distincts.

Le contrôle automatique a refusé l’application de ces changements car ils touchent le chemin d’authentification global et pourraient bloquer les utilisateurs en cas d’erreur. Autorisation explicite demandée pour réaliser et tester ce périmètre local.
