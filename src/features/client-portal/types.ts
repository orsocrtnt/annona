import type { StopStatus, SupportTicketStatus, SupportContactType } from "@prisma/client";

export interface PortalSupportTicket {
  id: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  contactType?: SupportContactType | null;
  createdAt: string;
  relatedOrder?: { reference: string } | null;
  messages?: { id: string; body: string; isStaff: boolean; createdAt: string }[];
}

export interface PortalSupportContacts {
  recommended: "ADMIN" | "DRIVER";
  admin: { name: string; email: string | null; phone: string | null };
  driver: {
    name: string;
    phone: string | null;
    deliveryReference: string;
  } | null;
  /** Commande en tournée (ou livrée depuis moins de 24 h) à laquelle se rattache le livreur proposé. */
  delivery: { id: string; reference: string; status: StopStatus } | null;
}

export interface PortalSettings {
  emailNotifications: boolean;
  smsNotifications: boolean;
  deliveryAlerts: boolean;
  invoiceAlerts: boolean;
  emailConfigured?: boolean;
  emailMode?: "disabled" | "test" | "live";
}

export interface PortalClientNotification {
  id: string;
  type: "DELIVERY" | "INVOICE" | "SUPPORT";
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}
