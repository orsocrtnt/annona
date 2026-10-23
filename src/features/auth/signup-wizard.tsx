"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/ui/form-field";
import { SignupPlanComparisonTable } from "@/features/auth/signup-plan-comparison-table";
import {
  type BillingInterval,
  type PlanCode,
  type SignupCatalog,
  formatSignupMoney,
} from "@/features/auth/signup-plan-comparison";
import { APP_NAME } from "@/lib/constants";

type Stage = "plan" | "options" | "identity" | "email" | "payment";
type Selection = { code: string; quantity: number };
type Catalog = SignupCatalog;
type Journey = {
  status: "DRAFT" | "EMAIL_PENDING" | "EMAIL_VERIFIED" | "PAYMENT_PENDING" | "PAYMENT_CONFIRMED" | "ACTIVATED" | "FAILED";
  planCode: PlanCode; billingInterval: BillingInterval; optionSelections: Selection[];
  quote: { totalHtCents: number; vatCents: number; totalTtcCents: number; currency: string; includedMonthlyOrders: number; orderOverageUnitPriceCents: number };
  email: string | null; firstName: string | null; lastName: string | null; companyName: string | null;
  legalName: string | null; siren: string | null; siret: string | null; phone: string | null;
  billingAddress: string | null; billingPostalCode: string | null; billingCity: string | null; billingCountry: string;
  emailVerified: boolean; emailResendAvailableAt: string | null; paymentConfirmed: boolean; activated: boolean;
  choicesEditable: boolean;
};

const stepItems: Array<{ id: Stage; label: string }> = [
  { id: "plan", label: "Formule" },
  { id: "options", label: "Options" },
  { id: "identity", label: "Entreprise" },
  { id: "email", label: "E-mail" },
  { id: "payment", label: "Paiement" },
];

function money(cents: number, currency = "EUR") {
  return formatSignupMoney(cents, currency);
}

function stageFromJourney(journey: Journey | null): Stage {
  if (!journey) return "plan";
  if (journey.activated || journey.paymentConfirmed || journey.emailVerified) return "payment";
  if (journey.status === "EMAIL_PENDING") return "email";
  if (journey.firstName || journey.companyName) return "identity";
  return "options";
}

