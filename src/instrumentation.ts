import type { Instrumentation } from "next";
import { reportOperationalIncident } from "@/lib/operations/incident-reporter";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  await reportOperationalIncident({
    source: "next.request",
    fingerprint: `${context.routeType}:${context.routePath}:${errorName}`,
    summary: "Une requête applicative non gérée a échoué.",
    severity: "error",
    context: {
      method: request.method,
      route: context.routePath,
      routeType: context.routeType,
      errorName,
    },
  });
};
