const API_PATH = "/api/driver/push-subscription";
const SERVICE_WORKER_PATH = "/sw.js";

export type DriverPushAvailability = "unavailable" | "install-required" | "denied" | "ready";

export function getDriverPushAvailability(input: {
  publicKey: string | undefined;
  supported: boolean;
  ios: boolean;
  standalone: boolean;
  permission: string | null;
}): DriverPushAvailability {
  // Sur iPhone, les notifications n'existent qu'une fois le site ajouté à l'écran d'accueil.
  if (input.ios && !input.standalone) return "install-required";
  if (!input.publicKey || !input.supported) return "unavailable";
  if (input.permission === "denied") return "denied";
  return "ready";
}

export function readDriverPushAvailability(): DriverPushAvailability {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return getDriverPushAvailability({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    supported: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    ios,
    standalone: window.matchMedia("(display-mode: standalone)").matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    permission: "Notification" in window ? Notification.permission : null,
  });
}

export function vapidKeyToBytes(key: string) {
  const padded = `${key}${"=".repeat((4 - (key.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function callApi(method: "POST" | "DELETE", body: unknown) {
  const response = await fetch(API_PATH, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("DRIVER_PUSH_API_FAILED");
}

async function currentSubscription() {
  if (!("serviceWorker" in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function isDriverPushEnabled() {
  return (await currentSubscription()) !== null;
}

export async function enableDriverPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("DRIVER_PUSH_NOT_CONFIGURED");
  if ((await Notification.requestPermission()) !== "granted") return false;
  await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription()
    ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyToBytes(publicKey),
    });
  await callApi("POST", subscription.toJSON());
  return true;
}

/** Retire d'abord côté serveur : un abonnement encore connu ferait sonner un compte déconnecté. */
export async function disableDriverPush() {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await callApi("DELETE", { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
}
