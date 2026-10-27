import { createHmac } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/services/prisma/client";

/** GROWTH-1, décision C10 : messages Contact stockés et lus dans le back-office plateforme. */
export const CONTACT_WINDOW_MS = 60 * 60 * 1000;
/** Au plus 3 messages par source et 50 au total par heure glissante. */
export const CONTACT_SOURCE_LIMIT = 3;
export const CONTACT_GLOBAL_LIMIT = 50;
export const CONTACT_PAGE_SIZES = [25, 50, 100] as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || null);

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  company: optionalText(160),
  phone: z.string().trim().max(40).regex(/^[0-9+().\s-]*$/).optional().transform((value) => value || null),
  message: z.string().trim().min(10).max(4000),
  /** Pot de miel : invisible pour un humain, doit rester vide. */
  website: z.string().max(200).optional(),
}).strict();

export type ContactSubmitResult =
  | { status: "accepted" }
  | { status: "invalid"; field: string }
  | { status: "rate_limited" };

type ContactDatabase = Pick<typeof prisma, "contactMessage">;
type ContactWriteDatabase = Pick<typeof prisma, "contactMessage" | "$transaction">;

/** L'adresse IP n'est jamais stockée : seule cette empreinte HMAC sert au débit. */
export function contactSourceHash(source: string, secret: string) {
  if (!secret) throw new Error("CONTACT_SOURCE_SECRET_MISSING");
  return createHmac("sha256", secret).update(`contact-source:${source}`).digest("hex");
}

/**
 * Vercel écrase x-forwarded-for avec la seule adresse du client. Derrière un proxy qui
 * ajoute au lieu d'écraser, les adresses de gauche viennent du client : seule la dernière,
 * posée par le proxy le plus proche, sert de source.
 */
export function contactSourceFromHeaders(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((entry) => entry.trim()).filter(Boolean).at(-1);
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export async function submitContactMessage(
  raw: unknown,
  source: string,
  options: { now?: Date; secret?: string; db?: ContactWriteDatabase } = {}
): Promise<ContactSubmitResult> {
  const parsed = contactMessageSchema.safeParse(raw);
  if (!parsed.success) return { status: "invalid", field: String(parsed.error.issues[0]?.path[0] ?? "") };
  const { website, ...data } = parsed.data;
  // Un robot reçoit la même réponse qu'un humain, mais rien n'est écrit.
  if (website) return { status: "accepted" };

  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  const sourceHash = contactSourceHash(source, options.secret ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  const since = new Date(now.getTime() - CONTACT_WINDOW_MS);
  // Verrou consultatif de transaction : sans lui, des envois simultanés lisaient le même
  // compte et dépassaient les limites (PERF-02 : 56 acceptés pour 50).
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('tutelliv:contact-rate-limit'))`;
    const [fromSource, total] = await Promise.all([
      tx.contactMessage.count({ where: { sourceHash, createdAt: { gte: since } } }),
      tx.contactMessage.count({ where: { createdAt: { gte: since } } }),
    ]);
    if (fromSource >= CONTACT_SOURCE_LIMIT || total >= CONTACT_GLOBAL_LIMIT) return { status: "rate_limited" } as const;

    await tx.contactMessage.create({ data: { ...data, sourceHash } });
    return { status: "accepted" } as const;
  });
}

export function parseContactListParams(params: URLSearchParams) {
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "25");
  if (!Number.isInteger(page) || page < 1 || page > 10_000) return { error: "Page invalide" } as const;
  if (!CONTACT_PAGE_SIZES.includes(pageSize as (typeof CONTACT_PAGE_SIZES)[number])) {
    return { error: "Taille de page invalide" } as const;
  }
  return { query: { page, pageSize } } as const;
}

export async function listContactMessages(
  query: { page: number; pageSize: number },
  db: ContactDatabase = prisma
) {
  const [total, items] = await Promise.all([
    db.contactMessage.count(),
    db.contactMessage.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      // L'empreinte de source reste interne : elle n'est jamais renvoyée.
      select: { id: true, name: true, email: true, company: true, phone: true, message: true, createdAt: true },
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}
