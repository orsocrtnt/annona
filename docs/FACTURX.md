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

## 2. Architecture

| Couche | Fichier | Rôle |
|---|---|---|
| Modèle | `src/domains/invoice/facturx/facturx.types.ts` | modèle sémantique EN 16931 typé (BT-/BG-) |
| Générateur | `src/domains/invoice/facturx/cii-generator.ts` | XML CII D16B pur, totaux en centimes entiers, contrôles BR- implémentables |
| Mapping | `src/domains/invoice/facturx/facturx-mapping.ts` | `Invoice` + `Company` + client → modèle ; refus actionnables |
| Isolation | `src/domains/invoice/facturx/facturx-scope.ts` | filtres Prisma imposant l'entreprise (et le client au portail) |
| PDF | `src/lib/pdf/facturx-pdf.ts`, `src/lib/pdf/srgb-icc.ts` | fichier associé `factur-x.xml`, XMP PDF/A-3 + extension `fx`, OutputIntent sRGB, `/ID` |
| Assemblage | `src/domains/invoice/facturx/facturx-document.ts` | mapping → XML → PDF classique → Factur-X ; réponse HTTP 200/422 |
| Base | `src/domains/invoice/facturx/facturx.service.ts` | chargement limité à l'entreprise, lecture/écriture des réglages JSON |
| Validation | `src/lib/validations/einvoicing.ts` | Zod : SIREN, SIRET préfixé, TVA FR = clé + SIREN, IBAN (clé 97), BIC |

Routes :

- `GET /api/invoices/[id]/pdf` (back-office, `invoices:read`, COMPANY_ADMIN ou MINI_ADMIN) : PDF classique ; `?format=facturx` : PDF Factur-X ;
- `GET /api/portal/invoices/[id]/pdf?format=facturx` (client propriétaire de la facture) ; sans paramètre, la route reste inchangée ;
- `GET/PATCH /api/company/einvoicing` (COMPANY_ADMIN uniquement) : identité légale (colonnes `Company`) et mentions (`settings.einvoicing`) ;
- `GET/PUT /api/company/clients/[id]/invoice-identity` (COMPANY_ADMIN uniquement) : identité de facturation d'un client de l'entreprise.

Écrans : Réglages › Facturation › onglet Factures, carte « Mentions légales et Factur-X » ; fiche client, carte « Identité de facturation » ; boutons « PDF » et « Factur-X » sur la carte du relevé de la commande et « Factur-X » à côté de « Télécharger le PDF » dans le portail.

Un refus renvoie `422` en texte brut : liste des données manquantes côté back-office, message générique côté client. Le PDF classique reste toujours disponible. L'export comptable CSV n'est pas modifié : il décrit les lignes, pas les documents, et une colonne supplémentaire changerait son format attendu.

## 3. Contrôles automatisés (hors ligne, `npm test`)

| Contrôle | Test |
|---|---|
| XML bien formé (prologue, balises, attributs, entités, caractères interdits) | `tests/facturx-xml.test.ts`, `tests/facturx-mapping.test.ts` (aide `tests/helpers/xml-wellformed.ts`) |
| Ordre des blocs imposé par le XSD CII (en-tête, parties, règlement, ventilation TVA) | `tests/facturx-xml.test.ts` |
| BR-02 à BR-11, BR-16, BR-21 à BR-27, BR-61, BR-CO-09/10/13/14/15/16/25/26, BR-S-02/05, BR-E-02/05/10, BR-AE-02/05/10 | `tests/facturx-xml.test.ts` |
| Arrondi HALF_UP au centime par taux, plusieurs taux, exonération, autoliquidation, avoir 381 | `tests/facturx-xml.test.ts` |
| Cohérence avec la facture stockée (TVA recalculée, total, lignes illisibles) | `tests/facturx-mapping.test.ts` |
| `factur-x.xml` embarqué, `/AF`, `/AFRelationship /Data`, `/EmbeddedFiles`, `text/xml`, `Params` | `tests/facturx-pdf.test.ts` |
| XMP : `pdfaid:part 3`, `conformance B`, `fx:DocumentType`, `fx:ConformanceLevel`, `fx:Version`, schéma d'extension, concordance avec Info | `tests/facturx-pdf.test.ts` |
| OutputIntent `GTS_PDFA1` + profil ICC sRGB chargé par LittleCMS (via sharp) | `tests/facturx-pdf.test.ts` |
| Rendu visuel identique (flux de contenu, MediaBox, polices de chaque page) | `tests/facturx-pdf.test.ts` |
| Isolation entreprise/client et rôles (back-office, portail, réglages) | `tests/facturx-routes.test.ts`, `tests/facturx-mapping.test.ts` |