export function SignupWizard() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [stage, setStage] = useState<Stage>("plan");
  const [planCode, setPlanCode] = useState<PlanCode>("STARTER");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("MONTHLY");
  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [identityDraft, setIdentityDraft] = useState<Record<string, string>>({});
  const [paymentEventKey, setPaymentEventKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/signup", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Impossible de charger l'inscription.");
    setCatalog(payload.catalog);
    setJourney(payload.journey);
    if (payload.journey) {
      setPlanCode(payload.journey.planCode);
      setBillingInterval(payload.journey.billingInterval);
      setSelections(payload.journey.optionSelections);
      setStage(stageFromJourney(payload.journey));
    }
    return payload.journey as Journey | null;
  }, []);

  useEffect(() => {
    load().catch((reason) => setError(reason instanceof Error ? reason.message : "Inscription indisponible."))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const updateCountdown = () => {
      if (journey?.status !== "EMAIL_PENDING" || !journey.emailResendAvailableAt) {
        setResendSeconds(0);
        return;
      }
      setResendSeconds(Math.max(0, Math.ceil((new Date(journey.emailResendAvailableAt).getTime() - Date.now()) / 1000)));
    };
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [journey?.emailResendAvailableAt, journey?.status]);

  const activePlan = catalog?.plans.find((plan) => plan.code === planCode);
  const options = useMemo(() => catalog?.options.filter((option) =>
    option.applicablePlans.includes(planCode) && (!option.featureKey || !activePlan?.includedFeatures.includes(option.featureKey))) ?? [], [catalog, planCode, activePlan]);
  const choicesEditable = Boolean(!journey || journey.choicesEditable);
  const emailLocked = Boolean(journey?.emailVerified);
  const progress = stage === "payment" ? 5 : stage === "email" ? 4 : stage === "identity" ? 3 : stage === "options" ? 2 : 1;
  const currentStepIndex = stepItems.findIndex((step) => step.id === stage);

  const post = async (body: unknown) => {
    setSubmitting(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Impossible de poursuivre.");
      return payload;
    } finally { setSubmitting(false); }
  };

  const applyJourney = (next: Journey, nextStage?: Stage) => {
    setJourney(next);
    setPlanCode(next.planCode);
    setBillingInterval(next.billingInterval);
    setSelections(next.optionSelections);
    if (nextStage) setStage(nextStage);
  };

  const reopenUnverifiedIdentity = async () => {
    const payload = await post({ action: "edit-identity" });
    applyJourney(payload.journey);
    setNotice("Vous pouvez corriger vos informations. L’ancien lien de confirmation n’est plus valable.");
    return payload.journey as Journey;
  };

  const goToStage = async (next: Stage) => {
    if (!choicesEditable && next !== "payment") return;
    try {
      if (journey?.status === "EMAIL_PENDING" && (next === "plan" || next === "options" || next === "identity")) {
        await reopenUnverifiedIdentity();
      }
      setStage(next);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de modifier cette étape.");
    }
  };

  const choosePlan = async () => {
    try {
      const action = journey ? "selection" : "create";
      const payload = await post({ action, planCode, billingInterval, optionSelections: [] });
      applyJourney(payload.journey, "options");
      setSelections([]);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible de poursuivre."); }
  };

  const saveOptions = async () => {
    try {
      const payload = await post({ action: "selection", planCode, billingInterval, optionSelections: selections });
      applyJourney(payload.journey, journey?.emailVerified ? "payment" : "identity");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible de poursuivre."); }
  };

  const submitIdentity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (!emailLocked && password !== confirmPassword) { setError("Les mots de passe ne correspondent pas."); return; }
    const body = Object.fromEntries(form.entries());
    try {
      if (emailLocked) {
        const payload = await post({ action: "identity-details", ...body });
        applyJourney(payload.journey, "payment");
        setNotice("Vos informations ont été mises à jour.");
        return;
      }
      await post({ action: "identity", ...body });
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Impossible d'enregistrer ces informations."); }
  };

  const pay = async () => {
    setSubmitting(true); setError(null);
    const eventKey = paymentEventKey ?? window.crypto.randomUUID();
    setPaymentEventKey(eventKey);
    try {
      const response = await fetch("/api/signup/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventKey, outcome: "confirmed" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Paiement fictif indisponible.");
      if (payload.redirectTo) window.location.assign(payload.redirectTo);
      else await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Paiement fictif indisponible."); }
    finally { setSubmitting(false); }
  };

  const resendVerificationEmail = async () => {
    if (resendSeconds > 0) return;
    try {
      const payload = await post({ action: "resend-email" });
      if (payload.journey) setJourney(payload.journey);
      setNotice("Un nouveau lien de confirmation vient d’être envoyé.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de renvoyer l’e-mail.");
      await load().catch(() => undefined);
    }
  };

  const setOption = (code: string, quantity: number) => {
    setSelections((current) => quantity <= 0 ? current.filter((item) => item.code !== code) : [...current.filter((item) => item.code !== code), { code, quantity }]);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Préparation de l’inscription…</div>;

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 font-semibold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white"><Package2 className="h-5 w-5" /></span>{APP_NAME}</Link>
          <Link href="/login" className="text-sm font-medium text-brand hover:underline">Se connecter</Link>
        </header>
        <section className="mt-8 rounded-2xl border bg-background p-5 shadow-sm sm:p-8">
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground"><span>Inscription entreprise</span><span>Étape {progress} sur 5</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-brand transition-all" style={{ width: `${progress * 20}%` }} /></div>
            <ol className="mt-4 grid grid-cols-5 gap-2 text-center text-[11px] sm:text-xs">
              {stepItems.map((step, index) => {
                const reachable = choicesEditable && index < 3 && index <= currentStepIndex && (Boolean(journey) || step.id === "plan");
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      disabled={!reachable || submitting}
                      onClick={() => void goToStage(step.id)}
                      className={`w-full rounded-md px-1 py-1 ${stage === step.id ? "font-semibold text-foreground" : "text-muted-foreground"} ${reachable ? "hover:text-foreground" : ""}`}
                    >
                      {step.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
          {error && <Alert variant="destructive" className="mb-6"><AlertDescription>{error}</AlertDescription></Alert>}
          {notice && <Alert variant="success" className="mb-6"><AlertDescription>{notice}</AlertDescription></Alert>}

          {stage === "plan" && catalog && choicesEditable && (
            <div>
              <h1 className="text-2xl font-semibold">Choisissez votre formule</h1>
              <p className="mt-2 text-muted-foreground">Comparez ce qui est inclus, en option ou absent. Les fonctions déjà incluses ne sont jamais refacturées à l’étape suivante.</p>
              <div className="mt-5 inline-flex rounded-lg border p-1">
                {(["MONTHLY", "ANNUAL"] as const).map((interval) => <button key={interval} type="button" onClick={() => setBillingInterval(interval)} className={`rounded-md px-4 py-2 text-sm ${billingInterval === interval ? "bg-foreground text-background" : "text-muted-foreground"}`}>{interval === "MONTHLY" ? "Mensuel" : "Annuel"}</button>)}
              </div>
              <div className="mt-6">
                <SignupPlanComparisonTable
                  catalog={catalog}
                  billingInterval={billingInterval}
                  planCode={planCode}
                  onSelectPlan={(code) => { if (code !== planCode) setSelections([]); setPlanCode(code); }}
                />
              </div>
              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
                {journey ? <Button variant="outline" onClick={() => void goToStage(journey.emailVerified ? "payment" : journey.status === "EMAIL_PENDING" ? "email" : "options")}>Retour</Button> : null}
                <Button className="w-full sm:w-auto" variant="brand" size="lg" loading={submitting} onClick={() => void choosePlan()}>Continuer</Button>
              </div>
            </div>
          )}

          {stage === "options" && catalog && activePlan && choicesEditable && journey && (
            <div>
              <h1 className="text-2xl font-semibold">Ajoutez seulement ce dont vous avez besoin</h1>
              <p className="mt-2 text-muted-foreground">Les fonctions déjà incluses dans {activePlan.name} ne sont jamais refacturées.</p>
              <div className="mt-6 space-y-3">{options.map((option) => {
                const selected = selections.find((item) => item.code === option.code)?.quantity ?? 0;
                const price = billingInterval === "ANNUAL" ? option.annualPriceCents : option.monthlyPriceCents;
                return <div key={option.code} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{option.name}</p><p className="text-sm text-muted-foreground">{money(price)} HT / {billingInterval === "ANNUAL" ? "an" : "mois"}</p></div>{option.kind === "OPTION" ? <button type="button" onClick={() => setOption(option.code, selected ? 0 : 1)} className={`rounded-lg border px-4 py-2 text-sm font-medium ${selected ? "border-brand bg-brand text-white" : ""}`}>{selected ? "Ajoutée" : "Ajouter"}</button> : <Input aria-label={`Quantité ${option.name}`} type="number" min={0} max={500} value={selected} onChange={(event) => setOption(option.code, Number(event.target.value))} className="w-28" />}</div>;
              })}</div>
              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row"><Button variant="outline" onClick={() => void goToStage("plan")}>Revoir la formule</Button><Button variant="brand" loading={submitting} onClick={() => void saveOptions()}>Continuer</Button></div>
            </div>
          )}

          {stage === "identity" && choicesEditable && journey && (
            <form onSubmit={submitIdentity} onChange={(event) => { const field = event.target as unknown as HTMLInputElement; if (field.name) setIdentityDraft((current) => ({ ...current, [field.name]: field.value })); }} className="space-y-5">
              <div>
                <h1 className="text-2xl font-semibold">{emailLocked ? "Corrigez les informations de l’entreprise" : "Créez votre entreprise"}</h1>
                <p className="mt-2 text-muted-foreground">{emailLocked ? "L’adresse e-mail déjà confirmée reste inchangée. Le mot de passe n’a pas à être resaisi." : "L’e-mail professionnel devra être confirmé avant le paiement fictif."}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2"><FormField label="Prénom" required><Input name="firstName" autoComplete="given-name" defaultValue={identityDraft.firstName ?? journey.firstName ?? ""} required /></FormField><FormField label="Nom" required><Input name="lastName" autoComplete="family-name" defaultValue={identityDraft.lastName ?? journey.lastName ?? ""} required /></FormField></div>
              <FormField label="E-mail professionnel" required><Input name="email" type="email" autoComplete="email" defaultValue={identityDraft.email ?? journey.email ?? ""} required readOnly={emailLocked} /></FormField>
              {!emailLocked && (
                <div className="grid gap-4 sm:grid-cols-2"><FormField label="Mot de passe" required><PasswordInput name="password" autoComplete="new-password" defaultValue={identityDraft.password ?? ""} required /></FormField><FormField label="Confirmer" required><PasswordInput name="confirmPassword" autoComplete="new-password" defaultValue={identityDraft.confirmPassword ?? ""} required /></FormField></div>
              )}
              <div className="grid gap-4 sm:grid-cols-2"><FormField label="Nom commercial" required><Input name="companyName" autoComplete="organization" defaultValue={identityDraft.companyName ?? journey.companyName ?? ""} required /></FormField><FormField label="Raison sociale" hint="Optionnel"><Input name="legalName" defaultValue={identityDraft.legalName ?? journey.legalName ?? ""} /></FormField></div>
              <div className="grid gap-4 sm:grid-cols-2"><FormField label="SIREN" hint="9 chiffres, optionnel"><Input name="siren" inputMode="numeric" maxLength={9} defaultValue={identityDraft.siren ?? journey.siren ?? ""} /></FormField><FormField label="SIRET" hint="14 chiffres, optionnel"><Input name="siret" inputMode="numeric" maxLength={14} defaultValue={identityDraft.siret ?? journey.siret ?? ""} /></FormField></div>
              <FormField label="Téléphone" hint="Optionnel"><Input name="phone" type="tel" autoComplete="tel" defaultValue={identityDraft.phone ?? journey.phone ?? ""} /></FormField>
              <FormField label="Adresse de facturation" required><Input name="billingAddress" autoComplete="street-address" defaultValue={identityDraft.billingAddress ?? journey.billingAddress ?? ""} required /></FormField>
              <div className="grid gap-4 sm:grid-cols-[140px_1fr_100px]"><FormField label="Code postal" required><Input name="billingPostalCode" autoComplete="postal-code" defaultValue={identityDraft.billingPostalCode ?? journey.billingPostalCode ?? ""} required /></FormField><FormField label="Ville" required><Input name="billingCity" autoComplete="address-level2" defaultValue={identityDraft.billingCity ?? journey.billingCity ?? ""} required /></FormField><FormField label="Pays" required><Input name="billingCountry" defaultValue={identityDraft.billingCountry ?? journey.billingCountry ?? "FR"} maxLength={2} required /></FormField></div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row"><Button type="button" variant="outline" onClick={() => void goToStage("options")}>Retour</Button><Button type="submit" variant="brand" loading={submitting}>{emailLocked ? "Enregistrer et revenir au paiement" : "Vérifier mon e-mail"}</Button></div>
            </form>
          )}

          {stage === "email" && journey?.status === "EMAIL_PENDING" && (
            <div className="mx-auto max-w-xl text-center"><h1 className="text-2xl font-semibold">Confirmez votre adresse e-mail</h1><p className="mt-3 text-muted-foreground">Nous avons envoyé un lien à <strong className="text-foreground">{journey.email}</strong>. Votre entreprise n’est pas encore créée.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap"><Button variant="brand" loading={submitting} onClick={() => { setSubmitting(true); setError(null); load().then((next) => { if (next?.status === "EMAIL_PENDING") setError("La confirmation n’est pas encore enregistrée. Ouvrez le lien reçu par e-mail, puis actualisez."); }).catch(() => setError("Vérification indisponible.")).finally(() => setSubmitting(false)); }}>J’ai confirmé, actualiser</Button><Button variant="outline" disabled={submitting || resendSeconds > 0} onClick={() => void resendVerificationEmail()}>{resendSeconds > 0 ? `Renvoyer l’e-mail dans ${resendSeconds} s` : "Renvoyer l’e-mail"}</Button><Button variant="ghost" disabled={submitting} onClick={() => void goToStage("identity")}>Modifier mes informations</Button><Button variant="ghost" disabled={submitting} onClick={() => void goToStage("plan")}>Revoir la formule</Button></div></div>
          )}

          {stage === "payment" && journey?.emailVerified && !journey.activated && (
            <div className="mx-auto max-w-2xl"><h1 className="text-2xl font-semibold">Confirmez l’abonnement en environnement test</h1><p className="mt-2 text-muted-foreground">Aucun débit réel n’est effectué. Vous pouvez encore corriger l’offre ou les informations tant que ce paiement n’est pas confirmé.</p><div className="mt-6 rounded-xl border bg-muted/20 p-5"><div className="flex justify-between"><span>Total HT</span><strong>{money(journey.quote.totalHtCents, journey.quote.currency)}</strong></div><div className="mt-2 flex justify-between text-sm text-muted-foreground"><span>TVA indicative</span><span>{money(journey.quote.vatCents, journey.quote.currency)}</span></div><div className="mt-4 flex justify-between border-t pt-4 text-lg"><span>Total TTC</span><strong>{money(journey.quote.totalTtcCents, journey.quote.currency)}</strong></div><p className="mt-4 text-xs text-muted-foreground">{journey.quote.includedMonthlyOrders.toLocaleString("fr-FR")} commandes incluses par mois, puis {money(journey.quote.orderOverageUnitPriceCents)} HT par commande supplémentaire. Les dépassements restent non bloquants.</p></div><div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row"><Button variant="outline" onClick={() => void goToStage("plan")}>Modifier l’offre</Button><Button variant="outline" onClick={() => void goToStage("identity")}>Modifier mes informations</Button><Button className="w-full" variant="brand" size="lg" loading={submitting} onClick={() => void pay()}>Confirmer le paiement fictif et activer</Button></div></div>
          )}
        </section>
      </div>
    </main>
  );
}
