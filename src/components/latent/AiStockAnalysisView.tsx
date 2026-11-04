"use client";

// Task 111 — "AI Fundamental + Technical Analysis" research dashboard.
// Every number comes from the stored immutable LLM research-signal records
// (/api/ai-analysis/*) produced by the deterministic evidence -> LLM ->
// validation -> risk/reward pipeline. RESEARCH ONLY: nothing here is a
// trading signal and no order path exists. LLM conviction is UNCALIBRATED and
// is never displayed as a win probability.

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SignalRow {
  symbol: string;
  finalSignal: string;
  llmState: string;
  llmConviction: number | null;
  evidenceQuality: number;
  dataCutoff: string;
  decisionTimestamp: string;
  provider: string;
  model: string;
  rrStatus: string | null;
  rrTp2: number | null;
  staleSkipped: boolean;
}

interface SignalDetail {
  symbol: string;
  dataCutoff: string;
  decisionTimestamp: string;
  provider: string;
  model: string;
  promptVersion: string;
  llmState: string;
  llmFailureReason: string | null;
  parseErrors: string[];
  llmOutput: {
    signal: string;
    analysis_horizon: string;
    fundamental_view: string;
    financial_pattern_view: string;
    national_news_view: string;
    international_news_view: string;
    company_news_view: string;
    technical_view: string;
    price_pattern_view: string;
    bullish_evidence: string[];
    bearish_evidence: string[];
    conflicting_evidence: string[];
    missing_evidence: string[];
    main_risks: string[];
    invalidation_conditions: string[];
    llm_conviction_score: number;
    decision_reason: string;
    source_references: string[];
    limitations: string[];
  } | null;
  llmConvictionScore: number | null;
  evidenceQualityScore: number;
  evidenceQualityParts: Record<string, number>;
  calibratedNetPositiveProbability: null;
  finalSignal: string;
  finalSignalReason: string;
  riskReward: {
    executionAssumption: string;
    entryReference: number | null;
    stopLoss: number | null;
    targets: { tp1: number | null; tp2: number | null; tp3: number | null };
    rr_to_tp1: number | null;
    rr_to_tp2: number | null;
    rr_to_tp3: number | null;
    risk_reward_status: string;
    positionQty: number;
    costSchedule: string;
    noTrade: boolean;
    noTradeReasons: string[];
  } | null;
  capitalProtection: { policyId: string; triggered: string[] };
}

const UNIVERSE = ["ANL", "BOP", "CNERGY", "FCCL", "HASCOL", "HUBC", "HUMNL", "KEL", "LOTCHEM", "LUCK", "MEBL", "MLCF", "OGDC", "PAEL", "PIBTL", "PPL", "PRL", "PSO", "SYS", "TELE", "TRG", "UNITY", "WTL"];

function signalBadge(signal: string) {
  const map: Record<string, string> = {
    BUY: "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    HOLD: "border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-400",
    SELL_TO_CLOSE: "border-orange-500/60 bg-orange-500/10 text-orange-700 dark:text-orange-400",
    BEARISH_RESEARCH_ONLY: "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-400",
    NO_TRADE: "border-zinc-500/60 bg-zinc-500/10 text-zinc-700 dark:text-zinc-400",
  };
  return map[signal] ?? "border-zinc-500/60 bg-zinc-500/10";
}

