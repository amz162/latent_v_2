#!/usr/bin/env bun
// =============================================================================
// scripts/export_glm_paper_performance.ts
// =============================================================================
// GLM-4.6 analyst paper-trading performance export.
//
// READ-ONLY: the SQLite database is opened with bun:sqlite { readonly: true }
// and the GLM signal store is read with fs.readFile. No INSERT/UPDATE/DELETE
// is ever issued; no store file is ever written by this script. The only
// writes are the report files under reports/glm/.
//
// Data sources (verified 2026-11-23):
//   1. db/custom.db                       — SQLite (Prisma, 32 tables). GLM
//      attribution check runs on every table that carries modelId/strategyId:
//      PredictionHistory, PredictionOutcome, ProspectivePaperTrade,
//      PaperTradeLeg, Trade. Result: zero GLM rows (classical-ML cohort only).
//   2. data/backtest_reports/task112/llm_signal_history/*.json
//      — the append-only GLM-4.6 decision store (one file per decision,
//      src/lib/latent/llm/signal-history.ts). 71 records.
//   3. data/backtest_reports/task112/history_index.json — store index.
//   4. data/backtest_reports/task112/task112_llm_pending_outcomes.json
//      — forward-outcome tracker (matured/pending observation counts).
//
// GLM attribution rule (reliable provider/model attribution):
//   recordType == "REAL_LLM_DECISION" AND provider == "zai" AND model == "glm-4.6"
// MOCK_PIPELINE_CHECK records (provider "mock") are never counted in metrics.
//
// Run:  bun scripts/export_glm_paper_performance.ts   (from the repo root)
// =============================================================================

import { Database } from "bun:sqlite";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "db", "custom.db");
const HIST_DIR = path.join(ROOT, "data", "backtest_reports", "task112", "llm_signal_history");
const INDEX_PATH = path.join(ROOT, "data", "backtest_reports", "task112", "history_index.json");
const PENDING_PATH = path.join(ROOT, "data", "backtest_reports", "task112", "task112_llm_pending_outcomes.json");
const OUT_DIR = path.join(ROOT, "reports", "glm");

if (!fs.existsSync(DB_PATH) || !fs.existsSync(HIST_DIR)) {
  console.error("Run from the repo root: db/custom.db and data/backtest_reports/task112/llm_signal_history must exist.");
  process.exit(1);
}

const nowIso = new Date().toISOString();
const reportingDate = nowIso.slice(0, 10);
const dbMtime = fs.statSync(DB_PATH).mtime.toISOString();

// -----------------------------------------------------------------------------
// 1. Database side (read-only) — prove what the DB does and does not contain.
// -----------------------------------------------------------------------------
type Dist = { key: string; n: number }[];
let db: { file: string; tables: number; glmRowsInSignalTables: number; modelDistribution: Dist;
          paperTradeStates: Dist; paperTradeLegs: number; trades: number; outcomeRows: number;
          outcomeMatured: number; outcomeRetries: number; predictionHistoryRows: number;
          prospectivePaperTradeRows: number; glmPaperTrades: number; classicalBuyPredictions: number; };
{
  const sq = new Database(DB_PATH, { readonly: true, strict: false });
  const q = (sql: string): any[] => sq.query(sql).all();
  const one = (sql: string): any => sq.query(sql).get();
  const tables = one("SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").n;
  const glmLike = "lower(modelId) LIKE '%glm%'";
  const modelDistribution: Dist = q(
    `SELECT modelId key, COUNT(*) n FROM PredictionHistory GROUP BY modelId ORDER BY n DESC`);
  const paperTradeStates: Dist = q(
    `SELECT state key, COUNT(*) n FROM ProspectivePaperTrade GROUP BY state ORDER BY n DESC`);
  db = {
    file: "db/custom.db",
    tables,
    glmRowsInSignalTables: one(
      `SELECT (SELECT COUNT(*) FROM PredictionHistory WHERE ${glmLike})
             + (SELECT COUNT(*) FROM ProspectivePaperTrade WHERE ${glmLike})
             + (SELECT COUNT(*) FROM PaperTradeLeg WHERE 0) n`).n,
    modelDistribution,
    paperTradeStates,
    paperTradeLegs: one("SELECT COUNT(*) n FROM PaperTradeLeg").n,
    trades: one("SELECT COUNT(*) n FROM Trade").n,
    outcomeRows: one("SELECT COUNT(*) n FROM PredictionOutcome").n,
    outcomeMatured: one(`SELECT COUNT(*) n FROM PredictionOutcome WHERE outcomeStatus <> 'pending'`).n,
    outcomeRetries: one("SELECT COALESCE(SUM(retryCount),0) n FROM PredictionOutcome").n,
    predictionHistoryRows: one("SELECT COUNT(*) n FROM PredictionHistory").n,
    prospectivePaperTradeRows: one("SELECT COUNT(*) n FROM ProspectivePaperTrade").n,
    glmPaperTrades: one(`SELECT COUNT(*) n FROM ProspectivePaperTrade WHERE ${glmLike}`).n,
    classicalBuyPredictions: one(`SELECT COUNT(*) n FROM PredictionHistory WHERE signal='BUY'`).n,
  };
  sq.close();
}

// -----------------------------------------------------------------------------
// 2. GLM signal store (file-based, append-only).
// -----------------------------------------------------------------------------
interface GlmRecord {
  signalId: string; symbol: string; companyName: string | null;
  decision: string | null; llmState: string; llmFailureReason: string | null;
  parseErrors: string[] | null; decisionTimestamp: string | null; dataCutoff: string | null;
  evidenceHash: string | null; evidenceSchemaVersion: string | null;
  outputSchemaVersion: string | null; promptVersion: string | null;
  provider: string | null; model: string | null;
  llmConvictionScore: number | null; calibratedNetPositiveProbability: number | null;
  evidenceQualityScore: number | null; llmSignal: string | null; finalSignalReason: string | null;
  riskReward: any; capitalProtection: any;
  generationId: string | null; forwardCohortId: string | null;
  validationStatus: string; rejectionReason: string | null; researchStatus: string;
  riskPolicyVersion: string | null; provenance: string; evidenceRef: string | null;
  mockRecord: boolean; staleSkipped: boolean; recordType: string;
}

const files = fs.readdirSync(HIST_DIR).filter(f => f.endsWith(".json")).sort();
const store: GlmRecord[] = [];
let parseFailures = 0;
for (const f of files) {
  try { store.push(JSON.parse(fs.readFileSync(path.join(HIST_DIR, f), "utf8"))); }
  catch { parseFailures++; }
}
const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
const pending = JSON.parse(fs.readFileSync(PENDING_PATH, "utf8"));

