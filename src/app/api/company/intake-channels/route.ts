import { NextResponse } from "next/server";
import { z } from "zod";
import { getCompanyId, requireRole, requireStaffRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { getIntakeChannels, updateIntakeChannel } from "@/domains/public-order/intake-channels.service";
import { listForwardingConfirmations } from "@/domains/order-intake/inbound-email.service";

const channel = z.enum(["orderLink", "inboundEmail"]);
const actionSchema = z.union([
  z.object({ channel, enabled: z.boolean() }).strict(),
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
    const [channels, gmailConfirmations] = await Promise.all([getIntakeChannels(companyId), listForwardingConfirmations(companyId)]);
    return NextResponse.json({ success: true, data: { ...channels, gmailConfirmations } });
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
    const [channels, gmailConfirmations] = await Promise.all([updateIntakeChannel(companyId, parsed.data), listForwardingConfirmations(companyId)]);
    return NextResponse.json({ success: true, data: { ...channels, gmailConfirmations } });
  });
}
