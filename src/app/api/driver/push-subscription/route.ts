import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { zodIssueMessage } from "@/lib/config-messages";
import { driverPushSubscriptionSchema, driverPushUnsubscribeSchema } from "@/lib/validations/driver-push";
import { removeDriverPushSubscription, saveDriverPushSubscription } from "@/domains/driver/driver-push.service";

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireDriverRole();
    if ("error" in auth) return auth.error;
    const companyId = auth.context.user.companyId;
    if (!companyId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const parsed = driverPushSubscriptionSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: zodIssueMessage(parsed.error, "Données invalides") }, { status: 400 });
    }
    await saveDriverPushSubscription({ id: auth.context.user.id, companyId }, parsed.data);
    return NextResponse.json({ success: true });
  });
}

export async function DELETE(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireDriverRole();
    if ("error" in auth) return auth.error;

    const parsed = driverPushUnsubscribeSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: zodIssueMessage(parsed.error, "Données invalides") }, { status: 400 });
    }
    await removeDriverPushSubscription(auth.context.user.id, parsed.data.endpoint);
    return NextResponse.json({ success: true });
  });
}
