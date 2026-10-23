# COST-1 — estimation documentaire des coûts et de la marge

**Date des tarifs :** 23 octobre 2026  
**Périmètre :** aucune requête de charge, aucune souscription, aucun paiement, aucune donnée réelle.  
**Statut :** phase documentaire terminée ; validation mesurée encore dépendante de `PERF-02` et des pilotes.

## Conclusion exploitable

Les prix de 79 €, 179 € et 349 € HT peuvent produire une contribution positive lorsque les coûts fixes sont mutualisés. Ils sont fragiles au démarrage et dans la variante haute. Avec les hypothèses centrales et une commission de 35 %, un portefeuille d'une seule entreprise reste négatif pour les trois offres ; à dix entreprises d'une même formule, la contribution estimée devient positive mais reste faible pour Starter (12,6 %) et Pro (5,3 %). Business atteint 19,0 %.

Le risque principal n'est pas le stockage. C'est la combinaison suivante : GPS toutes les quatre secondes, fonction serveur à chaque position, recalcul d'itinéraire toutes les trente secondes, fournisseur cartographique de production et support humain. Le modèle Business « livreurs illimités » rend ce risque non borné tant qu'aucune règle d'usage raisonnable, alerte de consommation ou mesure terrain ne fixe le volume réel.

## État technique observé

| Poste | Comportement actuel | Conséquence économique |
|---|---|---|
| GPS | Publication jusqu'à toutes les 4 s, uniquement service ouvert + mission active | 396 000 / 1 188 000 / 3 960 000 écritures mensuelles par entreprise dans le scénario central |
| Positions | Une ligne courante par livreur, mise à jour en place | Les requêtes et le calcul dominent ; l'historique GPS ne gonfle pas encore le stockage |
| Carte dispatch | Polling toutes les 20 s | Appels Next/Vercel et PostgreSQL supplémentaires |
| Itinéraire chauffeur | Recalcul toutes les 30 s | Jusqu'à 60 appels pour une navigation de 30 min par commande |
| Realtime | Aucun `.channel()`/`postgres_changes` dans l'application | 0 message Realtime budgété aujourd'hui ; ce poste devra être ajouté si l'architecture change |
| Preuves | JPEG/PNG, 5 Mio maximum, lien signé d'une heure | Le taux de photo, leur taille réelle et la conservation déterminent Storage/egress |
| E-mails | File durable et Resend prévus, envoi réel désactivé | Trois e-mails par commande retenus au centre ; à mesurer |
| Cartographie | OSM public + OSRM démo + Géoplateforme par défaut | Coût actuel nul, mais base impropre à une promesse commerciale fiable |

Les tuiles publiques OpenStreetMap sont fournies sans SLA et peuvent être bloquées ; la politique demande aux services commerciaux d'anticiper un retrait d'accès. Le serveur OSRM utilisé est un serveur de démonstration, sans garantie et limité à un usage raisonnable. Le budget central utilise donc les tarifs publics Geoapify comme **repère remplaçable**, sans choisir ni configurer ce fournisseur.

## Hypothèses centrales par entreprise

| Offre | Commandes | GPS/mois | Appels serveur estimés | E-mails | Preuves conservées à régime 12 mois | Crédits carto/jour |
|---|---:|---:|---:|---:|---:|---:|
| Starter | 1 000 | 396 000 | 423 920 | 3 000 | 8,2 Gio | 3 636 |
| Pro | 3 000 | 1 188 000 | 1 255 920 | 9 000 | 24,6 Gio | 10 409 |
| Business | 6 000 | 3 960 000 | 4 095 840 | 18 000 | 49,2 Gio | 20 818 |

Les preuves supposent 70 % de livraisons avec une photo moyenne de 1 Mio. La variante basse retient 50 % à 0,5 Mio ; la variante haute 100 % à 3 Mio. La taille maximale autorisée de 5 Mio n'est pas utilisée comme moyenne.

## Résultat central avec commission maximale de 35 %

Les montants ci-dessous sont la contribution mensuelle du portefeuille après hébergement, cartographie, e-mails, paiement, support estimé et commission. Ils ne sont ni une marge brute comptable ni un résultat net : salaires de développement, juridique, comptabilité, assurance, impôts, acquisition et incidents en sont exclus.

| Entreprises d'une même offre | Starter | Pro | Business |
|---:|---:|---:|---:|
| 1 | -89,64 € (-113,5 %) | -91,84 € (-51,3 %) | -15,08 € (-4,3 %) |
| 10 | 99,62 € (12,6 %) | 94,44 € (5,3 %) | 664,17 € (19,0 %) |
| 50 | 912,78 € (23,1 %) | 2 619,70 € (29,3 %) | 5 638,55 € (32,3 %) |
| 100 | 2 140,43 € (27,1 %) | 6 091,47 € (34,0 %) | 12 126,47 € (34,7 %) |

À partir de 50 ou 100 entreprises, le montant cartographique est un plancher de 860 €/mois : les lignes concernées demandent un devis et peuvent donc surestimer la marge.

## Effet des commissions à dix entreprises

| Offre | 15 % | 25 % | 35 % |
|---|---:|---:|---:|
| Starter | 257,62 € (32,6 %) | 178,62 € (22,6 %) | 99,62 € (12,6 %) |
| Pro | 452,44 € (25,3 %) | 273,44 € (15,3 %) | 94,44 € (5,3 %) |
| Business | 1 362,17 € (39,0 %) | 1 013,17 € (29,0 %) | 664,17 € (19,0 %) |

