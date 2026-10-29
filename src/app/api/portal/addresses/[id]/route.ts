import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import {
  updateClientAddress,
  deleteClientAddress,
} from "@/domains/client-portal/address.service";
import { customerAddressSchema } from "@/lib/validations/address";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = customerAddressSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides" },
      { status: 400 }
    );
  }

  const updated = await updateClientAddress(auth.context.user.id, id, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Adresse introuvable" }, { status: 404 });
  }

  return NextResponse.json({ data: updated, success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireClientRole();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const deleted = await deleteClientAddress(auth.context.user.id, id);

  if (!deleted) {
    return NextResponse.json({ error: "Adresse introuvable" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
