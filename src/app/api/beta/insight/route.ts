import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { evaluateStrategies, STRATEGY_INVENTORY } from "@/lib/latent/strategies/engine";
import { fuseSignals, type FusionResult } from "@/lib/latent/strategies/fusion";
import { computeRiskLevels, type RiskLevelBar } from "@/lib/latent/risk-levels";
import { backtestReportsDir, projectRoot } from "@/lib/latent/paths";
import { getCacheStatus } from "@/lib/latent/cache";
import { getSession, isBetaActive } from "@/lib/latent/beta-access";
import { errorResponse } from "@/lib/latent/error-codes";
import { rateLimit, clientKey } from "@/lib/latent/rate-limit";

// Task 116 Parts E/F/H — one combined beta insight per symbol:
//   1. Strategy Fusion (12-component engine, transparent consensus)
//   2. LLM Analyst (existing frozen Task 111 GLM-4.6 evidence — READ-ONLY)
//   3. Evidence Quality (data freshness/completeness)
//   4. Risk Policy (deterministic atr14-1.5-1-2-3 hypothetical levels)
//   5. Agreement/Conflict (never averaged away)
//
// The LLM is the analyst/explanation layer — NOT a 13th directional vote.
// Its stored decisions and evidence hashes are consumed immutably; no new
// LLM pipeline exists here. Conviction is uncalibrated and labelled as such.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BARS_LOOKBACK = 400; // working set for 120-session windows
const MIN_BARS_REQUIRED = 130;

interface LlmRecord {
  signalId: string;
  symbol: string;
  recordType: string;
  decision: string;
  dataCutoff: string;
  decisionTimestamp?: string;
  llmConvictionScore?: number | null;
  evidenceHash?: string;
  evidenceQualityScore?: number | null;
  finalSignalReason?: string;
  model?: string;
}

function latestRealLlmRecord(symbol: string): LlmRecord | null {
  // Immutable Task 111 signal history — read-only consumption of stored,
  // validated records. MOCK_PIPELINE_CHECK records are excluded (Part M3).
  const dir = path.join(backtestReportsDir(), "task112", "llm_signal_history");
  if (!fs.existsSync(dir)) return null;
  let best: { rec: LlmRecord; ts: number } | null = null;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json") || !f.startsWith(`${symbol}-`)) continue;
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as LlmRecord;
      if (rec.recordType !== "REAL_LLM_DECISION") continue;
      if (rec.symbol !== symbol) continue;
      const ts = new Date(rec.decisionTimestamp ?? f).getTime();
      if (!best || ts > best.ts) best = { rec, ts };
    } catch {
      continue;
    }
  }
  return best?.rec ?? null;
}

type Agreement = "agrees" | "conflicts" | "neutral" | "unavailable";

function llmAgreement(fusion: FusionResult, llm: LlmRecord | null): { agreement: Agreement; label: string; detail: string } {
  if (!llm) {
    return {
      agreement: "unavailable",
      label: "LLM_UNAVAILABLE",
      detail: "No stored GLM-4.6 analyst decision exists for this symbol. The strategy result stands alone — no LLM panel is invented.",
    };
  }
  const d = llm.decision;
  const bull = fusion.state === "BULLISH_ALIGNMENT";
  const bear = fusion.state === "BEARISH_PRESSURE";
  if (bull && d === "BUY")
    return { agreement: "agrees", label: "AGREEMENT", detail: "Strategy alignment is positive and the GLM-4.6 analyst decision is BUY. Agreement is shown — it is NOT proof of a winning trade (n=12 descriptive research only)." };
  if (bull && (d === "NO_TRADE" || d === "HOLD"))
    return { agreement: "conflicts", label: "CONFLICT", detail: `Strategy alignment is positive but the GLM-4.6 analyst decision is ${d}. The conflict is displayed, never averaged away.` };
  if (bear && (d === "NO_TRADE" || d === "HOLD"))
    return { agreement: "agrees", label: "AGREEMENT", detail: `Strategy output is bearish pressure and the analyst says ${d} — both indicate staying out (long-only policy: no short entry).` };
  if (bear && d === "BUY")
    return { agreement: "conflicts", label: "CONFLICT", detail: "Strategy output is bearish pressure but the GLM-4.6 analyst decision is BUY. The conflict is displayed." };
  if (fusion.state === "MIXED_EVIDENCE" || fusion.state === "REGIME_UNCLEAR")
    return { agreement: "neutral", label: "MIXED/NEUTRAL EVIDENCE", detail: `Strategy evidence is mixed (${fusion.state}); the analyst decision (${d}) is shown alongside it without converting either into a recommendation.` };
  return { agreement: "neutral", label: "NO DIRECT ASSESSMENT", detail: `Strategy state ${fusion.state} vs analyst decision ${d} — no direct agreement mapping applies.` };
}

