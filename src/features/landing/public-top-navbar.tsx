"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu } from "lucide-react";

import {
  AppleNavbar,
  AppleNavbarBrand,
  AppleNavbarLink,
  AppleNavbarLinks,
  appleNavbarIconButtonLightClass,
} from "@/components/navigation/apple-navbar";
import { ThemeMenuItem, ThemeToggle } from "@/components/theme/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// L'accueil passe par le logo ; Contact rejoint la navigation pour rester visible à toutes les largeurs.
const publicNavigation = [
  { href: "/fonctionnalites", label: "Fonctionnalités" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/demonstration", label: "Démonstration" },
  { href: "/contact", label: "Contact" },
] as const;

const menuItemClass =
  "min-h-11 cursor-pointer rounded-xl px-3 text-[#3b443e] focus:bg-[#f0f4f1] focus:text-[#0e1310] dark:text-text-secondary dark:focus:bg-secondary dark:focus:text-foreground";

/** Barre du site public : mêmes destinations partout (Démo, Connexion, Contact) et choix du thème. */
export function PublicTopNavbar() {
  const pathname = usePathname();

  return (
    // Barre claire de la DA Menthe, comme les espaces connectés ; variantes Dark « Encre + Pastel ».
    <AppleNavbar tone="light">
      <AppleNavbarBrand href="/" tone="light" />

      <AppleNavbarLinks
        ariaLabel="Navigation publique"
        className="absolute left-1/2 hidden -translate-x-1/2 lg:flex"
      >
        {publicNavigation.map((item) => (
          <AppleNavbarLink
            key={item.href}
            href={item.href}
            active={pathname === item.href}
            tone="light"
          >
            {item.label}
          </AppleNavbarLink>
        ))}
      </AppleNavbarLinks>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle className="max-sm:hidden" />

        <Link
          href="/login"
          className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold text-[#0e1310] transition-colors hover:bg-black/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-foreground dark:hover:bg-white/[0.08]"
        >
          Connexion
        </Link>

        <Link
          href="/demonstration"
          className="group hidden min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#0e1310] px-3.5 text-sm font-semibold text-white transition-[background-color,transform] duration-300 ease-out hover:bg-[#232a26] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none dark:bg-foreground dark:text-background dark:hover:bg-foreground/90 sm:inline-flex"
        >
          Voir la démo
          <ArrowRight
            className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden
          />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(appleNavbarIconButtonLightClass, "h-11 w-11 lg:hidden")}
              aria-label="Ouvrir la navigation"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-64 rounded-2xl border-border bg-white p-2 text-[#0e1310] shadow-xl dark:bg-popover dark:text-popover-foreground"
          >
            <DropdownMenuLabel className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Navigation
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {publicNavigation.map((item) => (
              <DropdownMenuItem key={item.href} asChild className={menuItemClass}>
                <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
                  <span>{item.label}</span>
                  {pathname === item.href ? (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                  ) : null}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className={menuItemClass}>
              <Link href="/demonstration">
                <ArrowRight className="h-4 w-4" aria-hidden />
                Voir la démo
              </Link>
            </DropdownMenuItem>
            <div className="sm:hidden">
              <DropdownMenuSeparator />
              <ThemeMenuItem />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </AppleNavbar>
  );
}
