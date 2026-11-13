"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/ui/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthShell } from "@/features/auth/auth-shell";
import { GoogleButton, GoogleDivider } from "@/features/auth/google-button";
import { useApplyLoginSession } from "@/features/auth/login-session";
import { AUTH_TIMEOUT_MESSAGE, RequestTimeoutError, requestJsonWithTimeout } from "@/features/auth/request-timeout";
import {
  companySignupSchema,
  emailSignupSchema,
  type CompanySignupFormInput,
  type EmailSignupFormInput,
} from "@/lib/validations/auth";

/** Mêmes champs que la connexion : 52 px, bordure contrastée en Light comme en Dark. */
const inputClass = "h-[52px] rounded-[14px] border-[#858f88] bg-card px-4 text-base dark:border-[#6b746f]";

type SignupFormProps =
  | { step: "start" }
  | { step: "company"; email: string; firstName: string; lastName: string };

function PrivacyNote() {
  return (
    <p className="text-center text-xs text-text-secondary">
      En créant un compte, vous acceptez la{" "}
      <Link href="/confidentialite" className="underline underline-offset-2 hover:decoration-2">
        politique de confidentialité
      </Link>
      .
    </p>
  );
}

function NetworkError(caught: unknown) {
  return caught instanceof RequestTimeoutError ? AUTH_TIMEOUT_MESSAGE : "Connexion interrompue. Vérifiez votre réseau puis réessayez.";
}

/**
 * AUTH-GOOGLE : inscription d'une boulangerie (entreprise « Essai » et son administrateur). Les clients et
 * les employés ne s'inscrivent pas ici : leur administrateur crée leurs comptes (ADM-01).
 */
