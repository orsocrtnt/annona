# DEMO-2 — Pool de démonstrations préconstruites

État : implémentation et base de préproduction validées le 22 octobre 2026. La validation finale sur l'URL Vercel Preview reste à exécuter après publication du code.

## Objectif

La connexion de démonstration ne fabrique plus huit livraisons, les utilisateurs et les réglages dans la requête HTTP. Trois entreprises fictives complètes sont préparées avant l'arrivée des visiteurs. Une connexion réserve atomiquement un slot ; la déconnexion ou l'expiration le place dans une file durable puis rend immédiatement la main au navigateur.

L'entreprise modèle permanente reste séparée. Les anciennes sessions DEMO-1 restent lisibles jusqu'à leur expiration mais aucune nouvelle connexion n'emprunte leur chemin de construction.

## États persistants

`DemoPoolEnvironment` associe exactement un slot à une entreprise fictive :

- `PREPARING` : construction initiale ou worker en cours ;
- `READY` : scénario complet disponible ;
- `LEASED` : réservé à une seule empreinte de session jusqu'à huit heures ;
- `RECYCLING` : recyclage demandé et reprenable ;
- `QUARANTINED` : incohérence ou ressource externe, aucune nouvelle attribution.

L'empreinte de session est un SHA-256 ; le cookie aléatoire brut n'est pas stocké en base. L'index unique sur cette empreinte rend le double clic idempotent. La transition conditionnelle `READY` vers `LEASED`, dans une transaction sérialisable, empêche deux visiteurs de recevoir la même entreprise.

## Chemin utilisateur

1. Le navigateur crée une clé de demande stable dans `sessionStorage` pour les doubles soumissions.
2. Supabase confirme le compte de démonstration commun.
3. Le serveur reprend une location active ou réserve un slot prêt.
4. La persona administrateur propre à l'entreprise louée est retournée.
5. Si le stock est vide, l'API répond `503`, code `DEMO_POOL_BUSY` et `Retry-After: 5`. Aucune entreprise partagée ni construction synchrone n'est utilisée.
6. La déconnexion passe le slot à `RECYCLING`, efface sa clé de location et répond `204`. `after()` lance le recyclage hors réponse ; l'état en base permet une reprise si la fonction s'arrête.

## Recyclage et sécurité

Avant de reconstruire, le worker exige : entreprise marquée `demoPool`, aucune preuve photo ou PDF, aucun job actif, aucune référence interentreprises et aucun objet dans le dossier Storage. Un échec de garde met immédiatement le slot en quarantaine. Une panne technique est retentée au maximum trois fois, puis mise en quarantaine.

Le reset supprime les jobs terminés du scénario précédent. Pour un compte créé pendant une démo, l'identité Supabase Auth est supprimée avant sa ligne locale ; une erreur fournisseur interrompt le recyclage. Le scénario n'est remis à `READY` qu'après contrôle d'un administrateur fictif et de huit commandes.

La table de coordination a RLS active et aucun droit direct `anon`, `authenticated` ou `PUBLIC`. Les migrations sont additives :

- `20261022090000_demo_pool` ;
- `20261022091000_demo_pool_security`.

## Commandes opérateur

Ces commandes ciblent explicitement `.env.preproduction.local`. Elles ne doivent pas être redirigées vers l'ancienne cible.

```bash
npm run demo2:prepare
npm run demo2:maintain
npm run test:demo2
DEMO_BASE_URL=https://URL-DE-PREVIEW npm run test:demo2:http
```

`demo2:prepare` est idempotente : elle ne reconstruit ni un slot prêt, ni un slot loué, ni un slot en quarantaine. `demo2:maintain` reprend les expirations et recyclages en attente. La route `/api/cron/demo-pool` offre la même reprise sous `CRON_SECRET`, mais aucun horaire payant n'est ajouté dans `vercel.json`.

## Preuves du 22 octobre 2026

- base Supabase de préproduction : trois slots prêts, aucun loué ou en quarantaine après recette ;
- concurrence : deux demandes identiques ont reçu la même location ; A et B ont reçu des entreprises différentes ; le quatrième visiteur a reçu l'état de stock vide ;
- isolation : le recyclage de A a supprimé son marqueur tout en conservant celui de B ;
- reprise : expiration, worker interrompu et panne Storage injectée ont suivi les états prévus ;
- modèle permanent : nombre de commandes inchangé ;
- HTTP local en build de production relié à la préproduction : ouverture p95 2 983 ms, maximum 2 983 ms, reconnexion p95 7 ms, déconnexion p95 1 224 ms sur trois ouvertures ;
- validation globale : 298 tests réussis, types et lint stricts, build Next réussi.

Preuves machine : `outputs/demo2/connected.json` et `outputs/demo2/http.json`.

## Porte de clôture

DEMO-2 reste ouverte jusqu'au même benchmark sur la véritable URL Vercel Preview. La publication ne doit pas inclure la branche de production ni modifier l'ancienne cible Supabase. Après succès Preview, consigner l'URL sans jeton, les quatre budgets et l'état final du pool, puis cocher la tâche.
