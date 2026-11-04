// ============================================================================
// Task 111 / Phase 9 — Deterministic evidence-to-LLM signal pipeline.
//
// Verified data -> evidence package -> completeness check -> LLM analysis ->
// strict output validation -> deterministic risk/reward engine -> capital
// protection / NO-TRADE policy -> research-only shadow signal.
//
// The LLM NEVER computes costs, position sizes, portfolio equity or the final
// risk/reward ratio. Provider failure yields a controlled `llm_unavailable`
// state — never a technical-rule signal presented as an LLM result.
// ============================================================================
import {
  createLLMClient,
  evidenceHash,
  llmConfigFromEnv,
  LLMUnavailableError,
  type LLMCallRecord,
  type LLMClient,
} from "./llm-provider";
import {
  PROMPT_VERSION,
  SIGNAL_ENGINE_SYSTEM_PROMPT,
  OUTPUT_SCHEMA_VERSION,
  EVIDENCE_SCHEMA_VERSION,
  validateSignalOutput,
  type LLMEvidence,
  type LLMSignalOutput,
  type Signal,
} from "./schemas";
import { computeRiskReward, DEFAULT_MIN_RR, type RiskRewardResult, type RRBar } from "./risk-reward-engine";

export const CAPITAL_PROTECTION_POLICY_ID = "task111-capital-protection-v1";
export const CAPITAL_PROTECTION_RULES = {
  maxRiskPerPositionPct: 2.0, // of account equity at entry (research overlay)
  maxOpenRiskPct: 6.0,
  maxExposurePct: 100.0, // no leverage, ever
  drawdownAlertPct: 5.0,
  drawdownPausePct: 10.0,
  minEvidenceQualityForBuy: 35,
  minRRDefault: DEFAULT_MIN_RR,
} as const;

/** Deterministic evidence-quality score (0-100). The LLM never sets this. */
export function computeEvidenceQuality(ev: LLMEvidence): { score: number; parts: Record<string, number> } {
  const st = (c: CategorizedEvidenceLike): number =>
    c.status === "verified" ? 1 : c.status === "partially_verified" ? 0.6 : c.status === "stale" ? 0.3 : c.status === "insufficient_history" ? 0.2 : 0;
  interface CategorizedEvidenceLike {
    status: string;
    metrics: unknown[];
    sources: string[];
  }
  const parts: Record<string, number> = {};
  // Weights sum to 100. Missing/unverified information strictly reduces the score.
  parts.source_verification = 20 * (ev.sourceRefs.filter((s) => s.retrievedAt || s.publishedAt).length / Math.max(1, ev.sourceRefs.length));
  parts.pit_availability = 8; // current-time analysis is PIT-safe by construction; historical use disabled
  parts.data_completeness =
    20 *
    ((st(ev.fundamentalEvidence) +
      st(ev.companyNewsEvidence) +
      st(ev.nationalNewsEvidence) +
      st(ev.internationalNewsEvidence)) /
      4);
  parts.data_freshness = ((): number => {
    const cutoffMs = Date.parse(ev.dataCutoff + "T17:00:00Z");
    if (!isFinite(cutoffMs)) return 0;
    const ageDays = (Date.now() - cutoffMs) / 86400000;
    return 15 * (ageDays <= 7 ? 1 : ageDays <= 14 ? 0.6 : ageDays <= 30 ? 0.3 : 0);
  })();
  parts.financial_history_coverage = 10 * st(ev.financialPatternEvidence);
  parts.news_corroboration = 7 * Math.max(st(ev.companyNewsEvidence), st(ev.nationalNewsEvidence));
  parts.technical_quality = 10 * st(ev.technicalEvidence);
  parts.pattern_confirmation = 5 * st(ev.pricePatternEvidence);
  const consistency =
    ev.priceContext.lastClose != null && ev.technicalEvidence.metrics.every((m) => m.value === null || isFinite(m.value as number)) ? 1 : 0.7;
  parts.cross_source_consistency = 5 * consistency;
  const score = Math.round(Object.values(parts).reduce((a, b) => a + b, 0));
  return { score: Math.max(0, Math.min(100, score)), parts };
}