export function SignupForm(props: SignupFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const router = useRouter();
  const applyLoginSession = useApplyLoginSession();

  const emailForm = useForm<EmailSignupFormInput>({
    resolver: zodResolver(emailSignupSchema),
    defaultValues: { companyName: "", firstName: "", lastName: "", email: "", password: "" },
  });
  const companyForm = useForm<CompanySignupFormInput>({
    resolver: zodResolver(companySignupSchema),
    defaultValues: {
      companyName: "",
      firstName: props.step === "company" ? props.firstName : "",
      lastName: props.step === "company" ? props.lastName : "",
    },
  });

  const onEmailSignup = async (data: EmailSignupFormInput) => {
    setError(null);
    try {
      const res = await requestJsonWithTimeout("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok || !res.json) {
        setError(res.json?.error ?? "Inscription momentanément indisponible. Réessayez dans quelques instants.");
        return;
      }
      setSent(res.json.message ?? "Vérifiez votre boîte mail pour confirmer votre adresse.");
      emailForm.reset();
    } catch (caught) {
      setError(NetworkError(caught));
    }
  };

  const onCompanySignup = async (data: CompanySignupFormInput) => {
    setError(null);
    try {
      const res = await requestJsonWithTimeout("/api/auth/signup/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok || !res.json) {
        setError(res.json?.error ?? "Inscription momentanément indisponible. Réessayez dans quelques instants.");
        return;
      }
      const destination = await applyLoginSession(res.json, null);
      router.push(destination);
    } catch (caught) {
      setError(NetworkError(caught));
    }
  };

  const isCompanyStep = props.step === "company";

  return (
    <AuthShell>
      <div className="w-full max-w-[420px] animate-slide-up motion-reduce:animate-none">
        <div className="mb-4 flex justify-center" aria-hidden>
          <Image src="/brand/icone-app-fond-clair.png" alt="" width={56} height={56} priority className="h-14 w-14 rounded-[18px] shadow-sm ring-1 ring-border dark:hidden" />
          <Image src="/brand/icone-app-fond-sombre.png" alt="" width={56} height={56} className="hidden h-14 w-14 rounded-[18px] ring-1 ring-border dark:block" />
        </div>
        <h1 className="text-balance text-center text-[clamp(28px,5vw,40px)] font-bold leading-[1.06] tracking-[-0.04em]">
          {isCompanyStep ? "Encore une étape" : "Créer le compte de votre boulangerie"}
        </h1>
        <p className="mt-2.5 text-center text-text-secondary">
          {isCompanyStep
            ? `Connecté avec Google : ${props.email}`
            : "Commandes, tournées et clients au même endroit. Vous ajouterez ensuite vos clients et vos employés."}
        </p>

        {error && (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {sent && (
          <Alert variant="success" className="mt-6">
            <AlertDescription>{sent}</AlertDescription>
          </Alert>
        )}

        {isCompanyStep && (
          <form onSubmit={companyForm.handleSubmit(onCompanySignup)} className="mt-7 space-y-5" noValidate>
            <FormField label="Nom de la boulangerie" error={companyForm.formState.errors.companyName?.message} required>
              <Input autoComplete="organization" className={inputClass} error={!!companyForm.formState.errors.companyName} {...companyForm.register("companyName")} />
            </FormField>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label="Prénom" error={companyForm.formState.errors.firstName?.message} required>
                <Input autoComplete="given-name" className={inputClass} error={!!companyForm.formState.errors.firstName} {...companyForm.register("firstName")} />
              </FormField>
              <FormField label="Nom" error={companyForm.formState.errors.lastName?.message} required>
                <Input autoComplete="family-name" className={inputClass} error={!!companyForm.formState.errors.lastName} {...companyForm.register("lastName")} />
              </FormField>
            </div>
            <Button type="submit" variant="brand" size="lg" className="h-[52px] w-full rounded-full text-base font-semibold" loading={companyForm.formState.isSubmitting}>
              Créer mon espace
            </Button>
            <PrivacyNote />
          </form>
        )}

        {!isCompanyStep && !sent && (
          <>
            <div className="mt-7 space-y-5">
              <GoogleButton intent="signup" onError={setError} />
              <GoogleDivider label="ou avec votre e-mail" />
            </div>
            <form method="post" onSubmit={emailForm.handleSubmit(onEmailSignup)} className="mt-5 space-y-5" noValidate>
              <FormField label="Nom de la boulangerie" error={emailForm.formState.errors.companyName?.message} required>
                <Input autoComplete="organization" className={inputClass} error={!!emailForm.formState.errors.companyName} {...emailForm.register("companyName")} />
              </FormField>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField label="Prénom" error={emailForm.formState.errors.firstName?.message} required>
                  <Input autoComplete="given-name" className={inputClass} error={!!emailForm.formState.errors.firstName} {...emailForm.register("firstName")} />
                </FormField>
                <FormField label="Nom" error={emailForm.formState.errors.lastName?.message} required>
                  <Input autoComplete="family-name" className={inputClass} error={!!emailForm.formState.errors.lastName} {...emailForm.register("lastName")} />
                </FormField>
              </div>
              <FormField label="Email" error={emailForm.formState.errors.email?.message} required>
                <Input type="email" autoComplete="email" inputMode="email" placeholder="vous@boulangerie.fr" className={inputClass} error={!!emailForm.formState.errors.email} {...emailForm.register("email")} />
              </FormField>
              <FormField
                label="Mot de passe"
                hint="8 caractères au moins, avec une majuscule, une minuscule et un chiffre."
                error={emailForm.formState.errors.password?.message}
                required
              >
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`${inputClass} pr-14`}
                  toggleClassName="right-1 h-11 w-11 rounded-[10px]"
                  error={!!emailForm.formState.errors.password}
                  {...emailForm.register("password")}
                />
              </FormField>
              <Button type="submit" variant="brand" size="lg" className="h-[52px] w-full rounded-full text-base font-semibold" loading={emailForm.formState.isSubmitting}>
                Créer mon compte
              </Button>
              <PrivacyNote />
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-text-secondary">
          Déjà un compte ?{" "}
          <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-brand hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
