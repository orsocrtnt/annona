import { NextResponse } from "next/server";
import { z } from "zod";
import { listClientNotifications, markClientNotificationsRead } from "@/domains/client-portal/notify.service";
import { requireAuth } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";

const markReadSchema = z.object({ ids: z.array(z.string().min(1).max(100)).max(500).optional() }).strict();

/**
 * Lot 2, demande 6 : cloche du back-office (administrateur, pâtissier, boulanger…) : ses propres notifications,
 * comme la cloche du portail client. Toujours celles du compte connecté.
 */
export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    return NextResponse.json({ data: await listClientNotifications(auth.context.user.id), success: true });
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const parsed = markReadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Requête de lecture des notifications invalide." }, { status: 400 });
    await markClientNotificationsRead(auth.context.user.id, parsed.data.ids);
    return NextResponse.json({ data: await listClientNotifications(auth.context.user.id), success: true });
  });
}
