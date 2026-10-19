# SUPPORT-1 — Exploitation du support client

Date de référence : 16 octobre 2026. Le canal suivi pour les demandes client est l'espace support intégré à TutelLiv. L'objectif affiché est une première réponse sous un jour ouvré. Cet objectif organise le travail de l'équipe ; il ne constitue pas encore un engagement contractuel.

## Parcours client

1. Le client ouvre `/portal/support`, crée une demande et choisit au besoin une commande ou une livraison de sa propre entreprise.
2. La demande et son premier message apparaissent dans la liste du client. Le détail `/portal/support/[id]` conserve tout l'historique.
3. Une réponse ou un changement de statut effectué par l'équipe crée une notification TutelLiv qui renvoie vers ce détail.
4. Les statuts visibles sont `Ouvert`, `En cours`, `Résolu` et `Fermé`. Une nouvelle réponse client sur une demande résolue ou fermée la rouvre automatiquement.

## Parcours équipe

Les administrateurs d'entreprise et dispatchers accèdent à `/support`. Un mini-administrateur doit disposer du module Support et de la permission `support:read`.

La boîte de réception propose les demandes actives, toutes les demandes ou un statut précis. Chaque fiche montre le client, les liens commande/livraison autorisés, l'historique, la réponse et le statut. L'équipe répond directement dans TutelLiv et peut passer la demande à `En cours`, `Résolu` ou `Fermé`.

Les lectures et écritures sont bornées par entreprise. Les ressources liées doivent appartenir à la même entreprise et au client du ticket. Un rôle client ou chauffeur ne peut pas appeler les routes internes du support.

## Vérification

- `npm run test:support1` crée deux entreprises temporaires, vérifie réception, réponse, notifications, résolution, réouverture et refus interentreprises, puis exige zéro résidu.
- `npm run test:support1:e2e` rejoue le parcours client et équipe dans Chrome, contrôle les notifications, la résolution visible et les refus entre rôles.
- `npm run test:e2e` rejoue SUPPORT-1 avec la recette globale TEST-2.
- `npm run check` vérifie types, lint et règles locales ; `npm run build` vérifie la compilation de production.

Les preuves filtrées se trouvent dans `outputs/support1/connected.json`, `outputs/support1/browser.json` et `outputs/support1/summary.json`. Elles ne contiennent ni identifiant interne, ni e-mail, ni cookie, ni secret.

## Nettoyage et incidents

Les recettes utilisent des noms préfixés `support1-` et suppriment uniquement leurs entreprises, utilisateurs, tickets, messages et notifications. Ne jamais réinitialiser toute la base. Si une recette échoue, vérifier `fixtureResidue`, corriger la cause, relancer le nettoyage ciblé puis toute la recette.

L'envoi d'e-mails transactionnels reste dans la tâche EMAIL. Tant qu'elle n'est pas validée, la notification garantie par SUPPORT-1 est la notification intégrée à TutelLiv.
