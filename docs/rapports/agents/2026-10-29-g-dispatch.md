# Lot G — DISPATCH-4 tranche 1 (suggestions, temps de trajet, mode) — 29 octobre 2026

Branche `agent/g-dispatch` (depuis `preproduction` c917cf8). Rapport en cours.

## Feuille de route (critères « Terminé quand »)

- [ ] 3 meilleurs livreurs par commande, score explicable (une phrase), poids documentés
- [ ] Temps de trajet OSRM `table` + cache borné + repli vol d'oiseau avec raison affichée ; contrat OSRM vérifié
- [ ] Affectation en un clic depuis la suggestion ; choix manuel forcé conservé
- [ ] Transaction courte, aucun appel réseau dedans ; double clic et concurrence sans double affectation (PostgreSQL réel)
- [ ] Mode Suggestion / Automatique dans les réglages existants, sans migration ; derrière l'option « Dispatch automatique »
- [ ] Dimensionnement : présélection vol d'oiseau puis un appel `table` groupé ; complexité pour 200 livreurs
- [ ] Aucune coordonnée exposée au client ; dispatcher/admin seulement ; isolation entre entreprises
- [ ] Pré-vol adverse, `npm run check` vert, `git diff --check` propre
