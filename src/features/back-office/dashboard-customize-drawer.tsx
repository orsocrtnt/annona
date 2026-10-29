"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUp,
  LayoutGrid,
  Plus,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_WIDGET_CATALOG,
  DASHBOARD_WIDGET_CATEGORY_LABELS,
  getWidgetCatalogEntry,
  moveDashboardWidgetToEdge,
  normalizeDashboardLayout,
  reorderDashboardWidgets,
  toggleDashboardWidget,
  type DashboardLayoutSettings,
} from "@/lib/dashboard/dashboard-layout";
import {
  useResetDashboardLayout,
  useUpdateDashboardLayout,
} from "@/features/back-office/dashboard-layout-hooks";
import { useDashboardContext } from "@/features/back-office/dashboard-context";
import { PERIOD_OPTIONS } from "@/features/back-office/dashboard-drill-down";

export function DashboardCustomizeDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { layout, setLayout, setPeriod } = useDashboardContext();
  const [draft, setDraft] = useState(layout);
  const savedLayoutRef = useRef(layout);
  const didSaveRef = useRef(false);
  const updateLayout = useUpdateDashboardLayout();
  const resetLayout = useResetDashboardLayout();

  useEffect(() => {
    if (open) {
      savedLayoutRef.current = layout;
      setDraft(layout);
      didSaveRef.current = false;
    }
  }, [open, layout]);

  const visibleWidgets = useMemo(
    () => [...draft.widgets].filter((w) => w.visible).sort((a, b) => a.order - b.order),
    [draft.widgets]
  );

  const catalogByCategory = useMemo(() => {
    const groups = new Map<
      (typeof DASHBOARD_WIDGET_CATALOG)[number]["category"],
      typeof DASHBOARD_WIDGET_CATALOG
    >();
    for (const entry of DASHBOARD_WIDGET_CATALOG) {
      const list = groups.get(entry.category) ?? [];
      list.push(entry);
      groups.set(entry.category, list);
    }
    return groups;
  }, []);

  const handleSave = async () => {
    try {
      const normalized = normalizeDashboardLayout(draft);
      const saved = await updateLayout.mutateAsync(normalized);
      savedLayoutRef.current = saved;
      didSaveRef.current = true;
      setLayout(saved);
      setPeriod(saved.defaultPeriod);
      onOpenChange(false);
      toast.success("Tableau de bord enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'enregistrement");
    }
  };

  const handleReset = async () => {
    try {
      const saved = await resetLayout.mutateAsync();
      savedLayoutRef.current = saved;
      didSaveRef.current = true;
      setDraft(saved);
      setLayout(saved);
      setPeriod(saved.defaultPeriod);
      toast.success("Configuration par défaut restaurée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur lors de la réinitialisation");
    }
  };

  const updateDraft = (next: DashboardLayoutSettings) => {
    const normalized = normalizeDashboardLayout(next);
    setDraft(normalized);
    setLayout(normalized);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !didSaveRef.current) {
      setLayout(savedLayoutRef.current);
      setDraft(savedLayoutRef.current);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent side="right" className="flex w-full max-w-md flex-col p-0">
        <DrawerHeader className="border-b px-6 py-5 pr-14">
          <DrawerTitle className="flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            Personnaliser le dashboard
          </DrawerTitle>
          <DrawerDescription>
            Choisissez les blocs affichés et leur ordre — par exemple, mettez la carte en
            premier.
          </DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-6 pb-6">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Ordre d&apos;affichage</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Les blocs actifs apparaissent sur le dashboard dans cet ordre, de haut en bas.
                </p>
              </div>

              {visibleWidgets.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Aucun bloc actif. Activez des blocs ci-dessous.
                </p>
              ) : (
                <div className="space-y-2">
                  {visibleWidgets.map((widget, index) => {
                    const entry = getWidgetCatalogEntry(widget.type);
                    return (
                      <LayoutOrderRow
                        key={widget.type}
                        position={index + 1}
                        label={entry?.label ?? widget.type}
                        canMoveUp={index > 0}
                        canMoveDown={index < visibleWidgets.length - 1}
                        canMoveFirst={index > 0}
                        onMoveUp={() =>
                          updateDraft({
                            ...draft,
                            widgets: reorderDashboardWidgets(draft.widgets, widget.type, "up"),
                          })
                        }
                        onMoveDown={() =>
                          updateDraft({
                            ...draft,
                            widgets: reorderDashboardWidgets(draft.widgets, widget.type, "down"),
                          })
                        }
                        onMoveFirst={() =>
                          updateDraft({
                            ...draft,
                            widgets: moveDashboardWidgetToEdge(draft.widgets, widget.type, "first"),
                          })
                        }
                      />
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium">Période par défaut</h3>
              <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
                {PERIOD_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => updateDraft({ ...draft, defaultPeriod: option.key })}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium transition-colors max-md:min-h-11",
                      draft.defaultPeriod === option.key
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            {[...catalogByCategory.entries()].map(([category, entries]) => (
              <section key={category} className="space-y-3">
                <h3 className="text-sm font-medium">
                  {DASHBOARD_WIDGET_CATEGORY_LABELS[category]}
                </h3>
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const widget = draft.widgets.find((w) => w.type === entry.type);
                    const visible = widget?.visible ?? false;

                    return (
                      <WidgetToggleRow
                        key={entry.type}
                        label={entry.label}
                        description={entry.description}
                        visible={visible}
                        onToggle={(next) =>
                          updateDraft({
                            ...draft,
                            widgets: toggleDashboardWidget(draft.widgets, entry.type, next),
                          })
                        }
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>

        <div className="flex flex-wrap gap-2 border-t px-6 py-4">
          <Button
            variant="brand"
            className="flex-1"
            onClick={handleSave}
            disabled={updateLayout.isPending}
          >
            Enregistrer
          </Button>
          <Button variant="outline" onClick={handleReset} disabled={resetLayout.isPending}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Défaut
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function LayoutOrderRow({
  position,
  label,
  canMoveUp,
  canMoveDown,
  canMoveFirst,
  onMoveUp,
  onMoveDown,
  onMoveFirst,
}: {
  position: number;
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canMoveFirst: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveFirst: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
        {position}
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium">{label}</p>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canMoveFirst}
          onClick={onMoveFirst}
          aria-label="Mettre en premier"
          title="Mettre en premier"
        >
          <ChevronsUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          aria-label="Monter"
          title="Monter"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          aria-label="Descendre"
          title="Descendre"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function WidgetToggleRow({
  label,
  description,
  visible,
  onToggle,
}: {
  label: string;
  description: string;
  visible: boolean;
  onToggle: (visible: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        visible ? "border-brand/30 bg-brand/5" : "border-border/60 bg-muted/10"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={visible}
          onClick={() => onToggle(!visible)}
          className={cn(
            "relative mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full transition-colors max-md:after:absolute max-md:after:-inset-3 max-md:after:content-['']",
            visible ? "bg-brand" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "block h-4 w-4 rounded-full bg-white shadow transition-transform dark:bg-foreground",
              visible ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardCustomizeButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="icon" onClick={onClick} aria-label="Personnaliser le dashboard">
      <Plus className="h-4 w-4" />
    </Button>
  );
}
