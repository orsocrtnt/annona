# CI-1 — Retour arrière applicatif sur la Preview

Date : 20 octobre 2026. Cible : branche `preproduction` et environnement Vercel `Preview` uniquement.

## Objectif et garde-fous

Le test devait prouver qu'un commit applicatif sain peut remplacer le commit courant sur l'URL stable de préproduction, puis que la version courante peut être rétablie. Avant chaque validation, le tableau de bord confirmait l'environnement `Preview`, la branche `preproduction` et le SHA source. Les actions Production, Promote et Force Promote n'ont pas été utilisées. La branche `main` et son déploiement Production sont restés sur leur état historique.

## Retour arrière essayé

Le déploiement sain `f6e19cc` a été redéployé depuis Vercel. Le nouveau déploiement `31uFWXR7g3bpnUEmgqbYNPZoyhKs` est passé à `Ready` en 1 min 39 s et a reçu l'alias stable `tutelliv-v2-git-preproduction-tutelliv.vercel.app`.

Le commit courant `04a0a35` a ensuite été redéployé. Le nouveau déploiement `4w1uqn5qf37V4qqy2bzCM71dfp9a` est passé à `Ready` en 2 min 11 s et a repris l'alias stable de la branche. La Preview termine donc sur la version courante.

Vercel désactive `Instant Rollback` pour cette Preview Hobby. La méthode validée utilise `Redeploy` : elle reconstruit le même code source avec les réglages de projet actuels. Elle ne garantit pas la réutilisation d'un binaire immuable. Cette limite devra être réévaluée avec l'offre d'hébergement commerciale avant la production.

## Contrôles après essai

Le contrôle direct de Supabase confirme vingt tables métier, RLS partout, aucun droit public, deux migrations appliquées, zéro drift, les références RBAC exactes, zéro utilisateur Auth et le bucket de preuves privé. Aucun envoi d'e-mail, aucune fixture et aucune donnée historique n'ont été créés ou supprimés pendant le retour arrière.

CI-1 est terminée pour la cible isolée : une modification défaillante est bloquée par la chaîne GitHub, la Preview est déployée après contrôles et le retour arrière applicatif est essayé et chronométré. La restauration base + Storage reste dans DB-1 et OPS-03A, car elle exige une cible jetable distincte et ne doit jamais être confondue avec un retour arrière applicatif.
