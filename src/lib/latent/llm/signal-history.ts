// ============================================================================
// Task 112/113 — server-side access to the append-only LLM signal history.
//
// Store: data/backtest_reports/task112/llm_signal_history/{signalId}.json
// (append-only; one file per decision; retries/older runs kept separately and
// distinguished by evidence hash + decision timestamp + provenance).
// This module NEVER mutates the store — it reads, filters and paginates.
//
// Task 113: every record carries an explicit `recordType` so mock
// pipeline-check records (MOCK_PIPELINE_CHECK) can never contaminate real LLM
// performance / forward-outcome / win-rate / calibration metrics, which are all
// derived exclusively from REAL_LLM_DECISION records. Mock records are visible
// in the UI only when the includeMock opt-in filter is selected.
// ============================================================================
import { promises as fs } from "fs";
import path from "path";

export type RecordType = "REAL_LLM_DECISION" | "MOCK_PIPELINE_CHECK";

export interface SignalHistoryRecord {
  signalId: string;
  symbol: string;
  companyName: string | null;
  decision: string | null;
  llmState: string;
  llmFailureReason: string | null;
  parseErrors: string[] | null;
  decisionTimestamp: string | null;
  dataCutoff: string | null;
  evidenceHash: string | null;
  evidenceSchemaVersion: string | null;
  outputSchemaVersion: string | null;
  promptVersion: string | null;
  provider: string | null;
  model: string | null;
  llmConvictionScore: number | null;
  calibratedNetPositiveProbability: null;
  evidenceQualityScore: number | null;
  llmSignal: string | null;
  finalSignalReason: string | null;
  riskReward: Record<string, unknown> | null;
  capitalProtection: Record<string, unknown> | null;
  generationId: string | null;
  forwardCohortId: string | null;
  validationStatus: string;
  rejectionReason: string | null;
  researchStatus: string;
  riskPolicyVersion: string | null;
  provenance: string;
  evidenceRef: string | null;
  mockRecord: boolean;
  staleSkipped: boolean;
  // Task 113: explicit record type. REAL_LLM_DECISION records are the only
  // records eligible for any performance/outcome metric. MOCK_PIPELINE_CHECK
  // records are retained for provenance/audit and shown only via includeMock.
  recordType: RecordType;
}

const ROOT = process.cwd();
const HIST_DIR = path.join(ROOT, "data", "backtest_reports", "task112", "llm_signal_history");
const EVIDENCE_DIR = path.join(ROOT, "data", "backtest_reports", "task111", "signals");

export interface SignalFilter {
  symbol?: string;
  company?: string;
  decision?: string;
  from?: string; // YYYY-MM-DD on decisionTimestamp
  to?: string;
  provider?: string;
  promptVersion?: string;
  cohort?: string;
  freshness?: string; // fresh | stale
  validationStatus?: string;
  evidenceCompleteness?: string; // complete | partial | missing
  q?: string; // symbol or company substring
  includeMock?: boolean;
  recordType?: RecordType; // Task 113: filter by explicit record type
}

/** Derive the explicit record type from a persisted record. Records written
 * before Task 113 lack the `recordType` field; derive it from mockRecord so
 * every metric path can rely on a non-null value. */
export function recordTypeOf(r: Pick<SignalHistoryRecord, "mockRecord" | "recordType">): RecordType {
  if (r.recordType === "REAL_LLM_DECISION" || r.recordType === "MOCK_PIPELINE_CHECK") return r.recordType;
  return r.mockRecord ? "MOCK_PIPELINE_CHECK" : "REAL_LLM_DECISION";
}

export async function loadAllRecords(): Promise<SignalHistoryRecord[]> {
  try {
    const files = (await fs.readdir(HIST_DIR)).filter((f) => f.endsWith(".json"));
    const rows: SignalHistoryRecord[] = [];
    for (const f of files) {
      try {
        const r = JSON.parse(await fs.readFile(path.join(HIST_DIR, f), "utf8")) as SignalHistoryRecord;
        // normalize pre-Task-113 records: guarantee a non-null recordType
        if (!r.recordType) (r as SignalHistoryRecord).recordType = recordTypeOf(r);
        rows.push(r);
      } catch {
        /* skip unreadable */
      }
    }
    rows.sort((a, b) => String(b.decisionTimestamp ?? "").localeCompare(String(a.decisionTimestamp ?? "")));
    return rows;
  } catch {
    return [];
  }
}

export function freshnessOf(r: SignalHistoryRecord, nowMs: number = Date.now()): "fresh" | "stale" {
  if (r.staleSkipped) return "stale";
  const t = Date.parse(String(r.dataCutoff ?? "") + "T17:00:00Z");
  if (!isFinite(t)) return "stale";
  return nowMs - t <= 10 * 24 * 3600 * 1000 ? "fresh" : "stale";
}

