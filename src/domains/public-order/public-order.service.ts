import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { getCompanyDeliveryOptions, getCompanyDeliverySlots } from "@/domains/company/company-settings.service";
import { DELIVERY_SLOT_ERROR_MESSAGES, resolveDeliverySlot } from "@/domains/order/delivery-slot";
import { createClientOrder } from "@/domains/order/order.service";
import { buildOrderInputFromForm } from "@/domains/order-intake/order-intake.form";
import { enqueueOperationJob, kickOperationJob, skippedJobError } from "@/domains/operations/operation-job.service";
import { trackingTimeline } from "@/domains/tracking/tracking.policy";
import { getFulfillmentStatusLabel, TERMINAL_STATUSES } from "@/lib/constants/order-status";
import { sendTransactionalEmail, type EmailContentFreezer, type ReplayWindowStart } from "@/lib/email/transactional-email";
import { abuseFingerprint, getAbuseHmacSecret } from "@/lib/security/abuse-hmac";
import { createClientOrderSchema } from "@/lib/validations/order";
import { appBaseUrl } from "./intake-channels.service";

export const PUBLIC_ORDER_WINDOW_MS = 60 * 60 * 1000;
/** Au plus 5 commandes par source et 60 par entreprise, par heure glissante. */
export const PUBLIC_ORDER_SOURCE_LIMIT = 5;
export const PUBLIC_ORDER_COMPANY_LIMIT = 60;
/** Un lien de suivi reste lisible 30 jours après la fin de la commande. */
export const TRACKING_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const newTrackingToken = () => randomBytes(24).toString("base64url");

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optional = (max: number) => z.string().trim().max(max).optional().transform((value) => value || "");
const stop = z.object({
  address: text(5, 200),
  city: text(2, 120),
  postalCode: z.string().trim().regex(/^[0-9A-Za-z -]{4,10}$/),
  instructions: optional(500),
}).strict();

export const publicOrderSchema = z.object({
  idempotencyKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/),
  name: text(2, 120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().min(6).max(40).regex(/^[0-9+().\s-]*$/),
  pickup: stop,
  delivery: stop.extend({ contactName: optional(120), phone: z.string().trim().max(40).regex(/^[0-9+().\s-]*$/).optional().transform((value) => value || "") }),
  packageName: optional(200),
  quantity: z.number().int().min(1).max(999),
  requestedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestedDeliverySlot: z.string().max(11).optional(),
  /** Pot de miel : invisible pour un humain, doit rester vide. */
  website: z.string().max(200).optional(),
}).strict();

export async function getPublicOrderPage(token: string) {
  if (!TOKEN.test(token)) return null;
  const channel = await prisma.companyIntakeChannel.findUnique({
    where: { orderLinkToken: token },
    select: { orderLinkEnabled: true, companyId: true, company: { select: { name: true, status: true } } },
  });
  // Compte suspendu ou inactif : le lien se comporte comme s'il n'existait pas.
  if (!channel?.orderLinkEnabled || !["ACTIVE", "TRIAL"].includes(channel.company.status)) return null;
  const slots = await getCompanyDeliverySlots(channel.companyId);
  return { companyId: channel.companyId, companyName: channel.company.name, slots };
}

export type PublicOrderResult =
  | { status: "created"; reference: string; trackingUrl: string }
  /** Pot de miel : même réponse qu'un humain, sans rien écrire. */
  | { status: "ignored" }
  | { status: "not_found" }
  | { status: "invalid"; field: string }
  | { status: "slot_invalid"; message: string }
  | { status: "rate_limited" }
  | { status: "unavailable" };

const REFUSALS = new Set(["SAAS_ORDER_CREATION_BLOCKED", "SAAS_ACCOUNT_READ_ONLY"]);

async function overLimit(db: Pick<typeof prisma, "orderTrackingLink">, companyId: string, sourceHash: string, since: Date) {
  const [fromSource, total] = await Promise.all([
    db.orderTrackingLink.count({ where: { sourceHash, createdAt: { gte: since } } }),
    db.orderTrackingLink.count({ where: { companyId, sourceHash: { not: null }, createdAt: { gte: since } } }),
  ]);
  return fromSource >= PUBLIC_ORDER_SOURCE_LIMIT || total >= PUBLIC_ORDER_COMPANY_LIMIT;
}

/**
 * Commande sans compte. Le demandeur n'est pas authentifié : aucune identité n'est déduite de
 * l'e-mail saisi (customerEmail reste vide, donc jamais de rattachement à un compte), le lien de
 * suivi ne part qu'à cette adresse et aucune affectation automatique n'est lancée.
 */
