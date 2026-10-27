"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, LifeBuoy, Menu } from "lucide-react";

import {
  AppleNavbar,
  AppleNavbarBrand,
  AppleNavbarLink,
  AppleNavbarLinks,
  appleNavbarActionClass,
  appleNavbarIconButtonClass,
} from "@/components/navigation/apple-navbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORT_EMAIL } from "@/lib/constants";
import { cn } from "@/lib/utils";

const publicNavigation = [
  { href: "/", label: "Accueil" },
  { href: "/fonctionnalites", label: "Fonctionnalités" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/demonstration", label: "Démonstration" },
] as const;

export function PublicTopNavbar() {
  const pathname = usePathname();

  return (
    <AppleNavbar>
      <AppleNavbarBrand href="/" />

      <AppleNavbarLinks
        ariaLabel="Navigation publique"
        className="absolute left-1/2 hidden -translate-x-1/2 lg:flex"
      >
        {publicNavigation.map((item) => (
          <AppleNavbarLink
            key={item.href}
            href={item.href}
            active={pathname === item.href}
          >
            {item.label}
          </AppleNavbarLink>
        ))}
      </AppleNavbarLinks>

      <div className="ml-auto flex items-center gap-1">
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className={cn(appleNavbarIconButtonClass, "hidden sm:inline-flex")}
          aria-label="Contacter le support"
          title="Support"
        >
          <LifeBuoy className="h-4 w-4" aria-hidden />
        </a>

        <Link href="/login" className={appleNavbarActionClass}>
          <span>Connexion</span>
          <ArrowUpRight
            className="h-4 w-4 transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden
          />
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(appleNavbarIconButtonClass, "lg:hidden")}
              aria-label="Ouvrir la navigation"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-64 rounded-2xl border-white/10 bg-[#15171f] p-2 text-white shadow-2xl"
          >
            <DropdownMenuLabel className="text-xs uppercase tracking-[0.16em] text-white/45">
              Navigation
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            {publicNavigation.map((item) => (
              <DropdownMenuItem
                key={item.href}
                asChild
                className="min-h-11 cursor-pointer rounded-xl px-3 text-white/75 focus:bg-white/10 focus:text-white"
              >
                <Link href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
                  <span>{item.label}</span>
                  {pathname === item.href ? (
                    <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
                  ) : null}
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuItem
              asChild
              className="min-h-11 cursor-pointer rounded-xl px-3 text-white/75 focus:bg-white/10 focus:text-white"
            >
              <a href={`mailto:${SUPPORT_EMAIL}`}>
                <LifeBuoy className="h-4 w-4" aria-hidden />
                Support
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </AppleNavbar>
  );
}
