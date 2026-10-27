import { createHash, randomInt } from "node:crypto";
import { Prisma, type SalesCommissionLevel } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/services/prisma/client";
import type { SignupCatalog, SignupQuote } from "@/domains/signup/signup.service";
import { createSalesAttributionSnapshot, type SalesAttributionSnapshot } from "./commission-core";
import { commissionEntriesForInvoices, type CommissionInvoice } from "./commission-ledger";

/**
 * SALES-1, décision C10 : un code permanent par commercial, créé par le super-administrateur,
 * lié à son niveau, sans date de fin et désactivable à tout moment.
 */
export const SALES_CODE_PATTERN = /^[A-Z]{2,8}-[A-HJ-NP-Z2-9]{4}$/;
const SUFFIX_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const salesCodeCreateSchema = z.object({
  sellerName: z.string().trim().min(2).max(120),
  sellerEmail: z.string().trim().toLowerCase().email().max(200),
  level: z.enum(["REFERRER", "ASSISTED", "AUTONOMOUS"]),
}).strict();

type SalesCodeDatabase = Pick<typeof prisma, "salesCode">;

/** Saisie publique : casse et espaces ignorés ; tout autre format est refusé. */
export function normalizeSalesCode(raw: string) {
  const code = raw.trim().toUpperCase();
  return SALES_CODE_PATTERN.test(code) ? code : null;
}

export function generateSalesCode(sellerName: string, random: (max: number) => number = randomInt) {
  const letters = sellerName.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase();
  const prefix = (letters.length >= 2 ? letters : "TL").slice(0, 8);
  let suffix = "";
  for (let index = 0; index < 4; index += 1) suffix += SUFFIX_ALPHABET[random(SUFFIX_ALPHABET.length)];
  return `${prefix}-${suffix}`;
}

function uniqueTarget(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.join(",") : String(target ?? "");
}

export async function createSalesCode(
  raw: unknown,
  actorId: string,
  options: { db?: SalesCodeDatabase; random?: (max: number) => number } = {}
) {
  const parsed = salesCodeCreateSchema.safeParse(raw);
  if (!parsed.success) return { status: "invalid", field: String(parsed.error.issues[0]?.path[0] ?? "") } as const;
  const db = options.db ?? prisma;
  // Un suffixe aléatoire peut entrer en collision : trois essais, puis échec explicite.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const created = await db.salesCode.create({
        data: { ...parsed.data, code: generateSalesCode(parsed.data.sellerName, options.random), createdById: actorId },
        select: { id: true, code: true, sellerName: true, sellerEmail: true, level: true, disabledAt: true, createdAt: true },
      });
      return { status: "created", salesCode: created } as const;
    } catch (error) {
      const target = uniqueTarget(error);
      if (target?.includes("seller_email") || target?.includes("sellerEmail")) return { status: "seller_has_code" } as const;
      if (!target?.includes("code")) throw error;
    }
  }
  throw new Error("SALES_CODE_GENERATION_EXHAUSTED");
}

export async function disableSalesCode(id: string, actorId: string, now = new Date(), db: SalesCodeDatabase = prisma) {
  const { count } = await db.salesCode.updateMany({
    where: { id, disabledAt: null },
    data: { disabledAt: now, disabledById: actorId },
  });
  if (count === 1) return { status: "disabled" } as const;
  const existing = await db.salesCode.findUnique({ where: { id }, select: { id: true } });
  return existing ? ({ status: "already_disabled" } as const) : ({ status: "not_found" } as const);
}

/** Code saisi pendant l'inscription : seul un code existant et actif est accepté. */
export async function resolveActiveSalesCodeId(raw: string, db: SalesCodeDatabase = prisma) {
  const code = normalizeSalesCode(raw);
  if (!code) throw new Error("SALES_CODE_INVALID");
  const found = await db.salesCode.findUnique({ where: { code }, select: { id: true, disabledAt: true } });
  if (!found || found.disabledAt) throw new Error("SALES_CODE_INVALID");
  return found.id;
}

/** Mêmes lignes et mêmes codes que le contrat de facturation (`makeBillingContract`). */
export function initialSalesLines(
  quote: Pick<SignupQuote, "planCode" | "planName" | "planPriceCents" | "billingInterval" | "selections">,
  options: SignupCatalog["options"]
) {
  return [
    { code: `plan:${quote.planCode}`, name: quote.planName, quantity: 1, unitHtCents: quote.planPriceCents },
    ...quote.selections.map((selection) => {
      const option = options.find((candidate) => candidate.code === selection.code);
      if (!option) throw new Error("SALES_LINE_INVALID");
      return {
        code: option.code,
        name: option.name,
        quantity: selection.quantity,
        unitHtCents: quote.billingInterval === "ANNUAL" ? option.annualPriceCents : option.monthlyPriceCents,
      };
    }),
  ];
}

/**
 * Fige l'attribution dans la transaction d'activation. Un code désactivé entre-temps n'attribue
 * rien, et une attribution impossible à figer ne bloque jamais l'activation d'un client qui a payé.
 */
