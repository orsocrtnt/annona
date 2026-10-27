import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { ContactForm } from "@/features/landing/contact-form";
import { GrowthShell } from "@/features/landing/growth-shell";

export const metadata: Metadata = {
  title: `Contact — ${APP_NAME}`,
  description: "Écrire à l'équipe TutelLiv : question, démonstration accompagnée ou pilote.",
};

export default function ContactPage() {
  return (
    <GrowthShell active="contact">
      <main id="main-content" tabIndex={-1} className="pb-20">
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-14 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8dee6] bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#3d5a73] shadow-sm">
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Contact
            </div>
            <h1 className="mt-6 text-balance text-4xl font-bold tracking-[-0.04em] text-[#172334] sm:text-5xl">
              Parlons de vos livraisons.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#617080] sm:text-lg">
              Une question sur le produit, une démonstration accompagnée ou un pilote : décrivez votre activité, nous vous répondons par e-mail.
            </p>
          </div>
          <ContactForm />
        </section>
      </main>
    </GrowthShell>
  );
}
