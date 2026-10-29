import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth-guard";
import { updateProfileSchema } from "@/lib/validations/user";
import { updateUserProfile } from "@/domains/user/user.service";
import { getUserPermissions } from "@/domains/user/user.service";

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const body = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateUserProfile(auth.context.user.id, parsed.data);
  const permissions = await getUserPermissions(auth.context.authId);

  const { role, ...rest } = updated;

  return NextResponse.json({
    data: {
      ...rest,
      role: {
        ...role,
        permissions: role.permissions.map((rp) => rp.permission),
      },
    },
    permissions,
    success: true,
  });
}
