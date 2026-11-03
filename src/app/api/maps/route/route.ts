import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api/auth-guard";
import { readJsonBody, withApiHandler } from "@/lib/api/route-handler";
import { MAX_ROUTE_WAYPOINTS } from "@/lib/maps/navigation-route";
import { fetchServerNavigationRoute } from "@/lib/maps/server-navigation-route";
import { isOverRequestLimit } from "@/lib/security/request-limit";

const bodySchema = z.object({
  waypoints: z.array(z.object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }).strict()).min(2).max(MAX_ROUTE_WAYPOINTS),
}).strict();

/** Navigation toutes les 30 s et cartes du dispatch : 180 calculs par quart d'heure et par compte suffisent. */
const ROUTE_LIMIT_PER_WINDOW = 180;

/** Itinéraire calculé côté serveur (LEGAL-1) : réservé aux comptes connectés, rien n'est conservé. */
export async function POST(request: Request) {
  return withApiHandler(async () => {
    const auth = await requireAuth();
    if ("error" in auth) return auth.error;
    const parsed = bodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return NextResponse.json({ error: "Itinéraire invalide." }, { status: 400 });
    if (await isOverRequestLimit("map-route-user", auth.context.user.id, ROUTE_LIMIT_PER_WINDOW)) {
      return NextResponse.json({ error: "Trop de calculs d'itinéraire. Réessayez dans quelques minutes." }, { status: 429 });
    }
    const route = await fetchServerNavigationRoute(parsed.data.waypoints);
    if (!route) return NextResponse.json({ error: "Itinéraire indisponible." }, { status: 503 });
    return NextResponse.json({ success: true, data: route }, { headers: { "Cache-Control": "no-store" } });
  });
}