La commission est appliquée pendant douze mois aux revenus HT initiaux éligibles encaissés, conformément à la règle actuelle. Les achats ultérieurs ne sont pas ajoutés à sa base dans ce modèle.

## Sensibilité avec commission de 35 %

| Portefeuille | Bas | Central | Haut |
|---|---:|---:|---:|
| 10 Starter | 244,62 € | 99,62 € | -187,89 € |
| 10 Pro | 713,55 € | 94,44 € | -328,56 € |
| 10 Business | 1 440,20 € | 664,17 € | -458,39 € |
| 100 Starter | 3 349,41 € | 2 140,43 € | 219,31 €* |
| 100 Pro | 8 134,18 € | 6 091,47 € | 1 821,01 €* |
| 100 Business | 16 452,51 € | 12 126,47 € | 3 160,40 €* |

`*` Le fournisseur cartographique est seulement chiffré à son plancher « Custom » ; la contribution haute réelle peut être inférieure.

## Coût marginal central à grande échelle

À 100 entreprises, le coût mensuel supplémentaire estimé d'une entreprise, avant commission, est de 20,88 € pour Starter, 45,94 € pour Pro et 95,09 € pour Business. Avec la commission maximale de 35 %, le coût marginal total devient environ 48,53 €, 108,59 € et 217,24 € ; la contribution marginale correspondante est environ 30,47 €, 70,41 € et 131,76 €.

Ces montants varient brutalement lors d'un changement de palier fournisseur. Ils ne doivent pas être extrapolés hors des volumes du CSV.

## Frais de paiement

Le scénario utilise une carte standard EEE à 1,5 % + 0,25 € et Stripe Billing à l'usage à 0,7 % du volume. Par paiement mensuel, cela représente environ 1,99 € pour Starter, 4,19 € pour Pro et 7,93 € pour Business. Le prélèvement SEPA peut réduire le coût du moyen de paiement, mais sa pertinence et les frais Billing doivent être validés dans `SAAS-01B` ; aucun compte Stripe réel n'est utilisé ici.

## Paliers et décisions

1. **Avant vente :** Vercel Pro (20 $/mois avec 20 $ de crédit d'usage) et Supabase Pro (25 $/mois, premier Micro couvert par les crédits) doivent être budgétés. Les offres gratuites servent encore à la préproduction, pas au calcul d'une exploitation commerciale fiable.
2. **Cartographie :** remplacer les services publics/démo par un fournisseur autorisant explicitement la production. Le recalcul toutes les 30 s doit être mesuré puis réduit ou mis en cache ; passer de 60 à 3 calculs par commande transforme fortement la marge.
3. **Business illimité :** un livreur actif 8 h/jour produit environ 158 400 écritures GPS/mois. Le mot « illimité » ne doit pas signifier une capacité technique sans borne. Ajouter surveillance, alerte et règle commerciale d'usage raisonnable ou offre sur devis au-delà d'un seuil, après arbitrage propriétaire.
4. **E-mails :** Resend Free est limité à 100 e-mails/jour ; Starter central atteint déjà 3 000/mois et peut dépasser cette limite quotidienne. Le budget retient donc au minimum Pro à 20 $/mois et 0,90 $/1 000 au-delà de 50 000.
5. **Support :** à 30 €/h chargé, le support pèse 15/30/60 € par entreprise et par mois dans le scénario central. C'est l'hypothèse non technique la plus sensible ; les pilotes doivent mesurer le temps réel.
6. **Capacité :** les paliers Supabase sont des réserves budgétaires guidées par le nombre d'écritures, pas une preuve que Micro/Small/Medium tiendra la charge. Seul `PERF-02` peut les remplacer.

## Sources officielles datées

- [Supabase Pricing](https://supabase.com/pricing) : Free 500 Mio DB/1 Gio Storage/5 Gio egress, Pro à partir de 25 $, Micro à 10 $ couvert par les crédits, 8 Gio DB, 100 Gio Storage, 250 Gio egress, Realtime 5 M messages puis 2,50 $/M.
- [Vercel Pricing](https://vercel.com/pricing) et [Fluid Compute](https://vercel.com/docs/functions/usage-and-pricing) : Pro 20 $, crédit 20 $, invocation 0,60 $/M, CPU et mémoire région Paris.
- [Resend Pricing](https://resend.com/pricing) : Free 3 000/mois et 100/jour ; Pro 20 $ pour 50 000 puis 0,90 $/1 000.
- [Stripe France](https://stripe.com/fr/pricing) : carte standard EEE 1,5 % + 0,25 €, Billing à l'usage 0,7 % du volume.
- [OpenStreetMap Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) : service best effort, sans SLA, retrait possible, avertissement spécifique aux usages commerciaux.
- [OSRM Demo Server](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server) : serveur de démonstration sans garantie, usage raisonnable et plafond indicatif d'une requête/seconde.
- [Geoapify Pricing](https://www.geoapify.com/pricing/) et [Pricing Details](https://www.geoapify.com/pricing-details/) : référence de budget cartographique, 3 000 crédits/jour gratuits, paliers 59/109/179/299/609 $, Custom à partir de 860 $, environ 50 tuiles par session.

## Preuves reproductibles

- calcul : `scripts/cost1/model.mjs` ;
- commande : `npm run cost1:model` ;
- hypothèses et 36 scénarios : `outputs/cost1/model.json` ;
- export prévisionnel : `outputs/cost1/scenarios.csv` ;
- méthode : `docs/operations/cost1/README.md`.

La phase documentaire est close. La case COST-1 globale reste ouverte jusqu'à `PERF-02`, car ses critères exigent de remplacer les hypothèses de charge, de support et de fournisseur par des mesures représentatives.