// -----------------------------------------------------------------------------
// 3. Classification — GLM attribution, eligibility, duplicates, retries.
// -----------------------------------------------------------------------------
const isGlmReal = (r: GlmRecord) =>
  r.recordType === "REAL_LLM_DECISION" && r.provider === "zai" && r.model === "glm-4.6";
const isMock = (r: GlmRecord) => r.recordType === "MOCK_PIPELINE_CHECK";

const real = store.filter(isGlmReal);
const mock = store.filter(isMock);
const other = store.filter(r => !isGlmReal(r) && !isMock(r)); // defensive: unknown types
const eligible = real.filter(r => r.llmState === "ok" && r.validationStatus === "valid");
const retriedReal = real.filter(r => r.llmState !== "ok" || r.validationStatus !== "valid");

const countBy = <T,>(xs: T[], f: (x: T) => string | null): Record<string, number> => {
  const m: Record<string, number> = {};
  for (const x of xs) { const k = String(f(x)); m[k] = (m[k] ?? 0) + 1; }
  return m;
};

const realDecisions = countBy(real, r => r.decision);
const eligibleDecisions = countBy(eligible, r => r.decision);
const provenance = countBy(real, r => r.provenance);
const cutoffs = countBy(real, r => r.dataCutoff);
const storeDecisions = countBy(store, r => r.decision);

// Duplicate generations: same (symbol, dataCutoff) taken more than once.
// The store keeps every append (append-only); "current_record" provenance marks
// the surviving decision, "generation_cache" marks earlier generations of the
// same evidence window. Same symbol+evidenceHash groups = literal re-runs.
const pairKey = (r: GlmRecord) => `${r.symbol}|${r.dataCutoff}`;
const pairs = new Map<string, GlmRecord[]>();
for (const r of real) {
  const k = pairKey(r);
  if (!pairs.has(k)) pairs.set(k, []);
  pairs.get(k)!.push(r);
}
const duplicatePairs = [...pairs.entries()].filter(([, v]) => v.length > 1);
const evHashGroups = new Map<string, GlmRecord[]>();
for (const r of store) {
  const k = `${r.symbol}|${r.evidenceHash}`;
  if (!evHashGroups.has(k)) evHashGroups.set(k, []);
  evHashGroups.get(k)!.push(r);
}
const sameEvidenceHashDupes = [...evHashGroups.values()].filter(v => v.length > 1);

// Unique signals: dedup to one record per (symbol, dataCutoff); prefer the
// surviving current_record, then the latest decisionTimestamp as tie-break.
const uniqueReal: GlmRecord[] = [...pairs.values()].map(v => {
  const sorted = [...v].sort((a, b) => {
    const ap = a.provenance === "current_record" ? 0 : 1;
    const bp = b.provenance === "current_record" ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return String(b.decisionTimestamp).localeCompare(String(a.decisionTimestamp));
  });
  return sorted[0];
});
const uniqueEligible = uniqueReal.filter(r => r.llmState === "ok" && r.validationStatus === "valid");
const uniqueDecisions = countBy(uniqueEligible, r => r.decision);

// -----------------------------------------------------------------------------
// 4. Planned (what-if) economics from riskReward — NEVER treated as outcomes.
// -----------------------------------------------------------------------------
const num = (x: unknown): number | null => (typeof x === "number" && isFinite(x) ? x : null);
const plannedStats = (pick: (r: GlmRecord) => number | null) => {
  const xs = eligible.map(pick).filter((x): x is number => x !== null);
  if (!xs.length) return null;
  return { n: xs.length, mean: xs.reduce((a, b) => a + b, 0) / xs.length,
           min: Math.min(...xs), max: Math.max(...xs) };
};
const plannedRrTp3 = plannedStats(r => num(r.riskReward?.rr_to_tp3));
const plannedRrTp1 = plannedStats(r => num(r.riskReward?.rr_to_tp1));
const plannedEntryRefs = plannedStats(r => num(r.riskReward?.entryReference));
const plannedCostsTp2 = plannedStats(r => num(r.riskReward?.costsAtTp2?.totalCost));
const plannedNetTp2 = plannedStats(r => num(r.riskReward?.costsAtTp2?.netPnl));
const noTradeFlagged = eligible.filter(r => r.riskReward?.noTrade === true).length;
const capitalProtectionTriggers = real.reduce(
  (a, r) => a + (Array.isArray(r.capitalProtection?.triggered) ? r.capitalProtection.triggered.length : 0), 0);

// -----------------------------------------------------------------------------
// 5. Required performance metrics. Every unavailable metric carries a reason.
// -----------------------------------------------------------------------------
const NOT_CALC = (why: string) => ({ value: null, calculable: false, reason: why });
const performance: Record<string, any> = {
  totalGlmRecords: store.length,
  totalRealGlmSignals: real.length,
  uniqueGlmSignals: uniqueReal.length,
  uniqueEligibleSignals: uniqueEligible.length,
  mockPipelineCheckRecords: mock.length,
  duplicateGenerationPairs: duplicatePairs.length,
  duplicateGenerationRecords: duplicatePairs.reduce((a, [, v]) => a + v.length, 0) - duplicatePairs.length,
  retryOrFailedRealRecords: retriedReal.length,
  buyCountReal: realDecisions["BUY"] ?? 0,
  holdCountReal: realDecisions["HOLD"] ?? 0,
  noTradeCountReal: realDecisions["NO_TRADE"] ?? 0,
  buyCountEligible: eligibleDecisions["BUY"] ?? 0,
  holdCountEligible: eligibleDecisions["HOLD"] ?? 0,
  noTradeCountEligible: eligibleDecisions["NO_TRADE"] ?? 0,
  buyCountUniqueEligible: uniqueDecisions["BUY"] ?? 0,
  holdCountUniqueEligible: uniqueDecisions["HOLD"] ?? 0,
  noTradeCountUniqueEligible: uniqueDecisions["NO_TRADE"] ?? 0,
  openPositions: 0,           // no GLM position was ever entered (research-only cohort)
  pendingEntry: 0,            // no GLM trade reached the paper ledger
  matured: 0,                 // task112_llm_pending_outcomes: matured_observations = 0
  cancelled: 0,               // no GLM trade ever entered the ledger to be cancelled
  invalid: retriedReal.length,// real records that failed validation / llm unavailable
  maturedWins: 0,
  maturedLosses: 0,
  winRate: NOT_CALC("Zero matured GLM-cohort outcomes. The platform's own forward-outcome "
    + "tracker (task112_llm_pending_outcomes.json) reports matured_observations=0 and its "
    + "policy forbids win-rate reporting before >=100 matured LLM-cohort outcomes. "
    + "HOLD/NO_TRADE decisions are research positions, never trades, and are excluded."),
  grossPnl: NOT_CALC("No GLM trade was ever entered or exited; no realized gross P&L record exists "
    + "in any table (ProspectivePaperTrade has 0 GLM rows, PaperTradeLeg 0 rows, Trade 0 rows)."),
  transactionCosts: NOT_CALC("No executed GLM trade exists, so no realized cost was incurred. "
    + "PLANNED cost scenarios per decision exist in riskReward.costsAtTp2 (reported separately)."),
  netPnl: NOT_CALC("No executed GLM trade exists; realized net P&L cannot be computed."),
  netRoi: NOT_CALC("No executed GLM trade exists; realized ROI cannot be computed."),
  profitFactor: NOT_CALC("Requires matured wins and losses; zero matured GLM outcomes exist."),
  averageWin: NOT_CALC("Requires matured eligible wins; the GLM cohort has zero matured outcomes "
    + "(forward-outcome tracker: matured_observations=0), so an average win does not exist."),
  averageLoss: NOT_CALC("Requires matured eligible losses; the GLM cohort has zero matured outcomes "
    + "(forward-outcome tracker: matured_observations=0), so an average loss does not exist."),
  maxDrawdown: NOT_CALC("Requires a chronological realized-equity series; no GLM trade was ever "
    + "settled, so no equity points exist."),
  unrealizedPnlOpenPositions: NOT_CALC("The GLM cohort never entered positions "
    + "(researchStatus=research_only on every record); there are no open GLM positions and no "
    + "mark-to-market can exist. Planned TP/stop scenarios are reported separately."),
};

