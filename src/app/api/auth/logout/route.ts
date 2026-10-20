import { NextResponse } from "next/server";
import { getDemoBaseAuthUser } from "@/domains/demo/demo-auth.service";
import { getDemoSessionCompanyId } from "@/domains/demo/demo-session.service";
import {
  cleanupDemoSessionOnLogout,
  DEMO_LOGOUT_CLEANUP_AUTHORIZATION,
} from "@/domains/data-lifecycle/demo-cleanup.service";
import {
  clearDemoPersonaCookie,
  clearDemoSessionCookie,
} from "@/lib/demo/persona-cookie";

export async function POST() {
  try {
    const baseUser = await getDemoBaseAuthUser();
    if (!baseUser) return new NextResponse(null, { status: 204 });

    const companyId = await getDemoSessionCompanyId();
    if (!companyId) return new NextResponse(null, { status: 204 });

    const result = await cleanupDemoSessionOnLogout(companyId, {
      authorization: DEMO_LOGOUT_CLEANUP_AUTHORIZATION,
    });
    if (result.status !== "deleted" && result.status !== "missing") {
      console.error("Demo logout cleanup blocked:", result.reason ?? result.status);
      return NextResponse.json({ error: "Nettoyage de la démo différé" }, { status: 503 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Demo logout cleanup failed:", error);
    return NextResponse.json({ error: "Nettoyage de la démo différé" }, { status: 503 });
  } finally {
    await clearDemoPersonaCookie();
    await clearDemoSessionCookie();
  }
}
