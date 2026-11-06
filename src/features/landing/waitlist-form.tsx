"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { sendFunnelEvent } from "@/features/landing/funnel-beacon";
import { onHumanPresence } from "@/features/landing/human-presence";

type FormState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

const FIELD_LABELS: Record<string, string> = {
  firstName: "Prénom",
  lastName: "Nom",
  company: "Entreprise",
  email: "E-mail",
  phone: "Téléphone",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-[#d5ddd8] dark:border-input bg-card px-4 py-3 text-sm max-md:text-base text-foreground shadow-sm outline-none transition focus:border-[#08783f] dark:focus:border-ring focus:ring-2 focus:ring-[#08783f]/20";
const labelClass = "text-sm font-semibold text-foreground";

/** Code de campagne du lien (`/tarifs?c=code`), vérifié par le serveur (sinon « direct »). */
function readCampaign(): string | undefined {
  const code = new URLSearchParams(window.location.search).get("c");
  return code ? code.slice(0, 100) : undefined;
}

/** Liste d'attente de la page /tarifs provisoire : envoi vers /api/waitlist, rangé avec les messages Contact. */
export function WaitlistForm() {
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const campaign = useRef<string | undefined>(undefined);
  const visitCounted = useRef(false);

  useEffect(() => {
    campaign.current = readCampaign();
    // Une visite par affichage de la page (le double appel du mode strict de React est ignoré), comptée
    // seulement après un geste réel : les antivirus des messageries ouvrent la page sans rien faire.
    if (visitCounted.current) return;
    return onHumanPresence(() => {
      if (visitCounted.current) return;
      visitCounted.current = true;
      sendFunnelEvent("visit", campaign.current);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === "sending") return;
    const form = event.currentTarget;
    const values = {
      ...Object.fromEntries(new FormData(form).entries()),
      ...(campaign.current ? { campaign: campaign.current } : {}),
    };
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (response.status === 202) {
        form.reset();
        setState({ kind: "sent" });
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { error?: string; field?: string };
      const field = body.field ? FIELD_LABELS[body.field] : null;
      setState({
        kind: "error",
        message: field ? `Vérifiez le champ « ${field} ».` : body.error ?? "Inscription impossible. Réessayez plus tard.",
      });
    } catch {
      setState({ kind: "error", message: "Connexion impossible. Vérifiez votre réseau puis réessayez." });
    }
  }

  if (state.kind === "sent") {
    return (
      <div role="status" className="rounded-[1.75rem] border border-[#cdeedb] dark:border-border bg-[#effbf4] dark:bg-secondary p-6 text-foreground sm:p-8">
        <CheckCircle2 className="h-7 w-7 text-brand" aria-hidden />
        <p className="mt-3 text-xl font-bold tracking-tight">C’est noté, vous êtes sur la liste.</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Nous vous écrirons à l’adresse indiquée dès l’ouverture, avant tout le monde.
        </p>
        <button
          type="button"
          className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
          onClick={() => setState({ kind: "idle" })}
        >
          Inscrire une autre personne
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Liste d’attente"
      className="rounded-[1.75rem] border border-border bg-card p-6 shadow-[0_18px_60px_rgba(14,19,16,0.08)] sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Prénom
          <input name="firstName" required maxLength={60} autoComplete="given-name" className={inputClass} />
        </label>
        <label className={labelClass}>
          Nom
          <input name="lastName" required maxLength={60} autoComplete="family-name" className={inputClass} />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Entreprise
          <input name="company" required minLength={2} maxLength={160} autoComplete="organization" className={inputClass} />
        </label>
        <label className={labelClass}>
          E-mail
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={inputClass} />
        </label>
        <label className={labelClass}>
          Téléphone
          <input name="phone" type="tel" required minLength={8} maxLength={40} autoComplete="tel" className={inputClass} />
        </label>
      </div>
      {/* Pot de miel : invisible et hors du parcours clavier, il doit rester vide. */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Site web
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Vos coordonnées servent uniquement à vous prévenir de l’ouverture et à vous recontacter.{" "}
        <Link href="/confidentialite" className="font-semibold underline underline-offset-4 hover:text-foreground">
          Politique de confidentialité
        </Link>
      </p>
      {state.kind === "error" && (
        <p role="alert" className="mt-4 rounded-xl border border-[#ead1c9] dark:border-border bg-[#fbefeb] dark:bg-secondary px-4 py-3 text-sm font-semibold text-[#8a3b2a] dark:text-error">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={state.kind === "sending"}
        // Clic « Rejoindre la liste » : envoi tenté, compté même si un champ bloque ensuite l'envoi.
        onClick={() => sendFunnelEvent("click", campaign.current)}
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#00d46a] px-6 py-3 text-sm font-bold text-[#0e1310] shadow-sm transition-[transform,background-color] hover:bg-[#00c262] active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#08783f] focus-visible:ring-offset-2 sm:w-auto"
      >
        {state.kind === "sending" ? "Inscription…" : "Rejoindre la liste"}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
