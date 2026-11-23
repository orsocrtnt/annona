"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import type { DemoPersona } from "@/domains/demo/demo-scenario";
import { DEMO_PERSONA_LABELS, DEMO_PERSONA_ORDER, isDemoCompanyId } from "@/lib/demo/demo-constants";

const SPACE_PREFIX: Record<DemoPersona, string> = { client: "/portal", admin: "/dashboard", baker: "/bakery", driver: "/driver" };

/**
 * DEMO-1 : bandeau des comptes de démo — « Démo · changer d'espace · quitter ». Invisible pour un vrai compte.
 */
export function DemoBar() {
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!isDemoCompanyId(user?.companyId)) return null;

  async function switchTo(persona: DemoPersona) {
    setBusy(persona);
    setError(null);
    const response = await fetch("/api/demo/persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona }),
    }).catch(() => null);
    const data = (await response?.json().catch(() => ({}))) as { redirectTo?: string; error?: string } | undefined;
    if (response?.ok && data?.redirectTo) {
      window.location.assign(data.redirectTo);
      return;
    }
    setError(data?.error ?? "L'espace n'a pas pu s'ouvrir.");
    setBusy(null);
  }

  async function leave() {
    setBusy("leave");
    await fetch("/api/demo/leave", { method: "POST" }).catch(() => null);
    window.location.assign("/demo");
  }

  return (
    <div className="sticky top-0 z-50 bg-[#0d0d12] text-white" role="region" aria-label="Démo">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-sm">
        <span className="rounded-full bg-[#ffd60a] px-2.5 py-0.5 text-xs font-bold text-[#0d0d12] dark:bg-[#ffd60a]">Démo</span>
        <span className="hidden text-white/70 sm:inline">Rien n&apos;est envoyé.</span>
        <nav aria-label="Changer d'espace" className="flex flex-wrap items-center gap-1">
          {DEMO_PERSONA_ORDER.map((persona) => {
            const current = pathname.startsWith(SPACE_PREFIX[persona]);
            return (
              <button
                key={persona}
                type="button"
                onClick={() => switchTo(persona)}
                disabled={busy !== null || current}
                aria-current={current ? "page" : undefined}
                className="min-h-9 rounded-full px-3 font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd60a] aria-[current=page]:bg-white/15 aria-[current=page]:text-white disabled:cursor-default max-md:min-h-11"
              >
                {busy === persona ? "Ouverture…" : DEMO_PERSONA_LABELS[persona].title}
              </button>
            );
          })}
        </nav>
        {error && (
          <span role="alert" className="text-[#ff8589]">
            {error}
          </span>
        )}
        <button
          type="button"
          onClick={leave}
          disabled={busy !== null}
          className="ml-auto min-h-9 rounded-full border border-white/30 px-3 font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd60a] max-md:min-h-11"
        >
          {busy === "leave" ? "Fermeture…" : "Quitter la démo"}
        </button>
      </div>
    </div>
  );
}