function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/```json/gi, "```")
    .split("```")
    .map((s) => s.trim())
    .filter(Boolean);
  const candidates = cleaned.length ? cleaned : [text];
  for (const c of candidates) {
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(c.slice(start, end + 1));
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

export interface Task111SignalRecord {
  generationId: string;
  symbol: string;
  decisionTimestamp: string;
  dataCutoff: string;
  evidenceHash: string;
  evidenceSchemaVersion: typeof EVIDENCE_SCHEMA_VERSION;
  outputSchemaVersion: typeof OUTPUT_SCHEMA_VERSION;
  promptVersion: string;
  provider: string;
  model: string;
  llmState: "ok" | "llm_unavailable";
  llmFailureReason: string | null;
  parseErrors: string[];
  llmOutput: LLMSignalOutput | null;
  llmConvictionScore: number | null; // uncalibrated, LLM's own
  evidenceQualityScore: number; // deterministic
  evidenceQualityParts: Record<string, number>;
  calibratedNetPositiveProbability: null;
  finalSignal: Signal;
  finalSignalReason: string;
  riskReward: RiskRewardResult | null;
  capitalProtection: { policyId: string; triggered: string[] };
  signalClass: "LLM_RESEARCH_SIGNAL";
  signalStatus: "research_only";
  analysisHorizon: "5d" | "10d" | "21d";
}

export interface RunSignalOptions {
  client?: LLMClient;
  minRR?: number;
  openPositionsCount?: number;
  accountDrawdownPct?: number;
  generationId?: string;
  analysisHorizon?: "5d" | "10d" | "21d";
}

/**
 * Run one full decision for one symbol. Throws only on infrastructure errors;
 * LLM problems are captured in the record with llm_unavailable state.
 */
export async function runStockSignal(
  bundleEvidence: LLMEvidence,
  bundleBars: RRBar[],
  opts: RunSignalOptions
): Promise<Task111SignalRecord> {
  const client = opts.client ?? createLLMClient(llmConfigFromEnv());
  const evHash = evidenceHash(bundleEvidence);
  const quality = computeEvidenceQuality(bundleEvidence);
  const horizon = opts.analysisHorizon ?? "10d";

  // Deterministic risk/reward from verified data (LLM levels never trusted).
  const rr = computeRiskReward({
    symbol: bundleEvidence.symbol,
    bars: bundleBars,
    cutoffDate: bundleEvidence.dataCutoff,
    supportZones: [], // zones already embedded in pattern evidence; policy SL is ATR-based
    minRR: opts.minRR ?? DEFAULT_MIN_RR,
    evidenceQualityScore: quality.score,
    fundamentalPitSafe: bundleEvidence.fundamentalEvidence.status !== "unavailable",
  });

  // Capital protection triggers (research overlay, predeclared).
  const cpTriggered: string[] = [];
  if ((opts.accountDrawdownPct ?? 0) >= CAPITAL_PROTECTION_RULES.drawdownPausePct) cpTriggered.push("drawdown_pause_10pct");
  else if ((opts.accountDrawdownPct ?? 0) >= CAPITAL_PROTECTION_RULES.drawdownAlertPct) cpTriggered.push("drawdown_alert_5pct");
  if ((opts.openPositionsCount ?? 0) >= 5) cpTriggered.push("max_positions_5");

  const record: Task111SignalRecord = {
    generationId: opts.generationId ?? "task111-llm-multisource-gen1",
    symbol: bundleEvidence.symbol,
    decisionTimestamp: bundleEvidence.decisionTimestamp,
    dataCutoff: bundleEvidence.dataCutoff,
    evidenceHash: evHash,
    evidenceSchemaVersion: EVIDENCE_SCHEMA_VERSION,
    outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
    promptVersion: PROMPT_VERSION,
    provider: client.config.provider,
    model: client.config.model,
    llmState: "ok",
    llmFailureReason: null,
    parseErrors: [],
    llmOutput: null,
    llmConvictionScore: null,
    evidenceQualityScore: quality.score,
    evidenceQualityParts: quality.parts,
    calibratedNetPositiveProbability: null,
    finalSignal: "NO_TRADE",
    finalSignalReason: "",
    riskReward: rr,
    capitalProtection: { policyId: CAPITAL_PROTECTION_POLICY_ID, triggered: cpTriggered },
    signalClass: "LLM_RESEARCH_SIGNAL",
    signalStatus: "research_only",
    analysisHorizon: horizon,
  };

  // ── LLM analysis ─────────────────────────────────────────────────────────
  const userPayload = JSON.stringify(bundleEvidence);
  let parsed: unknown = null;
  try {
    const res = await client.complete(
      [
        { role: "system", content: SIGNAL_ENGINE_SYSTEM_PROMPT },
        { role: "user", content: userPayload },
      ],
      { temperature: 0.2 }
    );
    parsed = extractJson(res.content);
    if (parsed == null) {
      record.llmState = "llm_unavailable";
      record.llmFailureReason = "parse_error";
    }
  } catch (e) {
    record.llmState = "llm_unavailable";
    record.llmFailureReason = e instanceof LLMUnavailableError ? `provider:${e.message}` : `unknown:${String(e)}`;
  }

  if (parsed != null) {
    const validation = validateSignalOutput(parsed, bundleEvidence);
    if (!validation.valid) {
      record.parseErrors = validation.errors;
      record.llmState = "llm_unavailable";
      record.llmFailureReason = "validation_error:" + validation.errors.slice(0, 5).join(",");
    } else {
      const out = parsed as LLMSignalOutput;
      record.llmOutput = out;
      record.llmConvictionScore = out.llm_conviction_score;
    }
  }

  // ── Final decision (deterministic reconciliation; LLM cannot relax rules) ─
  if (record.llmState !== "ok" || !record.llmOutput) {
    record.finalSignal = "NO_TRADE";
    record.finalSignalReason =
      "llm_unavailable: the model output was absent, unparseable or failed strict validation; no signal is fabricated and no technical rule is substituted for the LLM.";
    return record;
  }
  const llmSignal = record.llmOutput.signal;
  if (cpTriggered.includes("drawdown_pause_10pct") && llmSignal === "BUY") {
    record.finalSignal = "NO_TRADE";
    record.finalSignalReason = "capital protection: account drawdown pause active; research BUYs are suppressed (policy " + CAPITAL_PROTECTION_POLICY_ID + "). " + record.llmOutput.decision_reason;
    return record;
  }
  if (rr.noTrade) {
    // A research LLM view may stand, but it can never become an executable BUY.
    if (llmSignal === "BUY") {
      record.finalSignal = "NO_TRADE";
      record.finalSignalReason =
        `LLM proposed BUY but the deterministic gate rejected executability (${rr.noTradeReasons.join("; ")}); downgraded to NO_TRADE. ` +
        record.llmOutput.decision_reason;
    } else {
      record.finalSignal = llmSignal;
      record.finalSignalReason = record.llmOutput.decision_reason;
    }
    return record;
  }
  record.finalSignal = llmSignal;
  record.finalSignalReason = record.llmOutput.decision_reason;
  return record;
}
