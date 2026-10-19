# DATA-02 — export de sortie et suppression contrôlée

Date de référence : 18 octobre 2026.

## Export d'entreprise

`exportCompanyData(companyId)` produit un document JSON versionné `tutelliv-company-export` v1 dans une transaction en lecture répétable. Il conserve les identifiants relationnels utiles à une reprise et inclut :

- entreprise et configuration ;
- utilisateurs, rôles fonctionnels, adresses et dernière position chauffeur ;
- notifications ;
- commandes récurrentes ;
- commandes, articles, collectes, livraisons et chronologie ;
- conversations et marqueurs de lecture ;
- factures ;
- tickets et messages de support ;
- manifeste des tâches opérationnelles sans leur charge ni leur erreur interne ;
- manifeste des preuves de livraison ; leurs binaires peuvent désormais être copiés dans l’archive privée décrite ci-dessous.

L'export exclut les identifiants Supabase Auth, clés d'idempotence, empreintes de requête, charges de jobs et erreurs internes. Il n'est pas encore exposé par une route ou une interface : le canal de remise, le chiffrement, l'expiration du lien et l'identité autorisée doivent être arrêtés avant cela.

## Archive locale privée avec preuves

`exportCompanyArchive(companyId, privateParent)` est un outil serveur d’opérateur, sans endpoint ni interface de remise. Il produit un dossier d’archive, sans compression ni nouvelle dépendance :

- `company.json` : export relationnel v1 ; les commandes incluent leur `companyId` ;
- `proofs/000001.png`, etc. : octets originaux, téléchargés successivement par accès authentifié au bucket privé ;
- `manifest.json` : état complet, compteurs, tailles, SHA256 du JSON et de chaque preuve, association entre nom local et `deliveryId`.

L’empreinte SHA256 du manifeste est retournée séparément avec le chemin local. Conserver cette empreinte dans le registre d’exploitation privé, séparément du dossier, pour contrôler ensuite aussi le manifeste. Aucun secret, lien signé ni URL de téléchargement n’est ajouté à l’archive ; le JSON contient les chemins d’objets déjà présents dans l’export et des données personnelles, donc doit rester privé.

Avant toute lecture Storage, le service valide l’entreprise, l’entreprise de chaque commande, le lien de chaque livraison à cette commande et à l’entreprise, l’unicité des identifiants et la correspondance exacte entre preuves et manifeste. Le chemin doit respecter le format POD de cette livraison et entreprise. Une incohérence quelconque fait échouer l’archive entière. Le bucket doit être privé ; aucun bucket n’est créé par l’export.

Le répertoire parent doit déjà exister, appartenir à l’utilisateur courant et n’accorder aucun droit au groupe ou aux autres. Choisir un dossier hors dépôt et hors répertoire servi par le Web. Les dossiers créés ont le mode `0700`, les fichiers `0600`. L’outil ne fournit pas de chiffrement au repos : les permissions locales ne remplacent pas un stockage chiffré ni le futur canal sécurisé de remise.

Exécution opérateur, uniquement pour une entreprise autorisée, depuis la racine du projet :

```sh
npx dotenv -e .env.local -- tsx scripts/data02/export-archive.ts <companyId> /chemin/absolu/prive
```

Ne pas exécuter cette commande générique dans une recette automatique sur des entreprises préexistantes. La recette dédiée ci-dessous construit ses propres fixtures.

Vérification hors ligne, sans variables d’environnement, base ni Storage :

```sh
node scripts/data02/verify-archive.mjs /chemin/prive/company-archive-UUID <manifestSha256>
```

Le vérificateur exige le SHA256 conservé séparément, contrôle tailles et empreintes, refuse les liens symboliques et fichiers supplémentaires et termine en erreur si l’archive est modifiée ou incomplète. Cette vérification prouve l’intégrité de la copie par rapport au manifeste, pas l’authenticité métier de la photo source ni une restauration de base.

### Limites techniques et échecs

