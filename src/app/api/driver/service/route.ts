import { NextResponse } from "next/server";
import { z } from "zod";
import { requireDriverRole } from "@/lib/api/auth-guard";
import { OrderAccessError } from "@/domains/order/order-access";
import { getDriverService, setDriverService } from "@/domains/tracking/tracking.service";
async function handle(request?: Request) {
  const auth = await requireDriverRole(); if ("error" in auth) return auth.error;
  const { id, companyId } = auth.context.user;
  if (!companyId) return NextResponse.json({ error: "Entreprise non associée." }, { status: 403 });
  try {
    if (!request) return NextResponse.json({ data: await getDriverService(id, companyId), success: true }, { headers: { "Cache-Control": "private, no-store" } });
    const input = z.object({ active: z.boolean() }).strict().safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: "État de service invalide." }, { status: 400 });
    return NextResponse.json({ data: await setDriverService(id, companyId, input.data.active), success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof OrderAccessError ? error.message : "Service momentanément indisponible." }, { status: error instanceof OrderAccessError ? error.status : 500 }); }
}
export async function GET() { return handle(); }
export async function POST(request: Request) { return handle(request); }
