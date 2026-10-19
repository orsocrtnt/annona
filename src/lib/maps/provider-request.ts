import { PROVIDER_TIMEOUT_MS } from "@/lib/maps/provider-config";

/** Bounds both the request and body parsing; callers decide their unavailable state. */
export async function fetchProviderJson(url: string, signal?: AbortSignal, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`Provider HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("Provider timeout")); }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
