"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { FormField } from "@/components/ui/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { selectLoginRedirect } from "@/lib/auth/login-redirect";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";
import type {
  LoginInput,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "@/lib/validations/auth";
import { clearPendingCredentials } from "@/lib/storage/pending-credentials";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { AuthShell } from "@/features/auth/auth-shell";
import { SPACE_ICONS } from "@/features/auth/login-space-chooser";
import { browserStorage, rememberLastSpace, type LoginContext } from "@/features/auth/login-space";
import { createSubmitGuard } from "@/features/auth/submit-guard";
import { DEMO_DEFAULT_PASSWORD, DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";
import { useAuthStore } from "@/stores/auth.store";
import { navigateToAuthPage } from "@/lib/navigation/auth-page-navigation";
type AuthMode = "login" | "register" | "forgot-password" | "reset-password";
type PasswordLink =
  | { tokenHash: string; type: "invite" | "recovery" | "signup" }
  | { accessToken: string; refreshToken: string; type: "invite" | "recovery" | "signup" };

function LoginEmailPrefill({ form }: { form: UseFormReturn<LoginInput> }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const email = searchParams.get("email");
    if (email) form.setValue("email", email);
  }, [searchParams, form]);

  return null;
}

interface AuthFormProps {
  mode: AuthMode;
  loginContext?: LoginContext;
  /** Lien « Essayer la démo » : remplit le compte de démonstration public (affiché en clair sur la page). */
  prefillDemo?: boolean;
}

/** Champs de la connexion : 52 px de haut, bordure contrastée (3:1) en Light comme en Dark. */
const loginInputClass =
  "h-[52px] rounded-[14px] border-[#858f88] bg-card px-4 text-base dark:border-[#6b746f]";

