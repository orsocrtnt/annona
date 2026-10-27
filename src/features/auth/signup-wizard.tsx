"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Package2 } from "lucide-react";
import { salesCodeFromSearch, signupEntryFromSearch } from "@/domains/growth/signup-entry";
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
import { describeSignupValidation, signupIdentityDetailsSchema, signupIdentitySchema } from "@/lib/validations/signup";
import { APP_NAME } from "@/lib/constants";
import { PublicSupportLink } from "@/features/support/public-support-link";

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
  salesCodeApplied?: boolean;
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
  const [paymentAdapter, setPaymentAdapter] = useState("fake");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [stage, setStage] = useState<Stage>("plan");
  const [planCode, setPlanCode] = useState<PlanCode>("STARTER");
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("MONTHLY");
  const [selections, setSelections] = useState<Selection[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [identityDraft, setIdentityDraft] = useState<Record<string, string>>({});
  const [paymentEventKey, setPaymentEventKey] = useState<string | null>(null);
  const [salesCode, setSalesCode] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/signup", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Impossible de charger l'inscription.");
    setCatalog(payload.catalog);
    setPaymentAdapter(payload.paymentAdapter ?? "fake");
    setJourney(payload.journey);
    if (payload.journey) {
      setPlanCode(payload.journey.planCode);
      setBillingInterval(payload.journey.billingInterval);
      setSelections(payload.journey.optionSelections);
      setStage(stageFromJourney(payload.journey));
    } else {
      const entry = signupEntryFromSearch(window.location.search);
      if (entry) {
        setPlanCode(entry.planCode);
        setBillingInterval(entry.billingInterval);
      }
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

  useEffect(() => {
    setSalesCode(salesCodeFromSearch(window.location.search));
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("payment") === "cancelled") {
      setNotice("Le paiement sandbox a été interrompu. Votre inscription est conservée.");
    }
  }, []);

  useEffect(() => {
    if (paymentAdapter !== "stripe-sandbox" || journey?.status !== "PAYMENT_PENDING") return;
    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch("/api/signup/payment", { cache: "no-store" });
        const result = await response.json();
        if (!stopped && result.confirmed) await load();
      } catch { /* Network interruption leaves the durable journey available. */ }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 5000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [paymentAdapter, journey?.status, load]);

  const activePlan = catalog?.plans.find((plan) => plan.code === planCode);
  const options = useMemo(() => catalog?.options.filter((option) =>
    option.applicablePlans.includes(planCode) && (!option.featureKey || !activePlan?.includedFeatures.includes(option.featureKey))) ?? [], [catalog, planCode, activePlan]);
  const choicesEditable = Boolean(!journey || journey.choicesEditable);
  const emailLocked = Boolean(journey?.emailVerified);
  const progress = stage === "payment" ? 5 : stage === "email" ? 4 : stage === "identity" ? 3 : stage === "options" ? 2 : 1;
  const currentStepIndex = stepItems.findIndex((step) => step.id === stage);

  const showFieldErrors = (fields: Record<string, string>, summary: string, form?: HTMLFormElement) => {
    setFieldErrors(fields);
    setError(summary);
    const first = Object.keys(fields)[0];
    if (first && form) {
      const target = form.elements.namedItem(first);
      if (target instanceof HTMLElement) target.focus();
    }
  };

  const post = async (body: unknown) => {
    setSubmitting(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) {
        const error = new Error(payload.error ?? "Impossible de poursuivre.") as Error & { fields?: Record<string, string> };
        error.fields = payload.fields;
        throw error;
      }
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
      const code = salesCode.trim();
      const payload = await post({ action, planCode, billingInterval, optionSelections: [], ...(code ? { salesCode: code } : {}) });
      applyJourney(payload.journey, "options");
      setSelections([]);
      setSalesCode("");
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    setFieldErrors({});
    if (!emailLocked && password !== confirmPassword) {
      showFieldErrors({ confirmPassword: "Les mots de passe ne correspondent pas." }, "Les mots de passe ne correspondent pas.", formElement);
      return;
    }
    const body = Object.fromEntries(form.entries());
    const parsed = emailLocked
      ? signupIdentityDetailsSchema.safeParse({ action: "identity-details", ...body })
      : signupIdentitySchema.safeParse({ action: "identity", ...body });
    if (!parsed.success) {
      const details = describeSignupValidation(parsed.error);
      showFieldErrors(details.fields, details.summary, formElement);
      return;
    }
    try {
      if (emailLocked) {
        const payload = await post(parsed.data);
        applyJourney(payload.journey, "payment");
        setNotice("Vos informations ont été mises à jour.");
        return;
      }
      const payload = await post(parsed.data);
      if (payload.journey) applyJourney(payload.journey, stageFromJourney(payload.journey));
      else await load();
    } catch (reason) {
      const fields = reason && typeof reason === "object" && "fields" in reason
        ? (reason.fields as Record<string, string> | undefined)
        : undefined;
      if (fields && Object.keys(fields).length > 0) {
        showFieldErrors(fields, reason instanceof Error ? reason.message : "Impossible d'enregistrer ces informations.", formElement);
        return;
      }
      setError(reason instanceof Error ? reason.message : "Impossible d'enregistrer ces informations.");
    }
  };

  const pay = async () => {
    setSubmitting(true); setError(null);
    const eventKey = paymentEventKey ?? window.crypto.randomUUID();
    setPaymentEventKey(eventKey);
    try {
      const response = await fetch("/api/signup/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventKey, outcome: "confirmed" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? (paymentAdapter === "stripe-sandbox" ? "Le paiement sandbox est indisponible. Votre inscription est conservée." : "Paiement fictif indisponible."));
      if (payload.checkoutUrl) window.location.assign(payload.checkoutUrl);
      else if (payload.redirectTo) window.location.assign(payload.redirectTo);
      else await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : (paymentAdapter === "stripe-sandbox" ? "Le paiement sandbox est indisponible. Votre inscription est conservée." : "Paiement fictif indisponible.")); }
    finally { setSubmitting(false); }
  };

  const resendVerificationEmail = async () => {
    if (resendSeconds > 0) return;
    try {
      const payload = await post({ action: "resend-email" });
      if (payload.journey) applyJourney(payload.journey, stageFromJourney(payload.journey));
      if (payload.journey?.emailVerified) {
        setNotice("Cette adresse est déjà confirmée. Vous pouvez continuer.");
        return;
      }
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
          <div className="flex items-center gap-4">
            <PublicSupportLink />
            <Link href="/login" className="text-sm font-medium text-brand hover:underline">Se connecter</Link>
          </div>
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
              <div className="mt-6 max-w-sm">
                <FormField label="Code commercial (facultatif)">
                  <Input
                    name="salesCode"
                    value={salesCode}
                    maxLength={24}
                    autoComplete="off"
                    placeholder={journey?.salesCodeApplied ? "Code déjà appliqué" : "Ex. CAMILLE-7K3P"}
                    onChange={(event) => setSalesCode(event.target.value.toUpperCase())}
                  />
                </FormField>
                {journey?.salesCodeApplied && <p className="mt-2 text-sm text-muted-foreground">Un code commercial est appliqué à cette inscription. Saisissez-en un autre pour le remplacer.</p>}
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
            <form onSubmit={submitIdentity} onChange={(event) => { const field = event.target as unknown as HTMLInputElement; if (field.name) { setIdentityDraft((current) => ({ ...current, [field.name]: field.value })); setFieldErrors((current) => current[field.name] ? { ...current, [field.name]: "" } : current); } }} className="space-y-5" noValidate>
              <div>
                <h1 className="text-2xl font-semibold">{emailLocked ? "Corrigez les informations de l’entreprise" : "Créez votre entreprise"}</h1>
                <p className="mt-2 text-muted-foreground">{emailLocked ? "L’adresse e-mail déjà confirmée reste inchangée. Le mot de passe n’a pas à être resaisi." : "L’e-mail professionnel devra être confirmé avant le paiement fictif."}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2"><FormField label="Prénom" required error={fieldErrors.firstName}><Input name="firstName" autoComplete="given-name" defaultValue={identityDraft.firstName ?? journey.firstName ?? ""} required /></FormField><FormField label="Nom" required error={fieldErrors.lastName}><Input name="lastName" autoComplete="family-name" defaultValue={identityDraft.lastName ?? journey.lastName ?? ""} required /></FormField></div>
              <FormField label="E-mail professionnel" required error={fieldErrors.email}><Input name="email" type="email" autoComplete="email" defaultValue={identityDraft.email ?? journey.email ?? ""} required readOnly={emailLocked} /></FormField>
              {!emailLocked && (
                <div className="grid gap-4 sm:grid-cols-2"><FormField label="Mot de passe" required hint="Au moins 8 caractères, une minuscule, une majuscule et un chiffre." error={fieldErrors.password}><PasswordInput name="password" autoComplete="new-password" defaultValue={identityDraft.password ?? ""} required /></FormField><FormField label="Confirmer" required error={fieldErrors.confirmPassword}><PasswordInput name="confirmPassword" autoComplete="new-password" defaultValue={identityDraft.confirmPassword ?? ""} required /></FormField></div>
              )}
              <div className="grid gap-4 sm:grid-cols-2"><FormField label="Nom commercial" required error={fieldErrors.companyName}><Input name="companyName" autoComplete="organization" defaultValue={identityDraft.companyName ?? journey.companyName ?? ""} required /></FormField><FormField label="Raison sociale" hint="Optionnel" error={fieldErrors.legalName}><Input name="legalName" defaultValue={identityDraft.legalName ?? journey.legalName ?? ""} /></FormField></div>
              <div className="grid gap-4 sm:grid-cols-2"><FormField label="SIREN" hint="9 chiffres, optionnel" error={fieldErrors.siren}><Input name="siren" inputMode="numeric" maxLength={9} defaultValue={identityDraft.siren ?? journey.siren ?? ""} /></FormField><FormField label="SIRET" hint="14 chiffres, optionnel" error={fieldErrors.siret}><Input name="siret" inputMode="numeric" maxLength={14} defaultValue={identityDraft.siret ?? journey.siret ?? ""} /></FormField></div>
              <FormField label="Téléphone" hint="Optionnel" error={fieldErrors.phone}><Input name="phone" type="tel" autoComplete="tel" defaultValue={identityDraft.phone ?? journey.phone ?? ""} /></FormField>
              <FormField label="Adresse de facturation" required error={fieldErrors.billingAddress}><Input name="billingAddress" autoComplete="street-address" defaultValue={identityDraft.billingAddress ?? journey.billingAddress ?? ""} required /></FormField>
              <div className="grid gap-4 sm:grid-cols-[140px_1fr_100px]"><FormField label="Code postal" required error={fieldErrors.billingPostalCode}><Input name="billingPostalCode" autoComplete="postal-code" defaultValue={identityDraft.billingPostalCode ?? journey.billingPostalCode ?? ""} required /></FormField><FormField label="Ville" required error={fieldErrors.billingCity}><Input name="billingCity" autoComplete="address-level2" defaultValue={identityDraft.billingCity ?? journey.billingCity ?? ""} required /></FormField><FormField label="Pays" required error={fieldErrors.billingCountry}><Input name="billingCountry" defaultValue={identityDraft.billingCountry ?? journey.billingCountry ?? "FR"} maxLength={2} required /></FormField></div>
              <div className="flex flex-col-reverse gap-3 sm:flex-row"><Button type="button" variant="outline" onClick={() => void goToStage("options")}>Retour</Button><Button type="submit" variant="brand" loading={submitting}>{emailLocked ? "Enregistrer et revenir au paiement" : "Vérifier mon e-mail"}</Button></div>
            </form>
          )}

          {stage === "email" && journey?.status === "EMAIL_PENDING" && (
            <div className="mx-auto max-w-xl text-center"><h1 className="text-2xl font-semibold">Confirmez votre adresse e-mail</h1><p className="mt-3 text-muted-foreground">Nous avons envoyé un lien à <strong className="text-foreground">{journey.email}</strong>. Votre entreprise n’est pas encore créée.</p><div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap"><Button variant="brand" loading={submitting} onClick={() => { setSubmitting(true); setError(null); load().then((next) => { if (next?.status === "EMAIL_PENDING") setError("La confirmation n’est pas encore enregistrée. Ouvrez le lien reçu par e-mail, puis actualisez."); }).catch(() => setError("Vérification indisponible.")).finally(() => setSubmitting(false)); }}>J’ai confirmé, actualiser</Button><Button variant="outline" disabled={submitting || resendSeconds > 0} onClick={() => void resendVerificationEmail()}>{resendSeconds > 0 ? `Renvoyer l’e-mail dans ${resendSeconds} s` : "Renvoyer l’e-mail"}</Button><Button variant="ghost" disabled={submitting} onClick={() => void goToStage("identity")}>Modifier mes informations</Button><Button variant="ghost" disabled={submitting} onClick={() => void goToStage("plan")}>Revoir la formule</Button></div></div>
          )}

          {journey?.activated && <div className="mx-auto max-w-xl text-center"><h1 className="text-2xl font-semibold">Votre espace est prêt</h1><p className="mt-3">Le paiement a été confirmé par le serveur.</p><Link className="mt-6 inline-block underline" href="/login?redirect=/onboarding">Se connecter et commencer</Link></div>}
          {stage === "payment" && journey?.emailVerified && !journey.activated && (
            <div className="mx-auto max-w-2xl"><h1 className="text-2xl font-semibold">Confirmez l’abonnement en environnement test</h1><p className="mt-2 text-muted-foreground">{paymentAdapter === "stripe-sandbox" ? "Aucun débit réel n’est effectué. Les choix sont verrouillés dès l’ouverture du paiement Stripe pour éviter une différence avec le devis accepté." : "Aucun débit réel n’est effectué. Le paiement fictif active le compte seulement après confirmation serveur."}</p><div className="mt-6 rounded-xl border bg-muted/20 p-5"><div className="flex justify-between"><span>Total HT</span><strong>{money(journey.quote.totalHtCents, journey.quote.currency)}</strong></div><div className="mt-2 flex justify-between text-sm text-muted-foreground"><span>TVA indicative</span><span>{money(journey.quote.vatCents, journey.quote.currency)}</span></div><div className="mt-4 flex justify-between border-t pt-4 text-lg"><span>Total TTC</span><strong>{money(journey.quote.totalTtcCents, journey.quote.currency)}</strong></div><p className="mt-4 text-xs text-muted-foreground">{journey.quote.includedMonthlyOrders.toLocaleString("fr-FR")} commandes incluses par mois, puis {money(journey.quote.orderOverageUnitPriceCents)} HT par commande supplémentaire. Les dépassements restent non bloquants.</p></div><div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row"><Button variant="outline" disabled={!choicesEditable} onClick={() => void goToStage("plan")}>Modifier l’offre</Button><Button variant="outline" disabled={!choicesEditable} onClick={() => void goToStage("identity")}>Modifier mes informations</Button><Button className="w-full" variant="brand" size="lg" loading={submitting} onClick={() => void pay()}>{paymentAdapter === "stripe-sandbox" ? "Payer dans la sandbox Stripe" : "Confirmer le paiement fictif et activer"}</Button></div></div>
          )}
        </section>
      </div>
    </main>
  );
}