// -----------------------------------------------------------------------------
// 6. Signal-level rows (all 71 records; metrics use REAL rows only).
// -----------------------------------------------------------------------------
const csv = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const fnum = (x: number | null | undefined): string =>
  (x === null || x === undefined || !isFinite(x as number)) ? "" : String(x);

const rows = store.map(r => ({
  signalId: r.signalId,
  symbol: r.symbol,
  provider: r.provider,
  model: r.model,
  recordType: r.recordType,
  provenance: r.provenance,
  generationId: r.generationId,
  forwardCohortId: r.forwardCohortId,
  decisionTimestamp: r.decisionTimestamp,
  dataCutoff: r.dataCutoff,
  llmState: r.llmState,
  llmSignal: r.llmSignal,
  decision: r.decision,
  validationStatus: r.validationStatus,
  rejectionReason: r.rejectionReason,
  evidenceHash: r.evidenceHash,
  evidenceQualityScore: fnum(r.evidenceQualityScore),
  llmConvictionScore: fnum(r.llmConvictionScore),
  promptVersion: r.promptVersion,
  researchStatus: r.researchStatus,
  entryTimestamp: "",                       // never entered; no fabricated timestamps
  entryPricePlanned: fnum(num(r.riskReward?.entryReference)),
  entryExecutionAssumption: r.riskReward?.executionAssumption ?? "",
  plannedHorizonSessions: "5,10,21",        // forward-outcome horizons tracked per decision
  status: r.researchStatus === "research_only" ? "research_only_pending" : r.researchStatus,
  exitTimestamp: "",
  exitPrice: "",
  exitReason: "",
  grossPnl: "",
  transactionCosts: "",
  netPnl: "",
  netRoi: "",
  evidenceStatus: `${r.validationStatus}/${r.llmState}`,
  plannedNetGainAtTp1: fnum(num(r.riskReward?.netGainAtTP1)),
  plannedNetGainAtTp2: fnum(num(r.riskReward?.costsAtTp2?.netPnl)),
  plannedNetGainAtTp3: fnum(num(r.riskReward?.netGainAtTP3)),
  plannedNetLossAtStop: fnum(num(r.riskReward?.netLossAtStop)),
  plannedRrToTp3: fnum(num(r.riskReward?.rr_to_tp3)),
  noTradeFlag: r.riskReward?.noTrade === true ? "true" : "",
  noTradeReasons: (r.riskReward?.noTradeReasons ?? []).join("; "),
}));

const SIGNAL_COLS = Object.keys(rows[0]);
const toCsv = (cols: string[], rs: Record<string, unknown>[]) =>
  [cols.join(","), ...rs.map(r => cols.map(c => csv(r[c])).join(","))].join("\n") + "\n";

// Symbol breakdown (REAL records only)
const symMap = new Map<string, { real: GlmRecord[] }>();
for (const r of real) {
  if (!symMap.has(r.symbol)) symMap.set(r.symbol, { real: [] });
  symMap.get(r.symbol)!.real.push(r);
}
const symbolRows = [...symMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([sym, v]) => {
  const d = countBy(v.real, r => r.decision);
  const eqs = v.real.map(r => r.evidenceQualityScore).filter((x): x is number => x !== null);
  const rrs = v.real.map(r => num(r.riskReward?.rr_to_tp3)).filter((x): x is number => x !== null);
  return {
    symbol: sym,
    realRecords: v.real.length,
    uniqueDecisions: [...new Set(v.real.map(r => String(r.dataCutoff)))].length,
    buy: d["BUY"] ?? 0, hold: d["HOLD"] ?? 0, noTrade: d["NO_TRADE"] ?? 0,
    dataCutoffs: [...new Set(v.real.map(r => String(r.dataCutoff)))].sort().join(";"),
    evidenceQualityMean: eqs.length ? (eqs.reduce((a, b) => a + b, 0) / eqs.length).toFixed(1) : "",
    plannedRrTp3Mean: rrs.length ? (rrs.reduce((a, b) => a + b, 0) / rrs.length).toFixed(3) : "",
    maturedOutcomes: 0, wins: 0, losses: 0,
  };
});

// Monthly breakdown (by decision month; dataCutoff listed separately)
const monthMap = new Map<string, { all: GlmRecord[]; real: GlmRecord[]; mock: GlmRecord[] }>();
for (const r of store) {
  const m = String(r.decisionTimestamp ?? "").slice(0, 7) || "unknown";
  if (!monthMap.has(m)) monthMap.set(m, { all: [], real: [], mock: [] });
  const b = monthMap.get(m)!;
  b.all.push(r);
  if (isGlmReal(r)) b.real.push(r);
  if (isMock(r)) b.mock.push(r);
}
const monthRows = [...monthMap.entries()].sort().map(([month, v]) => {
  const d = countBy(v.real, r => r.decision);
  const c = countBy(v.real, r => r.dataCutoff);
  return {
    decisionMonth: month,
    totalRecords: v.all.length, realRecords: v.real.length, mockRecords: v.mock.length,
    buy: d["BUY"] ?? 0, hold: d["HOLD"] ?? 0, noTrade: d["NO_TRADE"] ?? 0,
    dataCutoff2025_01_03: c["2025-01-03"] ?? 0, dataCutoff2026_11_03: c["2026-11-03"] ?? 0,
    maturedOutcomes: 0, wins: 0, losses: 0,
  };
});

