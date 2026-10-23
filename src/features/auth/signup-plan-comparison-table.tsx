"use client";

import { Check, Minus } from "lucide-react";
import {
  type BillingInterval,
  type ComparisonCell,
  type PlanCode,
  type SignupCatalog,
  buildSignupPlanComparison,
} from "@/features/auth/signup-plan-comparison";

const planOrder: PlanCode[] = ["STARTER", "PRO", "BUSINESS"];

const planDescriptions: Record<PlanCode, string> = {
  STARTER: "Pour démarrer avec une petite équipe",
  PRO: "Pour organiser une activité régulière",
  BUSINESS: "Pour les opérations plus importantes",
};

function CellContent({ cell }: { cell: ComparisonCell }) {
  if (cell.kind === "included") {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
        <Check className="h-4 w-4 text-brand" aria-hidden />
        {cell.text}
      </span>
    );
  }
  if (cell.kind === "missing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Minus className="h-4 w-4" aria-hidden />
        {cell.text}
      </span>
    );
  }
  if (cell.kind === "option") {
    return <span className="text-muted-foreground">{cell.text}</span>;
  }
  return <span>{cell.text}</span>;
}

export function SignupPlanComparisonTable({
  catalog,
  billingInterval,
  planCode,
  onSelectPlan,
}: {
  catalog: SignupCatalog;
  billingInterval: BillingInterval;
  planCode: PlanCode;
  onSelectPlan: (code: PlanCode) => void;
}) {
  const rows = buildSignupPlanComparison(catalog, billingInterval);
  const plans = planOrder
    .map((code) => catalog.plans.find((plan) => plan.code === code))
    .filter((plan): plan is NonNullable<typeof plan> => Boolean(plan));

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="min-w-[720px] w-full border-collapse text-sm">
        <caption className="sr-only">Comparaison des formules Starter, Pro et Business</caption>
        <thead>
          <tr className="border-b bg-muted/30">
            <th scope="col" className="px-4 py-4 text-left font-medium text-muted-foreground">Inclus dans l’offre</th>
            {plans.map((plan) => {
              const selected = plan.code === planCode;
              return (
                <th key={plan.code} scope="col" className={`px-4 py-4 text-left ${selected ? "bg-brand/5" : ""}`}>
                  <button
                    type="button"
                    onClick={() => onSelectPlan(plan.code)}
                    className={`w-full rounded-lg border p-3 text-left transition ${selected ? "border-brand ring-2 ring-brand/20" : "hover:border-foreground/30"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong>{plan.name}</strong>
                      {selected ? <Check className="h-4 w-4 text-brand" aria-hidden /> : null}
                    </div>
                    <p className="mt-1 text-xs font-normal text-muted-foreground">{planDescriptions[plan.code]}</p>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              <th scope="row" className="px-4 py-3 text-left font-medium">{row.label}</th>
              {plans.map((plan) => (
                <td key={plan.code} className={`px-4 py-3 align-top ${plan.code === planCode ? "bg-brand/5" : ""}`}>
                  <CellContent cell={row.cells[plan.code]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
