# Factur-X — factures de livraison

État : 28 octobre 2026. Tranche préparatoire à l'obligation d'émission électronique des PME et microentreprises (1er septembre 2027). Décision produit : `docs/DECISIONS_PRODUIT_COMMERCIALES.md`, section « Facturation des prestations de livraison ».

Cette tranche **ne rend pas TutelLiv conforme** et **n'en fait pas une plateforme agréée**. Elle produit un PDF Factur-X que la société de coursiers (ou son expert-comptable) peut déposer sur sa plateforme agréée, après validation par un outil officiel.

## 1. Cadrage

### Modèle de facture existant

| Élément | Source | Remarque |
|---|---|---|
| Numéro (BT-1) | `Invoice.reference` | unique |
| Date d'émission (BT-2) | `Invoice.createdAt` | pas de champ dédié |
| Échéance (BT-9) | `Invoice.dueDate` | nullable |
| Lignes | `Invoice.lineItems` (JSON) | `{label, amount, quantity, sourceType}` ; `amount` = prix unitaire HT |
| TVA | ligne `sourceType: "VAT"` libellée `TVA (x%)` | un seul taux par facture, calculé sur le sous-total HT, arrondi HALF_UP |
| Total TTC | `Invoice.amount` (Decimal 10,2) | somme des lignes, TVA comprise |
| Statut | `InvoiceStatus` | DRAFT, PENDING, PAID, OVERDUE, CANCELLED |
| Avoir, remise, devise | absents | EUR implicite ; pas d'avoir ni de remise dans le modèle |
| Vendeur | `Company` | `legalName`, `siren`, `siret`, `billingAddress/PostalCode/City`, `country`, `email` |
| Acheteur | `User` (rôle CLIENT) | prénom, nom, e-mail ; adresses de livraison `CustomerAddress` ; aucune identité légale |

### Profil retenu : EN 16931 (« Comfort »)

Les données du modèle suffisent pour EN 16931 dès que l'entreprise a saisi ses mentions légales : lignes détaillées, ventilation de TVA, conditions de paiement. BASIC n'apporterait rien (il exige aussi les lignes) et MINIMUM/BASIC WL ne sont pas des factures au sens fiscal. EXTENDED n'est pas nécessaire.

### Champs obligatoires et données manquantes

| Donnée | EN 16931 / mentions FR | Existant | Ajout |
|---|---|---|---|
| SIREN vendeur (BT-30) | requis par la réforme FR | `Company.siren` (saisi à l'inscription, facultatif) | saisie/édition back-office |
| TVA intracom. vendeur (BT-31) | BR-S-02 / BR-E-02 | absent | `settings.einvoicing.vatNumber` |
| Adresse vendeur (BG-5) | BR-08 / BR-09 | `billing*` + `country` | édition back-office |
| Forme, capital, RCS (BT-33) | mentions FR (Code de commerce) | absent | `settings.einvoicing` |
| Pénalités de retard (note PMD) | art. L441-9 C. com. | absent | `settings.einvoicing.latePenaltyText` (obligatoire) |
| Indemnité forfaitaire 40 € (note PMT) | art. D441-5 C. com. | absent | texte légal fixe |
| Escompte (note AAB) | art. L441-9 C. com. | absent | `settings.einvoicing.earlyPaymentDiscountText` |
| Conditions de paiement (BT-20) | BR-CO-25 | `dueDate` seulement | texte généré ou `paymentTermsText` |
| Moyen de paiement (BG-16) | facultatif ; BR-61 si virement | absent | IBAN/BIC facultatifs |
| Motif d'exonération (BT-120) | BR-E-10 | absent | `settings.einvoicing.vatExemptionReason` |
| Nom et adresse acheteur (BG-7, BG-8) | BR-07, BR-10, BR-11 | nom, adresse de livraison par défaut | identité de facturation du client |
| SIREN acheteur (BT-47) | requis par la réforme FR en B2B domestique | absent | identité de facturation du client (avertissement si absent) |

Choix technique : ces données vont dans le JSON `Company.settings.einvoicing` et `User.settings.invoiceIdentity`, validées par Zod, **sans migration**. Raison : une migration non appliquée ferait échouer toute requête Prisma sur `Company` dès la fusion du code. Une migration vers des colonnes dédiées reste possible plus tard.
