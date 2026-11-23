"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import type { DemoPersona } from "@/domains/demo/demo-scenario";
import { DEMO_PERSONA_LABELS, DEMO_PERSONA_ORDER, isDemoCompanyId } from "@/lib/demo/demo-constants";

const SPACE_PREFIX: Record<DemoPersona, string> = { client: "/portal", admin: "/dashboard", baker: "/bakery", driver: "/driver" };

/**
 * DEMO-1 : pastille flottante des comptes de démo — « Démo · changer d'espace · quitter », en bas au centre pour ne
 * recouvrir ni la barre latérale ni les en-têtes fixes. Invisible pour un vrai compte.
 */
export function DemoBar() {
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
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

  const currentPersona = DEMO_PERSONA_ORDER.find((persona) => pathname.startsWith(SPACE_PREFIX[persona]));

  return (
    <div
      role="region"
      aria-label="Démo"
      className="fixed bottom-4 left-1/2 z-[60] w-max max-w-[calc(100vw-24px)] -translate-x-1/2 max-md:bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]"
    >
      {open && (
        <nav
          id="demo-spaces"
          aria-label="Changer d'espace"
          className="mb-2 flex flex-col gap-1 rounded-2xl bg-[#0d0d12] p-2 text-sm text-white shadow-lg"
        >
          {DEMO_PERSONA_ORDER.map((persona) => {
            const current = persona === currentPersona;
            return (
              <button
                key={persona}
                type="button"
                onClick={() => switchTo(persona)}
                disabled={busy !== null || current}
                aria-current={current ? "page" : undefined}
                className="min-h-11 rounded-xl px-3 text-left font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd60a] aria-[current=page]:bg-white/15 aria-[current=page]:text-white disabled:cursor-default"
              >
                {busy === persona ? "Ouverture…" : DEMO_PERSONA_LABELS[persona].title}
              </button>
            );
          })}
        </nav>
      )}
      <div className="flex items-center gap-1 rounded-full bg-[#0d0d12] p-1 pl-1.5 text-sm text-white shadow-lg">
        <span className="rounded-full bg-[#ffd60a] px-2.5 py-1 text-xs font-bold text-[#0d0d12] dark:bg-[#ffd60a]">Démo</span>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="demo-spaces"
          className="min-h-10 rounded-full px-3 font-medium hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd60a] max-md:min-h-11"
        >
          {currentPersona ? DEMO_PERSONA_LABELS[currentPersona].title : "Espaces"} · changer
        </button>
        <button
          type="button"
          onClick={leave}
          disabled={busy !== null}
          className="min-h-10 rounded-full px-3 font-medium text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd60a] max-md:min-h-11"
        >
          {busy === "leave" ? "Fermeture…" : "Quitter"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-[#0d0d12] px-3 py-2 text-center text-sm text-[#ff8589]">
          {error}
        </p>
      )}
    </div>
  );
}