## 4. Limites — ce qui n'est PAS garanti

- **Pas de validation XSD ni Schematron officielle.** Les XSD Factur-X et le Schematron EN 16931 ne sont pas embarqués dans le dépôt. Avant toute mise en service : valider plusieurs factures réelles de recette avec Mustang (`mustangproject`, commande `--action validate`) ou le validateur FNFE-MPE, et corriger les écarts.
- **PDF/A-3b non strict.** Le relevé utilise les polices standard non embarquées de pdf-lib (Helvetica). PDF/A exige des polices embarquées : un validateur PDF/A (veraPDF) signalera cette non-conformité. Le XML, les métadonnées, l'OutputIntent et le fichier associé sont en place. Alternatives : (a) embarquer une police TTF libre via `@pdf-lib/fontkit` dans `invoice-pdf.ts` — modifie légèrement le rendu et ajoute une dépendance, à décider ; (b) conversion serveur PDF/A-3 (Ghostscript, Mustang) — hors périmètre Vercel actuel.
- **Profil ICC généré en code** (sRGB v2, primaires D50, courbe échantillonnée) : accepté par LittleCMS, non comparé au profil ICC officiel.
- **`AFRelationship /Data`** retenu ; les sources consultées divergent entre `Data` et `Alternative` pour la France : à confirmer avec la spécification FNFE en vigueur.
- **Mentions françaises PMD/PMT/AAB** en notes `IncludedNote` selon l'usage FNFE ; la règle exacte du profil français (CIUS) reste à confirmer.
- **Un seul taux de TVA par facture** côté TutelLiv (le générateur en gère plusieurs). Une facture sans ligne de TVA est traitée comme exonérée et exige un motif ; si la TVA arrondie vaut 0 € pour un taux non nul, ce cas est mal classé (montant inférieur à 3 centimes).
- **BR-E-02** : une facture exonérée exige un n° de TVA vendeur ; le cas du représentant fiscal ou de l'identifiant fiscal BT-32 n'est pas géré.
- **Ni avoir ni remise** dans le modèle TutelLiv : le générateur sait produire un avoir 381, aucun écran n'en crée.
- **Acheteur** : sans identité de facturation, nom et adresse de livraison par défaut du client sont utilisés, pays supposé FR ; le SIREN client manquant n'est qu'un avertissement.
- **Date d'émission = `createdAt`** de la facture ; un Factur-X régénéré porte une date de production nouvelle mais le même XML.
- **Aucun clic navigateur** n'a été fait sur les nouveaux écrans ; spec Playwright `tests/e2e/facturx.spec.ts` écrite, non lancée.

## 5. Données à faire saisir par chaque entreprise

Réglages › Facturation › Factures › « Mentions légales et Factur-X » (administrateur) : raison sociale, SIREN, SIRET, adresse de facturation complète, pays, n° de TVA intracommunautaire, forme juridique, capital, RCS/RM, mention des pénalités de retard, conditions d'escompte ; facultatifs : IBAN/BIC, conditions de paiement, motif d'exonération (obligatoire si l'entreprise ne facture pas de TVA). Pour chaque client professionnel : fiche client › « Identité de facturation » (raison sociale, SIREN, TVA, adresse).

## 6. Prochaine étape : plateforme agréée (non implémentée)

Point d'extension prévu, à créer dans `src/domains/invoice/facturx/` lorsque la plateforme sera choisie :

```ts
export interface ApprovedPlatformSender {
  /** Dépose un Factur-X ; renvoie l'identifiant de dépôt de la plateforme. */
  submit(input: { companyId: string; invoiceReference: string; pdf: Uint8Array; xml: string }): Promise<{ submissionId: string }>;
  /** Statut de cycle de vie (déposée, rejetée, encaissée…) pour l'afficher dans TutelLiv. */
  status(submissionId: string): Promise<{ state: string; detail?: string }>;
}
```

Prérequis avant cette étape : validation officielle (section 4), décision PDF/A strict, choix de la plateforme par le propriétaire, stockage des statuts de dépôt (migration à concevoir), revue juridique dans `docs/legal/`.
