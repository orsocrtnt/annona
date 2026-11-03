import type { OrderIntakeDraft } from "@/domains/order-intake/order-intake.draft";
import type { IntakeOrderInput } from "@/domains/order-intake/order-intake.form";

export interface OrderIntakeStatus {
  enabled: boolean;
  configured: boolean;
  canManage: boolean;
  limits: { hourly: number; daily: number; maxTextLength: number };
}

export interface InboundEmailItem {
  id: string;
  fromAddress: string;
  /** Client lu dans un e-mail transféré à la main par l'équipe ; null sinon. */
  originalSender: string | null;
  subject: string;
  bodyText: string;
  attachmentCount: number;
  status: "RECEIVED" | "ANALYZED" | "ANALYSIS_FAILED" | "NOT_ORDER";
  draft: OrderIntakeDraft | null;
  analysisError: string | null;
  createdAt: string;
}

export interface IntakeChannels {
  orderLink: { enabled: boolean; url: string | null };
  inboundEmail: { enabled: boolean; configured: boolean; address: string | null; mailbox: string | null };
  /** Codes de confirmation envoyés par Gmail à l'adresse TutelLiv (24 dernières heures). */
  gmailConfirmations?: { code: string; requester: string | null; receivedAt: string }[];
}

export type IntakeChannelAction =
  | { channel: "orderLink" | "inboundEmail"; enabled: boolean }
  | { channel: "orderLink" | "inboundEmail"; rotate: true }
  | { channel: "inboundEmail"; mailbox: string | null };

/** Erreur lisible renvoyée par les routes ; `code` pilote l'état affiché. */
export class OrderIntakeApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "OrderIntakeApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new OrderIntakeApiError("NETWORK", "Connexion impossible. Vérifiez le réseau puis réessayez.", 0);
  }
  const json = (await response.json().catch(() => ({}))) as { data?: T; code?: string; error?: string };
  if (!response.ok) {
    throw new OrderIntakeApiError(json.code ?? "ERROR", json.error ?? `Erreur serveur (${response.status})`, response.status);
  }
  return json.data as T;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const orderIntakeApi = {
  getStatus: () => request<OrderIntakeStatus>("/api/orders/intake"),
  setEnabled: (enabled: boolean) =>
    request<{ enabled: boolean }>("/api/orders/intake", {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ enabled }),
    }),
  analyze: (text: string, sender: string) =>
    request<OrderIntakeDraft>("/api/orders/intake/analyze", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ text, sender: sender.trim() || undefined }),
    }),
  getInbox: () => request<InboundEmailItem[]>("/api/orders/intake/inbox"),
  closeInboundEmail: (id: string, status: "CONVERTED" | "DISMISSED", extra: { orderIds?: string[]; confirm?: boolean } = {}) =>
    request<{ confirmationTo: string | null } | undefined>(`/api/orders/intake/inbox/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ status, ...(extra.orderIds?.length ? { orderId: extra.orderIds[0], orderIds: extra.orderIds } : {}), ...(extra.confirm ? { confirm: true } : {}) }),
    }),
  getChannels: () => request<IntakeChannels>("/api/company/intake-channels"),
  updateChannel: (action: IntakeChannelAction) =>
    request<IntakeChannels>("/api/company/intake-channels", {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify(action),
    }),
  /** La même clé est renvoyée à chaque clic sur une même livraison : une seule commande. */
  createOrder: (customerId: string, order: IntakeOrderInput, idempotencyKey: string) =>
    request<{ id: string; reference?: string }>("/api/orders/intake/orders", {
      method: "POST",
      headers: { ...jsonHeaders, "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ customerId, order }),
    }),
};
