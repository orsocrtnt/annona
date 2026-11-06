# Tri de la base existante → application de commande et livraison B2B (boulangerie)

6 novembre 2026. Référence : `Cahier des charges - version developpeur.pdf` (identifiants CLI, BOU, LIV, ADM, PLA, NOT, RG, ENF).

## Verdict

La base existante fournit déjà le socle technique : multi-entreprise, comptes et rôles, application livreur hors réseau, calcul de tournées, créneaux, heure de Paris, factures et Factur-X, envois d'e-mails et de notifications push.

Le cœur métier du nouveau projet est absent et doit être construit : catalogue de produits, prix par commerçant, verrouillage à 17h, total à produire, espace boulanger et facturation par période sur les quantités livrées.

La base existante a été conçue pour des coursiers : une commande y est un enlèvement suivi d'une livraison. Ici, une commande est un panier de produits livré depuis le laboratoire. **Le modèle de données change en profondeur.** Il n'y a aucune donnée réelle à reprendre, donc je recommande de repartir d'un schéma Prisma propre, avec une nouvelle base, plutôt que d'enchaîner des migrations.

---

## 1. Ce qu'on garde

| Élément existant | Où | Sert à |
|---|---|---|
| Next.js 15, TypeScript strict, Tailwind, Radix/shadcn, TanStack Query | tout le projet | socle |
| Isolation par `companyId`, contrôles côté serveur | `src/lib/permissions`, `src/domains/*` | PLA-01, critère de recette 10 |
| Connexion Supabase, mot de passe oublié, réinitialisation | `src/app/(auth)`, `src/domains/auth` | CLI-01 |
| Entreprise : nom, logo, `settings` en JSON | `Company` | PLA-03, PLA-04 |
| Écrans super-admin des entreprises | `/companies`, `/companies/[id]` | PLA-02 |
| Créneaux de livraison (mode `SLOTS`) | `src/lib/validations/delivery-slots.ts`, `src/domains/order/delivery-slot.ts` | RG-08, ADM-09 |
| Fonctions d'heure de Paris, changements d'heure compris | `src/domains/order-intake/order-intake.deadline.ts` (à déplacer dans `src/lib`) | RG-01 |
| File d'actions hors réseau du livreur, PWA, service worker | `src/features/driver/offline-action-queue.ts`, `public/sw.js`, `driver.webmanifest` | LIV-06, critère 8 |
| Photo, code d'échec et commentaire sur un arrêt | champs `pod*` de `Delivery`, `src/domains/delivery/proof*.ts` | LIV-05 |
| Calcul de tournée (insertion au moindre coût, créneaux, capacité) | `src/lib/dispatch/round-planner.ts`, `travel-time.ts`, `delivery-rounds.service.ts` | ADM-06, RG-09 |
| Cartes MapLibre, géocodage IGN, itinéraires OSRM | `src/lib/maps`, `src/components/maps` | ADM-06, ADM-08 |
| Position du livreur pendant la tournée seulement | `use-driver-live-position.ts`, `DriverLocation` | ENF-04, NOT-03 |
| Numérotation continue des factures, PDF, Factur-X, export comptable | `src/domains/invoice`, `src/lib/pdf` | ADM-10, ENF-05 |
| Statut payé et relances | `Invoice`, `InvoiceReminder` | ADM-10, RG-07 |
| E-mails transactionnels (Resend) et push (`web-push`) | `src/lib/email`, `driver-push.service.ts` | NOT-01 à NOT-03 |
| Tâches planifiées et file de jobs | `OperationJob`, `src/app/api/cron` | RG-04, RG-09 (déclenchement à 17h) |
| Tickets de support, utilisés pour les réclamations des commerçants (décision du 6 novembre) | `SupportTicket*`, `/support`, `/portal/support` | réclamations |
| Bouton « Recommander » du portail client | `src/features/client-portal/reorder-order-button.tsx` | CLI-08, ENF-03 |
| Historique des commandes et factures du portail | `/portal/orders/history`, `/portal/invoices` | CLI-07, CLI-10 |
| Suivi en direct du dashboard | `src/domains/dashboard`, `dashboard-map-widgets.tsx` | ADM-08 |
| Conservation et effacement des données (RGPD) | `src/domains/data-lifecycle` | ENF-04 |
| Tests, CI GitHub, Playwright, scripts `check` | `tests/`, `.github/` | recette |

## 2. Ce qu'on supprime

Ces éléments ne figurent pas dans le cahier des charges, ou relèvent du métier de coursier. L'historique git les conserve.

