import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, Check, Database, Play, ShieldCheck, Truck, UserRound } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { readPublicDemoEntry } from "@/domains/growth/public-demo";
import { DEMO_PERSONA_LABELS, type DemoPersona } from "@/lib/demo/constants";
import { GrowthShell } from "@/features/landing/growth-shell";

export const metadata: Metadata = {
  title: `Démonstration — ${APP_NAME}`,
  description: "Parcours de démonstration sur données fictives, distinct du pilote et de l'inscription.",
};

const personaVisuals: Record<DemoPersona, { icon: typeof Building2; detail: string; className: string }> = {
  admin: { icon: Building2, detail: "Organiser les missions", className: "bg-[#e3f7ec] dark:bg-brand-subtle text-brand" },
  client: { icon: UserRound, detail: "Suivre une commande", className: "bg-[#e3f7ec] dark:bg-brand-subtle text-brand" },
  driver: { icon: Truck, detail: "Parcourir une mission", className: "bg-[#f2dfb8] dark:bg-[#3a2f1c] text-[#7a5410] dark:text-[#f0b45c]" },
};

export default async function DemonstrationPage() {
  let available = false;
  let href: string | null = null;
  try {
    const entry = await readPublicDemoEntry();
    available = entry.available;
    href = entry.available ? entry.href : null;
  } catch {
    available = false;
  }

  const personas = Object.entries(DEMO_PERSONA_LABELS) as Array<[DemoPersona, string]>;

  return (
    <GrowthShell active="demonstration">
      <main id="main-content" tabIndex={-1} className="pb-20">
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-14 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-brand shadow-sm">
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
              Explorer sans rien déranger
            </div>
            <h1 className="mt-6 text-balance text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl lg:text-6xl">
              Faites le tour de TutelLiv, à votre rythme.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              La démonstration ouvre une entreprise déjà marquée comme démo. Les données y sont fictives et séparées d&apos;une entreprise cliente.
            </p>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Ce n&apos;est ni un pilote gratuit, ni une découverte premium, ni une souscription.
            </p>

            <div className="mt-7">
              {available && href ? (
                <Link
                  className="inline-flex min-h-13 items-center gap-2 rounded-xl bg-[#00d46a] px-6 py-3.5 text-sm font-bold text-[#0e1310] shadow-[0_12px_30px_rgba(0,212,106,0.25)] transition-[transform,background-color] hover:bg-[#00c262] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#08783f] dark:focus-visible:ring-ring focus-visible:ring-offset-2"
                  href={href}
                >
                  Ouvrir la démonstration
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-xl border border-[#ecd6a8] dark:border-border bg-[#fdf4e4] dark:bg-secondary px-4 py-3 text-sm font-semibold text-[#7a5410] dark:text-[#f0b45c]">
                  <span className="h-2 w-2 rounded-full bg-[#c98a12]" aria-hidden />
                  {"La démonstration n'est pas ouverte sur cet environnement."}
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-gradient-to-br from-[#e3f7ec] via-white to-[#fbefd9] blur-2xl dark:hidden" aria-hidden />
            <div className="overflow-hidden rounded-[1.75rem] border border-[#d5ddd8] dark:border-input bg-[#0e1310] dark:bg-secondary shadow-[0_28px_80px_rgba(14,19,16,0.2)]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
                <div className="flex gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#e6a2a2]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#e4cc87]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#8fc6a9]" />
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">Espace fictif</span>
              </div>
              <div className="p-5 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-white/70">Aujourd’hui</p>
                    <p className="mt-1 text-xl font-bold text-white">Choisissez votre point de vue</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white" aria-hidden>
                    <Database className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-6 grid gap-3">
                  {personas.map(([key, label]) => {
                    const visual = personaVisuals[key];
                    const Icon = visual.icon;
                    return (
                      <div key={key} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${visual.className}`} aria-hidden>
                          <Icon className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white">{label}</p>
                          <p className="mt-0.5 text-xs text-white/70">{visual.detail}</p>
                        </div>
                        <Check className="h-4 w-4 shrink-0 text-[#8be3b3]" aria-hidden />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [ShieldCheck, "Données fictives", "Aucune entreprise cliente n’est utilisée pour cette visite."],
              [Database, "Espace séparé", "La démo reste identifiable et distincte des autres environnements."],
              [Play, "Accès immédiat", "La démo s’ouvre en un clic, sans créer de compte."],
            ].map(([Icon, title, text]) => {
              const FeatureIcon = Icon as typeof ShieldCheck;
              return (
                <article key={String(title)} className="rounded-[1.5rem] border border-border bg-card/80 p-5 shadow-sm">
                  <FeatureIcon className="h-5 w-5 text-brand" aria-hidden />
                  <h2 className="mt-4 font-bold text-foreground">{String(title)}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{String(text)}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-4xl px-5 sm:px-6">
          <div className="rounded-[1.75rem] border border-border bg-card/85 p-6 text-center shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Une visite préparée, sans surprise.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {`Vous passez d’une vue à l’autre : ${Object.values(DEMO_PERSONA_LABELS).join(", ")}. Si la démo est momentanément indisponible, réessayez dans quelques instants ou écrivez-nous depuis la page Contact.`}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/fonctionnalites" className="inline-flex min-h-11 items-center rounded-xl border border-[#d5ddd8] dark:border-input bg-card px-4 py-2.5 text-sm font-bold text-foreground hover:bg-[#f0f4f1] dark:hover:bg-secondary">
                Fonctionnalités
              </Link>
              <Link href="/tarifs" className="inline-flex min-h-11 items-center rounded-xl border border-[#d5ddd8] dark:border-input bg-card px-4 py-2.5 text-sm font-bold text-foreground hover:bg-[#f0f4f1] dark:hover:bg-secondary">
                Tarifs
              </Link>
              <Link href="/contact" className="inline-flex min-h-11 items-center rounded-xl border border-[#d5ddd8] dark:border-input bg-card px-4 py-2.5 text-sm font-bold text-foreground hover:bg-[#f0f4f1] dark:hover:bg-secondary">
                Demander un pilote
              </Link>
              <Link href="/login" className="inline-flex min-h-11 items-center px-3 py-2.5 text-sm font-bold text-[#4a544d] dark:text-text-secondary underline decoration-[#a3aca6] underline-offset-4 hover:text-foreground">
                Connexion
              </Link>
            </div>
          </div>
        </section>
      </main>
    </GrowthShell>
  );
}
