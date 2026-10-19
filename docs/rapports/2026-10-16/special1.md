# SPECIAL-1 — Qualification des missions spéciales

Date : 16 octobre 2026. Qualification interne sur l'environnement de test autorisé, sans migration ni déploiement.

## Décision de périmètre

Le socle opérationnel est conservé, mais la mission spéciale est explicitement exclue de l'offre pilote. TutelLiv sait centraliser la demande multi-adresses et exécuter la livraison après conversion manuelle. Il ne sait pas produire un devis chiffré versionné ni enregistrer une acceptation du client. Présenter ce flux comme un devis complet serait donc trompeur.

La catégorie reste désactivée par défaut. Les écrans de création, de détail client, de traitement administrateur et de paramètres indiquent son caractère expérimental et le traitement externe du devis. Une demande de devis ne peut plus être passée directement à livré ou en échec : seuls le maintien, la conversion manuelle après accord externe et l'annulation sont proposés et acceptés.

## Recette obtenue

La recette connectée a créé une demande fictive avec trois adresses dans l'ordre, au statut `QUOTE_REQUESTED` et sans livraison. Une seconde entreprise n'a pu ni lire ni convertir cette demande. Le passage direct à `DELIVERED` a été refusé sans mutation.

Après conversion explicite en `PENDING`, une livraison a utilisé la première adresse comme collecte et la dernière comme destination. Le livreur autorisé pour `SPECIAL_MISSION` a été affecté, a confirmé la prise en charge, démarré puis livré avec preuve. Une facture personnalisée de 320 € HT et 384 € TTC a ensuite été créée et rendue visible au client propriétaire seulement. Toutes les entreprises, utilisateurs, commandes, livraisons, factures et tâches fictives ont été supprimés ; le contrôle final compte zéro résidu.

Preuve : `outputs/special1/connected.json`. Durée automatisée : 39,5 s.

La validation globale réussit avec 230/230 tests, types et lint stricts, contrôle de 32 documents, `git diff --check` et build Next.js de 100 pages.

## Limites

L'accord reste une déclaration manuelle de l'administrateur, sans montant de devis, version, date de validité, document ou action du client. La facture finale personnalisée ne remplace pas ces éléments. Le contenu juridique, fiscal et commercial dépend du pays et de BILL-01A. La recette ne valide ni e-mail réel, paiement, téléphone terrain, conformité du document ni usage par une entreprise pilote.