export async function submitPublicOrder(
  token: string,
  raw: unknown,
  source: string,
  deps: { now?: Date; secret?: string; createOrder?: typeof createClientOrder } = {}
): Promise<PublicOrderResult> {
  const page = await getPublicOrderPage(token);
  if (!page) return { status: "not_found" };
  const parsed = publicOrderSchema.safeParse(raw);
  if (!parsed.success) return { status: "invalid", field: parsed.error.issues[0]?.path.join(".") ?? "" };
  const input = parsed.data;
  if (input.website) return { status: "ignored" };

  const { companyId } = page;
  const now = deps.now ?? new Date();
  const sourceHash = abuseFingerprint("public-order-source", source, deps.secret ?? getAbuseHmacSecret());
  const since = new Date(now.getTime() - PUBLIC_ORDER_WINDOW_MS);
  // Contrôle sans verrou avant le géocodage ; le vrai plafond est vérifié sous verrou à la création.
  if (await overLimit(prisma, companyId, sourceHash, since)) return { status: "rate_limited" };

  const options = await getCompanyDeliveryOptions(companyId);
  const deliveryCategory = options.deliveryCategories.COURIER ? "COURIER" : options.deliveryCategories.STANDARD ? "STANDARD" : null;
  if (!deliveryCategory) return { status: "unavailable" };

  const order = createClientOrderSchema.safeParse({
    ...buildOrderInputFromForm({
      deliveryCategory,
      pickup: { address: input.pickup.address, city: input.pickup.city, postalCode: input.pickup.postalCode, contactName: "", phone: "", instructions: input.pickup.instructions },
      delivery: { address: input.delivery.address, city: input.delivery.city, postalCode: input.delivery.postalCode, contactName: input.delivery.contactName, phone: input.delivery.phone, instructions: input.delivery.instructions },
      requestedDeliveryDate: input.requestedDeliveryDate,
      requestedDeliverySlot: input.requestedDeliverySlot ?? "",
      weightKg: "",
      deadlineLabel: "",
      urgent: false,
      packageName: input.packageName,
      quantity: input.quantity,
      instructions: "",
    }),
    notes: `Commande sans compte, via le lien public. Demandeur (non vérifié) : ${input.name} — ${input.email} — ${input.phone}`,
  });
  if (!order.success) return { status: "invalid", field: order.error.issues[0]?.path.join(".") ?? "" };

  const slot = resolveDeliverySlot(page.slots, order.data, now);
  if (!slot.ok) return { status: "slot_invalid", message: DELIVERY_SLOT_ERROR_MESSAGES[slot.error] };

  const createOrder = deps.createOrder ?? createClientOrder;
  let created: { id: string; reference: string };
  let replayed: { id: string; reference: string } | null = null;
  try {
    created = await createOrder(
      null,
      companyId,
      null,
      {
        ...order.data,
        ...(slot.deliverySlotStart ? { requestedDeliveryDate: slot.requestedDeliveryDate, deliverySlotStart: slot.deliverySlotStart } : {}),
        source: "PUBLIC_LINK",
      },
      {
        idempotencyKey: input.idempotencyKey,
        skipAutoDispatch: true,
        beforeCreate: async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`public-order:${companyId}`}::text, 0))`;
          // Sans client, la contrainte d'unicité (client, clé) ne joue pas : le double envoi se détecte sous ce verrou (AUDIT-0111, C3).
          replayed = await tx.order.findFirst({
            where: { companyId, customerId: null, idempotencyKey: input.idempotencyKey },
            select: { id: true, reference: true },
          });
          if (replayed) throw new Error("PUBLIC_ORDER_REPLAYED");
          if (await overLimit(tx, companyId, sourceHash, since)) throw new Error("PUBLIC_ORDER_RATE_LIMITED");
        },
        afterCreate: async (tx, createdOrder) => {
          const link = await tx.orderTrackingLink.create({
            data: { token: newTrackingToken(), orderId: createdOrder.id, companyId, guestEmail: input.email, sourceHash },
          });
          await enqueueOperationJob(tx, {
            jobKey: `guest-tracking:${link.id}`,
            type: "CLIENT_NOTIFICATION",
            companyId,
            payload: { kind: "GUEST_TRACKING_LINK", linkId: link.id },
          });
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PUBLIC_ORDER_REPLAYED" && replayed) return replayedResult(replayed);
    if (message === "PUBLIC_ORDER_RATE_LIMITED") return { status: "rate_limited" };
    if (message === "IDEMPOTENCY_KEY_REUSED") return { status: "invalid", field: "idempotencyKey" };
    if (REFUSALS.has(message)) return { status: "unavailable" };
    throw error;
  }

  const link = await prisma.orderTrackingLink.findUnique({ where: { orderId: created.id } });
  if (!link) throw new Error("PUBLIC_ORDER_LINK_MISSING");
  const job = await prisma.operationJob.findUnique({ where: { jobKey: `guest-tracking:${link.id}` }, select: { id: true, status: true } });
  if (job?.status === "PENDING") kickOperationJob(job.id);
  return { status: "created", reference: created.reference, trackingUrl: `/suivi/${link.token}` };
}

/** Un second envoi du même formulaire retrouve la première commande et son lien de suivi. */
async function replayedResult(order: { id: string; reference: string }): Promise<PublicOrderResult> {
  const link = await prisma.orderTrackingLink.findUnique({ where: { orderId: order.id } });
  if (!link) throw new Error("PUBLIC_ORDER_LINK_MISSING");
  return { status: "created", reference: order.reference, trackingUrl: `/suivi/${link.token}` };
}

/** Envoi durable du lien de suivi, à la seule adresse saisie avec la commande. */
export async function deliverGuestTrackingEmail(
  payload: unknown,
  jobKey: string,
  replayWindow: ReplayWindowStart,
  freezeContent: EmailContentFreezer
) {
  const linkId = (payload as { linkId?: unknown } | null)?.linkId;
  if (typeof linkId !== "string") throw new Error("GUEST_TRACKING_PAYLOAD_INVALID");
  const link = await prisma.orderTrackingLink.findUnique({
    where: { id: linkId },
    select: { token: true, guestEmail: true, order: { select: { reference: true } }, company: { select: { name: true } } },
  });
  if (!link?.guestEmail) throw skippedJobError("GUEST_TRACKING_NO_RECIPIENT");
  const delivery = await sendTransactionalEmail({
    to: link.guestEmail,
    subject: `Votre commande ${link.order.reference} chez ${link.company.name}`,
    text: [
      "Bonjour,",
      "",
      `${link.company.name} a bien reçu votre commande ${link.order.reference}.`,
      "Suivez-la ici, sans créer de compte :",
      `${appBaseUrl()}/suivi/${link.token}`,
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    ].join("\n"),
    idempotencyKey: jobKey,
    replayWindowStart: replayWindow,
    freezeContent,
  });
  if (delivery.status === "disabled") {
    if (delivery.reason === "disabled") throw skippedJobError("GUEST_TRACKING_EMAIL_DISABLED");
    throw new Error("GUEST_TRACKING_EMAIL_NOT_CONFIGURED");
  }
  return delivery;
}

const confirmationDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

/**
 * MAIL-PONT, étape 5 : une seule confirmation par e-mail reçu, après la validation humaine, à l'expéditeur
 * d'origine. Envoyée par TutelLiv au nom de l'entreprise ; « répondre à » vers sa boîte de commandes.
 */
export async function deliverInboundOrderConfirmation(
  payload: unknown,
  jobKey: string,
  replayWindow: ReplayWindowStart,
  freezeContent: EmailContentFreezer
) {
  const data = payload as { linkIds?: unknown; replyTo?: unknown } | null;
  const linkIds = Array.isArray(data?.linkIds) ? data.linkIds.filter((id): id is string => typeof id === "string").slice(0, 10) : [];
  if (linkIds.length === 0) throw new Error("INBOUND_CONFIRMATION_PAYLOAD_INVALID");
  const links = await prisma.orderTrackingLink.findMany({
    where: { id: { in: linkIds }, revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: { token: true, guestEmail: true, order: { select: { reference: true, requestedDeliveryDate: true } }, company: { select: { name: true } } },
  });
  const recipient = links[0]?.guestEmail;
  if (!recipient) throw skippedJobError("INBOUND_CONFIRMATION_NO_RECIPIENT");
  const company = links[0]!.company.name;
  const replyTo = typeof data?.replyTo === "string" ? data.replyTo : null;
  const lines = links.flatMap((link) => [
    `Commande ${link.order.reference}${link.order.requestedDeliveryDate ? `, prévue ${confirmationDate.format(link.order.requestedDeliveryDate)}` : ""}.`,
    `Suivi : ${appBaseUrl()}/suivi/${link.token}`,
    "",
  ]);
  const delivery = await sendTransactionalEmail({
    to: recipient,
    replyTo,
    // Décision C14 (3 novembre 2026) : « Entreprise via TutelLiv », sans réglage chez le client.
    senderName: company,
    subject: links.length > 1
      ? `${company} confirme vos ${links.length} commandes`
      : `${company} confirme votre commande ${links[0]!.order.reference}`,
    text: [
      "Bonjour,",
      "",
      `${company} a bien reçu votre demande par e-mail et l'a enregistrée.`,
      "",
      ...lines,
      replyTo ? "Pour toute question, répondez simplement à cet e-mail." : "Pour toute question, contactez directement l'entreprise.",
      "",
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    ].join("\n"),
    idempotencyKey: jobKey,
    replayWindowStart: replayWindow,
    freezeContent,
  });
  if (delivery.status === "disabled") {
    if (delivery.reason === "disabled") throw skippedJobError("INBOUND_CONFIRMATION_EMAIL_DISABLED");
    throw new Error("INBOUND_CONFIRMATION_EMAIL_NOT_CONFIGURED");
  }
  return delivery;
}

