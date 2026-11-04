import { NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getIntakeChannels, updateIntakeChannel } from "@/domains/public-order/intake-channels.service";
import { listForwardingConfirmations } from "@/domains/order-intake/inbound-email.service";
import { listWhatsAppTeam } from "@/domains/order-intake/whatsapp.service";
import { companyHasSaasFeature } from "@/domains/saas/saas.service";
import { CONFIG_MESSAGES } from "@/lib/config-messages";

const channel = z.enum(["orderLink", "inboundEmail"]);
const actionSchema = z.union([
  z.object({ channel: z.enum(["orderLink", "inboundEmail", "whatsapp"]), enabled: z.boolean() }).strict(),
  z.object({ channel, rotate: z.literal(true) }).strict(),
  z.object({ channel: z.literal("inboundEmail"), mailbox: z.string().trim().max(200).email().nullable() }).strict(),
]);

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("settings:update");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    const [channels, gmailConfirmations, whatsappTeam, automationIncluded] = await Promise.all([
      getIntakeChannels(companyId), listForwardingConfirmations(companyId), listWhatsAppTeam(companyId),
      companyHasSaasFeature(companyId, "order_automation"),
    ]);
    return NextResponse.json({ success: true, data: { ...channels, gmailConfirmations, whatsappTeam, automationIncluded } });
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireStaffRole("settings:update");
    if ("error" in auth) return auth.error;
    const denied = requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN"]);
    if (denied) return denied;
    const companyId = getCompanyId(auth.context);
    if (!companyId) return NextResponse.json({ error: "Entreprise non associée" }, { status: 400 });
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Réglage invalide" }, { status: 400 });
    // OFFER-1 : e-mails renvoyés et WhatsApp exigent l'option pour être activés ; le lien de commande reste au socle.
    const automationIncluded = await companyHasSaasFeature(companyId, "order_automation");
    const action = parsed.data;
    if ("enabled" in action && action.enabled && action.channel !== "orderLink" && !automationIncluded) {
      return NextResponse.json({ error: CONFIG_MESSAGES.ORDER_AUTOMATION_NOT_INCLUDED, code: "SAAS_FEATURE_NOT_AVAILABLE" }, { status: 403 });
    }
    const [channels, gmailConfirmations, whatsappTeam] = await Promise.all([
      updateIntakeChannel(companyId, action), listForwardingConfirmations(companyId), listWhatsAppTeam(companyId),
    ]);
    return NextResponse.json({ success: true, data: { ...channels, gmailConfirmations, whatsappTeam, automationIncluded } });
  });
}
