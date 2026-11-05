"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { demoRequestKeyFor, useApplyLoginSession } from "@/features/auth/login-session";
import { AUTH_TIMEOUT_MESSAGE, RequestTimeoutError, requestJsonWithTimeout } from "@/features/auth/request-timeout";
import { DEMO_DEFAULT_PASSWORD, DEMO_LOGIN_EMAIL } from "@/lib/demo/constants";

/** Espaces tous pris : le serveur en prépare un autre ; on réessaie seul quelques fois avant d'afficher l'erreur. */
const BUSY_RETRIES = 4;
const MAX_BUSY_WAIT_SECONDS = 10;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * « Voir la démo » : ouvre l'espace de démonstration sans saisir d'identifiants. Même appel serveur que le
 * formulaire (compte démo public, réservation d'un espace isolé), puis arrivée sur l'accueil de l'espace.
 */
export function DemoLauncher() {
  const router = useRouter();
  const applyLoginSession = useApplyLoginSession();
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const running = useRef(false);

  const open = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setError(null);
    setPreparing(false);
    try {
      const request = () => requestJsonWithTimeout("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: DEMO_LOGIN_EMAIL,
          password: DEMO_DEFAULT_PASSWORD,
          demoRequestKey: demoRequestKeyFor(DEMO_LOGIN_EMAIL),
        }),
      });
      let res = await request();
      for (let attempt = 0; attempt < BUSY_RETRIES && res.status === 503 && typeof res.json?.retryAfterSeconds === "number"; attempt += 1) {
        setPreparing(true);
        await wait(Math.min(Math.max(res.json.retryAfterSeconds, 1), MAX_BUSY_WAIT_SECONDS) * 1000);
        res = await request();
      }
      if (!res.ok || res.json === null) {
        running.current = false;
        setError(res.json?.error ?? "La démonstration est momentanément indisponible. Réessayez dans quelques instants.");
        return;
      }
      const destination = await applyLoginSession(res.json, null);
      // replace : le retour arrière depuis l'espace ne relance pas l'ouverture.
      router.replace(destination);
    } catch (caught) {
      running.current = false;
      setError(caught instanceof RequestTimeoutError ? AUTH_TIMEOUT_MESSAGE : "Connexion interrompue. Vérifiez votre réseau puis réessayez.");
    }
  }, [applyLoginSession, router]);

  useEffect(() => {
    void open();
    // Une seule ouverture au chargement ; « Réessayer » relance à la demande.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-[420px] text-center">
      {error ? (
        <>
          <h1 className="text-balance text-[clamp(28px,5vw,40px)] font-bold leading-[1.06] tracking-[-0.04em]">
            La démo n’a pas pu s’ouvrir
          </h1>
          <Alert variant="destructive" className="mt-6 text-left">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button type="button" variant="brand" size="lg" className="mt-6 h-[52px] w-full rounded-full text-base font-semibold" onClick={() => void open()}>
            Réessayer
          </Button>
          <Link href="/" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline">
            Revenir à l’accueil
          </Link>
        </>
      ) : (
        <div role="status" aria-live="polite" className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand motion-reduce:animate-none" aria-hidden />
          <h1 className="mt-5 text-balance text-[clamp(28px,5vw,40px)] font-bold leading-[1.06] tracking-[-0.04em]">
            Ouverture de la démo…
          </h1>
          <p className="mt-2.5 text-text-secondary">
            {preparing
              ? "Tous les espaces sont occupés : un nouvel espace se prépare, encore quelques secondes."
              : "Un espace fictif est préparé pour vous, sans compte à créer."}
          </p>
        </div>
      )}
    </div>
  );
}