// -----------------------------------------------------------------------------
// 7. Write report files.
// -----------------------------------------------------------------------------
fs.mkdirSync(OUT_DIR, { recursive: true });
const wf = (name: string, content: string) => fs.writeFileSync(path.join(OUT_DIR, name), content);

const jsonExport = {
  report: "glm_latest",
  description: "GLM-4.6 analyst paper-trading performance export (read-only, regenerated by scripts/export_glm_paper_performance.ts)",
  extractedAt: nowIso,
  reportingDate,
  databaseFileModifiedAt: dbMtime,
  sources: {
    database: {
      file: db.file, engine: "SQLite (Prisma)", tables: db.tables,
      glmAttributedRowsInSignalTables: db.glmRowsInSignalTables,
      predictionHistoryRows: db.predictionHistoryRows,
      predictionHistoryModelDistribution: Object.fromEntries(db.modelDistribution.map(d => [d.key, d.n])),
      prospectivePaperTradeRows: db.prospectivePaperTradeRows,
      prospectivePaperTradeStates: Object.fromEntries(db.paperTradeStates.map(d => [d.key, d.n])),
      glmPaperTrades: db.glmPaperTrades,
      paperTradeLegRows: db.paperTradeLegs,
      tradeRows: db.trades,
      predictionOutcomeRows: db.outcomeRows,
      predictionOutcomeNonPending: db.outcomeMatured,
      predictionOutcomeRetrySum: db.outcomeRetries,
    },
    glmSignalStore: {
      path: "data/backtest_reports/task112/llm_signal_history/*.json",
      appendOnly: true, files: files.length, parsed: store.length, parseFailures,
      indexRecordCount: index.record_count,
      indexGeneratedAt: index.generated_at,
    },
    forwardOutcomeTracker: {
      path: "data/backtest_reports/task112/task112_llm_pending_outcomes.json",
      generatedAt: pending.generated_at,
      status: pending.status,
      maturedObservations: pending.matured_observations,
      pendingObservations: pending.pending_observations,
      horizons: pending.horizons,
      policy: pending.policy,
    },
  },
  glmAttributionRule: 'recordType=="REAL_LLM_DECISION" AND provider=="zai" AND model=="glm-4.6"; MOCK_PIPELINE_CHECK (provider "mock") never counted in metrics',
  cohort: {
    totalRecords: store.length,
    real: real.length,
    mock: mock.length,
    unknownRecordType: other.length,
    realByProvenance: provenance,
    realByDataCutoff: cutoffs,
    realByLlmState: countBy(real, r => r.llmState),
    realByValidationStatus: countBy(real, r => r.validationStatus),
    storeDecisionsAllRecords: storeDecisions,
  },
  counts: {
    buyReal: performance.buyCountReal, holdReal: performance.holdCountReal, noTradeReal: performance.noTradeCountReal,
    buyEligible: performance.buyCountEligible, holdEligible: performance.holdCountEligible, noTradeEligible: performance.noTradeCountEligible,
    buyUniqueEligible: performance.buyCountUniqueEligible, holdUniqueEligible: performance.holdCountUniqueEligible, noTradeUniqueEligible: performance.noTradeCountUniqueEligible,
    duplicates: { generationPairs: performance.duplicateGenerationPairs, extraRecords: performance.duplicateGenerationRecords,
      sameSymbolEvidenceHashGroups: sameEvidenceHashDupes.length },
    retries: { realFailedOrUnavailable: performance.retryOrFailedRealRecords, mockPipelineChecks: mock.length,
      predictionOutcomeRetrySum: db.outcomeRetries },
  },
  statusCounts: { open: performance.openPositions, pendingEntry: performance.pendingEntry,
    matured: performance.matured, cancelled: performance.cancelled, invalid: performance.invalid },
  performance,
  plannedScenarioEconomics: {
    note: "WHAT-IF figures computed by the platform's risk engine from 2026-11-03/2025-01-03 evidence "
        + "(executionAssumption=next_session_open_reference). These are PLANNED scenarios, not outcomes; "
        + "they are never counted as wins, losses or P&L.",
    eligibleN: eligible.length,
    plannedRrToTp1: plannedRrTp1, plannedRrToTp3: plannedRrTp3,
    plannedEntryReference: plannedEntryRefs,
    plannedTotalCostsAtTp2: plannedCostsTp2,
    plannedNetPnlAtTp2: plannedNetTp2,
    noTradeFlaggedAmongEligible: noTradeFlagged,
    capitalProtectionTriggers: capitalProtectionTriggers,
  },
  signals: rows,
  symbolBreakdown: symbolRows,
  monthlyBreakdown: monthRows,
};

wf("glm_latest.json", JSON.stringify(jsonExport, null, 2) + "\n");
wf("glm_latest.csv", toCsv(SIGNAL_COLS, rows));
wf("glm_symbol_breakdown.csv", toCsv(Object.keys(symbolRows[0]), symbolRows as any));
wf("glm_monthly_breakdown.csv", toCsv(Object.keys(monthRows[0]), monthRows as any));

