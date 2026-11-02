/**
 * Task 103 — market-data feature-availability contract (spec Phase 4).
 *
 * Consumers MUST declare which index source they require. This module maps
 * underlying data states to exactly three consumer-facing availability states
 * and forbids silent switching between them:
 *
 *   verified_index  — genuine KSE-100 observations exist and are fresh enough
 *   internal_proxy  — explicitly-labeled proxy (pilot25 breadth) namespace
 *   unavailable     — feature must be treated as missing (regime => "unknown")
 *
 * A consumer requesting `verified_index` can NEVER receive proxy values: the
 * proxy lives in a different source namespace and is only served to callers
 * that explicitly ask for `internal_proxy`.
 */
import { kse100Status } from "./kse100-provider";

export type IndexSourceState = "verified_index" | "internal_proxy" | "unavailable";

export type RequestedSource = "verified_index" | "internal_proxy";

export interface IndexAvailability {
  requested: RequestedSource;
  state: IndexSourceState;
  /** last observation date of the underlying source, when one exists */
  asOf: string | null;
  stale: boolean;
  /** reason when state != requested */
  reason: string | null;
}

/** Genuine KSE-100 older than this many days is stale (PSX trades ~5d/week). */
const MAX_INDEX_AGE_DAYS = 14;

export function kse100Availability(nowIso: string = new Date().toISOString()): IndexAvailability {
  const st = kse100Status();
  if (st.status === "verified" || st.status === "partially_verified") {
    const last = st.range ? st.range[st.range.length - 1] : null;
    const ageDays = last
      ? (Date.parse(nowIso) - Date.parse(`${last}T17:00:00+05:00`)) / 86400_000
      : NaN;
    const stale = !(ageDays >= 0 && ageDays <= MAX_INDEX_AGE_DAYS);
    return {
      requested: "verified_index",
      state: stale ? "unavailable" : "verified_index",
      asOf: last,
      stale,
      reason: stale
        ? `genuine KSE-100 present but stale (last ${last}); consumers must treat as unavailable`
        : null,
    };
  }
  return {
    requested: "verified_index",
    state: "unavailable",
    asOf: null,
    stale: true,
    reason: `genuine KSE-100 ${st.status}: ${st.unblockPath}`,
  };
}

/**
 * Internal-proxy availability. Returns an EXPLICITLY LABELED proxy handle, or
 * unavailable. The label travels with every value so no UI/API can present it
 * as the KSE-100 index.
 */
export function internalProxyAvailability(hasProxySeries: boolean): {
  state: IndexSourceState;
  namespace: "market_internal_proxy";
  label: string;
  valueAllowed: boolean;
  reason: string | null;
} {
  return hasProxySeries
    ? { state: "internal_proxy", namespace: "market_internal_proxy",
         label: "internal proxy (pilot25 equal-weight breadth) — NOT the KSE-100 index",
         valueAllowed: true, reason: null }
    : { state: "unavailable", namespace: "market_internal_proxy",
         label: "internal proxy series absent",
         valueAllowed: false, reason: "no proxy series available either" };
}

/** Regime prediction gate: genuine index required; proxy users opt in explicitly. */
export function marketRegimeGate(source: RequestedSource): {
  decision: "index_features" | "proxy_features" | "unknown";
  label: string;
} {
  if (source === "verified_index") {
    const av = kse100Availability();
    return av.state === "verified_index"
      ? { decision: "index_features", label: "genuine KSE-100" }
      : { decision: "unknown", label: `regime unknown — ${av.reason}` };
  }
  return { decision: "proxy_features",
            label: "proxy-based regime (separate namespace, never presented as KSE-100)" };
}
