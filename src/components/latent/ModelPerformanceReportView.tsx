"use client";

// Task 112 — "Model Performance" tab: the in-app comprehensive report over
// every model and strategy actually present in repository evidence
// (Tasks 79-111), including the GLM-4.6 LLM analyst. All values come from the
// machine-readable report artifact; missing values are marked in the artifact
// itself ("Not available in source evidence") and shown as such here.
// Historical / validation / final-test / forward categories are never merged.

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface SummaryRow {
  model: string;
  methodology: string;
  best_available_result: unknown;
  forward_outcomes_matured: string;
  current_status: string;
  promotion_eligibility: string;
}

interface Profile {
  model_name: string;
  model_family: string;
  purpose: string;
  methodology: string;
  training_approach: string;
  prediction_horizon: string;
  universe: string;
  transaction_cost_assumptions: string;
  execution_assumptions: string;
  historical_backtest_result: unknown;
  metrics_by_category: unknown;
  forward_validation_status: string;
  current_disposition: string;
  current_status_label: string;
  promotion_eligibility: string;
  artifact_location: string;
  [k: string]: unknown;
}

interface AccountRow {
  strategy: string;
  ending_balance: number | string;
  net_roi_pct: number | string;
  max_drawdown_pct: number | string;
  annualized_volatility_pct: number | string | null;
  avg_exposure_pct: number | string | null;
  turnover: number | string | null;
  trades: number | string | null;
  win_rate_pct: number | string | null;
  profit_factor: number | string | null;
  total_costs: number | string | null;
}

interface Report {
  generated_at: string;
  git_head: string;
  status: string;
  report_version?: string;
  inventory: Profile[];
  summary: SummaryRow[];
  account_comparison_pkr100k: AccountRow[];
  llm_evidence_contribution: Record<string, { available_pct?: number; cited_pct?: number; available?: number; cited?: number; note?: string }>;
  general_forward_cohort: {
    total_forward_observations?: number; matured_positions?: number; wins?: number; losses?: number;
    pending_strategy_outcomes?: number; unique_symbols?: number; warning?: string;
  };
  evidence_lineage: Record<string, unknown>;
  task113_audit?: {
    available: boolean;
    data_frontier?: string;
    session_count?: number;
    inventory_dashboard?: InventoryDash;
    forward_validation_dashboard?: ForwardRow[];
    llm_outcome_maturity?: LlmMaturity;
    explanation_57_43_59?: { conclusion?: string; what_each_number_counts?: Record<string, string> };
  };
  task114_maturity?: {
    available: boolean;
    reason?: string;
    engine_version?: string;
    generated_at?: string;
    data_frontier?: string;
    sessions_new_since_2026_11_03?: string[];
    panel?: Task114PanelRow[];
    llm?: Task114Llm;
    idempotency?: { duplicate_processing_attempts_identical?: number; source_bar_revisions_detected?: number; outcome_key?: string; policy?: string };
    missing_market_data?: string[];
    drill_down?: Record<string, Task114DrillRow[]>;
    warnings?: string[];
    methodology?: Record<string, string>;
  };
}

interface Task114PanelRow {
  cohort_id: string;
  total_observations?: number;
  unique_symbols?: number;
  matured_5_session?: number;
  pending_5_session?: number;
  remaining_sessions_5?: number[];
  matured_10_session?: number;
  pending_10_session?: number;
  matured_21_session?: number;
  pending_21_session?: number;
  terminal_exits_frozen_engine?: number;
  pending_mtm_frozen_engine?: number;
  unfilled_awaiting_entry_bar?: number;
  excluded_records?: number;
  policy_version?: string;
  cost_profile?: string;
}

interface Task114Llm {
  genuine_universe_decisions?: number;
  unique_symbols?: number;
  decisions_buy?: number;
  decisions_hold?: number;
  decisions_no_trade?: number;
  excluded_count?: number;
  terminal_exits_llm_policy_sim?: number;
  calibration?: { status?: string; minimum_required?: number; current_matured_llm_outcomes?: number; llm_conviction?: string };
  counterfactual_note?: string;
  preservation?: string;
}

