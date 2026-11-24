"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DemoPersona } from "@/domains/demo/demo-scenario";
import { DEMO_PERSONA_LABELS, DEMO_PERSONA_ORDER } from "@/lib/demo/demo-constants";

type Phase = "idle" | "preparing" | "opening";

async function post(path: string, body?: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string; redirectTo?: string };
  if (!response.ok) throw new Error(data.error ?? "La démo ne répond pas. Réessayez.");
  return data;
}

/**
 * DEMO-1 : le visiteur choisit l'espace à essayer ; au premier choix, sa boulangerie de démo est préparée
 * (journée remise à l'heure du moment), puis l'espace s'ouvre sans identifiants.
 */
export function DemoLauncher() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [chosen, setChosen] = useState<DemoPersona | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(persona: DemoPersona) {
    setChosen(persona);
    setError(null);
    try {
      setPhase("preparing");
      await post("/api/demo/start");
      setPhase("opening");
      const { redirectTo } = await post("/api/demo/persona", { persona });
      window.location.assign(redirectTo ?? "/dashboard");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "La démo ne répond pas. Réessayez.");
      setPhase("idle");
      setChosen(null);
    }
  }

  const busy = phase !== "idle";

  return (
    <div className="w-full max-w-[560px] animate-slide-up motion-reduce:animate-none">
      <h1 className="text-center text-4xl font-bold">Essayer Annona</h1>
      <p className="mx-auto mt-3 max-w-[440px] text-center text-base text-text-secondary">
        Une boulangerie fictive, sa journée de livraisons remise à l&apos;heure. Rien n&apos;est envoyé : ni e-mail, ni
        notification. Votre démo reste à vous jusqu&apos;à votre déconnexion, 4 heures au plus.
      </p>

      <ul className="mt-8 grid gap-3" aria-label="Espaces à essayer">
        {DEMO_PERSONA_ORDER.map((persona) => {
          const label = DEMO_PERSONA_LABELS[persona];
          const loading = busy && chosen === persona;
          return (
            <li key={persona}>
              <button
                type="button"
                onClick={() => open(persona)}
                disabled={busy}
                aria-busy={loading}
                className="group flex min-h-[76px] w-full items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 text-left transition-colors hover:border-foreground/30 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-60"
              >
                <span className="flex flex-col gap-1">
                  <span className="text-lg font-semibold">{label.title}</span>
                  <span className="text-sm text-text-secondary">{label.description}</span>
                </span>
                {loading ? (
                  <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 min-h-6 text-center text-sm text-text-secondary" role="status" aria-live="polite">
        {phase === "preparing" && "Préparation de votre boulangerie de démo… (quelques secondes)"}
        {phase === "opening" && "Ouverture de l'espace…"}
      </p>
      {error && (
        <p className="mt-2 text-center text-sm font-medium text-error" role="alert">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-center">
        <Button asChild variant="ghost" size="sm">
          <a href="/login">J&apos;ai déjà un compte</a>
        </Button>
      </div>
    </div>
  );
}
