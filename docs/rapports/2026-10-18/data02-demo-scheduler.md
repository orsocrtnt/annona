# DATA-02 — préparation locale du nettoyage planifié des démos

18 octobre 2026. Cette tranche rend le nettoyage prudent des sessions démo appelable par un futur planificateur. Elle ne crée aucun horaire, ne déploie rien et ne change aucune donnée connectée.

## Résultat

L'outil opérateur et la route de cron utilisent maintenant le même exécuteur de lot. Celui-ci sélectionne au maximum les 100 plus anciennes entreprises démo dont la durée nominale de huit heures est écoulée, puis laisse le service de nettoyage revérifier dans une transaction l'échéance exacte, l'heure de grâce et tous les garde-fous déjà qualifiés.

Une 101e ligne sert uniquement à détecter un reliquat. Le résultat expose des compteurs et codes de refus agrégés, sans identifiant d'entreprise ni donnée personnelle. Un lot avec refus ou reliquat n'est pas présenté comme réussi.

La route `GET /api/cron/demo-cleanup` exige simultanément un `CRON_SECRET` exact et `DEMO_CLEANUP_ENABLED=expired-demo-sessions-v1`. Sans secret, elle répond `401` avant toute lecture ; sans autorisation DATA-02, elle répond `503` avant toute lecture. Un lot entièrement traité répond `200`. Un refus ou reliquat répond `503` et transmet un incident agrégé au reporter opérationnel. Une panne répond `500` avec un texte générique, sans recopier le message interne susceptible de contenir un identifiant.

## Activation volontairement absente

Aucune entrée n'a été ajoutée à `vercel.json` et aucune variable d'environnement n'a été activée. La route ne s'exécute donc pas automatiquement et n'est pas publiée par cette tranche. L'activation future exigera une préproduction isolée, un canal d'alerte réellement branché, l'observation du reliquat et l'autorisation de déploiement.

Le dry-run connecté sur la cible de test autorisée a examiné 51 anciennes entreprises candidates : toutes ont été refusées avec le code agrégé `UNMANAGED_OR_NON_DEMO`, sans mutation et sans identifiant dans la sortie. Aucun reliquat au-delà du lot n'a été trouvé. Ce résultat confirme le comportement prudent et matérialise le chantier de provenance des anciennes démos ; il ne valide ni une cadence hébergée, ni la disponibilité du fournisseur, ni la cible globale de suppression sous 24 heures.

## Fichiers

- `src/domains/data-lifecycle/demo-cleanup-batch.service.ts` : sélection bornée, exécution partagée et résultat agrégé.
- `src/app/api/cron/demo-cleanup/route.ts` : double garde, statuts HTTP et incidents opérationnels.
- `scripts/data02/cleanup-demo.ts` : outil opérateur aligné sur le même lot.
- `tests/demo-cleanup-cron.test.ts` : ordre, limite, activation, retours, alertes et non-divulgation.
- `.env.example` et `docs/operations/data02/DEMO_RETENTION.md` : procédure et état d'activation exacts.

## Validation

- Treize tests DATA-02 ciblés réussis : huit tests de rétention existants et cinq tests du lot/cron.
- Suite complète réussie : 271 tests, vérification TypeScript et lint strict.
- Les tests vérifient que l'autorisation d'application est contrôlée avant toute lecture, que le secret et l'activation protègent la route, que les refus/reliquats déclenchent l'alerte et qu'une panne ne divulgue pas l'identifiant injecté.
- Aucun appel externe ni mutation de base n'est réalisé par ces tests.
- Build de production isolé réussi avec 102 pages, dont la nouvelle route, sans `.env.local` et sans toucher au serveur utilisateur.
- Documentation : 57 fichiers contrôlés, zéro lien/commande/variable manquant ; TODO et ses deux copies identiques.
- Scanner : 862 fichiers, zéro secret détecté. `git diff --check` réussi.

Les preuves de build, documentation, scanner et dry-run sont consignées dans `outputs/data02/demo-scheduler-verification.json`.

## Limites restantes

DATA-02 reste ouverte. La route ne traite volontairement ni les anciennes démos sans échéance fiable, ni les sessions avec comptes ajoutés, objets Storage ou jobs actifs. Le gel des écritures et uploads, le manifeste et la reprise Auth/Storage, les sauvegardes, la restauration d'export, la politique légale définitive et l'activation observée en préproduction restent à réaliser ou valider.
