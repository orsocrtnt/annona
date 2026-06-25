import { NextResponse } from "next/server";
import { searchBanAddresses } from "@/lib/addresses/ban-search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 3) {
    return NextResponse.json({ data: [], success: true });
  }

  try {
    const suggestions = await searchBanAddresses(q);
    return NextResponse.json({ data: suggestions, success: true });
  } catch {
    return NextResponse.json(
      { error: "Impossible de rechercher cette adresse" },
      { status: 502 }
    );
  }
}
