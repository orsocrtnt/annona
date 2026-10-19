import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import {
  getClientSettings,
  updateClientSettings,
} from "@/domains/client-portal/settings.service";
import { clientSettingsSchema } from "@/lib/validations/settings";
import {
  getEmailDeliveryConfigured,
  getEmailDeliveryMode,
} from "@/domains/client-portal/notify.service";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const settings = await getClientSettings(auth.context.user.id);
    return NextResponse.json({
      data: {
        ...settings,
        emailConfigured: getEmailDeliveryConfigured(),
        emailMode: getEmailDeliveryMode(),
      },
      success: true,
    });
  });
}

export async function PATCH(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const parsed = clientSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const settings = await updateClientSettings(auth.context.user.id, parsed.data);
    return NextResponse.json({
      data: {
        ...settings,
        emailConfigured: getEmailDeliveryConfigured(),
        emailMode: getEmailDeliveryMode(),
      },
      success: true,
    });
  });
}
