/**
 * Accès base pour Factur-X : chargement d'une facture strictement limitée à l'entreprise
 * (et au commerçant du client côté portail), lecture/écriture des mentions légales de
 * l'entreprise (JSON `settings`). L'identité de facturation de l'acheteur vient de la fiche `Merchant`.
 */
import { Prisma } from "@prisma/client";
import type { FacturXSource } from "@/domains/invoice/facturx/facturx-mapping";
import { facturXInvoiceWhere, type FacturXInvoiceScope } from "@/domains/invoice/facturx/facturx-scope";
import { parseBillingSettings } from "@/domains/company/billing-settings.service";
import { readCompanyLogo } from "@/domains/company/company-logo.service";
import { generateInvoicePdf, type InvoicePdfData, type InvoicePdfLegalMentions } from "@/lib/pdf/invoice-pdf";
import {
  clientInvoiceIdentitySchema,
  parseStoredEinvoicingSettings,
  type CompanyEinvoicingUpdate,
} from "@/lib/validations/einvoicing";
import { settingsSection, updateSettingsWithClaim } from "@/lib/database/claimed-settings-update";
import { prisma } from "@/services/prisma/client";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export interface LoadedFacturXInvoice {
  companyId: string;
  reference: string;
  /** Toujours présent : une facture de période a toujours un commerçant (relation obligatoire). */
  source: FacturXSource | null;
  pdf: Omit<InvoicePdfData, "companyLogoPng" | "legal">;
}

export async function loadFacturXInvoice(scope: FacturXInvoiceScope): Promise<LoadedFacturXInvoice | null> {
  const invoice = await prisma.invoice.findFirst({
    where: facturXInvoiceWhere(scope),
    select: {
      reference: true,
      status: true,
      issuedAt: true,
      dueDate: true,
      paidAt: true,
      periodStart: true,
      periodEnd: true,
      subtotalCents: true,
      vatCents: true,
      totalCents: true,
      notes: true,
      companyId: true,
      lines: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { label: true, quantity: true, unitPriceCents: true, vatRateBasisPoints: true, totalCents: true },
      },
      // Dernière commande livrée de la période : date de livraison (BT-72).
      orders: {
        where: { status: "DELIVERED" },
        orderBy: { deliveryDate: "desc" },
        take: 1,
        select: { deliveryDate: true },
      },
      company: {
        select: {
          name: true,
          legalName: true,
          siren: true,
          siret: true,
          email: true,
          address: true,
          city: true,
          country: true,
          billingAddress: true,
          billingPostalCode: true,
          billingCity: true,
          settings: true,
        },
      },
      merchant: {
        select: {
          name: true,
          siren: true,
          vatNumber: true,
          address: true,
          postalCode: true,
          city: true,
          billingAddress: true,
          billingPostalCode: true,
          billingCity: true,
          billingEmail: true,
          contactEmail: true,
        },
      },
    },
  });
  if (!invoice) return null;

  const company = invoice.company;
  const merchant = invoice.merchant;
  const storedEinvoicing = parseStoredEinvoicingSettings(asRecord(company.settings).einvoicing);
  const buyerEmail = merchant.billingEmail ?? merchant.contactEmail ?? null;
  const identity = clientInvoiceIdentitySchema.safeParse({
    companyName: merchant.name,
    siren: merchant.siren ?? undefined,
    vatNumber: merchant.vatNumber ?? undefined,
    address: merchant.billingAddress ?? merchant.address,
    postalCode: merchant.billingPostalCode ?? merchant.postalCode ?? "",
    city: merchant.billingCity ?? merchant.city ?? "",
    countryCode: "FR",
  });
  // Montant affiché du relevé : HT par ligne, puis TVA par taux (même calcul que le Factur-X).
  const vatByRate = new Map<number, number>();
  for (const line of invoice.lines) {
    vatByRate.set(line.vatRateBasisPoints, (vatByRate.get(line.vatRateBasisPoints) ?? 0) + line.totalCents);
  }

  return {
    companyId: invoice.companyId,
    reference: invoice.reference,
    source: {
      invoice: {
        reference: invoice.reference,
        status: invoice.status,
        createdAt: invoice.issuedAt,
        dueDate: invoice.dueDate,
        lines: invoice.lines.map(({ label, quantity, unitPriceCents, vatRateBasisPoints }) => ({ label, quantity, unitPriceCents, vatRateBasisPoints })),
        subtotalCents: invoice.subtotalCents,
        vatCents: invoice.vatCents,
        totalCents: invoice.totalCents,
        notes: invoice.notes,
        orderReference: null,
        deliveryDate: invoice.orders[0]?.deliveryDate ?? invoice.periodEnd,
      },
      seller: {
        name: company.name,
        legalName: company.legalName,
        siren: company.siren,
        siret: company.siret,
        email: company.email,
        billingAddress: company.billingAddress,
        billingPostalCode: company.billingPostalCode,
        billingCity: company.billingCity,
        country: company.country,
      },
      einvoicing: storedEinvoicing.settings,
      einvoicingInvalidFields: storedEinvoicing.invalidFields,
      buyer: {
        firstName: merchant.name,
        lastName: "",
        email: buyerEmail,
        identity: identity.success ? identity.data : null,
        defaultAddress: { address: merchant.address, postalCode: merchant.postalCode, city: merchant.city },
      },
    },
    // Relevé PDF : lignes HT puis une ligne de TVA par taux, en euros (format du générateur PDF).
    pdf: {
      reference: invoice.reference,
      status: invoice.status,
      createdAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      amount: invoice.totalCents / 100,
      lineItems: [
        ...invoice.lines.map((line) => ({ label: line.label, amount: line.unitPriceCents / 100, quantity: line.quantity })),
        ...[...vatByRate.entries()]
          .filter(([rate]) => rate > 0)
          .map(([rate, basis]) => ({
            label: `TVA (${(rate / 100).toLocaleString("fr-FR")} %)`,
            amount: Math.round((basis * rate) / 10_000) / 100,
            quantity: 1,
          })),
      ],
      notes: invoice.notes,
      orderReference: null,
      company: { name: company.name, email: company.email, address: company.address, city: company.city },
      customerName: merchant.name,
      customerEmail: buyerEmail,
      // Pied de page lu dans les réglages déjà chargés : pas de seconde lecture de Company.settings.
      footerNote: parseBillingSettings(asRecord(company.settings).billing).invoice.footerNote ?? null,
    },
  };
}