| Élément | Où | Raison |
|---|---|---|
| Abonnements, offres, usage, sièges, facturation SaaS | `Saas*`, `src/domains/saas`, `billing`, `/admin/subscriptions`, `/settings/subscription` | PLA-05 est prévu en V2 |
| Prospection, liste d'attente, codes commerciaux, commissions, pilotes, messages de contact | `growth`, `sales`, `Prospect*`, `Sales*`, `PlatformPilot*`, `Waitlist*`, `ContactMessage`, `/admin/{campaigns,prospection,sales,pilots,waitlist,contact}` | outils de vente de l’ancien produit |
| Site public : tarifs, fonctionnalités, démonstration, `go/[code]` | `src/app/{tarifs,fonctionnalites,demo,demonstration,go}`, `features/landing`, `features/demo`, `domains/demo`, `DemoPoolEnvironment` | hors périmètre |
| Inscription autonome avec paiement | `SignupJourney`, `SignupPaymentEvent`, `domains/signup`, `/register` | c'est l'éditeur qui ouvre les comptes (PLA-02) |
| Commandes par e-mail, WhatsApp ou analyse IA | `InboundOrderEmail`, `CompanyIntakeChannel`, `OrderIntakeUsage`, `domains/order-intake` (hors fonctions d'heure) | l'objectif est de supprimer les commandes par message |
| Lien de commande public et page de suivi publique | `/commander/[token]`, `/suivi/[token]`, `OrderTrackingLink`, `domains/public-order` | le commerçant a un compte |
| Messagerie sur une commande | `OrderMessage`, `OrderThreadRead`, `domains/order-conversation` | non demandé |
| Adresse d'enlèvement, arrêts multiples, poids, mission spéciale, catégories `COURIER`/`SPECIAL_MISSION` | `Order`, `OrderStop`, `RecurringOrder.pickup*` | tout part du laboratoire |
| Statuts `QUOTE_REQUESTED`, `PURCHASING`, `INVOICED`, `PAID` sur la commande | `OrderStatus`, `DeliveryStatus` | statuts remplacés (§3) |
| Affectation automatique mission par mission (score, proximité, éligibilité) | `auto-dispatch.service.ts`, `dispatch-score.ts`, `driver-eligibility.ts`, `dispatch-proximity.ts`, `/dispatch/*` | une tournée correspond à un créneau, et c'est l'admin qui l'attribue |
| Signature du destinataire, PDF de preuve | `podSignature*`, `proof-pdf.ts` | « Livré » se fait en un appui ; la photo sert seulement en cas de problème |
| Zones tarifaires | `src/lib/tariff` | remplacées par les prix du catalogue |
| Rôles `DISPATCHER` et `MINI_ADMIN` | `SystemRole`, `mini-admin.ts` | remplacés (§3) |
| Atelier de design, journal des accès plateforme | `features/design-lab`, `/admin/access-events` | outils internes de l’ancien produit |
| Fichiers propres à l’ancien produit | `TODO.md`, `outputs/` (430 Mo), `.impeccable`, `.playwright-cli`, `PRODUCT.md`, `DESIGN.md` | à réécrire pour le nouveau produit |

## 3. Ce qu'on modifie

| Élément | Aujourd'hui | Demain | Exigences |
|---|---|---|---|
| **Rôles** | SUPER_ADMIN, COMPANY_ADMIN, MINI_ADMIN, DISPATCHER, DRIVER, CLIENT | SUPER_ADMIN, ADMIN, **BAKER**, DRIVER, MERCHANT | §3, ADM-01 |
| **Commerçant** | `CompanyCustomer` (nom, e-mail) + `User` client + `CustomerAddress` | `Merchant` : raison sociale, adresse, coordonnées GPS, consignes d'accès, périodicité de facturation, un ou plusieurs utilisateurs | CLI-02, LIV-01, ADM-10 |
| **Commande** | adresses d'enlèvement et de livraison, `requestedDeliveryDate`, `deliverySlotStart` | `merchantId`, `deliveryDate`, `slotId`, statut `DRAFT → VALIDATED → LOCKED → PREPARED → DELIVERED`, origine `MANUAL`/`RECURRING`, `lockedAt`. Une seule commande par commerçant, par date et par créneau | CLI-05, CLI-06, RG-01, RG-02 |
| **Ligne de commande** | `name`, `quantity`, `unitPrice` saisis à la main | `productId`, `quantityOrdered`, `quantityDelivered`, `unitPriceFrozen` (prix figé au verrouillage) | RG-05, RG-06, BOU-06 |
| **Créneau** | stocké en JSON dans `Company.settings` | table `Slot` (début, fin, actif), car la tournée et la commande y sont liées | RG-08 |
| **Tournée / arrêt** | `Delivery` avec `roundId` et `roundSequence` | tables `Round` (date, créneau, livreur, statut) et `Stop` (ordre, commande, heure de livraison, statut, incident, photo). Le calcul de tournée existant alimente `Stop.order` | ADM-06, ADM-07, BOU-03, critère 6 |
| **Commande récurrente** | fréquence hebdomadaire, bimensuelle ou mensuelle ; lignes en JSON ; génération selon `nextRunAt` | jours de la semaine, créneau, lignes en table, actif ou suspendu. Générée **à l'heure limite seulement si aucune commande manuelle n'existe** pour ce jour | CLI-09, RG-04, critère 4 |
| **Facture** | une facture par commande, lignes en JSON | une facture par commerçant et par période (jour, semaine, mois, année) regroupant plusieurs commandes, calculée sur les **quantités livrées**, avec mode de règlement (virement, prélèvement, espèces). Numérotation et Factur-X conservés | CLI-10, ADM-10, RG-06, RG-07, critère 9 |
| **Navigation du livreur** | lien Google Maps seulement | après « Livré » : proposer l'arrêt suivant, puis « Ouvrir dans Plans », « Ouvrir dans Waze » ou « Y aller seul » | LIV-04, critère 7 |
| **Écran tournée du livreur** | liste de missions | arrêts dans l'ordre, avec nombre de colis et consignes d'accès, plus une **liste de chargement** | LIV-01, LIV-02 |
| **Paramètres entreprise** | créneaux en JSON | heure limite (17h par défaut), fuseau horaire, délai du rappel, créneaux, catégories | ADM-09, RG-01, NOT-01 |
| **Correction après 17h** | non tracée | journal `AuditLog` (qui, quand, avant/après) | ADM-05, RG-10 |
| **Notifications** | e-mails et push vers le livreur | rappel avant l'heure limite, confirmation de commande, « livreur en approche » quand l'arrêt précédent est marqué livré | NOT-01, NOT-02, NOT-03 |
| **Vocabulaire et marque** | ancien nom, chauffeur, mission, dispatch | nouveau nom, « client » pour le commerçant, livreur, tournée, arrêt ; textes centralisés | ENF-07 |
| **Tableau de bord admin** | missions en retard, sans livreur, en cours | commandes du jour, tournées (livrées, restantes, incidents) | ADM-04, ADM-08 |

## 4. Ce qu'il faut créer (absent de la base existante)

| À créer | Exigences |
|---|---|
| Catalogue : `Category` (nom, ordre), `Product` (nom, photo, unité, prix de base, actif), écrans d'administration | ADM-02, PLA-04 |
| Prix spécifique par commerçant et par produit, appliqué partout | ADM-03, RG-05, critère 3 |
| Catalogue côté commerçant, avec boutons + / − et saisie directe, panier et choix de la date et du créneau | CLI-03, CLI-04, CLI-05 |
| Verrouillage à l'heure limite : refus côté serveur à partir de 17h00:00, tâche planifiée qui verrouille, fige les prix, génère les récurrentes, calcule le total à produire et les tournées | RG-01, RG-04, RG-09, critère 2 |
| **Espace boulanger** : total à produire par produit, détail par commerçant, commandes groupées par tournée dans l'ordre de chargement, impression des bons et étiquettes, case « préparée », signalement d'un manquant | BOU-01 à BOU-06, critère 5 |
| Relevés de factures par période, téléchargeables | CLI-10 |

## 5. Décisions à prendre avant de coder

1. **Mobile natif ou web ?** ENF-01 demande des applications iOS et Android pour les commerçants et les livreurs. La base existante est une application web installable (PWA). Trois choix : garder la PWA (rien à refaire, mais la PWA est limitée sur iPhone : notifications seulement une fois installée), emballer le site avec Capacitor (une base de code, publication sur les stores, effort modéré), ou réécrire en React Native / Expo (effort important). **Décidé le 6 novembre : Capacitor.**
2. **Nom et marque** du nouveau produit : **Annona** (décision du 6 novembre).
3. **Nouveau projet Supabase** (base et stockage) en Union européenne, et nouveau projet Vercel.
4. ~~Tickets de support~~ : gardés pour les réclamations (décision du 6 novembre).
5. **Cartographie** (question ouverte du cahier des charges) : La base existante utilise des services publics gratuits (OSRM, IGN) réservés aux essais. Pour 200 arrêts par jour, il faut chiffrer un service payant ou héberger un OSRM.
6. **Schéma de données** : je recommande de repartir d'un schéma Prisma propre, avec une seule migration initiale.

## 6. Ordre de travail proposé

1. Nettoyage : supprimer les éléments du §2, faire repasser `npm run check`.
2. Nouveau schéma Prisma et nouvelle base, données de démonstration (une boulangerie, 100 produits, 20 commerçants, 5 livreurs).
3. Catalogue, prix, commande côté commerçant, heure limite.
4. Verrouillage à 17h, total à produire, espace boulanger.
5. Tournées, application livreur (navigation, hors réseau, incidents).
6. Factures par période, notifications.
7. Applications mobiles (selon la décision 1), puis recette sur les 10 critères.
