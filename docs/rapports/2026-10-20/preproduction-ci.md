# ENV-1 — Préproduction isolée et recette distante

Date : 20 octobre 2026. Commit applicatif validé : `f6e19cc` sur la branche `preproduction`.

## Résultat

La préproduction est séparée du développement et de la future production. Le dépôt conserve `main` comme branche de production, tandis que Vercel crée une Preview depuis `preproduction`. Cette Preview utilise un projet Supabase gratuit distinct, vide au repos et réservé aux données fictives. Le projet historique et ses 51 démonstrations n'ont été ni modifiés, ni copiés, ni supprimés.

La Preview Vercel du commit validé a terminé avec le statut `success`. Elle reste protégée par l'authentification de l'équipe. La recette fonctionnelle exécute donc le même commit dans le runner GitHub relié aux seules variables de préproduction, puis vérifie séparément le statut du vrai déploiement Vercel. Aucun accès public de contournement n'a été créé.

## Preuves distantes

- chaîne sans secret GitHub réussie en 3 min 10 s : [exécution 39468646066](https://github.com/orsocrtnt/tutelliv-v2/actions/runs/39468646066) ;
- chaîne connectée GitHub réussie en 14 min 52 s : [exécution 39469149338](https://github.com/orsocrtnt/tutelliv-v2/actions/runs/39469149338) ;
- garde d'isolation, 279 tests, recette A/B, montage temporaire, trois parcours Chromium et contrôle des preuves réussis ;
- nettoyage `always()` réussi : six sociétés temporaires supprimées, aucun objet Storage résiduel et artefact de preuve nettoyé publié pour sept jours ;
- déploiement Vercel Preview du commit `f6e19cc` terminé avec succès.

Le nombre de parcours distant est de trois : la suite Playwright regroupe les contrôles administrateur et carte dans un même projet navigateur. La validation locale équivalente avait auparavant exécuté quatre projets de recette. Cette différence de regroupement ne retire aucun scénario fonctionnel à la chaîne distante.

## Contrôle final de la cible

Après le nettoyage distant, `npm run db1:verify-preproduction` confirme vingt tables métier, vingt-et-une tables publiques avec le registre Prisma, RLS active partout, aucun droit direct pour les rôles publics, deux migrations appliquées, zéro drift, six rôles, trente-trois permissions, cent neuf liaisons rôle-permission et zéro utilisateur Supabase Auth. Le bucket de preuves reste privé et limité aux images JPEG/PNG de 5 Mio.

Les secrets restent dans les magasins locaux, GitHub et Vercel préproduction. Aucun secret, e-mail de test ou identifiant interne ne figure dans ce rapport ni dans les preuves publiées.

## Périmètre restant

ENV-1 est terminée. CI-1 reste ouverte pour essayer et chronométrer le redéploiement d'un artefact applicatif sain. DB-1 et OPS-03A restent ouvertes pour exporter puis restaurer l'ensemble base + Storage sur une cible jetable isolée. Ces essais ne doivent jamais viser `main`, la production future ou le projet historique.
