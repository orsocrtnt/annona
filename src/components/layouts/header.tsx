"use client";

import { cn } from "@/lib/utils";
import {
  AppleNavbar,
  appleNavbarIconButtonClass,
} from "@/components/navigation/apple-navbar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/stores/ui.store";
import { useAuth } from "@/hooks/use-auth";
import { getInitials } from "@/lib/utils";
import { Menu, LogOut, Settings } from "lucide-react";
import type { BreadcrumbItem } from "@/types";
import Image from "next/image";
import Link from "next/link";

interface HeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
  premium?: boolean;
}

export function Header({ breadcrumbs, className, premium = false }: HeaderProps) {
  const { toggleMobileNav } = useUIStore();
  const { user, logout } = useAuth();

  const content = (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          premium
            ? "h-11 w-11 rounded-full text-[#0e1310] hover:bg-black/[0.055]"
            : appleNavbarIconButtonClass,
          "lg:hidden"
        )}
        onClick={toggleMobileNav}
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Fil d'Ariane"
          className={cn(
            "hidden items-center gap-1.5 text-sm md:flex",
            premium ? "text-[#667069]" : "text-white/55"
          )}
        >
          {breadcrumbs.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className={premium ? "text-black/25" : "text-white/30"}>/</span>}
              {item.href ? (
                <Link
                  href={item.href}
                  className={cn(
                    "rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2",
                    premium
                      ? "hover:text-[#0e1310] focus-visible:ring-[#00d46a]"
                      : "hover:text-white focus-visible:ring-white/80"
                  )}
                >
                  {item.label}
                </Link>
              ) : (
                <span className={cn("font-medium", premium ? "text-[#0e1310]" : "text-white")}>{item.label}</span>
              )}
            </div>
          ))}
        </nav>
      )}

      {premium && (
        <>
          <Link
            href="/"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d46a] lg:hidden"
          >
            <Image src="/brand/logo-horizontal-fond-clair.png" alt="TutelLiv" width={94} height={28} priority />
          </Link>
          <p className="hidden text-sm font-medium text-[#667069] lg:block">
            Centre de pilotage
          </p>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Ouvrir le menu du compte"
              className={cn(
                "flex items-center gap-2.5 px-1.5 pr-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2",
                premium
                  ? "min-h-11 rounded-full border border-black/[0.07] bg-white/72 text-[#0e1310] shadow-[0_8px_30px_rgba(14,19,16,0.06)] hover:bg-white focus-visible:ring-[#00d46a]"
                  : "min-h-10 rounded-xl border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1] focus-visible:ring-white/80"
              )}
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl ?? undefined} />
                <AvatarFallback
                  className={cn(
                    "text-xs font-semibold",
                    premium ? "bg-[#0e1310] text-white" : "bg-[#dce7ef] text-[#243447]"
                  )}
                >
                  {user ? getInitials(user.firstName, user.lastName) : "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-none">
                  {user ? `${user.firstName} ${user.lastName}` : "Utilisateur"}
                </p>
                <p className={cn("mt-0.5 text-xs", premium ? "text-[#5f6962]" : "text-white/45")}>
                  {user?.role.name ?? "—"}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Paramètres
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  if (premium) {
    return (
      <header
        className={cn(
          // Fond plein au-dessus de la barre, fondu dessous : le contenu ne défile plus en clair dans la marge.
          "sticky top-[var(--demo-banner-height,0px)] z-30 bg-[linear-gradient(to_bottom,var(--color-background)_72%,transparent)] px-3 pb-2 pt-3 lg:px-8 lg:pt-4",
          className
        )}
      >
        <div className="mx-auto flex h-14 max-w-[1480px] items-center gap-3 rounded-[18px] border border-white/70 bg-white/64 px-3 shadow-[0_12px_44px_rgba(14,19,16,0.055)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/58 lg:px-4">
          {content}
        </div>
      </header>
    );
  }

  return (
    <AppleNavbar className={className} maxWidthClassName="max-w-none">
      {content}
    </AppleNavbar>
  );
}
