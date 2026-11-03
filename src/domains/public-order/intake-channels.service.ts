import { randomBytes } from "node:crypto";
import { prisma } from "@/services/prisma/client";

type ChannelDb = Pick<typeof prisma, "companyIntakeChannel">;

/** Domaine de réception, ex. commandes.tutelliv.fr ; sans lui, aucune adresse n'est proposée. */
export function inboundEmailDomain(env: Record<string, string | undefined> = process.env) {
  return env.INBOUND_EMAIL_DOMAIN?.trim().toLowerCase() || null;
}

export function isInboundEmailConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(inboundEmailDomain(env) && env.RESEND_INBOUND_WEBHOOK_SECRET?.trim() && env.RESEND_API_KEY?.trim());
}

const newOrderLinkToken = () => randomBytes(24).toString("base64url");
/** Minuscules et chiffres seulement : la partie locale d'une adresse e-mail n'a pas de casse sûre. */
const newInboundToken = () => randomBytes(16).toString("hex");

export function appBaseUrl(env: Record<string, string | undefined> = process.env) {
  return env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "";
}

export async function getIntakeChannels(companyId: string, db: ChannelDb = prisma) {
  const channel = await db.companyIntakeChannel.findUnique({ where: { companyId } });
  const domain = inboundEmailDomain();
  return {
    orderLink: {
      enabled: channel?.orderLinkEnabled ?? false,
      url: channel?.orderLinkToken ? `${appBaseUrl()}/commander/${channel.orderLinkToken}` : null,
    },
    inboundEmail: {
      enabled: channel?.inboundEmailEnabled ?? false,
      configured: isInboundEmailConfigured(),
      address: channel?.inboundEmailToken && domain ? `${channel.inboundEmailToken}@${domain}` : null,
      mailbox: channel?.orderMailboxAddress ?? null,
    },
  };
}

export type IntakeChannelAction =
  | { channel: "orderLink" | "inboundEmail"; enabled: boolean }
  | { channel: "orderLink" | "inboundEmail"; rotate: true }
  | { channel: "inboundEmail"; mailbox: string | null };

/** Activer crée le jeton au besoin ; le renouveler rend l'ancien lien ou l'ancienne adresse inopérants. */
export async function updateIntakeChannel(companyId: string, action: IntakeChannelAction, db: ChannelDb = prisma) {
  if ("mailbox" in action) {
    const orderMailboxAddress = action.mailbox?.trim().toLowerCase() || null;
    await db.companyIntakeChannel.upsert({ where: { companyId }, update: { orderMailboxAddress }, create: { companyId, orderMailboxAddress } });
    return getIntakeChannels(companyId, db);
  }
  const current = await db.companyIntakeChannel.findUnique({ where: { companyId } });
  const rotate = "rotate" in action;
  const data = action.channel === "orderLink"
    ? {
        orderLinkToken: rotate || !current?.orderLinkToken ? newOrderLinkToken() : current.orderLinkToken,
        ...("enabled" in action ? { orderLinkEnabled: action.enabled } : {}),
      }
    : {
        inboundEmailToken: rotate || !current?.inboundEmailToken ? newInboundToken() : current.inboundEmailToken,
        ...("enabled" in action ? { inboundEmailEnabled: action.enabled } : {}),
      };
  await db.companyIntakeChannel.upsert({ where: { companyId }, update: data, create: { companyId, ...data } });
  return getIntakeChannels(companyId, db);
}