interface Task114DrillRow {
  decision_id: string;
  symbol: string;
  decision_date?: string;
  entry_status?: string;
  h5?: string;
  h10?: string;
  h21?: string;
}

interface InventoryDash {
  total_registry_entries?: number;
  implemented_models?: number;
  trained_psx_models?: number;
  successfully_evaluated_models?: number;
  shadow_models?: number;
  rule_based_strategies?: number;
  blocked_unavailable_models?: number;
  duplicate_alias_entries?: number;
  historical_experiments?: number;
  by_category?: Record<string, number>;
  note?: string;
}

interface ForwardRow {
  cohort_id: string;
  cohort_name?: string;
  total_observations?: number;
  unique_symbols?: number;
  matured_5_session?: number | string;
  pending_5_session?: number | string;
  matured_10_session?: number | string;
  pending_10_session?: number | string;
  matured_21_session?: number | string;
  pending_21_session?: number | string;
  matured_terminal_exits_early?: number;
  pending_mtm_open?: number;
  unfilled_awaiting_entry_bar?: number;
}

interface LlmMaturity {
  matured_5_session?: number;
  matured_10_session?: number;
  matured_21_session?: number;
  total_real_decisions?: number;
  buy_decisions_current?: number;
  calibration_status?: string;
  directional_accuracy?: string;
  net_returns_buy?: string;
  rule?: string;
}

const NA = "Not available in source evidence";

function statusBadge(s: string) {
  if (s.startsWith("Shadow")) return "border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-300";
  if (s.startsWith("Research")) return "border-zinc-500/60 bg-zinc-500/10";
  if (s.startsWith("Rule")) return "border-purple-500/60 bg-purple-500/10 text-purple-700 dark:text-purple-300";
  if (s.startsWith("Rejected")) return "border-rose-500/60 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return "border-amber-500/60 bg-amber-500/10";
}

function fmtVal(v: unknown): string {
  if (v == null) return NA;
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v * 1e4) / 1e4) : String(v);
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

