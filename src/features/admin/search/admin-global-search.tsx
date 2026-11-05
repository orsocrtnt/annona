"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Inbox, Loader2, Package, Search, User, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAdminSearch } from "@/features/admin/hooks";
import { cn } from "@/lib/utils";
import type { AdminSearchItem, AdminSearchType } from "@/domains/admin/search.service";

/**
 * ADMIN-ESPACE lot 3 : recherche globale du super-administrateur. Champ dans la barre du haut (ordinateur),
 * loupe sur téléphone, raccourci ⌘K / Ctrl+K. Flèches pour choisir, Entrée pour ouvrir, Échap pour fermer.
 */

const MIN = 2;
const MAX = 80;
const DEBOUNCE_MS = 250;

const ICONS: Record<AdminSearchType, React.ComponentType<{ className?: string }>> = {
  companies: Building2,
  users: User,
  orders: Package,
  waitlist: UserPlus,
  contact: Inbox,
};

/** Même normalisation que le serveur : espaces regroupés, bords retirés. */
export function normalizeSearchInput(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function optionId(item: AdminSearchItem) {
  return `admin-search-${item.type}-${item.id}`;
}

function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Contenu de la fenêtre : démonté à la fermeture, donc saisie et résultats repartent de zéro à chaque ouverture. */
function SearchPanel({ onNavigate }: { onNavigate: (href: string) => void }) {
  const [input, setInput] = useState("");
  const [active, setActive] = useState(0);
  const typed = normalizeSearchInput(input);
  const debounced = useDebounced(typed, DEBOUNCE_MS);
  const q = debounced.length >= MIN && debounced.length <= MAX ? debounced : "";
  const { data, error, isFetching } = useAdminSearch(q);
  const result = q && data && data.q === q ? data : null;
  // Pendant la frappe, la liste précédente reste visible mais grisée : Entrée n'ouvre qu'un résultat de la saisie affichée.
  const fresh = result !== null && result.q === typed;
  const items = useMemo(() => (result ? result.groups.flatMap((group) => group.items ?? []) : []), [result]);

  // Premier résultat choisi à chaque nouvelle liste.
  useEffect(() => {
    setActive(0);
  }, [result]);
  useEffect(() => {
    const item = items[active];
    if (item) document.getElementById(optionId(item))?.scrollIntoView({ block: "nearest" });
  }, [active, items]);

  const go = (item: AdminSearchItem | undefined) => {
    if (item) onNavigate(item.href);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (items.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + items.length) % items.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (fresh) go(items[active]);
    }
  };

  const pending = typed.length >= MIN && typed.length <= MAX && (typed !== debounced || (isFetching && !result));
  const empty = result && result.groups.every((group) => group.items !== null && group.items.length === 0);
  let index = -1;

  return (
    <>
      <div className="flex min-h-14 items-center gap-3 border-b border-border px-4 pr-14">
        {pending ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <input
          type="text"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="admin-search-results"
          aria-autocomplete="list"
          aria-activedescendant={items[active] ? optionId(items[active]) : undefined}
          aria-label="Rechercher dans la plateforme"
          placeholder="Entreprise, nom, e-mail, référence…"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={MAX + 20}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          className="h-14 min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
        />
      </div>

      <div className="max-h-[min(60dvh,28rem)] overflow-y-auto overscroll-contain p-2" aria-live="polite">
        {typed.length < MIN ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Tapez au moins 2 caractères : nom d&apos;entreprise, nom ou e-mail d&apos;utilisateur, référence de commande, inscription ou message Contact.
          </p>
        ) : typed.length > MAX ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">80 caractères au plus.</p>
        ) : error && !result ? (
          <p className="px-3 py-6 text-center text-sm text-[#c43b2f] dark:text-error" role="alert">
            {error instanceof Error ? error.message : "Recherche indisponible."}
          </p>
        ) : !result ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">Recherche…</p>
        ) : empty ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Aucun résultat pour « {result.q} ». Les accents comptent : essayez avec ou sans.
          </p>
        ) : (
          <div
            id="admin-search-results"
            role="listbox"
            aria-label="Résultats de la recherche"
            aria-busy={!fresh}
            data-fresh={fresh ? "true" : "false"}
            className={cn("transition-opacity", !fresh && "opacity-60")}
          >
            {result.groups.map((group) => {
              if (group.items !== null && group.items.length === 0) return null;
              const Icon = ICONS[group.type];
              return (
                <div key={group.type} role="group" aria-labelledby={`admin-search-group-${group.type}`} className="py-1">
                  <p id={`admin-search-group-${group.type}`} className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {group.label}
                  </p>
                  {group.items === null ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Indisponible pour le moment.</p>
                  ) : (
                    group.items.map((item) => {
                      index += 1;
                      const position = index;
                      const selected = position === active;
                      return (
                        <div
                          key={item.id}
                          id={optionId(item)}
                          role="option"
                          aria-selected={selected}
                          tabIndex={-1}
                          onMouseMove={() => setActive(position)}
                          onClick={() => go(item)}
                          className={cn(
                            "flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2",
                            selected ? "bg-brand-subtle text-foreground" : "text-foreground"
                          )}
                        >
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3f7ec] text-brand dark:bg-brand-subtle"
                            aria-hidden
                          >
                            <Icon className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{item.title}</span>
                            {item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
                          </span>
                          {item.badge && (
                            <span className="hidden shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground min-[400px]:inline">
                              {item.badge}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                  {group.hasMore && (
                    <p className="px-3 pb-1 pt-0.5 text-xs text-muted-foreground">Plus de 5 résultats : précisez la recherche.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="hidden border-t border-border px-4 py-2.5 text-xs text-muted-foreground sm:block">
        <kbd className="font-sans font-semibold">↑</kbd> <kbd className="font-sans font-semibold">↓</kbd> pour choisir ·{" "}
        <kbd className="font-sans font-semibold">Entrée</kbd> pour ouvrir · <kbd className="font-sans font-semibold">Échap</kbd> pour fermer
      </p>
    </>
  );
}

function AdminSearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-3 max-w-xl translate-y-0 gap-0 overflow-hidden rounded-[1.5rem] border-border bg-card p-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 sm:top-[12vh] max-md:p-0 dark:bg-card">
        <DialogTitle className="sr-only">Recherche globale</DialogTitle>
        <DialogDescription className="sr-only">
          Entreprises, utilisateurs, commandes, inscriptions à la liste d&apos;attente et messages Contact. Flèches pour choisir, Entrée pour ouvrir, Échap pour fermer.
        </DialogDescription>
        <SearchPanel
          onNavigate={(href) => {
            onOpenChange(false);
            router.push(href);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Déclencheur de la barre du haut et raccourci clavier ; rendu pour le super-administrateur seulement. */
export function AdminGlobalSearch() {
  const [open, setOpen] = useState(false);
  const [shortcut, setShortcut] = useState("Ctrl K");

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setShortcut("⌘K");
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        aria-label="Rechercher dans la plateforme"
        data-testid="admin-search-trigger"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#5f6a63] transition-colors hover:bg-black/[0.055] hover:text-[#0e1310] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-muted-foreground dark:hover:bg-white/[0.08] dark:hover:text-foreground lg:w-64 lg:justify-start lg:gap-2 lg:border lg:border-black/[0.07] lg:bg-white/72 lg:px-4 lg:hover:bg-white xl:w-80 dark:lg:border-border dark:lg:bg-card dark:lg:hover:bg-muted"
      >
        <Search className="h-5 w-5 shrink-0 lg:h-4 lg:w-4" aria-hidden />
        <span className="hidden flex-1 text-left text-sm lg:inline">Rechercher…</span>
        <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted-foreground lg:inline">
          {shortcut}
        </kbd>
      </button>
      <AdminSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