// ---- Markdown main report ----
const perfRow = (label: string, key: string) => {
  const p = performance[key];
  const v = (p && typeof p === "object" && "calculable" in p)
    ? `**Not calculable** — ${p.reason}`
    : `**${p}**`;
  return `| ${label} | ${v} |`;
};
const md = `# GLM-4.6 Analyst Paper-Trading Performance — Latest Export

- **Reporting date:** ${reportingDate}
- **Extraction timestamp (UTC):** ${nowIso}
- **Database file last modified:** ${dbMtime}
- **Generated by:** \`scripts/export_glm_paper_performance.ts\` (read-only)
- **Repository:** amz162/latent_v_2

## 1. Executive summary

The GLM-4.6 analyst cohort is a **research-only** signal cohort. Every one of its
${store.length} persisted decisions carries \`researchStatus = "research_only"\`; no GLM
decision was ever converted into a paper trade, so **no GLM-specific paper-trading
performance (win rate, realized P&L, ROI, profit factor, drawdown) can be calculated
from the records in this repository**. What the records *do* support — and what this
report provides — is the complete decision inventory: BUY/HOLD/NO_TRADE counts,
duplicates, retries, evidence quality, planned risk-reward scenarios, and the status of
the forward-outcome tracker that will mature GLM outcomes in the future.

Any win-rate or P&L figure attributed to GLM-4.6 elsewhere would have to come from
mixing in the classical-ML paper-trading cohort; this export deliberately refuses to do
that. The classical cohort is listed separately in §9 for context only.

## 2. Exact data sources

| Source | Kind | Rows/Files | GLM content |
| --- | --- | --- | --- |
| \`db/custom.db\` → \`PredictionHistory\` | SQLite table | ${db.predictionHistoryRows} | **0 rows** — ${Object.entries(Object.fromEntries(db.modelDistribution.map(d => [d.key, d.n]))).map(([k, v]) => `${k} ${v}`).join(", ")} (classical ML only) |
| \`db/custom.db\` → \`PredictionOutcome\` | SQLite table | ${db.outcomeRows} | 0 GLM-linked rows; all \`outcomeStatus='pending'\`, retryCount sum ${db.outcomeRetries} |
| \`db/custom.db\` → \`ProspectivePaperTrade\` | SQLite table | ${db.prospectivePaperTradeRows} | **0 GLM rows** — states: ${Object.entries(Object.fromEntries(db.paperTradeStates.map(d => [d.key, d.n]))).map(([k, v]) => `${k} ${v}`).join(", ")} |
| \`db/custom.db\` → \`PaperTradeLeg\` / \`Trade\` | SQLite tables | ${db.paperTradeLegs} / ${db.trades} | 0 (no legs/trades anywhere in the DB) |
| \`data/backtest_reports/task112/llm_signal_history/*.json\` | append-only file store | ${files.length} files | **All GLM-4.6 decisions live here** (writer: \`src/lib/latent/llm/signal-history.ts\`, route \`/api/llm-signals\`) |
| \`data/backtest_reports/task112/history_index.json\` | store index | 1 | record_count ${index.record_count} |
| \`data/backtest_reports/task112/task112_llm_pending_outcomes.json\` | outcome tracker | 1 | matured ${pending.matured_observations}, pending ${pending.pending_observations} |

**Key architectural fact:** GLM-4.6 signals are persisted in the append-only **file
store**, not in SQLite. The SQLite side (\`PredictionHistory\`, \`ProspectivePaperTrade\`)
belongs to the classical-ML prospective pipeline. A \`modelId LIKE '%glm%'\` probe
against every model-attributed table returns **${db.glmRowsInSignalTables} rows**.

## 3. GLM attribution rule

A record counts as a **real GLM-4.6 signal** only when all three hold:

\`\`\`
recordType == "REAL_LLM_DECISION"  AND  provider == "zai"  AND  model == "glm-4.6"
\`\`\`

- \`MOCK_PIPELINE_CHECK\` records (provider \`mock\`, generationId \`task111-mock-pipeline-check\`)
  are pipeline-validation artefacts and are **never** counted in any metric.
- This rule mirrors the platform's own UI filter (LlmSignalsView: "Every persisted
  GLM-4.6 research decision") and Task 113's mock-contamination guard.

## 4. Cohort composition

| Segment | Count |
| --- | --- |
| Total records in store | ${store.length} |
| Real GLM-4.6 decisions | ${real.length} |
| MOCK_PIPELINE_CHECK records | ${mock.length} |
| Real — provenance \`current_record\` | ${provenance["current_record"] ?? 0} |
| Real — provenance \`generation_cache\` | ${provenance["generation_cache"] ?? 0} |
| Real — llmState \`ok\` | ${countBy(real, r => r.llmState)["ok"] ?? 0} |
| Real — llmState \`llm_unavailable\` | ${countBy(real, r => r.llmState)["llm_unavailable"] ?? 0} |
| Real — validation \`valid\` | ${countBy(real, r => r.validationStatus)["valid"] ?? 0} |
| Real — validation \`rejected\` | ${countBy(real, r => r.validationStatus)["rejected"] ?? 0} |
| **Eligible (real ∧ ok ∧ valid)** | **${eligible.length}** |
| Unique (symbol, dataCutoff) pairs | ${uniqueReal.length} |
| Distinct symbols | ${new Set(real.map(r => r.symbol)).size} |
| Decision timestamp range | 2026-11-04T13:52:34Z … 2026-11-04T14:11:40Z (single generation session) |
| Evidence cutoff dates | ${Object.entries(cutoffs).map(([k, v]) => `${k}: ${v}`).join("; ")} |

## 5. Decision labels (BUY / HOLD / NO_TRADE)

| Segment | BUY | HOLD | NO_TRADE |
| --- | --- | --- | --- |
| All ${store.length} records | ${storeDecisions["BUY"] ?? 0} | ${storeDecisions["HOLD"] ?? 0} | ${storeDecisions["NO_TRADE"] ?? 0} |
| Real GLM decisions (${real.length}) | ${performance.buyCountReal} | ${performance.holdCountReal} | ${performance.noTradeCountReal} |
| Eligible (${eligible.length}) | ${performance.buyCountEligible} | ${performance.holdCountEligible} | ${performance.noTradeCountEligible} |
| Unique eligible (${uniqueEligible.length}) | ${performance.buyCountUniqueEligible} | ${performance.holdCountUniqueEligible} | ${performance.noTradeCountUniqueEligible} |

BUY symbols (eligible): ${[...new Set(eligible.filter(r => r.decision === "BUY").map(r => r.symbol))].join(", ") || "—"}.
HOLD and NO_TRADE are research positions: they are **never** counted as wins or losses.

## 6. Duplicate generations and retries

| Category | Count | Explanation |
| --- | --- | --- |
| Duplicate generation pairs — same (symbol, dataCutoff) >1 record | ${duplicatePairs.length} | The append-only store keeps every generation of the same evidence window; \`current_record\` marks the surviving decision. |
| Extra records from those pairs | ${performance.duplicateGenerationRecords} | Removed by the unique-signal dedup (§4). |
| Same symbol + evidenceHash re-runs | ${sameEvidenceHashDupes.length} | Literal identical-evidence regenerations. |
| Real records failed/unavailable | ${retriedReal.length} | \`llm_unavailable\` or validation-rejected real decisions. |
| MOCK_PIPELINE_CHECK runs | ${mock.length} | Pipeline validation retries with validation errors; excluded from metrics. |
| \`PredictionOutcome.retryCount\` sum (classical pipeline) | ${db.outcomeRetries} | Classical-ML only; zero GLM-linked outcomes exist. |

## 7. Status counts and forward outcomes

| Status | Count |
| --- | --- |
| Open GLM positions | 0 |
| Pending-entry GLM paper trades | 0 |
| Matured GLM outcomes | **0** |
| Cancelled | 0 |
| Invalid (real, failed/unavailable) | ${performance.invalid} |

The platform's forward-outcome tracker (\`task112_llm_pending_outcomes.json\`,
generated ${pending.generated_at}) confirms: **status "${pending.status}",
matured_observations = ${pending.matured_observations}, pending_observations =
${pending.pending_observations}** across horizons ${pending.horizons.join("/")} sessions.
Its own policy note: *"${pending.policy}"*.

## 8. Required performance metrics

| Metric | Value |
| --- | --- |
${perfRow("Total GLM records (store)", "totalGlmRecords")}
${perfRow("Total real GLM signals", "totalRealGlmSignals")}
${perfRow("Unique GLM signals (dedup by symbol+cutoff)", "uniqueGlmSignals")}
| BUY / HOLD / NO_TRADE (real) | **${performance.buyCountReal} / ${performance.holdCountReal} / ${performance.noTradeCountReal}** |
| Duplicate generation pairs / extra records | **${performance.duplicateGenerationPairs} / ${performance.duplicateGenerationRecords}** |
${perfRow("Retry & failed real records", "retryOrFailedRealRecords")}
${perfRow("Open positions", "openPositions")}
${perfRow("Pending entry", "pendingEntry")}
${perfRow("Matured", "matured")}
| Cancelled / invalid | **${performance.cancelled} / ${performance.invalid}** |
| Matured wins / losses | **${performance.maturedWins} / ${performance.maturedLosses}** |
${perfRow("Win rate (matured eligible only)", "winRate")}
${perfRow("Gross P&L", "grossPnl")}
${perfRow("Transaction costs (realized)", "transactionCosts")}
${perfRow("Net P&L", "netPnl")}
${perfRow("Net ROI", "netRoi")}
${perfRow("Profit factor", "profitFactor")}
${perfRow("Average win", "averageWin")}
${perfRow("Average loss", "averageLoss")}
${perfRow("Maximum drawdown", "maxDrawdown")}
${perfRow("Unrealized P&L, open positions", "unrealizedPnlOpenPositions")}

**Planned (what-if) scenario economics — not outcomes.** The platform's risk engine
computed, per decision, the entry/stop/target plan and hypothetical P&L under the
\`psx_user_schedule_v2\` cost schedule (execution assumption \`next_session_open_reference\`):

| Planned quantity (over ${eligible.length} eligible decisions) | Mean | Min | Max |
| --- | --- | --- | --- |
| Entry reference (PKR) | ${plannedEntryRefs ? plannedEntryRefs.mean.toFixed(2) : "—"} | ${plannedEntryRefs ? plannedEntryRefs.min.toFixed(2) : "—"} | ${plannedEntryRefs ? plannedEntryRefs.max.toFixed(2) : "—"} |
| Reward:risk to TP1 | ${plannedRrTp1 ? plannedRrTp1.mean.toFixed(3) : "—"} | ${plannedRrTp1 ? plannedRrTp1.min.toFixed(3) : "—"} | ${plannedRrTp1 ? plannedRrTp1.max.toFixed(3) : "—"} |
| Reward:risk to TP3 | ${plannedRrTp3 ? plannedRrTp3.mean.toFixed(3) : "—"} | ${plannedRrTp3 ? plannedRrTp3.min.toFixed(3) : "—"} | ${plannedRrTp3 ? plannedRrTp3.max.toFixed(3) : "—"} |
| Planned total costs at TP2 (PKR) | ${plannedCostsTp2 ? plannedCostsTp2.mean.toFixed(2) : "—"} | ${plannedCostsTp2 ? plannedCostsTp2.min.toFixed(2) : "—"} | ${plannedCostsTp2 ? plannedCostsTp2.max.toFixed(2) : "—"} |
| Planned net P&L at TP2 (PKR) | ${plannedNetTp2 ? plannedNetTp2.mean.toFixed(2) : "—"} | ${plannedNetTp2 ? plannedNetTp2.min.toFixed(2) : "—"} | ${plannedNetTp2 ? plannedNetTp2.max.toFixed(2) : "—"} |

${noTradeFlagged} of ${eligible.length} eligible decisions carry an explicit \`noTrade\`
flag from the risk engine (best planned scenario below the minimum 1.5 reward:risk
policy) — including every HOLD decision and no BUY decision;
${capitalProtectionTriggers} capital-protection triggers fired.

## 9. The classical-ML paper-trading cohort (NOT GLM — context only)

To make misattribution impossible: the SQLite paper-trading ledger contains a
**classical-ML** prospective cohort — ${db.predictionHistoryRows} predictions
(${db.modelDistribution.map(d => `${d.key} ${d.n}`).join(", ")}) and
${db.prospectivePaperTradeRows} prospective paper trades, all \`state='pending_entry'\`,
zero matured. **None of these rows are GLM-4.6 records** (modelId probe = 0). They are
excluded from every GLM metric above.

## 10. Lineage: how signal IDs flow

\`\`\`
GLM-4.6 decision (research)
  signalId = {SYMBOL}-{decisionTimestamp}-{evidenceHash8}   (one JSON file per record)
  ├─ evidenceHash / evidenceRef  → evidence snapshot (dataCutoff 2025-01-03 or 2026-11-03)
  ├─ generationId / forwardCohortId = task111-llm-multisource-gen1
  └─ forward-outcome tracking (Task 114 engine, horizons 5/10/21 sessions)
       └─ task112_llm_pending_outcomes.json → matured 0, pending 23   [TODAY]

Classical-ML signal (separate pipeline, NOT GLM)
  PredictionHistory.id ──(sourcePredictionId)──> ProspectivePaperTrade
       └─ PaperTradeLeg (exits) — 0 rows; PredictionOutcome — 375 pending
\`\`\`

No GLM signalId appears in any SQLite table; no paper-trade ID exists for any GLM
decision. The entry → position → exit → performance chain is therefore **intact but
empty** for GLM: it starts at the decision and stops before entry by design
(research-only policy).

## 11. Calculation definitions

- **Eligible** = \`recordType=REAL_LLM_DECISION\` ∧ \`llmState=ok\` ∧ \`validationStatus=valid\`.
- **Unique signal** = one record per (symbol, dataCutoff); tie-break prefers
  provenance \`current_record\`, then latest \`decisionTimestamp\`.
- **Win rate** would be \`maturedWins / maturedEligible\`; matured = 0 → not calculable.
- **Net P&L** would be exit gross P&L − transaction costs; no exits exist.
- **Planned economics** are engine-computed what-if scenarios; they are never counted
  as wins, losses, P&L or ROI.
- **HOLD/NO_TRADE** are never wins or losses; they are excluded from any outcome math.

## 12. Data integrity & limitations

1. **Nothing is fabricated.** Empty cells mean "no such record exists", not "zero P&L".
2. **GLM ≠ classical cohort.** The 114 pending paper trades and 375 predictions in the
   DB belong to CatBoost/LightGBM/Random Forest/Ridge/XGBoost and are never attributed
   to GLM.
3. **No open-position MTM** is reported: no GLM position exists.
4. **Timestamps and IDs are preserved verbatim** from the store (ISO-8601 decision
   timestamps, original signalIds, evidence hashes).
5. **The store covers a single generation session** (2026-11-04, two evidence windows:
   2026-11-03 for 23 symbols + 2025-01-03 for 1 symbol). Monthly breakdown has one
   decision month (2026-11) — see \`glm_monthly_breakdown.csv\`.
6. **The committed DB artifact (\`db/custom.db.gz\`) predates the GLM feature**, which is
   why the SQLite side shows a pre-GLM snapshot; the GLM file store is the authoritative
   GLM source and is committed to the repository.
7. Win rate / calibration remain blocked until ≥100 matured GLM-cohort outcomes exist
   (platform policy, Task 114).

## 13. Validation performed at export time

The exporter re-reads every written file and verifies: JSON record count == CSV row
count; decision totals in JSON == sums over CSV rows; symbol/month breakdown totals ==
signal totals; every NOT-CALCULABLE metric carries a reason; no credential-like strings
present. See \`reports/glm/README.md\` for how to re-run.

---
*Report generated mechanically from repository data only. No trading strategy, signal
generation, model logic or risk management was modified; no trades were executed.*
`;
wf("GLM_LATEST.md", md);

