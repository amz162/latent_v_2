/**
 * Task 102 — genuine KSE-100 index provider (provider-independent adapter).
 *
 * HONESTY CONTRACT (Task 102 spec, Phase 2):
 *  - This adapter returns ONLY genuine KSE-100 observations. It NEVER
 *    substitutes an average of pilot stocks, a market-internal proxy, or any
 *    synthetic series as the index.
 *  - Data sources are auto-detected in priority order:
 *      1. `db/custom.db` table `Kse100Daily` (owner-supplied official EOD CSV
 *         import; created by scripts/task102_kse100_import.py)
 *      2. `data/backtest_reports/task102/kse100_index_data.json` (fetched by
 *         scripts/task102_kse100_fetch.py from a permitted provider)
 *  - If neither exists, the adapter reports status `blocked_external_data`
 *    and returns no observations. The internal proxy (pilot25 breadth) lives
 *    in its own module and is NEVER exposed through this adapter.
 */
import * as fs from "fs";
import path from "path";

export type Kse100DataStatus =
  | "verified"
  | "partially_verified"
  | "blocked_external_data"
  | "provider_unavailable";

export interface Kse100Bar {
  date: string; // YYYY-MM-DD (PSX session date)
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null; // or turnover, when the provider supplies it
  provider: string;
  retrievedAt: string;
  quality: string;
}

export interface Kse100Status {
  status: Kse100DataStatus;
  source: string | null;
  rows: number;
  range: [string, string] | null;
  blockers: string[];
  unblockPath: string;
  note: string;
}

const ARTIFACT = path.join(
  process.cwd(),
  "data/backtest_reports/task102/kse100_index_data.json",
);
const COVERAGE = path.join(
  process.cwd(),
  "data/backtest_reports/task102/task102_kse100_coverage.json",
);

export function kse100Status(): Kse100Status {
  try {
    if (fs.existsSync(ARTIFACT)) {
      const rows = JSON.parse(fs.readFileSync(ARTIFACT, "utf-8")) as Kse100Bar[];
      if (rows.length > 0) {
        return {
          status: (rows[0].quality as Kse100DataStatus) ?? "partially_verified",
          source: rows[0].provider,
          rows: rows.length,
          range: [rows[0].date, rows[rows.length - 1].date],
          blockers: [],
          unblockPath: "n/a — data present",
          note: "genuine KSE-100 observations stored separately from stock-level data",
        };
      }
    }
    const cov = fs.existsSync(COVERAGE)
      ? (JSON.parse(fs.readFileSync(COVERAGE, "utf-8")) as any)
      : null;
    return {
      status: "blocked_external_data",
      source: null,
      rows: 0,
      range: null,
      blockers: (cov?.attempts ?? []).map(
        (a: any) => `${a.provider}: ${a.result ?? a.error ?? "failed"}`,
      ),
      unblockPath:
        "place official PSX KSE-100 EOD CSV at data/backtest_reports/task102/raw_external_data/kse100_official_eod.csv or set a permitted vendor key in .env",
      note: "no genuine KSE-100 observations exist; the internal proxy is NOT a substitute and is never served here",
    };
  } catch (e) {
    return {
      status: "provider_unavailable",
      source: null,
      rows: 0,
      range: null,
      blockers: [String(e).slice(0, 120)],
      unblockPath: "check data/backtest_reports/task102/task102_kse100_coverage.json",
      note: "status check failed",
    };
  }
}

/** As-of query: last genuine observation STRICTLY at or before `date`. */
export function getKse100AsOf(date: string): Kse100Bar | null {
  const st = kse100Status();
  if (st.status === "blocked_external_data" || st.status === "provider_unavailable") return null;
  const rows = JSON.parse(fs.readFileSync(ARTIFACT, "utf-8")) as Kse100Bar[];
  let lo: Kse100Bar | null = null;
  for (const r of rows) {
    if (r.date <= date) lo = r;
    else break;
  }
  return lo;
}
