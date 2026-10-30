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
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeRadioGroup } from "@/components/theme/theme-preference-choice";
import { ThemeToggle } from "@/components/theme/theme-toggle";
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

/** Menu compact (mobile et tablette) : navigation, démo et choix complet du thème. */
function PublicMenu({ pathname, triggerClassName }: { pathname: string; triggerClassName: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClassName} aria-label="Ouvrir la navigation">
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
        <DropdownMenuSeparator />
        {/* Clair / Sombre / Système (lot A) : la barre garde la bascule en un clic, le menu le choix complet. */}
        <ThemeRadioGroup />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const flatButton =
  "inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-[10px] px-[11px] text-[13px] font-semibold min-[901px]:px-3.5 min-[901px]:text-[14px] transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9";

/**
 * Barre « à plat » de la landing (LANDING-3), copie de la maquette validée : logo, liens, « Se connecter »,
 * « Voir la démo » ; la bascule de thème et le menu compact restent.
 */
function FlatTopNavbar({ pathname, demoHref }: { pathname: string; demoHref: string }) {
  return (
    <header className="relative z-40">
      <div className="mx-auto flex max-w-[1280px] items-center gap-2.5 px-4 py-[14px] text-[15px] min-[901px]:gap-[26px] min-[901px]:px-8 min-[901px]:py-[18px]">
        <Link href="/" className="flex min-h-11 shrink-0 items-center rounded-lg max-[900px]:[&_img]:!h-[30px] max-[900px]:[&_img]:!w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandLogo size="md" className="dark:hidden" priority />
          <BrandLogo size="md" onDark className="hidden dark:inline-flex" />
        </Link>
        <nav aria-label="Navigation publique" className="hidden items-center gap-[22px] text-[var(--l-mute)] min-[901px]:flex">
          {/* Comme la maquette : trois liens, la démo passe par le bouton « Voir la démo ». */}
          {publicNavigation.filter((item) => item.href !== "/demonstration").map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className="rounded-md hover:text-[var(--l-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="h-9 w-9 max-sm:hidden" />
          <Link href="/login" className={cn(flatButton, "border border-[var(--l-line)] bg-[var(--l-card)] text-[var(--l-ink)]")}>
            Se connecter
          </Link>
          <a href={demoHref} className={cn(flatButton, "bg-[var(--l-ink-btn)] text-[var(--l-ink-btn-fg)]")}>
            Voir la démo
          </a>
          {/* Comme la maquette : sur mobile, logo et deux boutons ; les liens restent dans le pied de page. */}
        </div>
      </div>
    </header>
  );
}

/** Barre du site public : mêmes destinations partout (Démo, Connexion, Contact) et choix du thème. */
export function PublicTopNavbar({ variant = "pill", demoHref = "/demonstration" }: { variant?: "pill" | "flat"; demoHref?: string }) {
  const pathname = usePathname();

  if (variant === "flat") return <FlatTopNavbar pathname={pathname} demoHref={demoHref} />;

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

        <PublicMenu pathname={pathname} triggerClassName={cn(appleNavbarIconButtonLightClass, "h-11 w-11 lg:hidden")} />
      </div>
    </AppleNavbar>
  );
}
