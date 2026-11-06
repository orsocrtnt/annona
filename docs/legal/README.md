# LEGAL-1 — dossier de revue France

**État à jour : [vérification du 2 novembre 2026](VERIFICATION_2026-11-02.md).** Depuis le 1er novembre 2026, le recours à un juriste n'est plus obligatoire : là où ce dossier dit « juriste » ou « validation professionnelle », lire « vérification documentée, décision du propriétaire », un avis restant possible au besoin.

Version de travail du 18 octobre 2026, destinée au propriétaire. Ce dossier organise les questions et pièces à valider ; il ne contient ni avis juridique, ni contrat prêt à signer, ni attestation de conformité. **LEGAL-1 reste ouverte.** L'identité juridique de l'exploitant et la validation professionnelle manquent.

## Mode de lecture

- **Exigence sourcée** : règle décrite par un texte ou une autorité, dont le champ d'application doit être vérifié pour l'exploitant et chaque pilote.
- **Recommandation** : mesure proposée ou repère de l'autorité, à distinguer d'une obligation légale automatique.
- **Décision produit** : choix du propriétaire, consigné dans les décisions commerciales de l'ancien produit (historique git) ; il ne constitue pas une validation juridique.
- **À qualifier** : fait, rôle ou arbitrage encore inconnu. Ne pas le remplacer par une hypothèse dans un document publié.

Les sources officielles et leurs dates sont regroupées dans [SOURCES.md](SOURCES.md). Les liens techniques du dépôt servent de preuves de fonctionnement, pas de sources de droit.

## Pièces à faire établir ou valider

1. **Identité et mentions de l'éditeur** — propriétaire puis juriste : forme juridique, dénomination, immatriculation, siège, TVA applicable, représentant habilité, contacts et hébergeur. Tout est à renseigner à partir de justificatifs ; aucune identité n'est créée ici.
2. **Contrat SaaS B2B / CGV et bon de souscription** — juriste avec propriétaire : périmètre, exclusions, catalogue versionné, HT/TVA, périodes, dépassements, renouvellement, suspension, sortie, preuve d'acceptation, propriété intellectuelle, responsabilité et assurance. Les exigences de communication/contenu des CGV professionnelles doivent être traitées selon leur contexte, sans recopier un modèle consommateur. [Service Public — CGV](https://entreprendre.service-public.gouv.fr/vosdroits/F33527).
3. **Conditions d'utilisation des trois espaces** — juriste/produit : rôles, habilitations, usages interdits, données introduites, compte partagé, contenu des photos et assistance ; cohérence avec le contrat, sans nouvelles promesses techniques.
4. **Information confidentialité** — juriste/référent données : séparer les traitements propres de Annona et les notices que les entreprises clientes délivrent à leurs salariés, clients et destinataires. Faire préciser finalités, base légale, destinataires, transferts, durées et droits ; prévoir l'information lors d'une collecte indirecte. [CNIL — information et transparence](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence).
5. **Accord de traitement / DPA et annexes** — juriste : instructions, objet, durée, catégories de personnes/données, confidentialité, sécurité, assistance, sous-traitance ultérieure, sort des données et contrôle. Un contrat conforme à l'article 28 est requis lorsque le service agit comme sous-traitant ; le document doit décrire la prestation effective. [CNIL — sous-traitance](https://www.cnil.fr/fr/sous-traitant), [RGPD, art. 28](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra).
6. **Annexe fournisseurs et transferts** — propriétaire/exploitation puis juriste : compléter le [registre préparatoire](SOUS_TRAITANTS.md), recueillir contrats et conditions applicables, valider la chaîne de destinataires et les changements de fournisseur.
7. **Dossier GPS salariés et utilisateurs mobiles** — employeur/client avec juriste et assistance Annona : finalités, proportionnalité, information et éventuelle consultation des représentants, accès, précision, arrêt hors service, conservation, droits et décision AIPD. Voir [les points de revue](POINTS_A_VALIDER.md) ; aucun modèle de consentement général n'est proposé.
8. **Protocole des preuves photo** — client/juriste/produit : consignes de cadrage, informations aux personnes, base légale, accès, minimisation, conservation, contestation et retrait d'une photo inadéquate. Ne pas assimiler contrôle SHA256, signature de lien et valeur probatoire juridique.
9. **Politique de conservation, sortie et suppression** — juriste/client/exploitation : valider le [projet DATA-02](../operations/data02/RETENTION_POLICY_DRAFT.md), les exceptions légales, le gel contentieux, les backups et les preuves de purge. L'export actuel et la purge démo partielle ne remplacent pas cette validation.
10. **Annexe sécurité, incidents et support** — exploitation/juriste : responsabilités, canaux, horaires, délais contractuels éventuels, notification de violation, secours, sauvegardes et restauration. Relier [OPS-03B](../operations/ops03b/README.md), [OPS-03A](../operations/ops03a/README.md) et [SUPPORT-1](../operations/support1/README.md).
11. **Convention de pilote gratuit** — propriétaire/juriste/client : durée de quatre semaines, trois entreprises visées, limites convenues, gratuité expresse, absence d'obligation d'achat, accompagnement, confidentialité, DPA, mesures, sortie et export. Le pilote avec données réelles reste derrière les mêmes portes de sécurité et de protection des données qu'un usage payant.
12. **Accord apporteur / commercial** — juriste avec propriétaire : qualifier les activités réellement confiées, représentation/négociation, statut, attribution, assiette HT encaissée, taux 15/25/35 %, durée envisagée de douze mois, remboursements, justificatifs, fin de relation et commissions. Les taux sont des décisions produit ; la qualification et les droits légaux ne se déduisent pas de l'étiquette du contrat. [Service Public — agent commercial](https://entreprendre.service-public.gouv.fr/vosdroits/F37410).

## Dossier remis au validateur

- [Matrice des rôles et responsabilités](RESPONSABILITES_RGPD.md), par traitement ; toutes les qualifications restent proposées.
- [Analyse d'impact type et décision automatisée du Dispatch intelligent](AIPD_TYPE.md), trame pré-remplie pour les clients (3 novembre 2026).
- [Fournisseurs et destinataires connus](SOUS_TRAITANTS.md), statut d'usage et champs inconnus.
- [Informations manquantes et décisions](POINTS_A_VALIDER.md), incluant facturation électronique 2026/2027.
- [Checklist avant données réelles](CHECKLIST.md), preuves attendues et responsable de validation.
- [Sources officielles](SOURCES.md), consultées le 18 octobre 2026.

Pour chaque pièce, le registre de validation devra conserver : version, rédacteur, validateur professionnel identifié, date, périmètre validé, réserves, décisions du propriétaire et preuve d'acceptation des parties concernées. Ces champs restent **non renseignés** ; aucun accord ni signature n'est présumé.
