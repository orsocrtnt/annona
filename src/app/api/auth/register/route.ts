import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Utilisez le parcours d'inscription sécurisé." },
    { status: 410, headers: { "Cache-Control": "no-store", Location: "/register" } }
  );
}
