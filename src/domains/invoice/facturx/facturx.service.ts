/**
 * Accès base pour Factur-X : chargement d'une facture strictement limitée à l'entreprise
 * (et au client propriétaire côté portail), lecture/écriture des mentions légales de
 * l'entreprise et de l'identité de facturation des clients. Aucune migration : JSON `settings`.
 */
import { Prisma } from "@prisma/client";
import type { FacturXSource } from "@/domains/invoice/facturx/facturx-mapping";
import { companyClientWhere, facturXInvoiceWhere, type FacturXInvoiceScope } from "@/domains/invoice/facturx/facturx-scope";
import { getCompanyBillingSettings } from "@/domains/company/billing-settings.service";
import { readCompanyLogo } from "@/domains/company/company-logo.service";
import { generateInvoicePdf, type InvoicePdfData, type InvoicePdfLegalMentions } from "@/lib/pdf/invoice-pdf";
import {
  parseStoredClientInvoiceIdentity,
  parseStoredEinvoicingSettings,
  type ClientInvoiceIdentity,
  type CompanyEinvoicingUpdate,
} from "@/lib/validations/einvoicing";
import { prisma } from "@/services/prisma/client";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

export interface LoadedFacturXInvoice {
  companyId: string;
  reference: string;
  /** null si la facture n'a plus de client rattaché. */
  source: FacturXSource | null;
  pdf: Omit<InvoicePdfData, "companyLogoPng" | "footerNote">;
}

export async function loadFacturXInvoice(scope: FacturXInvoiceScope): Promise<LoadedFacturXInvoice | null> {
  const invoice = await prisma.invoice.findFirst({
    where: facturXInvoiceWhere(scope),
    select: {
      reference: true,
      status: true,
      createdAt: true,
      dueDate: true,
      paidAt: true,
      amount: true,
      lineItems: true,
      notes: true,
      companyId: true,
      order: { select: { reference: true } },
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
      customer: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          settings: true,
          addresses: { where: { isDefault: true }, select: { address: true, postalCode: true, city: true }, take: 1 },
        },
      },
    },
  });
  if (!invoice) return null;

  const amount = Number(invoice.amount);
  const rawLines = Array.isArray(invoice.lineItems) ? (invoice.lineItems as Array<Record<string, unknown>>) : [];
  const customer = invoice.customer;
  const company = invoice.company;

  return {
    companyId: invoice.companyId,
    reference: invoice.reference,
    source: customer
      ? {
          invoice: {
            reference: invoice.reference,
            status: invoice.status,
            createdAt: invoice.createdAt,
            dueDate: invoice.dueDate,
            amount,
            lineItems: invoice.lineItems,
            notes: invoice.notes,
            orderReference: invoice.order?.reference ?? null,
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
          einvoicing: parseStoredEinvoicingSettings(asRecord(company.settings).einvoicing),
          buyer: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            identity: parseStoredClientInvoiceIdentity(asRecord(customer.settings).invoiceIdentity),
            defaultAddress: customer.addresses[0] ?? null,
          },
        }
      : null,
    // Mêmes données que le relevé PDF actuel, pour un rendu visuel identique.
    pdf: {
      reference: invoice.reference,
      status: invoice.status,
      createdAt: invoice.createdAt,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      amount,
      lineItems: rawLines.map((line) => ({
        label: String(line.label ?? ""),
        amount: line.amount as number,
        quantity: line.quantity as number,
      })),
      notes: invoice.notes,
      orderReference: invoice.order?.reference ?? null,
      company: { name: company.name, email: company.email, address: company.address, city: company.city },
      customerName: customer ? `${customer.firstName} ${customer.lastName}`.trim() : null,
      customerEmail: customer?.email ?? null,
    },
  };
}

/**
 * Relevé PDF, avec le même logo et le même pied de page que la route du portail.
 * `legal` (variante Factur-X uniquement) ajoute les mentions légales visibles ; absent, rendu classique inchangé.
 */
export async function renderClassicInvoicePdf(loaded: LoadedFacturXInvoice, legal?: InvoicePdfLegalMentions): Promise<Uint8Array> {
  const [billing, companyLogoPng] = await Promise.all([
    getCompanyBillingSettings(loaded.companyId),
    // Un logo absent ou illisible ne bloque jamais le relevé.
    readCompanyLogo(loaded.companyId).catch(() => null),
  ]);
  return generateInvoicePdf({ ...loaded.pdf, companyLogoPng, footerNote: billing.invoice.footerNote ?? null, legal });
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
  return { identity: { ...identity, country: identity.country ?? "FR" }, einvoicing: parseStoredEinvoicingSettings(asRecord(settings).einvoicing) };
}

export async function updateCompanyEinvoicing(companyId: string, input: CompanyEinvoicingUpdate) {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: companyId }, select: { settings: true } });
    if (!company) throw new Error("COMPANY_NOT_FOUND");
    const identity = input.identity;
    try {
      await tx.company.update({
        where: { id: companyId },
        data: {
          legalName: identity.legalName ?? null,
          siren: identity.siren ?? null,
          siret: identity.siret ?? null,
          billingAddress: identity.billingAddress ?? null,
          billingPostalCode: identity.billingPostalCode ?? null,
          billingCity: identity.billingCity ?? null,
          country: identity.country,
          // Clé dédiée : la route des réglages de facturation réécrit `settings.billing` en entier.
          settings: { ...asRecord(company.settings), einvoicing: input.einvoicing } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("COMPANY_IDENTITY_TAKEN");
      throw error;
    }
    return input;
  });
}

// ---------------------------------------------------------------------------
// Identité de facturation d'un client de l'entreprise
// ---------------------------------------------------------------------------

export async function getClientInvoiceIdentity(companyId: string, clientId: string) {
  const client = await prisma.user.findFirst({ where: companyClientWhere(companyId, clientId), select: { settings: true } });
  if (!client) return undefined;
  return parseStoredClientInvoiceIdentity(asRecord(client.settings).invoiceIdentity);
}

export async function updateClientInvoiceIdentity(companyId: string, clientId: string, identity: ClientInvoiceIdentity) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.user.findFirst({ where: companyClientWhere(companyId, clientId), select: { id: true, settings: true } });
    if (!client) return null;
    await tx.user.update({
      where: { id: client.id },
      data: { settings: { ...asRecord(client.settings), invoiceIdentity: identity } as Prisma.InputJsonValue },
    });
    return identity;
  });
}
