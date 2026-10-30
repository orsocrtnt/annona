"use client";

import * as React from "react";
import { Check, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Copie le lien de suivi sans connexion à transmettre au client ou au destinataire. */
export function OrderTrackingLinkButton({ orderId }: { orderId: string }) {
  const [state, setState] = React.useState<"idle" | "pending" | "copied" | "error">("idle");
  const [url, setUrl] = React.useState<string | null>(null);
  const copy = async () => {
    setState("pending");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/tracking-link`, { method: "POST" });
      const json = (await response.json()) as { data?: { url: string } };
      if (!response.ok || !json.data) throw new Error("LINK");
      setUrl(json.data.url);
      await navigator.clipboard.writeText(json.data.url);
      setState("copied");
    } catch {
      setState("error");
    }
  };
  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" className="min-h-11" disabled={state === "pending"} onClick={copy}>
        {state === "pending" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          : state === "copied" ? <Check className="mr-2 h-4 w-4" aria-hidden />
          : <Link2 className="mr-2 h-4 w-4" aria-hidden />}
        {state === "copied" ? "Lien de suivi copié" : "Copier le lien de suivi"}
      </Button>
      <div aria-live="polite" className="text-xs text-muted-foreground">
        {state === "error" && (url ? <span className="break-all">{url}</span> : "Lien indisponible. Réessayez.")}
      </div>
    </div>
  );
}
