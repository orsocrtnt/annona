# Intégration des mails Menthe soignée

Direction approuvée par le propriétaire le 30 octobre après revue des 13 maquettes locales : carte blanche aérée, logo horizontal officiel, boutons encre, badges menthe et accents ambre/rouge selon le statut. Conserver les messages métier, préférences, destinataires, liens Auth et mécanismes de reprise.

1. Étendre les tests du rendu : logo avec texte alternatif, 13 variantes, récapitulatifs basés sur les données présentes, échappement, statut inconnu et liens Auth inchangés.
2. Implémenter la présentation pure commune et les liens utiles depuis les notifications existantes ; aucun changement de transport ni d’activation.
3. Régénérer les trois modèles Supabase et les aperçus des 13 mails. Le dépôt ne configure pas les modèles hébergés : leur installation distante restera à faire après publication autorisée.
4. Exécuter tests ciblés, `npm run check`, vérifier les rendus générés dans Safari et les liens de démonstration. Documenter les limites Gmail/Outlook/réception ; mettre à jour TODO et lancer `npm run todo:progress`.

Exécution séquentielle dans le dossier courant : préserver tous les changements en cours sur les commandes et ne modifier que les fichiers de mail et le suivi. Aucun push de code ni déploiement dans cette demande. Le logo utilise son URL publique fixe sur annona.fr avec `alt="Annona"` ; il reste facultatif à la lecture lorsque les images sont bloquées, sans pixel de suivi.

## Résultat

Intégration locale réalisée. Tests de rendu rouges puis verts ; 63 tests ciblés avant ajout du dernier cas bienvenue ; contrôle complet final `npm run check` : 1 459 tests, types et lint réussis. Logo public HTTP 200. Safari : galerie des 13 rendus, clic vers la relance, rechargement et retour arrière ; contrôle visuel à 390 px pour récupération, livraison et relance. Aucun envoi ni déploiement. Modèles Auth hébergés et réception Gmail/Outlook restent à recetter après publication. La préférence de preuve désactivée interdit toujours le lien de preuve, y compris sous le nouveau rendu.

## Publication demandée le 30 octobre 2026

Le propriétaire autorise le commit et le push de l’ensemble sur `preproduction`. Version finale : bandeau blanc pleine largeur, logo centré, textes de prospection clarifiés et archivés dans `docs/operations/email/prospection/`. Contrôles avant publication : `npm run check` (1 460 tests), `npm run build`, `npm run docs:verify`, `npm run ci:secrets` et `git diff --check` réussis. Les preuves `outputs/` restent locales. L’installation des modèles Auth hébergés et la validation Gmail mobile sombre / Outlook restent séparées.
