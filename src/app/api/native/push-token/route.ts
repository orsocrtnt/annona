import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth-guard";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { zodIssueMessage } from "@/lib/config-messages";
import { nativePushTokenSchema } from "@/lib/validations/native-push";
import { saveDriverPushSubscription } from "@/domains/driver/driver-push.service";
import { nativeSubscription, removeNativePushToken } from "@/domains/notification/native-push.service";

/** MOBILE-1 : seuls les espaces des applications (client et livreur) reçoivent des notifications natives. */
const NATIVE_APP_ROLES = new Set(["MERCHANT", "DRIVER"]);

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const { user } = auth.context;
    if (!NATIVE_APP_ROLES.has(user.role.systemRole) || !user.companyId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const parsed = nativePushTokenSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: zodIssueMessage(parsed.error, "Données invalides") }, { status: 400 });
    }
    await saveDriverPushSubscription({ id: user.id, companyId: user.companyId }, nativeSubscription(parsed.data));
    return NextResponse.json({ success: true });
  });
}

/** À la déconnexion : le téléphone ne sonne plus pour ce compte (seul son propre jeton est retiré). */
export async function DELETE(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;

    const parsed = nativePushTokenSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return NextResponse.json({ error: zodIssueMessage(parsed.error, "Données invalides") }, { status: 400 });
    }
    await removeNativePushToken(auth.context.user.id, parsed.data);
    return NextResponse.json({ success: true });
  });
}
