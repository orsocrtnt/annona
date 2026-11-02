# Porte juridique avant données réelles

Cette checklist ne remplace pas les portes techniques de `TODO.md`. Une ligne est considérée satisfaite uniquement avec une preuve datée et un responsable identifié. Depuis le 1er novembre 2026, la mention « juriste » ou « validateur juridique » se lit « vérification documentée et décision du propriétaire » ; état au 2 novembre : [vérification](VERIFICATION_2026-11-02.md).

## Entité et contrats

- identité officielle de l'éditeur vérifiée sur justificatifs ;
- contrat SaaS B2B/CGV et bon de souscription validés par le juriste ;
- conditions d'utilisation cohérentes avec les trois rôles ;
- convention pilote gratuite validée avant le premier pilote ;
- contrat commercial adapté à chaque apporteur ou agent, avec commissions validées ;
- documents datés, versionnés et acceptés par une personne habilitée.

## Protection des données

- qualification responsable/sous-traitant confirmée par traitement ;
- DPA article 28 et instructions documentées validés ;
- notices entreprise, utilisateurs, livreurs et contacts indirects préparées ;
- registre des traitements propres et registre sous-traitant préparés ;
- bases légales, destinataires, droits et canaux de demande documentés ;
- nécessité d'un DPO et d'une AIPD analysée ; AIPD terminée avant traitement si requise ;
- obligations d'information/consultation des représentants du personnel attribuées au client employeur ;
- politique GPS et photos validée, avec arrêt hors service et accès minimal.

## Fournisseurs

- fiches Supabase, Vercel, Resend et cartographie complétées à partir des contrats réels ;
- DPA, régions, sauvegardes, transferts, sous-traitants ultérieurs et suppressions vérifiés ;
- préproduction isolée qualifiée avant toute donnée réelle ;
- fournisseur public de démonstration remplacé ou explicitement autorisé pour l'usage prévu ;
- procédure d'ajout/remplacement d'un fournisseur et d'information des clients établie.

## Sécurité, conservation et sortie

- RLS, Auth, Storage privé et isolation A/B rejoués sur préproduction ;
- invitations réelles et récupération testées avec domaine validé ;
- conservation validée par catégorie, sans durée globale arbitraire ;
- export entreprise, remise chiffrée et contrôle d'identité testés ;
- suppression vérifiable base/Auth/Storage testée uniquement sur fixtures ;
- sauvegarde et restauration base + objets + configuration exercées et chronométrées ;
- procédure après restauration rejoue les purges arrivées à échéance ;
- incident simulé, alerte reçue et registre/notification prêts.

## Décision d'ouverture

Avant le premier pilote réel, le propriétaire, le responsable technique et le validateur juridique consignent ensemble : périmètre autorisé, exclusions, fournisseurs, version documentaire, risques résiduels, responsable d'incident et date de prochaine revue.

Le passage de cette checklist n'autorise pas automatiquement un déploiement, une dépense, une prospection ou un traitement destructif. Ces actions suivent leurs autorisations propres.
