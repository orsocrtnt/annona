# ENV-1 — Estimation de coût avant création

Date de vérification : 18 octobre 2026. Montants fournisseurs en dollars américains hors taxes, hors variation de change, domaine et dépassements. Aucun abonnement ni ressource n'a été créé.

## Trois niveaux possibles

| Niveau | Supabase | Vercel | Resend | Minimum mensuel indicatif | Ce que ce niveau démontre |
|---|---:|---:|---:|---:|---|
| Préparation économique | Free, 0 $ | Pro, 20 $ | Free, 0 $ | 20 $ | Préproduction sans données réelles, migrations, RLS, e-mails limités et tests fonctionnels |
| Préproduction stable | Pro, 25 $ | Pro, 20 $ | Free, 0 $ | 45 $ | Pas de pause Supabase, sauvegardes quotidiennes conservées 7 jours, usage commercial Vercel |
| Exercice RPO base ≤ 1 h | Pro, 25 $ + PITR 7 jours, env. 100 $ | Pro, 20 $ | Free, 0 $ | 145 $ | Restauration PostgreSQL à un instant précis ; les objets Storage restent à sauvegarder séparément |

Resend Pro ajouterait 20 $/mois et porterait les deux derniers totaux à 65 $ et 165 $. Il n'est pas nécessaire pour la recette initiale si 3 000 e-mails/mois et 100/jour suffisent.

Ces totaux ne comprennent pas une éventuelle deuxième instance Supabase payante pour la production, un domaine, les dépassements, un service de surveillance tiers, les cartes ou le paiement.

## Points de décision

### Supabase

Le plan Free fournit jusqu'à deux projets actifs, mais un projet inactif peut être suspendu et les sauvegardes de base ne sont pas téléchargeables. Il convient à la préparation sans données réelles, pas à la validation de sauvegarde exigée avant vente.

Le plan Pro coûte 25 $/mois au niveau de l'organisation, comprend 10 $ de crédit de calcul pour une instance Micro et fournit des sauvegardes quotidiennes avec sept jours de conservation. La restauration point dans le temps sur sept jours coûte environ 100 $/mois par projet en plus. Elle protège PostgreSQL ; les fichiers Storage et leur configuration exigent une copie/restauration distincte. Sources : [tarifs Supabase](https://supabase.com/pricing), [facturation Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase), [PITR](https://supabase.com/docs/guides/platform/manage-your-usage/point-in-time-recovery), [sauvegarde/restauration CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) et [checklist production](https://supabase.com/docs/guides/deployment/going-into-prod).

### Vercel

Le plan Hobby est réservé à l'usage personnel non commercial. TutelLiv doit donc utiliser Pro dès qu'une préproduction sert le projet commercial ou des pilotes. Pro coûte 20 $/mois, comprend un siège de déploiement et 20 $ de crédit d'usage. Sources : [Vercel Pro](https://vercel.com/docs/plans/pro-plan) et [Vercel Hobby](https://vercel.com/docs/plans/hobby).

### Resend

Free fournit 3 000 e-mails/mois avec une limite de 100/jour. Pro coûte 20 $/mois pour 50 000 e-mails et supprime la limite quotidienne. Le domaine n'étant pas encore choisi, aucun DNS ni envoi réel ne doit être activé. Source : [tarifs Resend](https://resend.com/pricing).

## Recommandation par étape

1. Créer la préproduction Supabase Free uniquement pour migrations, RLS, Storage privé et recettes sans données réelles.
2. Utiliser Vercel Pro pour respecter l'usage commercial ; vérifier d'abord si le compte existant est déjà Pro, car le coût marginal peut alors être nul.
3. Utiliser Resend Free après achat et validation du domaine.
4. Passer Supabase en Pro avant un pilote avec données réelles.
5. Activer PITR pendant l'exercice de restauration, ajouter une sauvegarde versionnée des objets privés, puis mesurer séparément les RPO base et photos. Décider ensuite si le coût de 100 $/mois est nécessaire en permanence. La facturation PITR est horaire ; un essai court peut donc être moins coûteux.

Le choix de niveau et toute dépense restent soumis à validation du propriétaire.