- 1 000 preuves au maximum ; 5 Mio par preuve et 256 Mio de preuves au total.
- Téléchargements séquentiels en flux, sans accumulation de photos en mémoire ; annulation au dépassement de taille, à la première erreur ou après 30 secondes par objet (réponse et corps compris). Les plafonds peuvent seulement être abaissés via les options internes.
- JSON limité à 10 Mio sérialisés. Cette limite est contrôlée **après** lecture du graphe relationnel et sérialisation en mémoire : ce service ne constitue pas un export relationnel en flux ni une qualification de gros volumes ou d’exports simultanés.
- Tailles déclarées contrôlées avant la copie, tailles réelles contrôlées à chaque bloc, fichiers relus pour comparer leur SHA256 au flux téléchargé. Objet absent, refus fournisseur, corps vide, tronqué ou interrompu : aucun succès partiel. Storage peut signaler un objet absent par une erreur HTTP générique ; elle reste bloquante.
- Le travail s’effectue dans `.partial-*`, puis le dossier est renommé seulement lorsque tous les fichiers et le manifeste sont écrits. Les erreurs traitées nettoient le dossier temporaire exact et préservent les archives précédentes. Une interruption brutale du processus peut laisser un `.partial-*` privé : il ne constitue jamais une archive complète et doit être examiné/nettoyé explicitement par l’opérateur.
- Le snapshot PostgreSQL est cohérent en lecture répétable, mais aucun snapshot distribué PostgreSQL/Storage n’est garanti. Une photo supprimée après la lecture fait échouer la copie ; une modification en place avant la copie n’est pas détectable sans empreinte source historique. Aucun nouveau mécanisme de conservation n’est introduit.

## Recette connectée et suppression limitée aux fixtures

`npm run test:data02` crée deux entreprises fictives identifiées par slugs aléatoires propres à l’exécution, plus une vraie photo privée par entreprise. Il exporte A, vérifie les octets et les SHA256 ainsi que l’absence des données de B et des identifiants techniques exclus. Il simule sur la seule livraison A une référence absente puis une référence vers la photo B : les deux exports échouent sans publier de dossier partiel. Les compteurs B et ses octets de preuve restent inchangés.

Le script supprime la seule fixture A avec contrôle de son identifiant et de son slug exact ; tous ses compteurs doivent tomber à zéro et ceux de B rester identiques. Le bloc final supprime exclusivement les chemins Storage enregistrés au moment de leur upload, contrôle les dossiers de ces deux entreprises, puis nettoie les entreprises de cette exécution et l’archive temporaire locale. Zéro fixture restante est exigé. La preuve publique de recette conserve seulement compteurs, empreinte et résultats, sans données personnelles, identifiants d’entreprise ou chemins Storage.

Cette recette ne lit pas le contenu des anciennes entreprises. Elle lit les rôles structurels nécessaires à la création des fixtures. Aucun compte Supabase Auth n’est créé et aucune commande générique de suppression d’entreprise n’est fournie. Une clôture réelle devra figer l’accès, produire et remettre l’export, appliquer les durées de conservation, puis coordonner base, Auth, bucket et sauvegardes.

## Décisions et validations restantes

- pays et obligations applicables ;
- durées par catégorie : compte, commandes, factures, GPS, photos, support, journaux et sauvegardes ;
- distinction entre résiliation, suspension, anonymisation et suppression ;
- suppression ou anonymisation réelle dans Supabase Auth et Storage selon la politique validée (seule la suppression des objets de fixtures est testée) ;
- propagation vers les sauvegardes selon leur rétention ;
- test de restauration de l'export vers une cible isolée ;
- traitement complet et planifié des sessions de démonstration expirées (première tranche sans assets décrite ci-dessous).

Ces points dépendent de LEGAL-1 et des accès ENV-1/OPS-03A. Aucune durée de données réelles n'est activée dans le code en attendant. La durée de huit heures déjà utilisée pour les démos est désormais explicite pour les nouvelles sessions.

## Sessions démo expirées : première tranche

L'outil opérateur `npm run data02:demo-cleanup` fonctionne en dry-run. L'application exige deux opt-ins et ne touche que les nouvelles sessions ayant une échéance explicite, un roster synthétique exact, aucun fichier externe ni lien interentreprises, après une heure de grâce. Les anciennes sessions, les photos/objets Storage, les comptes Auth et jobs en cours sont refusés sans mutation. Un ancien cookie ne peut plus rouvrir une session dépourvue d'échéance ; la prochaine connexion crée une session propre.

`npm run data02:demo-legacy-inventory -- --deep` qualifie les anciennes candidates en lecture seule et produit uniquement des agrégats. Au 18 octobre, les 51 candidates ont le marqueur et le roster synthétique attendus, mais aucune échéance persistée. Les contrôles DB, Storage et références interentreprises sont tous propres. Elles restent néanmoins inaccessibles et conservées : leur échéance ne sera pas inventée après coup et aucune suppression n'est autorisée implicitement. Aucune planification ni suppression de données réelles n'est activée. Procédure, garanties et limites : `docs/operations/data02/DEMO_RETENTION.md` ; preuves `outputs/data02/demo-retention-connected.json` et `outputs/data02/demo-legacy-inventory.json`.

Preuve nettoyée : `outputs/data02/connected.json`.

Validation locale : huit tests dédiés dans `tests/company-archive.test.ts`, intégrés à `npm run check`. Rapport : `docs/rapports/2026-10-18/data02-proof-archive.md`. Le jalon DATA-02 reste ouvert.
