import { zodIssueMessage } from "@/lib/config-messages";
import { ConversationError } from "@/domains/order-conversation/order-conversation.service";
import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { upsertDriverLocation } from "@/domains/driver/driver-location.service";
import { updateDriverLocationSchema } from "@/lib/validations/driver-location";

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireDriverRole();
    if ("error" in auth) return auth.error;

    const body = await readJsonBody(request);
    const parsed = updateDriverLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodIssueMessage(parsed.error, "Données invalides") },
        { status: 400 }
      );
    }

    let location;
    try { location = await upsertDriverLocation(auth.context.user.id, auth.context.user.companyId ?? "", parsed.data); }
    catch (error) { if (error instanceof ConversationError) return NextResponse.json({ error: error.message }, { status: error.status }); throw error; }
    return NextResponse.json({
      data: { updatedAt: location.updatedAt.toISOString() },
      success: true,
    });
  });
}