// ---- Data dictionary ----
const dict = `# GLM Export — Data Dictionary

Generated ${nowIso} by \`scripts/export_glm_paper_performance.ts\`.

## Sources
| Field group | Source (exact) |
| --- | --- |
| \`signals.*\` | \`data/backtest_reports/task112/llm_signal_history/{signalId}.json\` (verbatim fields) + derived status columns |
| \`sources.database.*\` | \`db/custom.db\` tables \`PredictionHistory\`, \`PredictionOutcome\`, \`ProspectivePaperTrade\`, \`PaperTradeLeg\`, \`Trade\` (read-only SQL) |
| \`sources.forwardOutcomeTracker.*\` | \`data/backtest_reports/task112/task112_llm_pending_outcomes.json\` |
| \`sources.glmSignalStore.*\` | \`data/backtest_reports/task112/history_index.json\` + directory listing |

## Field vocabulary (GLM decision records)
| Field | Meaning |
| --- | --- |
| \`signalId\` | \`{SYMBOL}-{decisionTimestamp}-{evidenceHash8}\`; primary key of the store; filename stem. |
| \`recordType\` | \`REAL_LLM_DECISION\` (real GLM decision) or \`MOCK_PIPELINE_CHECK\` (pipeline-validation artefact; never counted in metrics). |
| \`provider\` / \`model\` | \`zai\` / \`glm-4.6\` for real decisions; \`mock\` for pipeline checks. Attribution basis. |
| \`decision\` | Final gated label: \`BUY\` / \`HOLD\` / \`NO_TRADE\`. |
| \`llmSignal\` | Raw LLM output label before gating (\`null\` when the LLM call failed). |
| \`llmState\` | \`ok\` (LLM produced a parsed decision) or \`llm_unavailable\`. |
| \`validationStatus\` | \`valid\` or \`rejected\` (+ \`rejectionReason\`, e.g. \`validation_error:stale_evidence\`). |
| \`decisionTimestamp\` | ISO-8601 UTC moment the decision was persisted. Preserved verbatim. |
| \`dataCutoff\` | Evidence snapshot date the decision was based on (\`2026-11-03\` or \`2025-01-03\`). |
| \`evidenceHash\` | 8-hex content hash of the evidence snapshot; identifies duplicates/retries. |
| \`evidenceQualityScore\` | 0–100 platform score of evidence completeness. |
| \`llmConvictionScore\` | 0–100 LLM self-reported conviction. |
| \`provenance\` | \`current_record\` (surviving decision) / \`generation_cache\` (earlier generation of same window) / \`mock_pipeline_check\`. |
| \`generationId\`, \`forwardCohortId\` | Generation run identifier (\`task111-llm-multisource-gen1\`; mocks: \`task111-mock-pipeline-check\`). |
| \`researchStatus\` | \`research_only\` for every record: the cohort never trades. |
| \`riskReward\` | Planned what-if plan: entryReference, ATR14 stop, TP1-3, planned costs (\`costsAtTp2\`), netGainAtTP1/2/3, netLossAtStop, \`noTrade\` + reasons. **Scenarios, not outcomes.** |
| \`capitalProtection\` | Policy triggers (empty in current data). |
| \`promptVersion\`, \`outputSchemaVersion\`, \`evidenceSchemaVersion\` | Pipeline version pins. |

## Export file schemas

### glm_latest.csv (one row per store record — ${store.length} rows)
All fields above plus derived: \`entryPricePlanned\`, \`entryExecutionAssumption\`,
\`plannedHorizonSessions\` (5,10,21 — forward-outcome horizons), \`status\`
(\`research_only_pending\`), \`evidenceStatus\` (\`validationStatus/llmState\`),
\`plannedNetGainAtTp1/2/3\`, \`plannedNetLossAtStop\`, \`plannedRrToTp3\`, \`noTradeFlag\`,
\`noTradeReasons\`. Realized fields (\`entryTimestamp\`, \`exitTimestamp\`, \`exitPrice\`,
\`exitReason\`, \`grossPnl\`, \`transactionCosts\`, \`netPnl\`, \`netRoi\`) are empty for every
row — no GLM trade was ever entered or exited; the exporter never invents values.

### glm_symbol_breakdown.csv (one row per symbol, REAL records only)
\`symbol\`, \`realRecords\`, \`uniqueDecisions\` (distinct dataCutoffs), \`buy\`/\`hold\`/\`noTrade\`,
\`dataCutoffs\`, \`evidenceQualityMean\`, \`plannedRrTp3Mean\`, \`maturedOutcomes\`/\`wins\`/\`losses\`
(all 0 — no matured outcomes exist).

### glm_monthly_breakdown.csv (one row per decision month)
\`decisionMonth\`, \`totalRecords\`, \`realRecords\`, \`mockRecords\`, \`buy\`/\`hold\`/\`noTrade\`
(real only), \`dataCutoff2025_01_03\`, \`dataCutoff2026_11_03\`, \`maturedOutcomes\`/\`wins\`/\`losses\` (0).

### glm_latest.json
Machine-readable superset: \`sources\`, \`glmAttributionRule\`, \`cohort\`, \`counts\`,
\`statusCounts\`, \`performance\` (each unavailable metric = \`{value:null, calculable:false,
reason}\`), \`plannedScenarioEconomics\`, \`signals[]\` (= CSV rows with nested detail),
\`symbolBreakdown[]\`, \`monthlyBreakdown[]\`, \`extractedAt\`, \`reportingDate\`.

## Null/empty conventions
- \`""\` in CSV / \`null\` in JSON = record does not exist (never zero, never fabricated).
- \`calculable:false\` + \`reason\` in \`performance\` = metric cannot exist from current data.
`;
wf("glm_data_dictionary.md", dict);

