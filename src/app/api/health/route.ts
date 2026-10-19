import { NextResponse } from "next/server";
import { getServiceHealth } from "@/domains/operations/service-health.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  const healthSecret = process.env.OPS_HEALTH_SECRET;
  const deep = new URL(request.url).searchParams.get("deep") === "1";

  if (!deep) {
    return NextResponse.json({ status: "ok", service: "tutelliv" });
  }
  if (!healthSecret || authorization !== `Bearer ${healthSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const result = await getServiceHealth();
  return NextResponse.json(result, { status: result.status === "ok" ? 200 : 503 });
}
