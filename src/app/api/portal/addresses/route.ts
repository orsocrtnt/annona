import { NextResponse } from "next/server";
import { requireClientRole } from "@/lib/api/auth-guard";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import {
  getClientAddresses,
  createClientAddress,
} from "@/domains/client-portal/address.service";
import { customerAddressSchema } from "@/lib/validations/address";

export async function GET() {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const addresses = await getClientAddresses(auth.context.user.id);
    return NextResponse.json({ data: addresses, success: true });
  });
}

export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireClientRole();
    if ("error" in auth) return auth.error;

    const body = await readJsonBody(request);
    const parsed = customerAddressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const address = await createClientAddress(auth.context.user.id, parsed.data);
    return NextResponse.json({ data: address, success: true }, { status: 201 });
  });
}
