# MOB-01C — Point de reprise pour l'agent qui mène la séance iPhone

Rédigé le 28 octobre 2026. La séance est prévue le 29 octobre 2026. À lire en entier avant de répondre au propriétaire.

## Où on en est

- **Séance retenue par le propriétaire :** iPhone seulement, une seule personne, à pied, durée d'environ 1 h 30 à 2 h. Il n'y a pas d'Android : MOB-01C restera ouverte après cette séance.
- **Préparation terminée le 27 octobre :**
  - script [`scripts/mob01c/field-fixture.ts`](../../../scripts/mob01c/field-fixture.ts) ;
  - commandes `npm run mob01c:setup`, `npm run mob01c:watch` et `npm run mob01c:cleanup` ;
  - déroulé en 14 étapes dans [`README.md`](README.md), section « Séance iPhone seul, à pied ».
- **Essai à blanc réussi sur la préproduction**, avec deux adresses publiques de Paris :
  - les 3 livraisons sont localisées ;
  - le livreur et l'administrateur se connectent ;
  - le livreur voit ses 3 missions ;
  - le relevé des positions fonctionne ;
  - le nettoyage ne laisse aucun résidu.

  `npm run check` passe (694/694).
- **État actuel :** aucune donnée `mob01c-` n'existe sur la préproduction et `outputs/mob01c/` est vide. Il faut donc relancer `setup` le jour de la séance.
- **Rien n'est commité.** Le propriétaire veut tout commiter et pousser plus tard, en une seule fois.
  - Ce chantier a modifié ou créé : le script, les trois commandes de `package.json`, `README.md`, ce fichier, et deux passages de `TODO.md` (le point 4 des interventions du propriétaire et l'avancement de MOB-01C).
  - Dans `TODO.md`, il y a aussi une note Stripe : tarification adaptative désactivée en mode test le 27 octobre et vérifiée par l'API.
  - D'autres agents travaillent dans le même dossier (landing, DATA-02). Ne jamais embarquer leurs fichiers.

## Ce que l'agent fait le jour de la séance

1. **Demander deux lieux publics** au propriétaire : un commerce, une place, une mairie. Ils doivent être à 400–800 m l'un de l'autre, sur une boucle d'environ 30 minutes. Ne jamais prendre son domicile.
2. **Créer les données :**

   ```
   MOB01C_ADDRESSES="rue|code postal|ville;rue|code postal|ville" npm run mob01c:setup
   ```

   La sortie doit indiquer `passed: true` et `geocoded: true` pour les 3 livraisons. Si une adresse n'est pas localisée, demander une adresse plus précise, lancer `cleanup`, puis relancer `setup`.
3. **Faire lancer le relevé par le propriétaire** dans un terminal du Mac : `npm run mob01c:watch`. Le Mac doit rester branché et capot ouvert pendant toute la marche.
4. **Rappeler au propriétaire ce qu'il fait de son côté :**
   - se connecter à Vercel dans Safari sur l'iPhone, car la préproduction est protégée par l'authentification de l'équipe ;
   - ouvrir l'adresse indiquée dans `outputs/mob01c/acces.txt`. Ce fichier contient les identifiants : ne jamais les afficher, c'est le propriétaire qui le lit ;
   - suivre les 14 étapes du `README.md` ;
   - faire une capture d'écran à chaque étape.
5. **Après la séance :**
   - le propriétaire arrête le relevé (Ctrl+C) et transmet ses captures ;
   - lire `outputs/mob01c/journal-*-synthese.json`, qui contient les trous de plus de 30 s, et le journal `.jsonl` ;
   - aligner le journal avec les heures des captures ;
   - rédiger `docs/rapports/<date>/mob01c-iphone.md`. Il doit dire clairement ce qui est garanti et ce que iOS suspend (écran verrouillé, arrière-plan, économie d'énergie). Ne trancher entre PWA et application native que si une limite observée empêche de tenir la promesse retenue ;
   - lancer `npm run mob01c:cleanup` et vérifier que le résidu est à zéro ;
   - mettre à jour MOB-01C dans `TODO.md`, la case restant ouverte faute d'Android, puis lancer `npm run todo:progress`.

## Pièges déjà rencontrés

- **Ne pas utiliser la démonstration.** Pour les entreprises de démo, `demo-live-positions.service.ts` invente des positions dès qu'une mission est en cours, ce qui masquerait les trous du verrouillage. L'entreprise de test est donc créée avec `isDemo: false`.
- **La base ne garde qu'une position par livreur** (`DriverLocation`). Sans `mob01c:watch`, aucune mesure des trous n'est possible.
- **Un livreur ne peut pas avoir plus de 3 livraisons en même temps** (`DRIVER_OVER_CAPACITY`). Le script en crée donc 3.
- **La règle des 150 m** (`DRIVER_PROXIMITY_THRESHOLD_METERS`) ne s'applique qu'au moment de livrer ou de déclarer un échec, pour une livraison STANDARD. Hors zone, l'application bloque et affiche la distance, sauf si le livreur confirme quand même.
- **Sous Node 20**, le client Supabase a besoin de `realtime: { transport: ws }`. C'est déjà intégré au script.
- **`setup` refuse de démarrer si un manifeste existe déjà.** Lancer `cleanup` d'abord.
