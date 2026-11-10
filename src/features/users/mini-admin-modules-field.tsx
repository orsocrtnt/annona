"use client";

import { Button } from "@/components/ui/button";
import { MINI_ADMIN_MODULES, MINI_ADMIN_MODULE_IDS, normalizeModules, type MiniAdminModuleId } from "@/lib/permissions/mini-admin";
import { fr } from "@/lib/i18n/fr";

const t = fr.accounts;

/** Lot 1, demande 4 : cases des fonctionnalités d'un mini admin (une par une, ou toutes). */
export function MiniAdminModulesField({
  value,
  onChange,
  error,
}: {
  value: MiniAdminModuleId[];
  onChange: (value: MiniAdminModuleId[]) => void;
  error?: string | null;
}) {
  const toggle = (id: MiniAdminModuleId) => onChange(normalizeModules(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]));
  const all = value.length === MINI_ADMIN_MODULE_IDS.length;
  return (
    <fieldset className="min-w-0 space-y-2 rounded-lg border p-3" data-testid="mini-admin-modules">
      <legend className="px-1 text-sm font-medium">{t.modules}</legend>
      <p className="text-xs text-muted-foreground">{t.modulesHint}</p>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {MINI_ADMIN_MODULES.map((module) => (
          <label key={module.id} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border-input"
              checked={value.includes(module.id)}
              onChange={() => toggle(module.id)}
              data-testid={`mini-admin-module-${module.id}`}
            />
            {module.label}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">{t.modulesCount(value.length, MINI_ADMIN_MODULE_IDS.length)}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(all ? [] : [...MINI_ADMIN_MODULE_IDS])}>
          {all ? t.modulesNone : t.modulesAll}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </fieldset>
  );
}