/**
 * Relevé PDF, avec le même logo et le même pied de page que la route du portail.
 * `legal` (variante Factur-X uniquement) ajoute les mentions légales visibles ; absent, rendu classique inchangé.
 */
export async function renderClassicInvoicePdf(loaded: LoadedFacturXInvoice, legal?: InvoicePdfLegalMentions): Promise<Uint8Array> {
  // Un logo absent ou illisible ne bloque jamais le relevé.
  const companyLogoPng = await readCompanyLogo(loaded.companyId).catch(() => null);
  return generateInvoicePdf({ ...loaded.pdf, companyLogoPng, legal });
}

// ---------------------------------------------------------------------------
// Mentions légales de l'entreprise (administrateur uniquement, voir la route)
// ---------------------------------------------------------------------------

export async function getCompanyEinvoicing(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      legalName: true,
      siren: true,
      siret: true,
      billingAddress: true,
      billingPostalCode: true,
      billingCity: true,
      country: true,
      settings: true,
    },
  });
  if (!company) return null;
  const { settings, ...identity } = company;
  const stored = parseStoredEinvoicingSettings(asRecord(settings).einvoicing);
  return { identity: { ...identity, country: identity.country ?? "FR" }, einvoicing: stored.settings, invalidFields: stored.invalidFields };
}

export async function updateCompanyEinvoicing(companyId: string, input: CompanyEinvoicingUpdate) {
  const identity = input.identity;
  // Réclamation sur updatedAt : une écriture concurrente de settings (billing…) n'est jamais écrasée.
  const result = await updateSettingsWithClaim({
    load: () => prisma.company.findUnique({ where: { id: companyId }, select: { settings: true, updatedAt: true } }),
    apply: (current) => ({ ...current, einvoicing: input.einvoicing }),
    section: settingsSection("einvoicing"),
    save: async (settings, claim) => {
      try {
        const claimed = await prisma.company.updateMany({
          where: { id: companyId, updatedAt: claim.expected },
          data: {
            legalName: identity.legalName ?? null,
            siren: identity.siren ?? null,
            siret: identity.siret ?? null,
            billingAddress: identity.billingAddress ?? null,
            billingPostalCode: identity.billingPostalCode ?? null,
            billingCity: identity.billingCity ?? null,
            country: identity.country,
            settings: settings as Prisma.InputJsonValue,
            updatedAt: claim.next,
          },
        });
        return claimed.count === 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("COMPANY_IDENTITY_TAKEN");
        throw error;
      }
    },
  });
  if (result === "missing") throw new Error("COMPANY_NOT_FOUND");
  return input;
}
