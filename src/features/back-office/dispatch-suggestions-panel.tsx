"use client";

import { Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssignFromSuggestion, useDispatchSuggestions } from "./hooks";
import { usePermissions } from "@/hooks/use-permissions";
import { formatDriverFromParts } from "@/lib/format/person-labels";

const DISPATCH_ROLES = new Set(["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);

interface DispatchSuggestionsPanelProps {
  deliveryId: string;
  /** Affiché seulement pour une livraison qui attend un livreur. */
  pending: boolean;
}

/**
 * DISPATCH-4 — les 3 meilleurs livreurs, la raison du choix et l'affectation en un clic.
 * Le choix manuel (y compris forcé au-delà de la charge) reste dans le sélecteur voisin.
 */
export function DispatchSuggestionsPanel({ deliveryId, pending }: DispatchSuggestionsPanelProps) {
  const { can, role } = usePermissions();
  const allowed = can("deliveries:dispatch") && Boolean(role && DISPATCH_ROLES.has(role));
  const { data, isLoading, error } = useDispatchSuggestions(deliveryId, pending && allowed);
  const assign = useAssignFromSuggestion();

  if (!pending || !allowed) return null;

  const handleAssign = async (driverId: string, label: string) => {
    if (assign.isPending) return;
    try {
      await assign.mutateAsync({ deliveryId, driverId });
      toast.success(`Livraison confiée à ${label}`);
    } catch (err) {
      toast.error("Affectation impossible", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <section aria-labelledby={`suggestions-${deliveryId}`} className="space-y-3 rounded-2xl border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 id={`suggestions-${deliveryId}`} className="text-sm font-semibold">
          Livreurs suggérés
        </h3>
        {data && (
          <span className="text-xs text-muted-foreground">
            {data.mode === "SUGGESTION" ? "Mode suggestion" : "Mode automatique"}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Calcul des suggestions">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error ? (
        <p className="text-sm text-muted-foreground" role="status">
          {error instanceof Error ? error.message : "Suggestions indisponibles."}
        </p>
      ) : !data?.assignable ? (
        <p className="text-sm text-muted-foreground" role="status">
          Cette livraison n’attend plus de livreur.
        </p>
      ) : data.suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground" role="status">
          Aucun livreur compatible avec les règles de dispatch. Choisissez un livreur ci-dessous,
          au besoin en forçant la charge.
        </p>
      ) : (
        <ol className="space-y-2">
          {data.suggestions.map((suggestion) => {
            const label = formatDriverFromParts(
              { firstName: suggestion.firstName, lastName: suggestion.lastName },
              null
            );
            return (
              <li
                key={suggestion.driverId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">
                    <span className="mr-2 text-muted-foreground">{suggestion.rank}.</span>
                    {label}
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      Score {suggestion.score}/100
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{suggestion.explanation}</p>
                </div>
                <Button
                  size="sm"
                  variant={suggestion.rank === 1 ? "brand" : "outline"}
                  disabled={assign.isPending}
                  loading={assign.isPending && assign.variables?.driverId === suggestion.driverId}
                  onClick={() => void handleAssign(suggestion.driverId, label)}
                  aria-label={`Affecter à ${label}`}
                >
                  Affecter
                </Button>
              </li>
            );
          })}
        </ol>
      )}
      {data?.assignable && data.suggestions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Pour un autre choix, utilisez le sélecteur de livreur.
        </p>
      )}
    </section>
  );
}
