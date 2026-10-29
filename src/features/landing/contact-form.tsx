"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";

type FormState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string };

const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  email: "E-mail",
  company: "Entreprise",
  phone: "Téléphone",
  message: "Message",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-[#d8dee6] bg-white px-4 py-3 text-sm max-md:text-base text-[#172334] shadow-sm outline-none transition focus:border-[#3d5a73] focus:ring-2 focus:ring-[#3d5a73]/20";

export function ContactForm() {
  const [state, setState] = useState<FormState>({ kind: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === "sending") return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/contact", {
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
        message: field ? `Vérifiez le champ « ${field} ».` : body.error ?? "Envoi impossible. Réessayez plus tard.",
      });
    } catch {
      setState({ kind: "error", message: "Connexion impossible. Vérifiez votre réseau puis réessayez." });
    }
  }

  if (state.kind === "sent") {
    return (
      <div role="status" className="rounded-[1.5rem] border border-[#cfe0cf] bg-[#eef6ee] p-6 text-[#2f5530]">
        <CheckCircle2 className="h-6 w-6" aria-hidden />
        <p className="mt-3 text-lg font-bold">Message reçu.</p>
        <p className="mt-1 text-sm leading-6">Nous vous répondrons à l&apos;adresse indiquée.</p>
        <button
          type="button"
          className="mt-4 text-sm font-semibold underline underline-offset-4"
          onClick={() => setState({ kind: "idle" })}
        >
          Envoyer un autre message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate={false} className="rounded-[1.5rem] border border-[#d8dee6] bg-white/90 p-6 shadow-[0_20px_60px_rgba(23,35,52,0.08)] sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[#243447]">
          Nom
          <input name="name" required minLength={2} maxLength={120} autoComplete="name" className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-[#243447]">
          E-mail
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-[#243447]">
          Entreprise <span className="font-normal text-[#758290]">(facultatif)</span>
          <input name="company" maxLength={160} autoComplete="organization" className={inputClass} />
        </label>
        <label className="text-sm font-semibold text-[#243447]">
          Téléphone <span className="font-normal text-[#758290]">(facultatif)</span>
          <input name="phone" type="tel" maxLength={40} autoComplete="tel" className={inputClass} />
        </label>
      </div>
      <label className="mt-5 block text-sm font-semibold text-[#243447]">
        Message
        <textarea name="message" required minLength={10} maxLength={4000} rows={6} className={inputClass} />
      </label>
      {/* Pot de miel : invisible et hors du parcours clavier, il doit rester vide. */}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label>
          Site web
          <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#758290]">
        Vos coordonnées servent uniquement à vous répondre.
      </p>
      {state.kind === "error" && (
        <p role="alert" className="mt-4 rounded-xl border border-[#ead1c9] bg-[#fbefeb] px-4 py-3 text-sm font-semibold text-[#8a3b2a]">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#243447] px-6 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(36,52,71,0.18)] transition hover:bg-[#182535] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d5a73] focus-visible:ring-offset-2"
      >
        <Send className="h-4 w-4" aria-hidden />
        {state.kind === "sending" ? "Envoi…" : "Envoyer"}
      </button>
    </form>
  );
}