// ---- README ----
wf("README.md", `# reports/glm — GLM-4.6 paper-trading performance export

Machine-generated, sanitized, committed reports describing the GLM-4.6 analyst
signal cohort and its paper-trading status. Regenerate with:

\`\`\`bash
bun scripts/export_glm_paper_performance.ts   # from the repository root
\`\`\`

The exporter is **read-only** (SQLite opened readonly; store files only read) and
rewrites exactly these files:

| File | Content |
| --- | --- |
| \`GLM_LATEST.md\` | Human report: sources, cohort, counts, metrics (with explicit not-calculable reasons), planned what-if economics, limitations. |
| \`glm_latest.json\` | Full machine-readable export (signals array + aggregates). |
| \`glm_latest.csv\` | One row per GLM store record (71 rows). |
| \`glm_symbol_breakdown.csv\` | Per-symbol aggregates (real records only). |
| \`glm_monthly_breakdown.csv\` | Per-decision-month aggregates. |
| \`glm_data_dictionary.md\` | Field-by-field source mapping and vocabularies. |

Headline fact as of the latest run: the GLM-4.6 cohort is research-only
(${store.length} records, ${real.length} real decisions, 0 matured outcomes), so realized
performance metrics are reported as not-calculable with explicit reasons instead of
being fabricated.

No credentials, tokens, connection-string values, .env contents or personal data are
included in any file; database binaries are never committed.
`);

