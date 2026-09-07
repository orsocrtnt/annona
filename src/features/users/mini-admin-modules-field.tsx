"use client";

import { MINI_ADMIN_MODULE_GROUPS, MINI_ADMIN_MODULES } from "@/lib/permissions/mini-admin";
import type { MiniAdminModuleId } from "@/lib/permissions/mini-admin";
import { cn } from "@/lib/utils";

export function MiniAdminModulesField({
  selected,
  onChange,
}: {
  selected: MiniAdminModuleId[];
  onChange: (next: MiniAdminModuleId[]) => void;
}) {
  return (
    <div className="space-y-4">
      {MINI_ADMIN_MODULE_GROUPS.map((group) => (
        <div key={group.id} className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MINI_ADMIN_MODULES.filter((mod) => mod.group === group.id).map((mod) => {
              const checked = selected.includes(mod.id);
              return (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => {
                    onChange(
                      checked ? selected.filter((id) => id !== mod.id) : [...selected, mod.id]
                    );
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    checked
                      ? "border-brand bg-brand/10 font-medium text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted/60"
                  )}
                >
                  {mod.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
