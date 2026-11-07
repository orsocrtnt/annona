"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useCompanyLogo } from "@/hooks/use-company-logo";
import { cn } from "@/lib/utils";

/**
 * PLA-03 : nom et logo de l'entreprise de l'utilisateur, en tête du portail client, de l'application
 * livreur et du back-office. Sans logo, le nom seul ; sans entreprise (super-administrateur), rien.
 */
export function CompanyBrand({ href, className, compact = false }: { href: string; className?: string; compact?: boolean }) {
  const { user } = useAuth();
  const name = user?.company?.name;
  const { hasLogo, src } = useCompanyLogo(Boolean(name));
  if (!name) return null;
  return (
    <Link
      href={href}
      className={cn("flex min-h-10 min-w-0 shrink items-center gap-2 rounded-xl px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11", className)}
      data-testid="company-brand"
    >
      {hasLogo ? (
        // Image privée servie par l'API (même entreprise) : pas d'optimisation next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" aria-hidden className="h-8 w-8 shrink-0 rounded-lg border border-black/5 bg-white object-contain" data-testid="company-logo" />
      ) : null}
      <span className={cn("truncate font-semibold tracking-tight text-[#0e1310] dark:text-foreground", compact ? "text-sm" : "text-base")}>{name}</span>
    </Link>
  );
}
