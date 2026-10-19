# V1-MESURE — Baseline interne du parcours principal

## Résultat

Un protocole reproductible mesure désormais cinq scénarios standard identiques sur une entreprise fictive isolée. Chaque scénario crée une commande et sa livraison, l’affecte manuellement, enregistre une question client et une réponse dispatch, relit le fil, puis lit le même statut et la même position fictive fraîche côté client et administration.

Environnement : Mac Apple M1, 8 Go, Node 22.18.0, services TutelLiv exécutés localement et PostgreSQL Supabase distant de test, connexion courante non bridée, aucun téléphone physique. Le harnais automatise les actions ; il ne mesure donc pas l’autonomie d’un utilisateur novice.

## Valeurs internes

Médianes sur cinq répétitions, avec minimum–maximum :

- création commande + livraison : **3 775,4 ms** (3 742,2–4 920,3) ;
- affectation manuelle : **3 039 ms** (2 997,4–3 186,2) ;
- question client : **2 105,3 ms** (2 054,5–2 131,9) ;
- réponse dispatch : **2 108,3 ms** (2 101,1–2 161,8) ;
- relecture du fil : **1 260,3 ms** (1 220,9–1 328,9) ;
- lecture statut/position client : **644,2 ms** (634,5–679,4) ;
- lecture statut/position administration : **629,3 ms** (616,2–659,7).

Les cinq lectures ont rendu une position `FRESH` et quatre entrées de chronologie. Le scénario de coordination comporte deux actions d’écriture et une relecture par dossier.

La mesure UI PERF-01 du 15 octobre reste complémentaire : sur le build production local, ouverture directe de la carte dispatch à 2,12 s et de la carte client à 3,12 s ; retours internes chauds respectifs autour de 74–81 ms et 75–86 ms. Ces chiffres utilisent un navigateur Chromium desktop 1440 × 1000 et un protocole différent ; ils ne sont pas mélangés avec les médianes de services ci-dessus.

## Intégrité et limites

Avant et après : 5 entreprises, 30 utilisateurs, 32 commandes, 32 livraisons et 1 message. Résidu de la fixture : zéro entreprise, utilisateur, commande, livraison, message ou tâche. Aucune migration, seed, remise à zéro, donnée préexistante ou déploiement.

Ces latences sont une baseline technique interne, pas un temps humain complet ni un gain par rapport au traitement par e-mail. Le protocole humain à chronométrer avant pilote est défini dans `docs/operations/v1-mesure/README.md`; les essais iPhone/Android restent dans MOB-01C et V1-GO.

Preuve brute sans secret : `outputs/v1-mesure/internal-baseline.json`.
