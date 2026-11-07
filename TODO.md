# TODO Annona — application de commande et livraison B2B (boulangerie)


<!-- TODO_PROGRESS_START -->
## Progression globale

**9 tâches terminées sur 13 — 69 %**

`██████████████░░░░░░` · 4 tâches restantes

**À faire par Claude**

- MOBILE-1 — Applications iOS et Android (Capacitor)
- RECETTE-V1 — Recette des dix critères (en dernier)

**À faire par toi**

- ACCES-1 — Accès et réponses du propriétaire (réponses du cahier des charges, mentions légales, clé Resend)
- NOTIF-1 — Notifications (clé Resend dans `.env.local` (ACCES-1) ; ensuite Claude fait l'envoi réel)

_Chaque tâche est classée selon qui doit agir ensuite. Cette jauge compte les tâches closes, sans pondération de leur taille. Recalcul et synchronisation des copies : `npm run todo:progress`, automatiquement avant `npm run docs:verify`._
<!-- TODO_PROGRESS_END -->

## Ce qu'il reste vraiment à faire (vue simple, à jour au 6 novembre 2026)

_Lire ce bloc en premier. Tout le reste du fichier est le détail. Un agent le met à jour à chaque fin de tâche (simples tirets ici : seules les cases des tâches comptent dans la jauge)._

**1. Toi**
- Répondre aux questions ouvertes du cahier des charges quand tu les as (ACCES-1) : créneaux du premier client, délai du rappel avant 17h, volumes à deux ans, service de cartographie.
- Fournir les mentions légales des factures (SIREN, TVA, forme juridique et capital, RCS, pénalités, escompte) et une clé Resend pour les vrais envois (ACCES-1).

**2. Claude (en autonomie, dans l'ordre)**
- Faits les 6 et 7 novembre : NET-1 (ancien produit retiré), SCHEMA-1 (nouveau modèle, base de démo), CAT-1 (catalogue et prix), CMD-1 (commande du client, recopie chronométrée à 33 s), LOCK-1 (verrouillage à 17h, récurrentes, tournées brouillon, corrections tracées), BOU-1 (espace boulanger), TOUR-1 (tournées, application livreur, hors réseau) FACT-1 (factures par période, PDF, règlements) et ADM-1 (clients, comptes, paramètres, super-admin, isolation). NOTIF-1 codée, attend la clé Resend pour un envoi réel. En cours : MOBILE-1, puis RECETTE-V1.

**3. Attente extérieure**
- Comptes Apple Developer et Google Play pour publier les applications (MOBILE-1, plus tard).

## Cadre

- Référence : `docs/cahier-des-charges/Cahier des charges - version developpeur.pdf` (identifiants CLI, BOU, LIV, ADM, PLA, NOT, RG, ENF, à citer dans le code et les tests) et `docs/cahier-des-charges/TRI-BASE.md` (ce qu'on garde, supprime, modifie et crée).
- Décisions du 6 novembre 2026 : nom **Annona** ; applications mobiles par **Capacitor** ; tickets de support gardés pour les réclamations ; nouveau schéma Prisma propre avec une seule migration initiale ; nouvelle base.
- Branche de travail : `base`. Un commit par lot, **aucun push** sans demande : `preproduction` et annona.fr portent encore l'ancien produit.
- Base de développement : projet Supabase `annona-dev` (`fqzlfszgyeyfeshllqtj`, Paris, créé le 6 novembre 2026). L'ancienne base `tutelliv-dev` a été mise en pause pour libérer la place gratuite (réactivable depuis le tableau Supabase) ; `tutelliv-preproduction` (annona.fr) n'est pas touchée.
- L'ancienne TODO (106 tâches closes, produit coursier) reste dans l'historique git : `git show 0475b8d:TODO.md`.

## Tâches ouvertes

_Tâches closes et journal : `docs/TODO-ARCHIVE.md`._

- [ ] **ACCES-1 — Accès et réponses du propriétaire.**

  **Qui : Toi — réponses du cahier des charges, mentions légales, clé Resend.**

  - `.env.local` : fait le 6 novembre 2026 (mot de passe de la base remis à zéro et clé `service_role` collés par le propriétaire avec `remplir-env.sh`, sans passer par l'agent). Vérifié par Claude : client Prisma par le pooler `aws-1-eu-west-3` port 6543 → `select` réussi ; connexion directe (`prisma db execute`) réussie ; API d'administration Supabase avec la clé `service_role` → 200.
  - Questions ouvertes du cahier des charges (section 9) : liste des créneaux du premier client ; délai du rappel avant 17h ; volumes à deux ans ; service de cartographie (les services gratuits OSRM et IGN suffisent pour les essais, pas pour 200 arrêts par jour). En attendant, valeurs par défaut réglables : créneaux 5h-6h, 6h-7h, 7h-8h ; rappel à 15h.

  - Mentions légales des factures (FACT-1), à saisir dans les paramètres de l'entreprise ou à me donner : SIREN, n° de TVA intracommunautaire, forme juridique et capital, immatriculation RCS, taux des pénalités de retard, conditions d'escompte. Sans elles, le PDF ne les porte pas et le Factur-X est refusé.
  - Clé Resend (`RESEND_API_KEY`) pour les vrais envois d'e-mails (factures, notifications) : à coller dans `.env.local` comme les autres valeurs.

  Terminé quand : les quatre réponses, les mentions légales et la clé Resend sont fournies (`.env.local` de base déjà fait).

- [ ] **NOTIF-1 — Notifications.**

  **Qui : Toi — clé Resend dans `.env.local` (ACCES-1) ; ensuite Claude fait l'envoi réel.**

  **Modèle conseillé : Claude Opus · effort moyen.**

  NOT-01 (rappel avant l'heure limite sans commande pour le lendemain, délai paramétrable), NOT-02 (confirmation à chaque commande validée ou modifiée), NOT-03 (« livreur en approche » quand l'arrêt précédent est livré).

  Terminé quand : tests des déclencheurs ; un envoi réel reçu sur une adresse de test.

  7 novembre 2026, code fait (commit `228a85a`, sans push, sans migration). NOT-01 : route `/api/cron/order-reminders` appelée par `cron-lock-orders.yml` toutes les 10 min ; client actif sans commande ni récurrente active ce jour-là, `reminderLeadMinutes` avant l'heure limite, une seule fois par compte, client et date, jamais après l'heure limite ; commande annulée ou brouillon = pas de commande ; délai 0 = rappel désactivé ; le client peut le couper (Paramètres › Alertes). NOT-02 : après chaque commande validée, modifiée ou annulée par le client et après correction admin ; au plus une confirmation toutes les 5 min par commande (la première tout de suite, les suivantes regroupées, état final relu à l'envoi). NOT-03 : au démarrage de la tournée le premier arrêt est prévenu, puis après « Livré » ou un problème le premier arrêt restant ; une seule fois par arrêt, rejeu hors ligne compris. Canaux : cloche du portail et e-mail par la file ; sans clé Resend, tâche e-mail close « ignorée » (`SKIPPED:EMAIL_DISABLED`) ; `registerNotificationChannel` prêt pour les notifications natives (MOBILE-1).
  Vérifications : 12 tests (dont changements d'heure du 25 octobre et du 29 mars, rejeu sans doublon, isolation) ; Playwright `tests/e2e/notif1-recette.spec.ts` cliqué 3/3 (confirmation dans la cloche, rappel par la route cron avec `?now=`, « livreur en approche » après un « Livré ») ; captures `outputs/recette-notif1-adm1/` ; `npm run check` 717/717 puis 731/731 ; `npm run build` vert.
  Reste : envoi réel reçu sur une adresse de test (critère de la tâche) ; confirmation différée et tâches en échec envoyées seulement au passage de `/api/cron/operations` (toutes les 5 min).

- [ ] **MOBILE-1 — Applications iOS et Android (Capacitor).**

  **Qui : Claude.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  ENF-01 : emballer les espaces commerçant et livreur avec Capacitor ; notifications natives ; ouverture de Plans et Waze. Publication : comptes Apple Developer et Google Play à ouvrir par le propriétaire.

  Terminé quand : les deux applications s'installent sur un vrai téléphone et passent les critères 1, 7 et 8.

- [ ] **RECETTE-V1 — Recette des dix critères.**

  **Qui : Claude — en dernier.**

  **Modèle conseillé : Claude Opus · effort élevé.**

  Rejouer les dix critères de la section 10 du cahier des charges sur `annona-dev`, dans le navigateur, avec un rapport et des captures.

  Terminé quand : les dix critères passent et le rapport est dans `docs/rapports/`.
