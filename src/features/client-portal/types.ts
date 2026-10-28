import type {
  OrderStatus,
  DeliveryCategory,
  DeliveryStatus,
  InvoiceStatus,
  SupportTicketStatus,
  RecurrenceFrequency,
  RecurrenceStatus,
  SupportContactType,
} from "@prisma/client";

export interface PortalDashboardStats {
  activeOrders: number;
  inDelivery: number;
  deliveredThisMonth: number;
  nextDeliveryEta: string | null;
  orderCount?: number;
  recentDeliveries?: {
    id: string;
    reference: string;
    status: import("@prisma/client").DeliveryStatus;
    deliveryCategory?: DeliveryCategory;
    address: string;
    city: string | null;
  }[];
}

export interface PortalOrder {
  id: string;
  reference: string;
  status: OrderStatus;
  source?: string;
  totalAmount: string | number;
  itemCount: number;
  createdAt: string;
  deliveryCategory?: DeliveryCategory;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupPostalCode?: string | null;
  pickupInstructions?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingPostalCode?: string | null;
  deliveryInstructions?: string | null;
  requestedDeliveryDate?: string | null;
  notes?: string | null;
  missionDescription?: string | null;
  stops?: {
    id: string;
    sequence: number;
    label?: string | null;
    address: string;
    city?: string | null;
    postalCode?: string | null;
    instructions?: string | null;
    items?: { id: string; name: string; quantity: number; unitPrice: string | number }[];
  }[];
  items?: {
    id: string;
    name: string;
    quantity: number;
    unitPrice: string | number;
    orderStopId?: string | null;
  }[];
  deliveries?: { id: string; reference: string; status: DeliveryStatus }[];
  invoices?: {
    id: string;
    reference: string;
    status: InvoiceStatus;
    amount: string | number;
  }[];
}

export interface PortalDelivery {
  id: string;
  orderId: string;
  reference: string;
  status: DeliveryStatus;
  /** Fiche livraison uniquement : échéance et retard selon la règle serveur (UX-03). */
  timing?: { dueAt: string | null; late: boolean; lateByMinutes: number | null };
  deliveryCategory?: DeliveryCategory;
  address: string;
  city: string | null;
  postalCode: string | null;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupPostalCode?: string | null;
  driverName: string | null;
  missionAcceptedAt: string | null;
  missionStartedAt: string | null;
  estimatedArrival: string | null;
  completedAt: string | null;
  createdAt: string;
  order?: {
    reference: string;
    status?: OrderStatus;
    totalAmount?: string | number;
    deliveryCategory?: DeliveryCategory;
    shippingAddress?: string | null;
    shippingCity?: string | null;
    shippingPostalCode?: string | null;
    deliveryInstructions?: string | null;
    pickupAddress?: string | null;
    pickupCity?: string | null;
    pickupPostalCode?: string | null;
    pickupInstructions?: string | null;
    stops?: {
      id: string;
      sequence: number;
      label?: string | null;
      address: string;
      city?: string | null;
      postalCode?: string | null;
      instructions?: string | null;
    }[];
  };
  company?: { name: string; phone: string | null; email: string | null };
  /** Prénom du livreur ; téléphone seulement si l'entreprise ne l'a pas masqué. */
  driver?: { firstName: string; phone?: string | null } | null;
  trackingEvents?: {
    id: string;
    label: string;
    description: string | null;
    latitude: number | null;
    longitude: number | null;
    occurredAt: string;
  }[];
  podPhotoUrl?: string | null;
  podFailureCode?: string | null;
  podNote?: string | null;
  podOutcome?: string | null;
  podSignatureUrl?: string | null;
  podPdfUrl?: string | null;
  podRecipientName?: string | null;
  podSignatureRefusedReason?: string | null;
}

export interface PortalInvoiceLineItem {
  label: string;
  amount: number;
  quantity: number;
  sourceType: "ZONE" | "FEE" | "PURCHASE" | "CUSTOM";
  sourceId?: string;
}

export interface PortalInvoice {
  id: string;
  reference: string;
  status: InvoiceStatus;
  amount: string | number;
  lineItems?: PortalInvoiceLineItem[];
  notes?: string | null;
  dueDate: string | null;
  paidAt: string | null;
  pdfUrl?: string | null;
  createdAt: string;
  order?: {
    id: string;
    reference: string;
    status?: OrderStatus;
    deliveryCategory?: DeliveryCategory;
    totalAmount?: string | number;
  };
  company?: { name: string; email: string | null; address: string | null; city: string | null };
}

export interface PortalSupportTicket {
  id: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  contactType?: SupportContactType | null;
  createdAt: string;
  relatedOrder?: { reference: string } | null;
  relatedDelivery?: { reference: string } | null;
  messages?: { id: string; body: string; isStaff: boolean; createdAt: string }[];
}

export interface PortalRecurringOrder {
  id: string;
  label: string;
  frequency: RecurrenceFrequency;
  intervalValue: number;
  intervalUnit: "DAYS" | "WEEKS" | "MONTHS";
  status: RecurrenceStatus;
  startAt: string;
  nextRunAt: string;
  endAt: string | null;
  deliveryCategory: DeliveryCategory;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupPostalCode?: string | null;
  pickupInstructions?: string | null;
  pickupStops?: {
    label?: string | null;
    address: string;
    city?: string | null;
    postalCode?: string | null;
    instructions?: string | null;
  }[];
  shippingAddress: string;
  shippingCity: string | null;
  shippingPostalCode: string | null;
  deliveryInstructions?: string | null;
  notes?: string | null;
  items: { name: string; quantity: number; estimatedPrice?: number }[];
}

export interface PortalAddress {
  id: string;
  label: string;
  address: string;
  city: string | null;
  postalCode: string | null;
  isDefault: boolean;
}

export interface PortalSupportContacts {
  recommended: "ADMIN" | "DRIVER";
  admin: { name: string; email: string | null; phone: string | null };
  driver: {
    name: string;
    phone: string | null;
    deliveryReference: string;
  } | null;
  delivery: { id: string; reference: string; status: DeliveryStatus } | null;
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
