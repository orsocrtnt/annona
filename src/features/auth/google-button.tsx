"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/services/supabase/client";
import { isNativeApp } from "@/lib/native/platform";

/**
 * AUTH-GOOGLE : « Continuer avec Google ». Visible seulement quand le fournisseur Google est réglé
 * (`NEXT_PUBLIC_GOOGLE_AUTH=on`) et hors des applications iOS/Android : Google refuse sa page de connexion
 * dans la vue web de Capacitor (version appli à faire dans MOBILE-1).
 */
export function isGoogleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_AUTH === "on";
}

export function googleCallbackUrl(origin: string, intent: "login" | "signup"): string {
  return new URL(`/auth/callback?intent=${intent}`, origin).toString();
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function GoogleButton({ intent, onError }: { intent: "login" | "signup"; onError?: (message: string) => void }) {
  // Décidé après le montage : le rendu serveur ne sait pas s'il tourne dans l'application native.
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setVisible(isGoogleAuthEnabled() && !isNativeApp());
  }, []);

  useEffect(() => {
    // Retour arrière depuis Google (bfcache) : le bouton redevient utilisable.
    const release = (event: PageTransitionEvent) => { if (event.persisted) setPending(false); };
    window.addEventListener("pageshow", release);
    return () => window.removeEventListener("pageshow", release);
  }, []);

  if (!visible) return null;

  const start = async () => {
    if (pending) return;
    setPending(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: googleCallbackUrl(window.location.origin, intent),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setPending(false);
      onError?.("La connexion avec Google est momentanément indisponible. Réessayez ou utilisez votre e-mail.");
    }
  };

  return (
    <button
      type="button"
      onClick={start}
      disabled={pending}
      aria-busy={pending}
      className="flex h-[52px] w-full items-center justify-center gap-3 rounded-full border border-[#858f88] bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60 dark:border-[#6b746f]"
    >
      <GoogleMark />
      {pending ? "Ouverture de Google…" : "Continuer avec Google"}
    </button>
  );
}

/** Séparateur « ou » entre Google et le formulaire e-mail ; masqué avec le bouton. */
export function GoogleDivider({ label = "ou" }: { label?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(isGoogleAuthEnabled() && !isNativeApp());
  }, []);
  if (!visible) return null;
  return (
    <div className="flex items-center gap-3 text-sm text-text-secondary" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