/**
 * MAIL-PONT, étape 5 : liens de suivi des commandes créées depuis un e-mail, rattachés à l'expéditeur
 * d'origine (un lien déjà existant garde son destinataire). Commandes d'une autre entreprise ignorées.
 */
export async function trackingLinksForConfirmation(
  tx: Prisma.TransactionClient,
  companyId: string,
  orderIds: string[],
  recipient: string
) {
  const orders = await tx.order.findMany({ where: { id: { in: orderIds }, companyId }, select: { id: true }, orderBy: { createdAt: "asc" } });
  const links = [];
  for (const order of orders) {
    links.push(await tx.orderTrackingLink.upsert({
      where: { orderId: order.id },
      update: {},
      create: { token: newTrackingToken(), orderId: order.id, companyId, guestEmail: recipient },
      select: { id: true, guestEmail: true },
    }));
  }
  // Un lien créé auparavant sans destinataire (copié depuis le back-office) reçoit celui de l'e-mail.
  const missing = links.filter((link) => !link.guestEmail).map((link) => link.id);
  if (missing.length) await tx.orderTrackingLink.updateMany({ where: { id: { in: missing } }, data: { guestEmail: recipient } });
  return links.map((link) => link.id);
}

/** Vue minimale du suivi : ni nom de livreur, ni position, ni adresse complète, ni preuve. */
export async function getPublicTracking(token: string, now = new Date()) {
  if (!TOKEN.test(token)) return null;
  const link = await prisma.orderTrackingLink.findUnique({
    where: { token },
    select: {
      revokedAt: true,
      company: { select: { name: true } },
      order: {
        select: {
          reference: true, status: true, deliveryCategory: true, updatedAt: true, pickupCity: true, shippingCity: true,
          requestedDeliveryDate: true, deliverySlotStart: true,
          deliveries: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            take: 1,
            select: {
              estimatedArrival: true, completedAt: true,
              trackingEvents: { select: { id: true, label: true, description: true, occurredAt: true } },
            },
          },
        },
      },
    },
  });
  if (!link || link.revokedAt) return null;
  const { order } = link;
  if (TERMINAL_STATUSES.includes(order.status) && now.getTime() - order.updatedAt.getTime() > TRACKING_LINK_TTL_MS) return null;
  const delivery = order.deliveries[0];
  return {
    companyName: link.company.name,
    reference: order.reference,
    statusLabel: getFulfillmentStatusLabel(order.status, order.deliveryCategory),
    pickupCity: order.pickupCity,
    deliveryCity: order.shippingCity,
    requestedDeliveryDate: order.requestedDeliveryDate?.toISOString() ?? null,
    deliverySlotStart: order.deliverySlotStart?.toISOString() ?? null,
    estimatedArrival: delivery?.estimatedArrival?.toISOString() ?? null,
    completedAt: delivery?.completedAt?.toISOString() ?? null,
    steps: trackingTimeline(delivery?.trackingEvents ?? []).map(({ id, label, occurredAt }) => ({ id, label, occurredAt })),
  };
}

/** Lien de suivi d'une commande de l'entreprise, pour le copier depuis le back-office. */
export async function getOrCreateTrackingLink(companyId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, companyId }, select: { id: true } });
  if (!order) return null;
  const link = await prisma.orderTrackingLink.upsert({
    where: { orderId },
    update: {},
    create: { token: newTrackingToken(), orderId, companyId },
    select: { token: true },
  });
  return { url: `${appBaseUrl()}/suivi/${link.token}` };
}
