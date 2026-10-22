import { after, NextResponse } from "next/server";
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
import {
  recycleDemoPoolEnvironment,
  requestDemoPoolRecycle,
} from "@/domains/demo/demo-pool.service";

export async function POST() {
  try {
    const companyId = await getDemoSessionCompanyId();
    if (!companyId) return new NextResponse(null, { status: 204 });

    // La réponse n'attend jamais la reconstruction du scénario. L'état
    // RECYCLING persiste en base ; `after` accélère le traitement, et un worker
    // ultérieur peut le reprendre après une interruption de fonction.
    if (await requestDemoPoolRecycle(companyId)) {
      after(async () => {
        try {
          const result = await recycleDemoPoolEnvironment(companyId);
          if (result.status !== "recycled" && result.status !== "ready") {
            console.error("Demo pool recycle deferred:", result.reason ?? result.status);
          }
        } catch (error) {
          console.error("Demo pool recycle failed:", error);
        }
      });
      return new NextResponse(null, { status: 204 });
    }

    // Compatibilité des anciennes sessions DEMO-1 non issues du pool.
    const baseUser = await getDemoBaseAuthUser();
    if (!baseUser) return new NextResponse(null, { status: 204 });
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
