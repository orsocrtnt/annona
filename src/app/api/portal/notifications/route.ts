import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import {
  listClientNotifications,
  markClientNotificationsRead,
} from "@/domains/client-portal/notify.service";

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

    const body = (await request.json().catch(() => null)) as { ids?: string[] } | null;
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id) => typeof id === "string") : undefined;
    await markClientNotificationsRead(auth.context.user.id, ids);
    const notifications = await listClientNotifications(auth.context.user.id);
    return NextResponse.json({ data: notifications, success: true });
  });
}
