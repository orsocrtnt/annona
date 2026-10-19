"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Truck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth.store";
import {
  DEMO_PERSONA_LABELS,
  type DemoPersona,
} from "@/lib/demo/constants";

const DEMO_BANNER_APP_PREFIXES = [
  "/admin",
  "/dashboard",
  "/dispatch",
  "/driver",
  "/portal",
  "/settings",
  "/users",
  "/companies",
] as const;

const PERSONA_ICONS: Record<DemoPersona, typeof Building2> = {
  admin: Building2,
  client: UserRound,
  driver: Truck,
};

const COLLAPSED_STORAGE_KEY = "tutelliv-demo-bar-collapsed";

function isDemoAppArea(pathname: string): boolean {
  return DEMO_BANNER_APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function DemoModeBar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { demo, setUser, setPermissions, setDemo } = useAuthStore();
  const [switching, setSwitching] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const visible = Boolean(demo?.isDemo) && isDemoAppArea(pathname);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const persistCollapsed = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const root = document.documentElement;
    const applyHeight = () => {
      const height = collapsed ? 0 : (barRef.current?.offsetHeight ?? 0);
      root.style.setProperty("--demo-banner-height", `${height}px`);
      if (height > 0) root.setAttribute("data-demo-banner", "");
      else root.removeAttribute("data-demo-banner");
    };
    applyHeight();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(applyHeight);
    if (!collapsed && barRef.current) observer?.observe(barRef.current);
    return () => {
      observer?.disconnect();
      root.style.removeProperty("--demo-banner-height");
      root.removeAttribute("data-demo-banner");
    };
  }, [visible, collapsed, hydrated]);

  const switchPersona = useCallback(
    async (persona: DemoPersona) => {
      if (!demo || persona === demo.persona) return;
      setSwitching(true);
      try {
        const res = await fetch("/api/demo/persona", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ persona }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Impossible de changer de vue");
        }
        setUser(json.user);
        setPermissions(json.permissions ?? []);
        setDemo(json.demo ?? null);
        await queryClient.clear();
        queryClient.setQueryData(["session"], {
          user: json.user,
          permissions: json.permissions ?? [],
          demo: json.demo ?? null,
        });
        router.push(json.redirectTo);
        toast.success(`Vue ${DEMO_PERSONA_LABELS[persona]} activée`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur de changement de vue");
      } finally {
        setSwitching(false);
      }
    },
    [demo, queryClient, router, setDemo, setPermissions, setUser]
  );

  const resetDemo = useCallback(async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Impossible de réinitialiser la démo");
      }
      setUser(json.user);
      setPermissions(json.permissions ?? []);
      setDemo(json.demo ?? null);
      await queryClient.clear();
      queryClient.setQueryData(["session"], {
        user: json.user,
        permissions: json.permissions ?? [],
        demo: json.demo ?? null,
      });
      setResetOpen(false);
      router.push(json.redirectTo ?? "/dashboard");
      toast.success("Démo réinitialisée — scénario de base restauré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la réinitialisation");
    } finally {
      setResetting(false);
    }
  }, [queryClient, router, setDemo, setPermissions, setUser]);

  if (!visible || !demo || !hydrated) return null;

  const ActiveIcon = PERSONA_ICONS[demo.persona];

  return (
    <>
      {collapsed ? (
        <button
          type="button"
          onClick={() => persistCollapsed(false)}
          className="fixed left-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[2000] flex items-center gap-1.5 rounded-r-xl border border-l-0 border-amber-200/80 bg-amber-50/95 px-1.5 py-3 shadow-md backdrop-blur-md transition-colors hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/90 dark:hover:bg-amber-900"
          aria-label="Afficher la barre de démonstration"
          title="Afficher la barre de démonstration"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-[11px] font-medium tracking-wide text-amber-950 [writing-mode:vertical-rl] rotate-180 dark:text-amber-100">
            Démo
          </span>
        </button>
      ) : (
        <>
          <div
            ref={barRef}
            role="region"
            aria-label="Environnement de démonstration"
            className="fixed inset-x-0 top-0 z-[2000] border-b border-amber-200/80 bg-amber-50/95 px-3 py-2 backdrop-blur-md dark:border-amber-900/50 dark:bg-amber-950/90"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2 text-sm text-amber-950 dark:text-amber-100">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span className="font-medium">Environnement de démonstration</span>
                <span className="hidden text-amber-800/80 sm:inline dark:text-amber-200/80">
                  — données fictives dans votre session isolée
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <ActiveIcon className="hidden h-4 w-4 text-amber-700 sm:block dark:text-amber-300" />
                  <Select
                    value={demo.persona}
                    onValueChange={(value) => void switchPersona(value as DemoPersona)}
                    disabled={switching || resetting}
                  >
                    <SelectTrigger aria-label="Changer de vue de démonstration" className="h-9 w-[min(180px,calc(100vw-1.5rem))] border-amber-200 bg-white/90 dark:border-amber-800 dark:bg-amber-950">
                      <SelectValue placeholder="Changer de vue" />
                    </SelectTrigger>
                    <SelectContent className="z-[2100]">
                      {(Object.keys(DEMO_PERSONA_LABELS) as DemoPersona[]).map((persona) => {
                        const Icon = PERSONA_ICONS[persona];
                        return (
                          <SelectItem key={persona} value={persona}>
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {DEMO_PERSONA_LABELS[persona]}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-amber-300 bg-white/90 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900"
                  onClick={() => setResetOpen(true)}
                  disabled={switching || resetting}
                >
                  <RotateCcw className="h-4 w-4" />
                  Réinitialiser la démo
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900"
                  onClick={() => persistCollapsed(true)}
                  aria-label="Réduire la barre de démonstration"
                  title="Réduire sur le côté"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Réduire</span>
                </Button>
              </div>
            </div>
          </div>
          <div className="shrink-0" style={{ height: "var(--demo-banner-height, 0px)" }} aria-hidden />
        </>
      )}

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser la démonstration ?</DialogTitle>
            <DialogDescription>
              Seules les commandes, livraisons, factures et tickets de votre session seront
              supprimés. Les autres démonstrations ne seront pas modifiées. Le scénario de base
              (8 livraisons, récurrence, support) sera recréé à l&apos;identique.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={resetting}>
              Annuler
            </Button>
            <Button variant="brand" onClick={() => void resetDemo()} loading={resetting}>
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
