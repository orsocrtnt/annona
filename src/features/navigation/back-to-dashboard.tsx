"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * RETOURS-3 (notes du tour 2 de Théo, 24 novembre 2026) : sur les pages du gérant ouvertes depuis le tableau de bord
 * (cartes et boutons cliquables), une flèche en haut à gauche ramène au tableau de bord, aussi sur téléphone où le
 * menu est replié.
 */
export function shouldShowBackToDashboard(role: string | undefined, pathname: string): boolean {
  if (role !== "ADMIN") return false;
  if (pathname === "/dashboard") return false;
  return pathname.startsWith("/dashboard/") || ["/support", "/users", "/settings"].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function BackToDashboard() {
  return (
    <Link
      href="/dashboard"
      className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg pr-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="back-to-dashboard"
    >
      <ArrowLeft className="h-5 w-5" aria-hidden />
      Tableau de bord
    </Link>
  );
}
