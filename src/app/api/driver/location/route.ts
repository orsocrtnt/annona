import { NextResponse } from "next/server";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { withApiHandler } from "@/lib/api/route-handler";
import { upsertDriverLocation } from "@/domains/driver/driver-location.service";
import { updateDriverLocationSchema } from "@/lib/validations/driver-location";

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireDriverRole();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const parsed = updateDriverLocationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Données invalides" },
        { status: 400 }
      );
    }

    const location = await upsertDriverLocation(auth.context.user.id, parsed.data);
    return NextResponse.json({
      data: { updatedAt: location.updatedAt.toISOString() },
      success: true,
    });
  });
}
