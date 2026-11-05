// Latent.pk — AskAnalyst provider library (Task 116 Part B2/B6)
//
// Server-side data access extracted from the thin route proxies so route
// handlers never talk to themselves over HTTP (the removed loopback
// route-to-route fetch pattern). One canonical fetch path
// with: timeout, bounded retries + backoff, schema validation, and honest
// error propagation. Never fabricates a value on failure — callers must
// handle `null` and show the provider state.

const BASE_URL = process.env.ASKANALYST_BASE_URL || "https://api.askanalyst.com.pk";
const TIMEOUT_MS = 12_000;
const MAX_ATTEMPTS = 3;

export interface ProviderFetchResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
  attempts: number;
  retrievedAt: string; // retrieval timestamp (provider does not supply one)
  provider: string;
}

async function fetchWithRetry<T>(
  label: string,
  url: string,
  validate: (raw: unknown) => T | null
): Promise<ProviderFetchResult<T>> {
  let lastError = "unknown_error";
  let lastStatus: number | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      lastStatus = res.status;
      if (!res.ok) {
        lastError = `upstream_status_${res.status}`;
        // 4xx means the request itself is wrong — retrying will not help.
        if (res.status < 500) break;
      } else {
        const raw: unknown = await res.json();
        const validated = validate(raw);
        if (validated === null) {
          lastError = "schema_validation_failed";
          break;
        }
        return {
          ok: true,
          data: validated,
          attempts: attempt,
          retrievedAt: new Date().toISOString(),
          provider: `askanalyst (${BASE_URL}) — ${label}`,
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "network_error";
    }
    if (attempt < MAX_ATTEMPTS) {
      // bounded backoff: 300ms, 900ms
      await new Promise((r) => setTimeout(r, 300 * Math.pow(3, attempt - 1)));
    }
  }
  return { ok: false, error: lastError, status: lastStatus, attempts: MAX_ATTEMPTS, retrievedAt: new Date().toISOString(), provider: `askanalyst (${BASE_URL}) — ${label}` };
}

export interface AskAnalystRatioRow {
  symbol: string;
  raw: Record<string, unknown>;
}

/** Annual ratio rows (EPS/DPS/BVPS/…) for one symbol. Null on failure. */
export async function fetchAskAnalystRatios(symbol: string): Promise<ProviderFetchResult<AskAnalystRatioRow[]> | null> {
  const sym = symbol.toUpperCase().trim();
  if (!/^[A-Z0-9-]{2,12}$/.test(sym)) return null;
  return fetchWithRetry<AskAnalystRatioRow[]>(
    "ratios",
    `${BASE_URL}/api/rationew/${encodeURIComponent(sym)}`,
    (raw) => {
      // The upstream returns an array of annual ratio records (or an object
      // wrapping one). Accept either; validate rows are objects.
      const arr = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { ratios?: unknown }).ratios) ? (raw as { ratios: unknown[] }).ratios : null;
      if (!arr) return null;
      const rows = arr.filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !Array.isArray(r));
      return rows.length > 0 ? rows.map((r) => ({ symbol: sym, raw: r })) : null;
    }
  );
}

/** Valuation/sector-comps series used by the fair-value route. Null on failure. */
export async function fetchAskAnalystValuation(symbol: string): Promise<ProviderFetchResult<unknown> | null> {
  const sym = symbol.toUpperCase().trim();
  if (!/^[A-Z0-9-]{2,12}$/.test(sym)) return null;
  return fetchWithRetry<unknown>(
    "valuation",
    `${BASE_URL}/api/generatevaluation2/${encodeURIComponent(sym)}`,
    (raw) => (raw && typeof raw === "object" ? raw : null)
  );
}

/** Financial-statement series used by the fair-value route. Null on failure. */
export async function fetchAskAnalystFinancials(symbol: string): Promise<ProviderFetchResult<unknown> | null> {
  const sym = symbol.toUpperCase().trim();
  if (!/^[A-Z0-9-]{2,12}$/.test(sym)) return null;
  return fetchWithRetry<unknown>(
    "financials",
    `${BASE_URL}/api/financialstatement/${encodeURIComponent(sym)}`,
    (raw) => (raw && typeof raw === "object" ? raw : null)
  );
}