export async function attributeSignupSale(
  tx: Pick<Prisma.TransactionClient, "salesCode" | "salesAttribution">,
  input: {
    signupId: string;
    salesCodeId: string | null;
    companyId: string;
    quote: SignupQuote;
    options: SignupCatalog["options"];
    now: Date;
  }
) {
  if (!input.salesCodeId) return { status: "none" } as const;
  const code = await tx.salesCode.findUnique({ where: { id: input.salesCodeId }, select: { id: true, level: true, disabledAt: true } });
  if (!code || code.disabledAt) return { status: "code_disabled" } as const;
  let snapshot: ReturnType<typeof createSalesAttributionSnapshot>;
  try {
    const lines = initialSalesLines(input.quote, input.options);
    snapshot = createSalesAttributionSnapshot({
      sellerReference: code.id,
      level: code.level as SalesCommissionLevel,
      startsAt: input.now,
      initialContractHash: createHash("sha256").update(JSON.stringify({ quote: input.quote, lines })).digest("hex"),
      initialLines: lines,
    });
  } catch (error) {
    console.error("[sales] attribution non figée", { signupId: input.signupId, code: error instanceof Error ? error.message : "UNKNOWN" });
    return { status: "snapshot_failed" } as const;
  }
  await tx.salesAttribution.create({
    data: {
      companyId: input.companyId,
      salesCodeId: code.id,
      signupId: input.signupId,
      level: snapshot.level,
      rateBps: snapshot.rateBps,
      attributedAt: input.now,
      eligibleUntil: new Date(snapshot.eligibleUntil),
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
  return { status: "attributed", rateBps: snapshot.rateBps } as const;
}

export const SALES_CODE_PAGE_SIZES = [25, 50, 100] as const;

export function parseSalesCodeListParams(params: URLSearchParams) {
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "25");
  if (!Number.isInteger(page) || page < 1 || page > 10_000) return { error: "Page invalide" } as const;
  if (!SALES_CODE_PAGE_SIZES.includes(pageSize as (typeof SALES_CODE_PAGE_SIZES)[number])) {
    return { error: "Taille de page invalide" } as const;
  }
  return { query: { page, pageSize } } as const;
}

/** Back-office plateforme : codes et nombre d'entreprises attribuées, sans montant ni client. */
export async function listSalesCodes(
  query: { page: number; pageSize: number },
  db: Pick<typeof prisma, "salesCode"> = prisma
) {
  const [total, rows] = await Promise.all([
    db.salesCode.count(),
    db.salesCode.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        sellerName: true,
        sellerEmail: true,
        level: true,
        disabledAt: true,
        createdAt: true,
        _count: { select: { attributions: true } },
      },
    }),
  ]);
  return {
    items: rows.map(({ _count, ...row }) => ({ ...row, attributions: _count.attributions })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Appelée dans la transaction de projection de la facturation : ajoute les écritures manquantes
 * de l'entreprise attribuée. Une erreur de calcul est journalisée et ne bloque jamais l'abonnement.
 */
export async function recordSalesCommissions(
  tx: Pick<Prisma.TransactionClient, "salesAttribution" | "salesCommissionEntry">,
  companyId: string,
  invoices: CommissionInvoice[]
) {
  const attribution = await tx.salesAttribution.findUnique({
    where: { companyId },
    select: { id: true, snapshot: true, commissionEntries: { select: { settlementKey: true, commissionCents: true } } },
  });
  if (!attribution) return 0;
  let entries: ReturnType<typeof commissionEntriesForInvoices>;
  try {
    entries = commissionEntriesForInvoices(attribution.snapshot as unknown as SalesAttributionSnapshot, invoices, attribution.commissionEntries);
  } catch (error) {
    console.error("[sales] commissions non calculées", { attributionId: attribution.id, code: error instanceof Error ? error.message : "UNKNOWN" });
    return 0;
  }
  if (entries.length === 0) return 0;
  const { count } = await tx.salesCommissionEntry.createMany({
    data: entries.map((row) => ({ ...row, attributionId: attribution.id })),
    skipDuplicates: true,
  });
  return count;
}

/** Libellé d'une écriture sans identifiant du fournisseur de paiement. */
function entryKind(settlementKey: string) {
  if (settlementKey.includes(":refund:")) return "REFUND" as const;
  const status = settlementKey.slice(settlementKey.lastIndexOf(":") + 1);
  return status === "paid" ? ("PAYMENT" as const) : ("UNPAID" as const);
}

/** Historique d'un code : 50 entreprises les plus récentes et leurs écritures théoriques. */
export async function getSalesCodeHistory(id: string, db: Pick<typeof prisma, "salesCode"> = prisma) {
  const code = await db.salesCode.findUnique({
    where: { id },
    select: {
      code: true,
      sellerName: true,
      attributions: {
        orderBy: [{ attributedAt: "desc" }, { id: "desc" }],
        take: 50,
        select: {
          id: true,
          level: true,
          rateBps: true,
          attributedAt: true,
          eligibleUntil: true,
          company: { select: { name: true } },
          commissionEntries: {
            orderBy: [{ receivedAt: "asc" }, { settlementKey: "asc" }],
            select: { settlementKey: true, explanation: true, eligibleHtCents: true, commissionCents: true, receivedAt: true },
          },
        },
      },
    },
  });
  if (!code) return null;
  return {
    code: code.code,
    sellerName: code.sellerName,
    attributions: code.attributions.map(({ company, commissionEntries, ...attribution }) => ({
      ...attribution,
      companyName: company.name,
      totalCommissionCents: commissionEntries.reduce((sum, row) => sum + row.commissionCents, 0),
      entries: commissionEntries.map(({ settlementKey, ...row }) => ({ ...row, kind: entryKind(settlementKey) })),
    })),
  };
}
