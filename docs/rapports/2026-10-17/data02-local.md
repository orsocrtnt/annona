# DATA-02 — socle local d'export et de suppression

Date : 17 octobre 2026.

## Résultat

Un export JSON d'entreprise versionné couvre le graphe de données actuellement présent dans TutelLiv. Il est construit dans une lecture cohérente et liste séparément les preuves privées à copier depuis Storage. Les identifiants Auth, clés d'idempotence, empreintes de requête et détails internes des jobs en sont exclus.

La recette connectée a créé deux entreprises temporaires. L'export de A contient 3 utilisateurs, 1 adresse, 1 notification, 1 récurrence, 1 commande et son article, 1 livraison et son événement, 1 message et 1 marqueur de lecture, 1 facture, 1 ticket et son message, 1 job et 1 référence de preuve. Aucune donnée ou référence de B n'est présente.

La suppression ciblée de A est protégée par le slug aléatoire de la fixture. Tous ses compteurs retombent à zéro et l'empreinte des compteurs de B reste identique. Le nettoyage final laisse zéro entreprise DATA-02.

## Limites

Le test utilise une référence fictive de preuve et ne supprime aucun objet Storage, compte Supabase Auth ou sauvegarde. Le service d'export n'a ni route publique ni lien de téchargement. Les durées de conservation et l'ordre de clôture d'un compte restent à décider avec LEGAL-1. DATA-02 reste donc ouverte.

Procédure : `docs/operations/data02/README.md`. Preuve : `outputs/data02/connected.json`.