function ViewChip({ label, value }: { label: string; value: string }) {
  const tone =
    value === "bullish" ? "text-emerald-600 dark:text-emerald-400"
    : value === "bearish" ? "text-rose-600 dark:text-rose-400"
    : value === "mixed" ? "text-amber-600 dark:text-amber-400"
    : "text-zinc-500";
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${tone}`}>{value}</span>
    </div>
  );
}

export function AiStockAnalysisView() {
  const [symbol, setSymbol] = useState("HUBC");
  const [rows, setRows] = useState<SignalRow[]>([]);
  const [detail, setDetail] = useState<SignalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const r = await fetch("/api/ai-analysis", { cache: "no-store" });
      const j = await r.json();
      setRows(j.signals ?? []);
    } catch {
      setRows([]);
    }
  }, []);

  const loadDetail = useCallback(async (sym: string) => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/ai-analysis/${sym}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.notice || j.error || `HTTP ${r.status}`);
      setDetail(j.signal);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);
  useEffect(() => {
    loadDetail(symbol);
  }, [symbol, loadDetail]);

  const rr = detail?.riskReward ?? null;
  const out = detail?.llmOutput ?? null;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">AI Fundamental + Technical Analysis</h1>
        <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400">
          RESEARCH ONLY — NOT AN APPROVED LIVE TRADING SIGNAL
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1">
        {UNIVERSE.map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className={`rounded-md border px-2 py-1 text-xs font-medium ${s === symbol ? "border-primary bg-primary/10" : "text-muted-foreground hover:bg-muted"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading LLM research signal…</p>}
      {err && <p className="text-sm text-rose-600">{err}</p>}

      {detail && (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Main signal card</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{detail.symbol}</div>
                    <div className="text-xs text-muted-foreground">cutoff {detail.dataCutoff} · decided {String(detail.decisionTimestamp).slice(0, 16)}Z</div>
                  </div>
                  <Badge variant="outline" className={signalBadge(detail.finalSignal)}>{detail.finalSignal}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  provider {detail.provider}/{detail.model} · prompt {detail.promptVersion} · horizon {out?.analysis_horizon ?? "10d"} · status research_only
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">LLM conviction (uncalibrated)</div>
                    <div className="text-lg font-semibold">{detail.llmConvictionScore ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground">NOT a win probability</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">Evidence quality</div>
                    <div className="text-lg font-semibold">{detail.evidenceQualityScore}</div>
                    <div className="text-[10px] text-muted-foreground">deterministic, engine-computed</div>
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">Calibrated probability</div>
                    <div className="text-lg font-semibold">—</div>
                    <div className="text-[10px] text-muted-foreground">null until validated calibration</div>
                  </div>
                </div>
                {rr && (
                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div className="rounded-md border p-2">
                      <div className="text-muted-foreground">Entry ref ({rr.executionAssumption === "delayed_observation_shadow" ? "delayed shadow" : "next open ref"})</div>
                      <div className="font-semibold">{rr.entryReference?.toFixed(2) ?? "—"}</div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-muted-foreground">Stop / TP1 / TP2 / TP3</div>
                      <div className="font-semibold">
                        {rr.stopLoss?.toFixed(2) ?? "—"} / {rr.targets?.tp1?.toFixed(2) ?? "—"} / {rr.targets?.tp2?.toFixed(2) ?? "—"} / {rr.targets?.tp3?.toFixed(2) ?? "—"}
                      </div>
                    </div>
                    <div className="rounded-md border p-2">
                      <div className="text-muted-foreground">Net R:R (V2 costs, whole shares)</div>
                      <div className="font-semibold">{rr.rr_to_tp2 != null ? `1 : ${rr.rr_to_tp2.toFixed(2)} (TP2)` : rr.risk_reward_status}</div>
                      <div className="text-[10px] text-muted-foreground">{rr.positionQty ? `${rr.positionQty} shares` : "no position"} · {rr.costSchedule?.split(" ")[0]}</div>
                    </div>
                  </div>
                )}
                {detail.llmState !== "ok" && (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                    llm_unavailable: {detail.llmFailureReason ?? "model output absent/unvalidated"} — no signal fabricated, no technical rule substituted.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Views by evidence source</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                <ViewChip label="Fundamentals" value={out?.fundamental_view ?? "unavailable"} />
                <ViewChip label="Financial patterns" value={out?.financial_pattern_view ?? "insufficient_data"} />
                <ViewChip label="Company news" value={out?.company_news_view ?? "unavailable"} />
                <ViewChip label="National news" value={out?.national_news_view ?? "unavailable"} />
                <ViewChip label="International news" value={out?.international_news_view ?? "unavailable"} />
                <ViewChip label="Technical indicators" value={out?.technical_view ?? "unknown"} />
                <ViewChip label="Price patterns" value={out?.price_pattern_view ?? "unknown"} />
                {detail.capitalProtection.triggered.length > 0 && (
                  <p className="pt-1 text-xs text-amber-600 dark:text-amber-400">
                    Capital protection triggered: {detail.capitalProtection.triggered.join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">LLM reasoning</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="leading-relaxed">{detail.finalSignalReason || out?.decision_reason}</p>
                {out?.bullish_evidence?.length ? (
                  <div><div className="text-xs font-semibold text-emerald-600">Bullish</div><ul className="list-disc pl-5 text-xs">{out.bullish_evidence.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                ) : null}
                {out?.bearish_evidence?.length ? (
                  <div><div className="text-xs font-semibold text-rose-600">Bearish</div><ul className="list-disc pl-5 text-xs">{out.bearish_evidence.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                ) : null}
                {out?.conflicting_evidence?.length ? (
                  <div><div className="text-xs font-semibold text-amber-600">Conflicting evidence</div><ul className="list-disc pl-5 text-xs">{out.conflicting_evidence.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                ) : null}
                {out?.main_risks?.length ? (
                  <div><div className="text-xs font-semibold">Main risks</div><ul className="list-disc pl-5 text-xs">{out.main_risks.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                ) : null}
                {out?.missing_evidence?.length ? (
                  <div><div className="text-xs font-semibold text-muted-foreground">Missing evidence (never fabricated)</div><ul className="list-disc pl-5 text-xs">{out.missing_evidence.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                ) : null}
                {out?.source_references?.length ? (
                  <div className="text-xs text-muted-foreground">Sources: {out.source_references.join(", ")}</div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Deterministic risk/reward audit</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {rr ? (
                  <>
                    <ViewChip label="R:R to TP1 (net of V2 costs)" value={rr.rr_to_tp1 != null ? rr.rr_to_tp1.toFixed(2) : rr.risk_reward_status} />
                    <ViewChip label="R:R to TP2" value={rr.rr_to_tp2 != null ? rr.rr_to_tp2.toFixed(2) : rr.risk_reward_status} />
                    <ViewChip label="R:R to TP3" value={rr.rr_to_tp3 != null ? rr.rr_to_tp3.toFixed(2) : rr.risk_reward_status} />
                    <ViewChip label="NO_TRADE gate" value={rr.noTrade ? `yes (${(rr.noTradeReasons ?? []).slice(0, 2).join("; ") || "policy"})` : "no"} />
                    <p className="pt-1 text-xs text-muted-foreground">
                      Levels follow the platform policy atr14-1.5-1-2-3 and are priced through computeTradeCostsV2
                      (psx_user_schedule_v2). The LLM cannot write its own ratio or relax any rule.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No deterministic R:R available for this record.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">All research signals (immutable history)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left py-1">Symbol</th><th className="text-left">Signal</th><th className="text-left">LLM</th>
                  <th className="text-left">Conviction</th><th className="text-left">Evidence</th><th className="text-left">Cutoff</th><th className="text-left">R:R(TP2)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol + r.decisionTimestamp} className="border-t">
                    <td className="py-1 font-medium">{r.symbol}</td>
                    <td><Badge variant="outline" className={signalBadge(r.finalSignal)}>{r.finalSignal}</Badge></td>
                    <td className={r.llmState === "ok" ? "text-emerald-600" : "text-amber-600"}>{r.llmState}</td>
                    <td>{r.llmConviction ?? "—"}</td>
                    <td>{r.evidenceQuality}</td>
                    <td>{r.dataCutoff}</td>
                    <td>{r.rrTp2 != null ? r.rrTp2.toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pt-2 text-[10px] text-muted-foreground">
            Historical decisions are never rewritten; each record is immutable per evidence hash. LLM conviction is
            uncalibrated and is never shown as a win probability.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
