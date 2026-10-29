"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Truck, UserRound } from "lucide-react";
import {
  LOGIN_SPACES,
  LOGIN_SPACE_KEYS,
  browserStorage,
  readLastSpace,
  type LoginContext,
  type LoginSpaceKey,
} from "@/features/auth/login-space";
import { APP_NAME } from "@/lib/constants";

export const SPACE_ICONS: Record<LoginContext, typeof Building2> = {
  company: Building2,
  client: UserRound,
  driver: Truck,
};

/** Temps 1 de la connexion : choisir son espace. « Dernier utilisé » n'est qu'un repère, jamais un saut. */
export function LoginSpaceChooser() {
  const [last, setLast] = useState<LoginSpaceKey | null>(null);

  useEffect(() => {
    setLast(readLastSpace(browserStorage()));
  }, []);

  return (
    <section className="mx-auto w-full max-w-[880px] animate-slide-up motion-reduce:animate-none" aria-labelledby="choose-title">
      <h1 id="choose-title" className="text-balance text-center text-[clamp(32px,5.6vw,48px)] font-bold leading-[1.04] tracking-[-0.04em]">
        Bienvenue sur {APP_NAME}
      </h1>
      <p className="mt-2.5 text-center text-text-secondary">Choisissez votre espace pour vous connecter.</p>

      <nav aria-label="Espaces" className="mt-7 sm:mt-9">
        <ul className="grid gap-2.5 sm:grid-cols-3 sm:gap-4">
          {LOGIN_SPACE_KEYS.map((key) => {
            const space = LOGIN_SPACES[key];
            const Icon = SPACE_ICONS[space.context];
            return (
              <li key={key}>
                <Link
                  href={space.href}
                  className="relative flex h-full items-center gap-4 rounded-[20px] border border-border bg-card p-4 transition-[border-color,transform] duration-200 hover:border-foreground active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none sm:min-h-[200px] sm:flex-col sm:items-start sm:gap-2.5 sm:rounded-3xl sm:p-6"
                >
                  <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-brand-subtle text-brand" aria-hidden>
                    <Icon className="h-6 w-6" strokeWidth={1.8} />
                  </span>
                  {/* Titre au-dessus, description en dessous : jamais sur la même ligne. */}
                  <span className="flex min-w-0 flex-col gap-1 sm:mt-auto">
                    <span className="block text-lg font-semibold tracking-[-0.02em] sm:text-[21px]">{space.title}</span>
                    <span className="block text-sm text-text-secondary">{space.description}</span>
                  </span>
                  {last === key ? (
                    <span className="ml-auto self-start rounded-full bg-brand-subtle px-2.5 py-0.5 text-xs font-semibold text-brand sm:absolute sm:right-5 sm:top-5">
                      Dernier utilisé
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-dashed border-[#858f88] p-4 dark:border-[#6b746f] sm:pl-6">
        <p className="text-[15px] text-text-secondary">
          <b className="font-semibold text-foreground">Pas encore de compte ?</b> Essayez la démo sur des données fictives.
        </p>
        <Link
          href="/login?espace=entreprise&demo=1"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-foreground px-[22px] text-[15px] font-semibold text-background transition-[background-color,transform] hover:bg-foreground/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
        >
          Essayer la démo
        </Link>
      </div>
    </section>
  );
}
