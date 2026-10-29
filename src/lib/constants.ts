export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Tutelliv";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
/**
 * Adresse de support publique, seulement si elle est configurée : aucune adresse par défaut, la boîte
 * `support@tutelliv.fr` n'existant pas (domaine non acheté). Sans configuration, les liens mènent à /contact.
 */
export const SUPPORT_EMAIL: string | null = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",

  // Back Office
  ADMIN_DASHBOARD: "/admin",
  COMPANY_DASHBOARD: "/dashboard",
  DISPATCHER_DASHBOARD: "/dispatch",
  SETTINGS: "/settings",
  USERS: "/users",
  COMPANIES: "/companies",

  // Client Portal
  CLIENT_PORTAL: "/portal",
  CLIENT_ORDERS: "/portal/orders",
  CLIENT_DELIVERIES: "/portal/deliveries",
  CLIENT_INVOICES: "/portal/invoices",
  CLIENT_SUPPORT: "/portal/support",

  // Driver App
  DRIVER_APP: "/driver",
  DRIVER_MISSIONS: "/driver/missions",
  DRIVER_PROFILE: "/driver/profile",
} as const;

export const PUBLIC_ROUTES = [
  ROUTES.HOME,
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
] as const;

export const AUTH_ROUTES = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
  "/login/client",
  "/login/driver",
] as const;
