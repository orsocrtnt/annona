import { createPrivateKey, sign } from "node:crypto";

/**
 * ADMIN-ESPACE, lot 5 : lecture seule d'une Google Sheet par un compte de service (API Google Sheets v4).
 * Aucune dépendance : le jeton OAuth est obtenu avec une assertion JWT signée par `node:crypto` (RS256),
 * portée `spreadsheets.readonly`. Les erreurs ne portent qu'un code et un statut HTTP : jamais la clé,
 * jamais le corps des réponses de Google.
 */

export const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const SHEETS_API_URL = "https://sheets.googleapis.com/v4/spreadsheets";
export const SHEETS_TIMEOUT_MS = 8_000;
/** Bornes de lecture : un fichier de prospection tient largement dedans. */
export const SHEETS_MAX_TABS = 30;
export const SHEETS_MAX_ROWS = 5_000;
const SHEETS_LAST_COLUMN = "AZ";

export type GoogleSheetsErrorCode =
  | "invalid_key"
  | "token_refused"
  | "access_denied"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "google_unavailable"
  | "invalid_response";

export class GoogleSheetsError extends Error {
  constructor(
    readonly code: GoogleSheetsErrorCode,
    readonly status: number | null = null
  ) {
    super(`google_sheets_${code}${status ? `_${status}` : ""}`);
    this.name = "GoogleSheetsError";
  }
}

export type ServiceAccount = { clientEmail: string; privateKey: string };
export type SheetTab = { title: string; values: unknown[][] };
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type SheetsDeps = { fetch?: FetchLike; now?: () => number; timeoutMs?: number };

/** Variable posée sur Vercel : « \n » littéraux et guillemets éventuels → clé PEM sur plusieurs lignes. */
export function normalizePrivateKey(raw: string) {
  let value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value.replace(/\\r/g, "").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

/** Assertion JWT du compte de service (RFC 7523), valable une heure. */
export function signServiceAccountAssertion(account: ServiceAccount, nowMs: number, scope = SHEETS_READONLY_SCOPE) {
  let key;
  try {
    key = createPrivateKey({ key: normalizePrivateKey(account.privateKey), format: "pem" });
  } catch {
    throw new GoogleSheetsError("invalid_key");
  }
  const iat = Math.floor(nowMs / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: account.clientEmail, scope, aud: GOOGLE_TOKEN_URL, iat, exp: iat + 3600 })
  );
  const unsigned = `${header}.${claims}`;
  let signature: Buffer;
  try {
    signature = sign("RSA-SHA256", Buffer.from(unsigned), key);
  } catch {
    throw new GoogleSheetsError("invalid_key");
  }
  return `${unsigned}.${base64url(signature)}`;
}

async function call(url: string, init: RequestInit, deps: SheetsDeps): Promise<Response> {
  const doFetch = deps.fetch ?? fetch;
  try {
    return await doFetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(deps.timeoutMs ?? SHEETS_TIMEOUT_MS) });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    throw new GoogleSheetsError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "google_unavailable");
  }
}

function httpError(status: number, step: "token" | "sheets") {
  if (step === "token") {
    if (status === 400 || status === 401 || status === 403) return new GoogleSheetsError("token_refused", status);
  } else {
    if (status === 401 || status === 403) return new GoogleSheetsError("access_denied", status);
    if (status === 404 || status === 400) return new GoogleSheetsError("not_found", status);
  }
  if (status === 429) return new GoogleSheetsError("rate_limited", status);
  return new GoogleSheetsError("google_unavailable", status);
}

/* ---------- Jeton d'accès, gardé en mémoire jusqu'à une minute de son expiration ---------- */

let cachedToken: { key: string; token: string; expiresAt: number } | null = null;

export function clearSheetsTokenCache() {
  cachedToken = null;
}

export async function fetchAccessToken(account: ServiceAccount, deps: SheetsDeps = {}): Promise<string> {
  const now = (deps.now ?? Date.now)();
  if (cachedToken && cachedToken.key === account.clientEmail && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.token;
  }
  const assertion = signServiceAccountAssertion(account, now);
  const response = await call(
    GOOGLE_TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }).toString(),
    },
    deps
  );
  if (!response.ok) throw httpError(response.status, "token");
  const json = (await response.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
  if (!json || typeof json.access_token !== "string" || json.access_token.length === 0) {
    throw new GoogleSheetsError("invalid_response");
  }
  const lifetime = typeof json.expires_in === "number" && json.expires_in > 0 ? json.expires_in : 3600;
  cachedToken = { key: account.clientEmail, token: json.access_token, expiresAt: now + lifetime * 1000 };
  return json.access_token;
}

/* ---------- Lecture des onglets ---------- */

/** `'Mode d''emploi'!A1:AZ5000` : nom d'onglet entre apostrophes, apostrophes doublées. */
export function tabRange(title: string) {
  return `'${title.replace(/'/g, "''")}'!A1:${SHEETS_LAST_COLUMN}${SHEETS_MAX_ROWS}`;
}

/**
 * Tous les onglets « grille » (au plus 30) en une seule lecture groupée. Valeurs brutes : les dates
 * saisies comme dates arrivent en numéro de série, indépendamment des réglages régionaux de la Sheet.
 */
export async function readSpreadsheetTabs(
  spreadsheetId: string,
  account: ServiceAccount,
  deps: SheetsDeps = {}
): Promise<SheetTab[]> {
  const token = await fetchAccessToken(account, deps);
  const headers = { Authorization: `Bearer ${token}` };
  const id = encodeURIComponent(spreadsheetId);

  const meta = await call(`${SHEETS_API_URL}/${id}?fields=sheets.properties(title,sheetType)`, { headers }, deps);
  if (!meta.ok) throw httpError(meta.status, "sheets");
  const metaJson = (await meta.json().catch(() => null)) as {
    sheets?: Array<{ properties?: { title?: unknown; sheetType?: unknown } }>;
  } | null;
  if (!metaJson || !Array.isArray(metaJson.sheets)) throw new GoogleSheetsError("invalid_response");
  const titles = metaJson.sheets
    .map((sheet) => sheet.properties)
    .filter((props) => props && typeof props.title === "string" && (props.sheetType ?? "GRID") === "GRID")
    .map((props) => props!.title as string)
    .slice(0, SHEETS_MAX_TABS);
  if (titles.length === 0) return [];

  const params = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  for (const title of titles) params.append("ranges", tabRange(title));
  const values = await call(`${SHEETS_API_URL}/${id}/values:batchGet?${params.toString()}`, { headers }, deps);
  if (!values.ok) throw httpError(values.status, "sheets");
  const valuesJson = (await values.json().catch(() => null)) as { valueRanges?: Array<{ values?: unknown }> } | null;
  if (!valuesJson || !Array.isArray(valuesJson.valueRanges)) throw new GoogleSheetsError("invalid_response");
  return titles.map((title, index) => {
    const raw = valuesJson.valueRanges?.[index]?.values;
    return { title, values: Array.isArray(raw) ? (raw.filter(Array.isArray) as unknown[][]) : [] };
  });
}