export async function GET(req: NextRequest) {
  const started = Date.now();
  try {
    // Task 117 Part C/J — the research view is for beta participants only;
    // computation is rate-limited per session and per IP (host protection).
    const gate = await isBetaActive();
    if (!gate.active) return errorResponse("profile_validation_error", { betaDisabled: true });
    const session = await getSession(req);
    if (!session) return errorResponse("invitation_invalid");
    const rlSession = rateLimit("insight_session", session.profileId, 60, 60 * 60 * 1000);
    const rlIp = rateLimit("insight_ip", clientKey(req), 120, 60 * 60 * 1000);
    if (!rlSession.allowed || !rlIp.allowed) {
      return errorResponse("rate_limited", { retryAfterSec: Math.max(rlSession.retryAfterSec, rlIp.retryAfterSec) });
    }

    const url = new URL(req.url);
    const symbolsParam = url.searchParams.get("symbols") || "";
    const advanced = url.searchParams.get("advanced") === "1";

    // default watchlist: the most liquid verified universe symbols
    const DEFAULT_SYMBOLS = ["LUCK", "HUBC", "SYS", "MEBL", "OGDC", "PSO", "TRG", "MLCF"];
    const symbols = (symbolsParam ? symbolsParam.split(",") : DEFAULT_SYMBOLS)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z0-9-]{2,12}$/.test(s))
      .slice(0, 12);
    if (!symbols.length) return NextResponse.json({ error: "No valid symbols requested" }, { status: 400 });

    // market overview (single query set)
    const frontierRow = await db.ohlcvBar.aggregate({ _max: { date: true } });
    const frontier = frontierRow._max.date;
    const totalBars = await db.ohlcvBar.count();

    // provider status from the Task 107 ingestion report (verified artifact)
    let providerStatus: Record<string, unknown> = { status: "unknown" };
    try {
      const ing = JSON.parse(
        fs.readFileSync(path.join(backtestReportsDir(), "task107", "task107_daily_ingestion_report.json"), "utf8")
      );
      providerStatus = {
        status: ing?.provider?.available ? "available" : "unavailable",
        identity: ing?.provider?.identity,
        frontierBefore: ing?.frontier_before ?? ing?.frontierBefore,
        frontierAfter: ing?.frontier_after ?? ing?.frontierAfter,
        retrievedAt: ing?.generated_at ?? ing?.generatedAt,
        overlapMismatches: (ing?.overlap_mismatches ?? ing?.overlapMismatches ?? []).length,
      };
    } catch {
      providerStatus = { status: "unavailable", reason: "ingestion report not readable — showing last verified data only" };
    }

    // bars for all requested symbols + their configured pair partners
    const pairMates = new Set<string>();
    for (const s of symbols) {
      for (const [a, b] of [["LUCK", "DGKC"], ["OGDC", "PPL"], ["ENGRO", "FFC"], ["HUBC", "KAPCO"]] as const) {
        if (a === s) pairMates.add(b);
        if (b === s) pairMates.add(a);
      }
    }
    const need = Array.from(new Set([...symbols, ...pairMates]));
    const barRows = await db.ohlcvBar.findMany({
      where: { symbol: { in: need } },
      orderBy: [{ symbol: "asc" }, { date: "asc" }],
      // cheap tail fetch: take the last BARS_LOOKBACK per symbol by fetching
      // all and slicing (the per-symbol dataset is small enough post-filter)
    });
    const barsBySymbol = new Map<string, typeof barRows>();
    for (const r of barRows) {
      if (!barsBySymbol.has(r.symbol)) barsBySymbol.set(r.symbol, []);
      const arr = barsBySymbol.get(r.symbol)!;
      // sliding window: keep the MOST RECENT BARS_LOOKBACK sessions per symbol
      if (arr.length >= BARS_LOOKBACK) arr.shift();
      arr.push(r);
    }

    const now = new Date();
    const perSymbol = symbols.map((sym) => {
      const rows = barsBySymbol.get(sym) ?? [];
      const bars = rows.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close }));
      const peerBars = new Map<string, { date: string; open: number; high: number; low: number; close: number }[]>();
      for (const [k, v] of barsBySymbol) if (k !== sym) peerBars.set(k, v.map((r) => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close })));

      if (bars.length < MIN_BARS_REQUIRED) {
        return {
          symbol: sym,
          available: false as const,
          reason: `Insufficient verified history: ${bars.length} bars (need ≥ ${MIN_BARS_REQUIRED}).`,
          barsAvailable: bars.length,
        };
      }

      const signals = evaluateStrategies({ symbol: sym, bars, peerBars, now });
      const fusion = fuseSignals(sym, signals);
      const llm = latestRealLlmRecord(sym);
      const agreement = llmAgreement(fusion, llm);

      // deterministic hypothetical risk levels (frozen atr14-1.5-1-2-3 policy)
      const riskBars: RiskLevelBar[] = bars.map((b) => ({ date: b.date, high: b.high, low: b.low, close: b.close }));
      const risk = computeRiskLevels(riskBars, fusion.sourceBarDate, "BUY");

      const evidenceQuality = {
        sourceBarDate: fusion.sourceBarDate,
        barsUsed: bars.length,
        dataFrontier: frontier,
        barFreshnessDays: frontier ? Math.floor((now.getTime() - new Date(frontier + "T00:00:00Z").getTime()) / 86_400_000) : null,
        llmDataCutoff: llm?.dataCutoff ?? null,
        llmEvidenceQualityScore: llm?.evidenceQualityScore ?? null,
        notes: [
          "All strategies computed from verified, overlap-checked OhlcvBar source data (psxdata via the Task 107 ingestion pipeline).",
        ],
      };

      return {
        symbol: sym,
        available: true as const,
        fusion,
        strategies: advanced
          ? signals
          : signals.map((s) => ({
              strategyId: s.strategyId,
              strategyName: s.strategyName,
              role: s.role,
              direction: s.direction,
              validationStatus: s.validationStatus,
              eligibility: s.eligibility,
              reason: s.reason,
              sourceBarDate: s.sourceBarDate,
              methodVersion: s.methodVersion,
            })),
        llm: llm
          ? {
              signalId: llm.signalId,
              decision: llm.decision,
              model: llm.model ?? "GLM-4.6 (Task 111 pipeline)",
              dataCutoff: llm.dataCutoff,
              decisionTimestamp: llm.decisionTimestamp ?? null,
              // conviction is DISPLAY-ONLY and uncalibrated — never a probability
              convictionLabel: "uncalibrated",
              convictionScore: llm.llmConvictionScore ?? null,
              evidenceHash: llm.evidenceHash ?? null,
              reason: llm.finalSignalReason ?? null,
              note: "LLM conviction is uncalibrated. Performance not available — insufficient matured outcomes (0 genuine matured LLM-cohort outcomes at 5/10/21 sessions as of Task 115).",
            }
          : null,
        llmAgreement: agreement,
        risk: risk
          ? {
              policyId: "atr14-1.5-1-2-3",
              policyVersion: "task77-v1",
              entryReference: bars[bars.length - 1].close,
              stopLoss: risk.sl,
              takeProfits: [risk.tp1, risk.tp2, risk.tp3],
              atr14: risk.atr14,
              warning: "SHADOW / BETA RESEARCH — NOT AN ORDER. Hypothetical deterministic levels from the frozen policy; no broker orders, no live execution, no leverage, no short entry, no automatic allocation.",
            }
          : null,
        evidenceQuality,
      };
    });

    return NextResponse.json({
      meta: {
        generatedAt: now.toISOString(),
        methodologyVersion: "beta-consensus-v1",
        strategyInventory: STRATEGY_INVENTORY,
        fusionDenominators: "Eligible directional strategies only; regime gates and pair context never inflate the denominator.",
        dataFrontier: frontier,
        totalVerifiedBars: totalBars,
        provider: providerStatus,
        cache: getCacheStatus(),
        warnings: [
          "BETA RESEARCH EXPERIENCE — educational/research information only, not personalized regulated investment advice, not guaranteed returns.",
          "This beta does not place broker orders. No live trading, no automatic execution, no automatic model promotion.",
          "No model or strategy has passed independent promotion requirements. Nothing here implies proven profitability.",
        ],
        researchFacts: {
          gen1Checkpoint: "Task 115: 12 gen1 observations at the 5-session horizon, aggregate net +PKR 38,064.93 — descriptive from n=12, NOT proof of a profitable edge.",
          llmMaturity: "GLM-4.6 cohort has ZERO matured 5/10/21-session outcomes (Task 115). The SYS TP3 exit was a terminal policy-simulation event, not a matured LLM horizon result.",
        },
      },
      perSymbol,
      latencyMs: Date.now() - started,
      projectRootNote: projectRoot() ? "runtime-root-relative" : "unresolved",
    });
  } catch (err) {
    console.error("[/api/beta/insight] error:", err);
    return NextResponse.json(
      { error: "Beta insight computation failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
