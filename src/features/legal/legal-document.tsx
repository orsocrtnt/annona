import type { ReactNode } from "react";
import Link from "next/link";
import { GrowthShell } from "@/features/landing/growth-shell";

/**
 * Gabarit des pages légales publiques (LEGAL-LIENS). Version provisoire décidée par le propriétaire le
 * 29 octobre 2026 : seuls les faits connus du dépôt (`docs/legal/J5_AUDIT_FACTUEL_DEV.md`, section 12) sont
 * affichés, sous un bandeau « en cours de validation » tant que LEGAL-1 n'est pas close. Ne jamais compléter
 * un champ inconnu (SIREN, directeur de publication, durées) par une hypothèse.
 */
export const LEGAL_UPDATED_AT = "29 octobre 2026";

export function LegalDocument({
  active,
  title,
  intro,
  children,
}: {
  active: "mentions-legales" | "confidentialite";
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <GrowthShell active={active}>
      <main id="main-content" tabIndex={-1} className="pb-20 focus:outline-none">
        <article className="mx-auto max-w-3xl px-5 pt-14 sm:px-6 sm:pt-20">
          <h1 className="text-balance text-4xl font-bold tracking-[-0.04em] text-[#172334] dark:text-foreground sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 text-base leading-7 text-[#617080] dark:text-text-secondary">{intro}</p>
          <p
            role="note"
            data-legal-status="provisoire"
            className="mt-6 rounded-xl border border-[#ecd9b4] bg-[#fdf4e4] px-4 py-3 text-sm leading-6 text-[#6b4e16] dark:border-border dark:bg-secondary dark:text-warning"
          >
            <strong>Version provisoire, en cours de validation juridique.</strong> Ce texte ne reprend que les
            informations déjà établies. Les éléments marqués « en cours » seront complétés avant l&apos;ouverture
            commerciale. Mise à jour : {LEGAL_UPDATED_AT}.
          </p>
          <div className="mt-10 space-y-10">{children}</div>
          <p className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
            Une question sur ces informations ?{" "}
            <Link href="/contact" className="font-semibold text-brand underline underline-offset-4">
              Écrivez-nous depuis la page Contact
            </Link>
            .
          </p>
        </article>
      </main>
    </GrowthShell>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-bold tracking-tight text-[#172334] dark:text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-base leading-7 text-[#3f4f60] dark:text-text-secondary">{children}</div>
    </section>
  );
}

export function LegalFacts({ rows }: { rows: ReadonlyArray<readonly [label: string, value: ReactNode]> }) {
  return (
    <dl className="divide-y divide-border rounded-xl border border-border bg-card/70">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 px-4 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
          <dt className="font-semibold text-[#243447] dark:text-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
