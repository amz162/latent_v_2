/**
 * Task 102 — intraday data provider abstraction (spec Phase 5).
 *
 * HONESTY CONTRACT:
 *  - This module NEVER manufactures intraday candles from daily OHLC data.
 *  - No provider is configured in this environment; ingestion is a pluggable
 *    interface so the rest of the system never becomes provider-dependent.
 *  - Synthetic fixtures exist ONLY for software tests and are structurally
 *    impossible to mix with real data (they carry provider "SYNTHETIC_TEST").
 */
export interface IntradayBar {
  symbol: string;
  interval: "1m" | "5m" | "15m" | "30m" | "1h";
  ts: string; // ISO instant (PSX session time)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  provider: string;
  quality: "verified" | "partially_verified" | "synthetic_test_only";
}

export interface IntradayProvider {
  readonly id: string;
  /** Returns bars for a symbol/session, or null when the provider has no data. */
  fetchIntraday(symbol: string, sessionDate: string, interval: IntradayBar["interval"]):
    Promise<IntradayBar[] | null>;
}

export const INTRADAY_PROVIDER_CONFIGURED: string | null =
  process.env.INTRADAY_DATA_PROVIDER ?? null;

export function intradayStatus(): {
  configuredProvider: string | null;
  status: "provider_unavailable" | "configured";
  note: string;
} {
  return {
    configuredProvider: INTRADAY_PROVIDER_CONFIGURED,
    status: INTRADAY_PROVIDER_CONFIGURED ? "configured" : "provider_unavailable",
    note:
      "No legitimate intraday PSX source exists in this environment. All execution-realism " +
      "findings elsewhere are daily-OHLC approximations and are labeled as such.",
  };
}