export function AuthForm({ mode, loginContext = "company", prefillDemo = false }: AuthFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [passwordLink, setPasswordLink] = useState<PasswordLink | null>(null);
  const linkRead = useRef(false);
  const [loginGuard] = useState(createSubmitGuard);

  // Retour arrière depuis l'espace (bfcache) : le formulaire redevient utilisable.
  useEffect(() => {
    const release = (event: PageTransitionEvent) => {
      if (event.persisted) loginGuard.release();
    };
    window.addEventListener("pageshow", release);
    return () => window.removeEventListener("pageshow", release);
  }, [loginGuard]);
  const [completingLink, setCompletingLink] = useState(false);
  const { setUser, setPermissions, setDemo, setSaas } = useAuthStore();

  useEffect(() => {
    if (mode !== "reset-password") return;
    const readLink = () => {
      if (!window.location.hash && linkRead.current) return;
      linkRead.current = true;
      const params = new URLSearchParams(window.location.hash.slice(1));
      const tokenHash = params.get("token_hash");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type");
      // Le fragment n'est pas envoyé au serveur ; le retirer de l'historique après lecture.
      window.history.replaceState(null, "", window.location.pathname);
      setSuccess(null);
      if (tokenHash && (type === "invite" || type === "recovery" || type === "signup")) {
        setPasswordLink({ tokenHash, type });
        setError(null);
      } else if (accessToken && refreshToken && (type === "invite" || type === "recovery" || type === "signup")) {
        setPasswordLink({ accessToken, refreshToken, type });
        setError(null);
      } else {
        setPasswordLink(null);
        setError("Lien manquant ou invalide. Demandez un nouveau lien.");
      }
    };
    if (!linkRead.current || window.location.hash) readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, [mode]);

  const isClient = loginContext === "client";
  const isDriver = loginContext === "driver";
  const isInvitedUser = isClient || isDriver;

  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: prefillDemo ? { email: DEMO_LOGIN_EMAIL, password: DEMO_DEFAULT_PASSWORD } : { email: "", password: "" },
  });
  const fillDemoAccount = () => {
    loginForm.setValue("email", DEMO_LOGIN_EMAIL, { shouldValidate: true });
    loginForm.setValue("password", DEMO_DEFAULT_PASSWORD, { shouldValidate: true });
  };

  const registerForm = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "", lastName: "", email: "",
      password: "", confirmPassword: "", companyName: "",
    },
  });

  const forgotForm = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onLogin = async (data: LoginInput) => {
    // Double clic : une seule requête à la fois ; après un succès, la navigation est en cours.
    if (!loginGuard.tryAcquire()) return;
    try {
      await submitLogin(data);
    } catch {
      loginGuard.release();
      setError("Connexion interrompue. Vérifiez votre réseau puis réessayez.");
    }
  };

  const submitLogin = async (data: LoginInput) => {
    setError(null);
    const normalizedEmail = data.email.trim().toLowerCase();
    let demoRequestKey: string | undefined;
    if (normalizedEmail === DEMO_LOGIN_EMAIL) {
      const storageKey = "tutelliv-demo-request-key";
      demoRequestKey = window.sessionStorage.getItem(storageKey) ?? window.crypto.randomUUID();
      window.sessionStorage.setItem(storageKey, demoRequestKey);
    }
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: normalizedEmail,
        password: data.password,
        demoRequestKey,
      }),
    });
    const json = await res.json().catch(() => null);
    if (json === null) {
      // Réponse illisible (page HTML d'un 502/504, coupure) : message maîtrisé, nouvel essai possible.
      loginGuard.release();
      setError("Service de connexion momentanément indisponible. Réessayez dans quelques instants.");
      return;
    }
    if (!res.ok) {
      loginGuard.release();
      setError(json.error ?? "Email ou mot de passe incorrect.");
      return;
    }
    await queryClient.clear();
    setSaas(json.saas ?? null);
    setPermissions(json.permissions);
    setDemo(json.demo ?? null);
    setUser(json.user);
    queryClient.setQueryData(["session"], {
      user: json.user,
      permissions: json.permissions,
      demo: json.demo ?? null,
      saas: json.saas ?? null,
    });
    const requestedRedirect = new URLSearchParams(window.location.search).get("redirect");
    const destination = selectLoginRedirect(requestedRedirect, json.redirectTo);
    // Repère « Dernier utilisé » : l'espace ouvert par le serveur, sans aucune donnée personnelle.
    rememberLastSpace(browserStorage(), destination);
    // Succès : la garde reste fermée pendant la navigation ; elle ne se rouvre qu'au retour arrière (pageshow).
    loginGuard.hold();
    router.push(destination);
  };

  const onRegister = async (data: RegisterInput) => {
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        email: data.email.trim().toLowerCase(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Impossible de créer le compte.");
      return;
    }

    registerForm.reset();
    setSuccess("Consultez votre messagerie pour confirmer votre adresse, puis connectez-vous.");
  };

  const onForgotPassword = async (data: ForgotPasswordInput) => {
    setError(null);
    try {
      const res = await fetch("/api/auth/password-recovery", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Envoi indisponible."); return; }
      setSuccess("Si cette adresse peut recevoir un lien, un e-mail sera envoyé.");
    } catch { setError("Connexion interrompue. Réessayez plus tard."); }
  };

  const onResetPassword = async (data?: ResetPasswordInput) => {
    setError(null);
    if (!passwordLink || completingLink) { setError("Demandez un nouveau lien ou attendez la fin de la demande."); return; }
    setCompletingLink(true);
    try {
      const res = await fetch("/api/auth/password-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, ...passwordLink }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Lien indisponible."); return; }
      setPasswordLink(null);
      resetForm.reset();
      clearPendingCredentials();
      if (json.redirectTo) {
        router.push(json.redirectTo);
        return;
      }
      setSuccess(passwordLink.type === "signup" ? "Adresse confirmée. Vous pouvez vous connecter." : "Mot de passe enregistré. Vous pouvez vous connecter.");
    } catch { setError("Connexion interrompue. Si le lien a été utilisé, demandez-en un nouveau."); }
    finally { setCompletingLink(false); }
  };

  const loginLinks: Record<LoginContext, { forgot: string; register?: string }> = {
    company: { forgot: "/forgot-password", register: "/register" },
    client: { forgot: "/forgot-password" },
    driver: { forgot: "/forgot-password" },
  };

  const titles: Record<AuthMode, { title: string; subtitle: string }> = {
    login: {
      title: isClient ? "Espace client" : isDriver ? "Espace chauffeur" : "Connexion",
      subtitle: isClient
        ? "Suivez vos commandes et livraisons en temps réel"
        : isDriver
          ? "Accédez à vos missions du jour et à la navigation"
          : "Accédez à votre espace de pilotage",
    },
    register: {
      title: "Créer un compte entreprise",
      subtitle: "Inscription réservée aux administrateurs d'entreprise",
    },
    "forgot-password": {
      title: "Mot de passe oublié",
      subtitle: "Nous vous enverrons un lien de réinitialisation",
    },
    "reset-password": {
      title: "Nouveau mot de passe",
      subtitle: "Choisissez un nouveau mot de passe pour votre compte",
    },
  };

  const SpaceIcon = SPACE_ICONS[loginContext];

  return (
    <AuthShell>
        <div className="w-full max-w-[420px] animate-slide-up motion-reduce:animate-none">
          {mode === "login" && (
            <>
              <Link
                href="/login"
                className="mb-5 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card pl-2.5 pr-3.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronLeft className="h-[18px] w-[18px]" aria-hidden />
                Changer d&apos;espace
              </Link>
              <div className="mb-4 flex justify-center" aria-hidden>
                <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-brand-subtle text-brand">
                  <SpaceIcon className="h-7 w-7" strokeWidth={1.8} />
                </span>
              </div>
            </>
          )}
          <h1 className={mode === "login" ? "text-balance text-center text-[clamp(32px,5.6vw,48px)] font-bold leading-[1.04] tracking-[-0.04em]" : "text-balance text-[clamp(26px,4.4vw,36px)] font-bold leading-[1.08] tracking-[-0.035em]"}>
            {passwordLink?.type === "signup" ? "Confirmer votre adresse e-mail" : titles[mode].title}
          </h1>
          <p className={mode === "login" ? "mt-2.5 text-center text-text-secondary" : "mt-2 text-text-secondary"}>
            {passwordLink?.type === "signup" ? "Confirmez votre adresse pour activer votre espace entreprise." : titles[mode].subtitle}
          </p>

          {mode === "login" && loginContext === "company" && (
            <Alert variant="info" className="mt-5">
              <AlertDescription>
                <span className="font-medium">Démonstration commerciale :</span>{" "}
                connectez-vous avec{" "}
                <span className="font-mono text-xs">{DEMO_LOGIN_EMAIL}</span> /{" "}
                <span className="font-mono text-xs">{DEMO_DEFAULT_PASSWORD}</span> pour explorer
                l&apos;admin, le portail client et l&apos;app chauffeur depuis un seul compte.
                <button
                  type="button"
                  onClick={fillDemoAccount}
                  className="mt-2.5 flex min-h-11 items-center rounded-full border border-brand/30 bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Remplir avec le compte démo
                </button>
              </AlertDescription>
            </Alert>
          )}

          {isInvitedUser && mode === "login" && (
            <Alert variant="info" className="mt-5">
              <AlertDescription>
                La création de compte est réservée à votre administrateur. Utilisez votre e-mail et le mot de passe choisi lors de votre invitation.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mt-6">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert variant="success" className="mt-6">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {(mode === "reset-password" || (mode === "register" && success)) && (
            <p className="mt-4 text-sm"><Link href={success ? "/login" : passwordLink?.type === "signup" ? "/register" : "/forgot-password"} className="text-brand underline underline-offset-2 hover:decoration-2">{success ? "Se connecter" : passwordLink?.type === "signup" ? "Reprendre l’inscription" : "Demander un nouveau lien"}</Link></p>
          )}

          {mode === "login" && (
            // method="post" : un envoi avant l'hydratation ne met jamais le mot de passe dans l'URL.
            <form method="post" onSubmit={loginForm.handleSubmit(onLogin)} className="mt-7 space-y-5" noValidate>
              <Suspense fallback={null}>
                <LoginEmailPrefill form={loginForm} />
              </Suspense>
              <FormField label="Email" error={loginForm.formState.errors.email?.message} required>
                <Input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="vous@email.fr"
                  className={loginInputClass}
                  error={!!loginForm.formState.errors.email}
                  {...loginForm.register("email")}
                />
              </FormField>
              <FormField label="Mot de passe" error={loginForm.formState.errors.password?.message} required>
                <PasswordInput
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`${loginInputClass} pr-14`}
                  toggleClassName="right-1 h-11 w-11 rounded-[10px]"
                  error={!!loginForm.formState.errors.password}
                  {...loginForm.register("password")}
                />
              </FormField>
              <div className="-mt-2 flex justify-end">
                <Link href={loginLinks[loginContext].forgot} className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
              <Button type="submit" variant="brand" size="lg" className="h-[52px] w-full rounded-full text-base font-semibold" loading={loginForm.formState.isSubmitting}>
                Se connecter
              </Button>
              {loginLinks[loginContext].register && (
                <p className="text-center text-sm text-text-secondary">
                  Pas encore de compte entreprise ?{" "}
                  <Link
                    href={loginLinks[loginContext].register!}
                    onClick={(event) => navigateToAuthPage(event, loginLinks[loginContext].register!)}
                    className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline"
                  >
                    Créer un compte
                  </Link>
                </p>
              )}
            </form>
          )}

          {mode === "register" && !success && (
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="mt-8 space-y-5">
              <Alert variant="info">
                <AlertDescription>
                  Cette inscription est réservée aux administrateurs d&apos;entreprise. Les comptes clients et chauffeurs sont créés par l&apos;administrateur.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Prénom" error={registerForm.formState.errors.firstName?.message} required>
                  <Input placeholder="Jean" {...registerForm.register("firstName")} />
                </FormField>
                <FormField label="Nom" error={registerForm.formState.errors.lastName?.message} required>
                  <Input placeholder="Dupont" {...registerForm.register("lastName")} />
                </FormField>
              </div>
              <FormField label="Email" error={registerForm.formState.errors.email?.message} required>
                <Input type="email" autoComplete="email" placeholder="vous@entreprise.fr" {...registerForm.register("email")} />
              </FormField>
              <FormField label="Entreprise" hint="Optionnel">
                <Input autoComplete="organization" placeholder="Nom de votre entreprise" {...registerForm.register("companyName")} />
              </FormField>
              <FormField label="Mot de passe" error={registerForm.formState.errors.password?.message} required>
                <PasswordInput autoComplete="new-password" placeholder="••••••••" {...registerForm.register("password")} />
              </FormField>
              <FormField label="Confirmer" error={registerForm.formState.errors.confirmPassword?.message} required>
                <PasswordInput autoComplete="new-password" placeholder="••••••••" {...registerForm.register("confirmPassword")} />
              </FormField>
              <Button type="submit" variant="brand" size="lg" className="w-full" loading={registerForm.formState.isSubmitting}>
                Créer mon compte entreprise
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Déjà un compte ?{" "}
                <Link href="/login" className="font-medium text-brand hover:underline">
                  Se connecter
                </Link>
              </p>
            </form>
          )}

          {mode === "forgot-password" && (
            <form onSubmit={forgotForm.handleSubmit(onForgotPassword)} className="mt-8 space-y-5">
              <FormField label="Email" error={forgotForm.formState.errors.email?.message} required>
                <Input type="email" placeholder="vous@entreprise.fr" {...forgotForm.register("email")} />
              </FormField>
              <Button type="submit" variant="brand" size="lg" className="w-full" loading={forgotForm.formState.isSubmitting}>
                Envoyer le lien
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="font-medium text-brand hover:underline">
                  Retour à la connexion
                </Link>
              </p>
            </form>
          )}

          {mode === "reset-password" && !success && passwordLink?.type === "signup" && (
            <Button className="mt-8 w-full" loading={completingLink} onClick={() => { void onResetPassword(); }}>Confirmer mon adresse</Button>
          )}

          {mode === "reset-password" && !success && passwordLink?.type !== "signup" && (
            <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="mt-8 space-y-5">
              <FormField label="Nouveau mot de passe" error={resetForm.formState.errors.password?.message} required>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="••••••••"
                  error={!!resetForm.formState.errors.password}
                  {...resetForm.register("password")}
                />
              </FormField>
              <FormField label="Confirmer le mot de passe" error={resetForm.formState.errors.confirmPassword?.message} required>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="••••••••"
                  error={!!resetForm.formState.errors.confirmPassword}
                  {...resetForm.register("confirmPassword")}
                />
              </FormField>
              <Button type="submit" variant="brand" size="lg" className="w-full" loading={resetForm.formState.isSubmitting} disabled={!passwordLink}>
                Mettre à jour le mot de passe
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="font-medium text-brand hover:underline">
                  Retour à la connexion
                </Link>
              </p>
            </form>
          )}
        </div>
    </AuthShell>
  );
}
