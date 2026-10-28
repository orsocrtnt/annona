import { NextResponse } from "next/server";
import { z } from "zod";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import {
  listClientNotifications,
  markClientNotificationsRead,
} from "@/domains/client-portal/notify.service";

const markReadSchema = z.object({ ids: z.array(z.string().min(1).max(100)).max(500).optional() }).strict();

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const notifications = await listClientNotifications(auth.context.user.id);
    return NextResponse.json({ data: notifications, success: true });
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const parsed = markReadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Requête de lecture des notifications invalide." }, { status: 400 });
    }
    await markClientNotificationsRead(auth.context.user.id, parsed.data.ids);
    const notifications = await listClientNotifications(auth.context.user.id);
    return NextResponse.json({ data: notifications, success: true });
  });
}
