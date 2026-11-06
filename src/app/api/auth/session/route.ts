import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/api/server-auth";

export async function GET() {
  try {
    const auth = await getServerAuth();

    if (!auth) {
      return NextResponse.json({ user: null, permissions: [] });
    }

    return NextResponse.json({
      user: auth.user,
      permissions: auth.permissions,
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la session" },
      { status: 500 }
    );
  }
}
