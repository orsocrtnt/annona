import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderProgress } from "@/lib/orders/progress";

/**
 * Frise d'avancement d'une commande (liste ordonnée, étape en cours annoncée) ;
 * annulée ou en échec : un état clair à la place de la frise.
 */
export function OrderProgressTrack({ progress }: { progress: OrderProgress }) {
  if (progress.kind === "stopped") {
    return (
      <p
        className={cn(
          "mt-5 rounded-xl px-3 py-2.5 text-sm font-medium",
          progress.tone === "danger" ? "bg-[#fdecea] text-[#8a2a20]" : "bg-[#f1f3f2] text-foreground"
        )}
      >
        {progress.label}
      </p>
    );
  }
  return (
    <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Avancement de la commande">
      {progress.steps.map((step, index) => {
        const done = index < progress.current || (index === progress.current && index === progress.steps.length - 1);
        const current = index === progress.current && !done;
        return (
          <li key={step.key} className="min-w-0" aria-current={current ? "step" : undefined}>
            <span
              className={cn("block h-1.5 rounded-full", done ? "bg-foreground" : current ? "bg-primary" : "bg-[#e4e8e5]")}
              aria-hidden="true"
            />
            <span
              className={cn(
                "mt-2 flex items-center gap-1 text-xs",
                done || current ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {done && <Check className="h-3 w-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">{step.label}</span>
              <span className="sr-only">{done ? " (terminée)" : current ? " (en cours)" : " (à venir)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