export function ModelPerformanceReportView() {
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    fetch("/api/model-report", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
        setReport(j);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const statuses = useMemo(
    () => [...new Set((report?.summary ?? []).map((r) => r.current_status))].sort(),
    [report]
  );
  const rows = useMemo(() => {
    let rs = report?.summary ?? [];
    if (statusFilter) rs = rs.filter((r) => r.current_status === statusFilter);
    const q = filter.trim().toLowerCase();
    if (q) rs = rs.filter((r) => r.model.toLowerCase().includes(q));
    return rs;
  }, [report, filter, statusFilter]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading model performance report…</div>;
  if (err)
    return (
      <div className="space-y-3 p-6">
        <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
          SHADOW / RESEARCH ONLY — NOT AN ORDER
        </div>
        <p className="text-sm text-rose-600">Report unavailable: {err}</p>
      </div>
    );
  if (!report) return null;

  const gf = report.general_forward_cohort;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
        SHADOW / RESEARCH ONLY — NOT AN ORDER
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Model &amp; Strategy Performance Report</h1>
          <p className="text-xs text-muted-foreground">
            Every model and strategy in repository evidence (Tasks 79-111) · generated {report.generated_at} · head {report.git_head} ·
            historical / validation / final-test / forward categories never merged.
          </p>
        </div>
        <div className="flex gap-1">
          {["pdf", "csv", "json", "md"].map((f) => (
            <a key={f} className="rounded-md border px-3 py-1.5 text-xs uppercase hover:bg-muted" href={`/api/model-report/download?format=${f}`}>
              {f}
            </a>
          ))}
        </div>
      </div>

      {/* cohort separation banner */}
      <Card>
        <CardContent className="space-y-1 pt-4 text-xs">
          <p className="font-semibold">Cohort separation</p>
          <p className="text-rose-600">{gf.warning}</p>
          <p>
            General cohort: {gf.total_forward_observations} observations · {gf.matured_positions} matured (W{gf.wins}/L{gf.losses}) ·{" "}
            {gf.pending_strategy_outcomes} pending · {gf.unique_symbols} symbols.
          </p>
          <p>
            LLM cohort (GLM-4.6): <b>0 matured outcomes</b> — decisions are current-date only; calibrated probability is
            “Not available — insufficient matured forward outcomes”; calibration requires ≥100 genuine matured LLM-cohort outcomes.
          </p>
        </CardContent>
      </Card>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input className="h-8 w-56" placeholder="Filter models…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select className="h-8 rounded-md border bg-background px-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{rows.length} models</span>
      </div>

      {/* Task 113: model inventory dashboard */}
      {report.task113_audit?.inventory_dashboard && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Model inventory dashboard (Task 113 audit)</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 md:grid-cols-5">
              {[
                ["Total registry entries", report.task113_audit.inventory_dashboard.total_registry_entries],
                ["Implemented models", report.task113_audit.inventory_dashboard.implemented_models],
                ["Trained on PSX data", report.task113_audit.inventory_dashboard.trained_psx_models],
                ["Successfully evaluated", report.task113_audit.inventory_dashboard.successfully_evaluated_models],
                ["Forward shadow models", report.task113_audit.inventory_dashboard.shadow_models],
                ["Rule-based strategies", report.task113_audit.inventory_dashboard.rule_based_strategies],
                ["Blocked / unavailable", report.task113_audit.inventory_dashboard.blocked_unavailable_models],
                ["Duplicate / alias", report.task113_audit.inventory_dashboard.duplicate_alias_entries],
                ["Historical experiments", report.task113_audit.inventory_dashboard.historical_experiments],
              ].map(([label, val]) => (
                <div key={String(label)} className="rounded-md border p-2">
                  <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
                  <div className="text-lg font-semibold">{String(val ?? "—")}</div>
                </div>
              ))}
            </div>
            <p className="pt-2 text-[10px] text-muted-foreground">{report.task113_audit.inventory_dashboard.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Task 113: forward-validation dashboard (by cohort) */}
      {report.task113_audit?.forward_validation_dashboard && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Forward-validation dashboard (Task 113 — by cohort)</CardTitle>
            <p className="text-[11px] text-muted-foreground">Each cohort reconciles internally. Total positions ≠ total decisions ≠ matured outcomes.</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1.5 pr-2">Cohort</th><th className="pr-2">Obs</th><th className="pr-2">Symbols</th>
                    <th className="pr-2">Mat 5</th><th className="pr-2">Pend 5</th>
                    <th className="pr-2">Mat 10</th><th className="pr-2">Pend 10</th>
                    <th className="pr-2">Mat 21</th><th className="pr-2">Pend 21</th>
                    <th className="pr-2">Term-exits</th><th className="pr-2">Pend-MTM</th><th className="pr-2">Unfilled</th>
                  </tr>
                </thead>
                <tbody>
                  {report.task113_audit.forward_validation_dashboard.map((fv) => (
                    <tr key={fv.cohort_id} className="border-b border-border/50">
                      <td className="py-1.5 pr-2 font-medium" title={fv.cohort_name}>{fv.cohort_id}</td>
                      <td className="pr-2">{fv.total_observations}</td>
                      <td className="pr-2">{fv.unique_symbols}</td>
                      <td className="pr-2">{fv.matured_5_session}</td>
                      <td className="pr-2">{fv.pending_5_session}</td>
                      <td className="pr-2">{fv.matured_10_session}</td>
                      <td className="pr-2">{fv.pending_10_session}</td>
                      <td className="pr-2">{fv.matured_21_session}</td>
                      <td className="pr-2">{fv.pending_21_session}</td>
                      <td className="pr-2">{fv.matured_terminal_exits_early}</td>
                      <td className="pr-2">{fv.pending_mtm_open}</td>
                      <td className="pr-2">{fv.unfilled_awaiting_entry_bar}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="pt-2 text-[10px] text-muted-foreground">
              0 horizon-matured outcomes for any cohort. The 43 terminal-early-exits are SL/TP3 exits, NOT 5/10/21-session horizon maturities
              (earliest 21-session ~2026-12-01). MTM pending is never counted as a win. Cohorts are never added across denominators.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Task 113: LLM outcome maturity (isolated) */}
      {report.task113_audit?.llm_outcome_maturity && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">LLM outcome maturity (Task 113 — isolated from all other cohorts)</CardTitle></CardHeader>
          <CardContent className="text-xs">
            {(() => {
              const l = report.task113_audit!.llm_outcome_maturity!;
              return (
                <div className="grid gap-1 sm:grid-cols-2">
                  <div>Matured at 5 / 10 / 21 sessions: <b>{l.matured_5_session} / {l.matured_10_session} / {l.matured_21_session}</b> (zero — current-date decisions; frontier equals decision as-of)</div>
                  <div>Total real decisions: <b>{l.total_real_decisions}</b> · BUY (current): <b>{l.buy_decisions_current}</b></div>
                  <div>Directional accuracy: <span className="text-muted-foreground">{l.directional_accuracy}</span></div>
                  <div>Net returns (BUY): <span className="text-muted-foreground">{l.net_returns_buy}</span></div>
                  <div className="sm:col-span-2">Calibration: <span className="font-semibold text-amber-700 dark:text-amber-300">{l.calibration_status}</span></div>
                </div>
              );
            })()}
            <p className="pt-2 text-[10px] text-muted-foreground">{report.task113_audit.llm_outcome_maturity.rule}</p>
          </CardContent>
        </Card>
      )}

      {/* Task 114: forward-horizon maturity panel */}
      {report.task114_maturity?.available && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Forward-horizon maturity (Task 114 — 5/10/21-session audit)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(() => {
              const t = report.task114_maturity;
              const tiles: Array<[string, string]> = [
                ["Market-data frontier", t.data_frontier ?? NA],
                ["New sessions since 2026-11-03", JSON.stringify(t.sessions_new_since_2026_11_03 ?? [])],
                ["Last maturity processing", t.generated_at ?? NA],
                ["Engine", t.engine_version ?? NA],
              ];
              return (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {tiles.map(([k, v]) => (
                    <div key={k} className="rounded-md border bg-muted/30 p-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
                      <div className="truncate text-sm font-semibold" title={v}>{v}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-1.5 pr-2">Cohort</th><th className="pr-2">Obs</th><th className="pr-2">Symbols</th>
                    <th className="pr-2">Mat5 / Pend5</th><th className="pr-2">Mat10 / Pend10</th><th className="pr-2">Mat21 / Pend21</th>
                    <th className="pr-2">Term-exits (frozen)</th><th className="pr-2">Pend-MTM</th>
                    <th className="pr-2">Unfilled</th><th className="pr-2">Excluded</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.task114_maturity.panel ?? []).map((p) => (
                    <tr key={p.cohort_id} className="border-b border-border/50">
                      <td className="py-1.5 pr-2 font-medium">{p.cohort_id}</td>
                      <td className="pr-2">{p.total_observations}</td>
                      <td className="pr-2">{p.unique_symbols}</td>
                      <td className="pr-2 font-semibold">{p.matured_5_session} / {p.pending_5_session}</td>
                      <td className="pr-2">{p.matured_10_session} / {p.pending_10_session}</td>
                      <td className="pr-2">{p.matured_21_session} / {p.pending_21_session}</td>
                      <td className="pr-2">{p.terminal_exits_frozen_engine ?? "—"}</td>
                      <td className="pr-2">{p.pending_mtm_frozen_engine ?? "—"}</td>
                      <td className="pr-2">{p.unfilled_awaiting_entry_bar}</td>
                      <td className="pr-2">{p.excluded_records}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Fixed-horizon matured = N actual per-symbol sessions elapsed from entry, marked at the Nth session close
              (entry session = session 1). <b>Early SL/TP3 terminal exits are a separate measurement from the frozen
              Task 106/107 engine and are never labelled horizon-matured.</b> Pending never enters completed statistics;
              5/10/21-session outcomes are computed independently from source bars. Current values are honestly 0
              everywhere — the first 5-session maturities can only occur at the earliest at the close of the next session
              (gen1: 4/5 sessions elapsed).
            </p>
            {report.task114_maturity.llm && (
              <div className="rounded-md border border-sky-500/40 bg-sky-500/5 p-3 text-xs">
                <div className="mb-1 font-semibold">LLM-specific maturity (isolated cohort `task111-llm`)</div>
                {(() => {
                  const l = report.task114_maturity!.llm!;
                  return (
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      <div>Genuine universe decisions: <b>{l.genuine_universe_decisions}</b> across <b>{l.unique_symbols}</b> symbols</div>
                      <div>BUY <b>{l.decisions_buy}</b> · HOLD <b>{l.decisions_hold}</b> · NO_TRADE <b>{l.decisions_no_trade}</b></div>
                      <div>Excluded records (mock + gen-cache dupes + stale ENGRO): <b>{l.excluded_count}</b></div>
                      <div>Terminal-exit policy sim (separate): <b>{l.terminal_exits_llm_policy_sim}</b> matured</div>
                      <div className="sm:col-span-2">Calibration: <span className="font-semibold text-amber-700 dark:text-amber-300">{l.calibration?.status}</span> (min {l.calibration?.minimum_required}; current {l.calibration?.current_matured_llm_outcomes})</div>
                    </div>
                  );
                })()}
              </div>
            )}
            {report.task114_maturity.idempotency && (
              <p className="text-[10px] text-muted-foreground">
                Idempotency: outcome key {report.task114_maturity.idempotency.outcome_key} · duplicate recomputations
                (identical, benign): {report.task114_maturity.idempotency.duplicate_processing_attempts_identical} ·
                source-bar revisions detected (auditable): {report.task114_maturity.idempotency.source_bar_revisions_detected}
              </p>
            )}
            {(report.task114_maturity.warnings ?? []).map((w) => (
              <p key={w} className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-[11px] text-amber-800 dark:text-amber-300">⚠ {w}</p>
            ))}
            {/* drill-down to individual matured and pending observations */}
            {Object.entries(report.task114_maturity.drill_down ?? {}).map(([cid, rows]) => (
              <details key={cid} className="rounded-md border">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium">
                  Drill-down: {cid} ({rows.length} observations)
                </summary>
                <div className="max-h-72 overflow-auto px-3 pb-2">
                  <table className="w-full text-left text-[11px]">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="py-1 pr-2">Decision</th><th className="pr-2">Sym</th><th className="pr-2">Entry</th>
                        <th className="pr-2">h5</th><th className="pr-2">h10</th><th className="pr-2">h21</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((d) => (
                        <tr key={d.decision_id} className="border-b border-border/40">
                          <td className="max-w-[16rem] truncate py-1 pr-2 font-mono" title={d.decision_id}>{d.decision_id}</td>
                          <td className="pr-2">{d.symbol}</td>
                          <td className="pr-2">{d.entry_status === "filled" ? "filled" : "unfilled"}</td>
                          <td className="pr-2">{d.h5}</td>
                          <td className="pr-2">{d.h10}</td>
                          <td className="pr-2">{d.h21}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      )}

      {/* summary table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Summary comparison</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1.5 pr-2">Model</th><th className="pr-2">Methodology</th>
                  <th className="pr-2">Best available result</th><th className="pr-2">Forward matured</th>
                  <th className="pr-2">Status</th><th className="pr-2">Promotion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.model} className="border-b border-border/50">
                    <td className="py-1.5 pr-2 font-medium">{r.model}</td>
                    <td className="max-w-[14rem] truncate pr-2" title={r.methodology}>{r.methodology}</td>
                    <td className="max-w-[16rem] truncate pr-2" title={fmtVal(r.best_available_result)}>{fmtVal(r.best_available_result)}</td>
                    <td className="pr-2">{r.forward_outcomes_matured}</td>
                    <td className="pr-2"><Badge variant="outline" className={`text-[10px] ${statusBadge(r.current_status)}`}>{r.current_status}</Badge></td>
                    <td className="pr-2">{r.promotion_eligibility}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* account comparison */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Account-level comparison (PKR 100,000 · V2 costs · whole shares · no leverage/shorts)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-1.5 pr-2">Strategy</th><th className="pr-2">End balance</th><th className="pr-2">Net ROI</th>
                  <th className="pr-2">Max DD</th><th className="pr-2">Ann. vol</th><th className="pr-2">Avg exposure</th>
                  <th className="pr-2">Turnover</th><th className="pr-2">Trades</th><th className="pr-2">Win %</th><th className="pr-2">PF</th><th className="pr-2">Costs</th>
                </tr>
              </thead>
              <tbody>
                {report.account_comparison_pkr100k.map((r) => (
                  <tr key={r.strategy} className="border-b border-border/50">
                    <td className="py-1.5 pr-2 font-medium">{r.strategy}</td>
                    <td className="pr-2">{typeof r.ending_balance === "number" ? Math.round(r.ending_balance).toLocaleString() : r.ending_balance}</td>
                    <td className="pr-2">{r.net_roi_pct}%</td>
                    <td className="pr-2">{r.max_drawdown_pct}%</td>
                    <td className="pr-2">{r.annualized_volatility_pct ?? "—"}</td>
                    <td className="pr-2">{r.avg_exposure_pct ?? "—"}%</td>
                    <td className="pr-2">{r.turnover ?? "—"}</td>
                    <td className="pr-2">{r.trades ?? "—"}</td>
                    <td className="pr-2">{r.win_rate_pct ?? "—"}</td>
                    <td className="pr-2">{r.profit_factor ?? "—"}</td>
                    <td className="pr-2">{typeof r.total_costs === "number" ? Math.round(r.total_costs).toLocaleString() : r.total_costs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pt-2 text-[10px] text-muted-foreground">
            Open positions are marked to market; realized and unrealized P&amp;L are reported separately and open
            positions are never counted as completed trades. Drawdown reduction is not alpha; the 10% vol-target result
            remains a research hypothesis, not a promoted strategy.
          </p>
        </CardContent>
      </Card>

      {/* evidence contribution */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">LLM evidence contribution (availability vs actual citation)</CardTitle></CardHeader>
        <CardContent className="text-xs">
          <div className="grid gap-2 md:grid-cols-5">
            {Object.entries(report.llm_evidence_contribution)
              .filter(([k]) => k !== "note")
              .map(([k, v]) => (
                <div key={k} className="rounded-md border p-2">
                  <div className="font-medium">{k.replace(/_/g, " ")}</div>
                  <div>available: {String(v.available_pct ?? "—")}%</div>
                  <div>cited: {String(v.cited_pct ?? "—")}%</div>
                </div>
              ))}
          </div>
          <p className="pt-2 text-muted-foreground">{String(report.llm_evidence_contribution.note ?? "")}</p>
        </CardContent>
      </Card>

      {/* full profiles */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Full model profiles ({report.inventory.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-xs">
          {report.inventory
            .filter((m) => !filter || m.model_name.toLowerCase().includes(filter.trim().toLowerCase()))
            .map((m) => (
              <details key={m.model_name} className="rounded-md border p-2">
                <summary className="cursor-pointer font-medium">
                  {m.model_name} — <span className="text-muted-foreground">{m.current_status_label}</span>
                </summary>
                <div className="mt-2 grid gap-x-4 gap-y-1 md:grid-cols-2">
                  {Object.entries(m).filter(([k]) => k !== "model_name").map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <span className="text-muted-foreground">{k.replace(/_/g, " ")}: </span>
                      <span className="break-words">{fmtVal(v)}</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
        </CardContent>
      </Card>

      <p className="text-[10px] text-muted-foreground">
        Downloaded artifacts are byte-identical to the versioned repository files (data/reports/ + docs/reports/).
        No secrets or API keys are embedded in this page or the report. Nothing here places orders or promotes a model.
      </p>
    </div>
  );
}
