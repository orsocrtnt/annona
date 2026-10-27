"use client";

import { useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COMPANY_LOGO_QUERY_KEY, useCompanyLogo } from "@/hooks/use-company-logo";
import { cn } from "@/lib/utils";

async function sendLogo(file: File | null) {
  const init: RequestInit = { method: file ? "POST" : "DELETE" };
  if (file) {
    const form = new FormData();
    form.set("logo", file);
    init.body = form;
  }
  const response = await fetch("/api/company/logo", init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "Impossible d’enregistrer le logo");
}

/**
 * Logo de l'entreprise, affiché en tête de ses factures. Partagé par les Paramètres et
 * l'onboarding ; indisponible en démo (le pool démo doit rester recyclable).
 */
export function CompanyLogoCard({
  readOnly = false,
  title = "Logo de l’entreprise",
  optional = false,
}: {
  readOnly?: boolean;
  title?: string;
  optional?: boolean;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { isDemo, hasLogo, src } = useCompanyLogo();
  const [version, setVersion] = useState(() => Date.now());
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const disabled = readOnly || isDemo;

  const save = useMutation({
    mutationFn: sendLogo,
    onSuccess: async (_data, file) => {
      setVersion(Date.now());
      setStatus({ tone: "success", message: file ? "Logo enregistré. Il apparaît sur vos prochaines factures." : "Logo retiré." });
      await queryClient.invalidateQueries({ queryKey: COMPANY_LOGO_QUERY_KEY });
    },
    onError: (error) => setStatus({ tone: "error", message: error instanceof Error ? error.message : "Impossible d’enregistrer le logo" }),
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {title}
          {optional && <span className="ml-2 text-sm font-normal text-muted-foreground">facultatif</span>}
        </CardTitle>
        <CardDescription>
          Affiché en tête de vos factures et relevés. Sans logo, c’est le nom de l’entreprise qui apparaît.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="flex h-24 w-full shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-[#f5f8f6] p-3 sm:w-60"
        >
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- image privée servie par l'API, sans optimisation Next
            <img
              src={`${src}?v=${version}`}
              alt="Logo actuel de l’entreprise"
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
              Aucun logo
            </span>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          <p id={hintId} className="text-sm text-muted-foreground">
            {isDemo
              ? "Indisponible dans l’environnement de démonstration : les espaces démo sont réinitialisés à chaque session."
              : "PNG, JPEG ou WebP, 2 Mo maximum. Il sera ajusté à 480 × 160 pixels au plus."}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="peer sr-only"
              aria-describedby={hintId}
              disabled={disabled || save.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setStatus(null);
                  save.mutate(file);
                }
              }}
            />
            <label
              htmlFor={inputId}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-[#f0f4f1] peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                (disabled || save.isPending) && "cursor-not-allowed opacity-60 hover:bg-white"
              )}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {save.isPending ? "Envoi…" : hasLogo ? "Remplacer le logo" : "Choisir un logo"}
            </label>
            {hasLogo && (
              <Button
                type="button"
                variant="ghost"
                disabled={disabled || save.isPending}
                onClick={() => {
                  setStatus(null);
                  save.mutate(null);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Retirer le logo
              </Button>
            )}
          </div>
          <p
            role={status?.tone === "error" ? "alert" : "status"}
            aria-live="polite"
            className={cn("min-h-5 text-sm", status?.tone === "error" ? "text-[#b3352a]" : "text-brand")}
          >
            {status?.message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