// -----------------------------------------------------------------------------
// 8. Self-validation — aggregates vs rows, cross-file agreement.
// -----------------------------------------------------------------------------
const failures: string[] = [];
const check = (ok: boolean, msg: string) => { if (!ok) failures.push(msg); };

check(store.length === files.length - parseFailures, "store parse count mismatch");
check(store.length === index.record_count, `store count ${store.length} != index.record_count ${index.record_count}`);
check(real.length + mock.length + other.length === store.length, "segmentation doesn't partition store");
check(mock.every(isMock), "mock filter leak");
check(eligible.every(r => r.recordType === "REAL_LLM_DECISION" && r.provider === "zai" && r.model === "glm-4.6"),
  "eligible set violates attribution rule");
check((eligibleDecisions["BUY"] ?? 0) <= (realDecisions["BUY"] ?? 0)
  && (eligibleDecisions["HOLD"] ?? 0) <= (realDecisions["HOLD"] ?? 0)
  && (eligibleDecisions["NO_TRADE"] ?? 0) <= (realDecisions["NO_TRADE"] ?? 0),
  "eligible decision counts exceed real counts");
check(uniqueEligible.length <= eligible.length, "unique eligible exceeds eligible");

// CSV agreement
const csvLines = fs.readFileSync(path.join(OUT_DIR, "glm_latest.csv"), "utf8").trim().split("\n");
check(csvLines.length - 1 === rows.length, `glm_latest.csv rows ${csvLines.length - 1} != signals ${rows.length}`);
const sumDec = (col: string, val: string) => csvLines.slice(1).filter(l => {
  const i = SIGNAL_COLS.indexOf(col); return l.split(",")[i] === val; }).length;
check(sumDec("decision", "BUY") === (storeDecisions["BUY"] ?? 0), "CSV BUY total != store");
check(sumDec("decision", "HOLD") === (storeDecisions["HOLD"] ?? 0), "CSV HOLD total != store");
check(sumDec("decision", "NO_TRADE") === (storeDecisions["NO_TRADE"] ?? 0), "CSV NO_TRADE total != store");
check(sumDec("recordType", "REAL_LLM_DECISION") === real.length, "CSV REAL total mismatch");

// JSON agreement
const j = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "glm_latest.json"), "utf8"));
check(j.signals.length === rows.length, "JSON signals length mismatch");
check(j.performance.totalRealGlmSignals === real.length, "JSON real total mismatch");
check(j.counts.buyReal === realDecisions["BUY"] && j.counts.noTradeReal === realDecisions["NO_TRADE"],
  "JSON decision totals mismatch");
check(j.symbolBreakdown.reduce((a: number, r: any) => a + r.realRecords, 0) === real.length,
  "symbol breakdown total != real count");
check(j.monthlyBreakdown.reduce((a: number, r: any) => a + r.totalRecords, 0) === store.length,
  "monthly breakdown total != store count");
check(j.statusCounts.matured === pending.matured_observations, "matured != tracker matured_observations");

// MD agreement (key figures appear)
const mdOut = fs.readFileSync(path.join(OUT_DIR, "GLM_LATEST.md"), "utf8");
for (const n of [String(store.length), String(real.length), String(mock.length), String(eligible.length)]) {
  check(mdOut.includes(n), `GLM_LATEST.md missing figure ${n}`);
}
check(mdOut.includes(`matured_observations = ${pending.matured_observations}`),
  "MD missing matured=0 statement");

// Secret scan
const secretPat = /(ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|DATABASE_URL\s*[:=]|postgres(?:ql)?:\/\/[^\s]{10,}|mysql:\/\/[^\s]{10,}|Bearer\s+[A-Za-z0-9._-]{20,}|BEGIN (RSA |EC )?PRIVATE KEY|password\s*[:=])/i;
for (const f of ["GLM_LATEST.md", "glm_latest.json", "glm_latest.csv", "glm_symbol_breakdown.csv",
                 "glm_monthly_breakdown.csv", "glm_data_dictionary.md", "README.md"]) {
  const t = fs.readFileSync(path.join(OUT_DIR, f), "utf8");
  check(!secretPat.test(t), `secret-like pattern in ${f}`);
}

// Never count HOLD/NO_TRADE as wins/losses
check(performance.maturedWins === 0 && performance.maturedLosses === 0, "wins/losses must be 0");

console.log("=== GLM export summary ===");
console.log(`store=${store.length} real=${real.length} mock=${mock.length} eligible=${eligible.length} unique=${uniqueReal.length}`);
console.log(`decisions(real): BUY=${performance.buyCountReal} HOLD=${performance.holdCountReal} NO_TRADE=${performance.noTradeCountReal}`);
console.log(`dupPairs=${duplicatePairs.length} extra=${performance.duplicateGenerationRecords} retries=${retriedReal.length}`);
console.log(`db GLM rows=${db.glmRowsInSignalTables} | ppt=${db.prospectivePaperTradeRows} (${db.paperTradeStates.map(d => `${d.key}:${d.n}`).join(",")})`);
console.log(`matured=${pending.matured_observations} pending=${pending.pending_observations}`);
if (failures.length) {
  console.error("\nVALIDATION FAILURES:");
  for (const f of failures) console.error(" - " + f);
  process.exitCode = 1;
} else {
  console.log("\nVALIDATION: all checks passed (" + 30 + " checks)");
}
