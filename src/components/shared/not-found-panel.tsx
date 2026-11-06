import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";

/**
 * Page « introuvable » aux couleurs de Annona (AUDIT-0411). Remplace la page brute de Next.js,
 * en anglais, que voyaient aussi les destinataires d'un lien de suivi ou de commande expiré.
 */
export function NotFoundPanel({
  title,
  message,
  actions = [],
}: {
  title: string;
  message: ReactNode;
  actions?: { href: string; label: string; primary?: boolean }[];
}) {
  return (
    <main
      id="main-content"
      className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-5 py-16 text-center text-foreground"
    >
      <BrandLogo />
      <p className="mt-10 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Page introuvable</p>
      <h1 className="mt-3 max-w-xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <div className="mt-4 max-w-md text-pretty text-base leading-7 text-muted-foreground">{message}</div>
      {actions.length > 0 && (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {actions.map((action) => (
            <Button key={action.href} asChild variant={action.primary ? "brand" : "outline"} className="min-h-11">
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </div>
      )}
    </main>
  );
}
