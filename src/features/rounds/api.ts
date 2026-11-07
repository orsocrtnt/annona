import type { AdminRoundsDay, LiveDashboard, ValidateRoundsResult } from "@/domains/round/round.types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let json: { error?: string; data?: T } = {};
  try {
    json = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const id = (value: string) => encodeURIComponent(value);

/** TOUR-1 — tournées (ADM-06, ADM-07) et suivi en direct (ADM-08). */
export const roundsApi = {
  day: (date: string) => call<AdminRoundsDay>(`/api/rounds?date=${encodeURIComponent(date)}`),
  create: (date: string, slotId: string) => call<{ id: string; name: string }>("/api/rounds", jsonInit("POST", { date, slotId })),
  remove: (roundId: string) => call<{ id: string }>(`/api/rounds/${id(roundId)}`, { method: "DELETE" }),
  assign: (roundId: string, driverId: string | null) =>
    call<{ id: string; driverName: string | null }>(`/api/rounds/${id(roundId)}`, jsonInit("PATCH", { driverId })),
  reorder: (roundId: string, stopIds: string[]) => call<{ id: string }>(`/api/rounds/${id(roundId)}/stops`, jsonInit("PUT", { stopIds })),
  optimize: (roundId: string) => call<{ id: string; approximate: boolean }>(`/api/rounds/${id(roundId)}/optimize`, { method: "POST" }),
  move: (stopId: string, roundId: string, position: number | null) =>
    call<{ roundId: string }>(`/api/stops/${id(stopId)}/move`, jsonInit("POST", { roundId, position })),
  validate: (date: string) => call<ValidateRoundsResult>("/api/rounds/validate", jsonInit("POST", { date })),
  live: () => call<LiveDashboard>("/api/dashboard/live"),
};