function evidenceCompletenessOf(r: SignalHistoryRecord): "complete" | "partial" | "missing" {
  const rr = r.riskReward as { risk_reward_status?: string } | null;
  if (r.llmState === "ok" && r.evidenceQualityScore != null && rr?.risk_reward_status) return "complete";
  if (r.evidenceQualityScore != null) return "partial";
  return "missing";
}

export function applyFilter(records: SignalHistoryRecord[], f: SignalFilter, nowMs: number = Date.now()): SignalHistoryRecord[] {
  const q = (f.q ?? "").trim().toUpperCase();
  return records.filter((r) => {
    const rt = recordTypeOf(r);
    // Task 113: mock records are excluded from every default view and every
    // metric path unless includeMock is opted in. This is enforced on the
    // explicit recordType so it cannot be bypassed by a stale mockRecord flag.
    if (rt === "MOCK_PIPELINE_CHECK" && !f.includeMock) return false;
    if (f.recordType && rt !== f.recordType) return false;
    if (f.symbol && r.symbol !== f.symbol.toUpperCase()) return false;
    if (f.company && !(r.companyName ?? "").toUpperCase().includes(f.company.toUpperCase())) return false;
    if (f.decision && r.decision !== f.decision && r.llmState !== f.decision) return false;
    if (f.from && String(r.decisionTimestamp ?? "").slice(0, 10) < f.from) return false;
    if (f.to && String(r.decisionTimestamp ?? "").slice(0, 10) > f.to) return false;
    if (f.provider && r.provider !== f.provider) return false;
    if (f.promptVersion && r.promptVersion !== f.promptVersion) return false;
    if (f.cohort && (r.forwardCohortId ?? "") !== f.cohort) return false;
    if (f.freshness && freshnessOf(r, nowMs) !== f.freshness) return false;
    if (f.validationStatus && r.validationStatus !== f.validationStatus) return false;
    if (f.evidenceCompleteness && evidenceCompletenessOf(r) !== f.evidenceCompleteness) return false;
    if (q && !(r.symbol ?? "").includes(q) && !(r.companyName ?? "").toUpperCase().includes(q)) return false;
    return true;
  });
}

export interface PagedSignals {
  records: SignalHistoryRecord[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  facets: {
    decisions: Record<string, number>;
    states: Record<string, number>;
    providers: string[];
    promptVersions: string[];
    cohorts: string[];
    symbols: string[];
    recordTypes: Record<string, number>;
    lastUpdatedAt: string | null;
  };
}

export async function querySignals(f: SignalFilter, page = 1, pageSize = 25): Promise<PagedSignals> {
  const all = await loadAllRecords();
  const filtered = applyFilter(all, f);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const p = Math.min(Math.max(1, page), pages);
  const slice = filtered.slice((p - 1) * pageSize, p * pageSize);
  const by = (fn: (r: SignalHistoryRecord) => string | null) => {
    const c: Record<string, number> = {};
    for (const r of filtered) {
      const k = fn(r) ?? "unknown";
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  };
  const lastTs = filtered
    .map((r) => r.decisionTimestamp)
    .filter((t): t is string => Boolean(t))
    .sort()
    .pop();
  return {
    records: slice,
    total: filtered.length,
    page: p,
    pageSize,
    pages,
    facets: {
      decisions: by((r) => r.decision),
      states: by((r) => r.llmState),
      providers: [...new Set(filtered.map((r) => `${r.provider}/${r.model}`))].sort(),
      promptVersions: [...new Set(filtered.map((r) => r.promptVersion ?? ""))].filter(Boolean).sort(),
      cohorts: [...new Set(filtered.map((r) => r.forwardCohortId ?? ""))].filter(Boolean).sort(),
      symbols: [...new Set(filtered.map((r) => r.symbol ?? ""))].filter(Boolean).sort(),
      recordTypes: by((r) => recordTypeOf(r)),
      lastUpdatedAt: lastTs ?? null,
    },
  };
}

export async function findRecord(signalId: string): Promise<SignalHistoryRecord | null> {
  // signal ids contain ':'-safe chars only; defense against path traversal
  if (!/^[A-Z0-9A-Za-z:\-_.]+$/.test(signalId)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(HIST_DIR, `${signalId}.json`), "utf8"));
  } catch {
    return null;
  }
}

/** Attach the stored evidence package (when retained) for the detail view. */
export async function findEvidence(symbol: string): Promise<Record<string, unknown> | null> {
  try {
    const p = path.join(EVIDENCE_DIR, `${symbol.toUpperCase()}.evidence.json`);
    const d = JSON.parse(await fs.readFile(p, "utf8"));
    return d.evidence ?? null;
  } catch {
    return null;
  }
}
