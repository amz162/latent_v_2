"use client";
/**
 * Task 85 — Model Registry + Strategy Results Dashboard.
 * Fetches from /api/models/registry + /api/backtest/task81-results.
 * Displays the 58-model registry with verified statuses + Task 81 cost-aware strategy results.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

const STATUS_COLORS: Record<string, string> = {
  trained: "bg-green-100 text-green-800",
  ensemble: "bg-blue-100 text-blue-800",
  rule_based: "bg-purple-100 text-purple-800",
  previously: "bg-cyan-100 text-cyan-800",
  duplicate: "bg-gray-100 text-gray-600",
  failed: "bg-red-100 text-red-800",
  blocked: "bg-orange-100 text-orange-800",
  not_evaluated: "bg-gray-100 text-gray-500",
};

function statusBadge(status: string) {
  const lower = (status || "").toLowerCase();
  const color = Object.entries(STATUS_COLORS).find(([k]) => lower.includes(k))?.[1] || "bg-gray-100 text-gray-500";
  return <Badge className={color + " text-xs"}>{status}</Badge>;
}

export function ModelRegistryDashboard() {
  const [registry, setRegistry] = useState<any>(null);
  const [t81, setT81] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [taxProfile, setTaxProfile] = useState("ATL_15");
  const [riskVariant, setRiskVariant] = useState("baseline");
  const [strategy, setStrategy] = useState("fixed_first_hit");
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [walkForward, setWalkForward] = useState<any>(null);
  const [prospective, setProspective] = useState<any>(null);
  const [wfUniverse, setWfUniverse] = useState("pilot25");
  const [perStock, setPerStock] = useState<any>(null);
  const [stockFilter, setStockFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const [r1, r2, r3, r4, r5] = await Promise.all([
          fetch("/api/models/registry").then((r) => r.json()),
          fetch("/api/backtest/task81-results").then((r) => r.json()),
          fetch("/api/backtest/walk-forward").then((r) => r.json()),
          fetch("/api/backtest/walk-forward/prospective").then((r) => r.json()),
          fetch("/api/backtest/per-stock-walk-forward").then((r) => r.json()),
        ]);
        setRegistry(r1);
        setT81(r2);
        setWalkForward(r3);
        setProspective(r4);
        setPerStock(r5);
      } catch (e: any) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="p-4 text-sm text-muted-foreground">Loading model registry...</div>;
  if (error) return <Alert variant="destructive"><AlertDescription>Failed to load: {error}</AlertDescription></Alert>;

  const canonical = registry?.canonical || [];
  const supplemental = registry?.supplemental || [];
  const allModels = [...canonical, ...supplemental];

  const families = [...new Set(canonical.map((m: any) => m.tierLabel || m.category || "Other"))];
  const filtered = allModels.filter((m: any) => {
    if (familyFilter !== "all" && !(m.tierLabel || "").includes(familyFilter) && !(m.category || "").includes(familyFilter)) return false;
    if (statusFilter !== "all" && !(m.verifiedStatus || "").toLowerCase().includes(statusFilter)) return false;
    return true;
  });

  const evaluated = canonical.filter((m: any) => (m.verifiedStatus || "").includes("evaluated")).length;
  const failed = canonical.filter((m: any) => (m.verifiedStatus || "").includes("failed")).length;
  const blocked = canonical.filter((m: any) => (m.verifiedStatus || "").includes("blocked")).length;
  const aliases = canonical.filter((m: any) => (m.verifiedStatus || "").includes("alias")).length;

  // Task 81 results
  const t81Overall = (t81?.overall || []).filter((o: any) => o.taxProfile === taxProfile && o.variant === riskVariant && o.strategy === strategy);
  const t81PerCell = (t81?.perCell || []).filter((c: any) => c.taxProfile === taxProfile && c.variant === riskVariant && c.strategy === strategy);

  return (
    <div className="space-y-6">
      {/* ─── Model Registry ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI Model Registry — Verified Status</CardTitle>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{registry?.canonicalCount || 0} canonical</Badge>
            <Badge variant="outline">{registry?.supplementalCount || 0} supplemental</Badge>
            <Badge className="bg-green-100 text-green-800">{evaluated} evaluated</Badge>
            <Badge className="bg-red-100 text-red-800">{failed} failed</Badge>
            <Badge className="bg-orange-100 text-orange-800">{blocked} blocked</Badge>
            <Badge className="bg-gray-100 text-gray-600">{aliases} aliases</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Select value={familyFilter} onValueChange={setFamilyFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Family" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Families</SelectItem>
                {families.map((f: string) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="evaluated">Evaluated</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="alias">Aliases</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="text-left border-b">
                  <th className="p-2">Model</th><th className="p-2">Family</th><th className="p-2">Status</th>
                  <th className="p-2 text-right">Dir.Acc</th><th className="p-2 text-right">MAE</th>
                  <th className="p-2 text-right">AUC</th><th className="p-2 text-right">N</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: any) => (
                  <tr key={m.name} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedModel(m)}>
                    <td className="p-2 font-medium">{m.name}{m.supplemental && <span className="text-muted-foreground ml-1">(supp)</span>}</td>
                    <td className="p-2 text-muted-foreground">{m.tierLabel || m.category || "—"}</td>
                    <td className="p-2">{statusBadge(m.verifiedStatus)}</td>
                    <td className="p-2 text-right">{m.dirAcc5d != null ? m.dirAcc5d.toFixed(4) : "—"}</td>
                    <td className="p-2 text-right">{m.mae5d != null ? m.mae5d.toFixed(6) : "—"}</td>
                    <td className="p-2 text-right">{m.rocAuc != null ? m.rocAuc.toFixed(4) : "—"}</td>
                    <td className="p-2 text-right">{m.n5d ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Status verified from Task 84 unified metrics. The UI&apos;s static &quot;trained&quot; flag is NOT used as proof — backend artifacts + OOS evaluation determine status.
          </p>
        </CardContent>
      </Card>

      {/* ─── Task 81 Cost-Aware Strategy Results ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Strategy Results — PSX V2 Costs</CardTitle>
          <p className="text-xs text-muted-foreground">540 cells: 5 models × 3 horizons × 2 periods × 3 risk variants × 3 strategies × 2 tax profiles</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Select value={taxProfile} onValueChange={setTaxProfile}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ATL_15">ATL Filer (15%)</SelectItem>
                <SelectItem value="NON_ATL_30">Non-ATL (30%)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskVariant} onValueChange={setRiskVariant}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baseline">Baseline (1.5 ATR)</SelectItem>
                <SelectItem value="variant_a">Variant A (TP1 1:1)</SelectItem>
                <SelectItem value="variant_b">Variant B (min net 1:2)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={strategy} onValueChange={setStrategy}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed_first_hit">Fixed First Hit</SelectItem>
                <SelectItem value="max_tp_step_trailing">Step Trailing</SelectItem>
                <SelectItem value="scale_out_50_25_25">Scale Out 50/25/25</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Overall summary */}
          {t81Overall.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {t81Overall.map((o: any) => (
                <div key={o.period} className="border rounded p-3">
                  <div className="text-xs text-muted-foreground">{o.period}</div>
                  <div className="text-lg font-bold">{o.nCompleted} trades</div>
                  <div className="text-xs">Win: {o.winRate}%</div>
                  <div className={"text-sm font-semibold " + (o.netPnl >= 0 ? "text-green-600" : "text-red-600")}>
                    Net: {o.netPnl >= 0 ? "+" : ""}{o.netPnl?.toLocaleString()}
                  </div>
                  <div className="text-xs text-muted-foreground">PF_gross: {o.profitFactor_gross} | PF_net: {o.profitFactor_net}</div>
                  <div className="text-xs text-muted-foreground">Slippage: 0 | Skipped: {o.nSkipped}</div>
                </div>
              ))}
            </div>
          )}

          {/* Per-cell table */}
          <div className="overflow-x-auto max-h-64">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="text-left border-b">
                  <th className="p-2">Model</th><th className="p-2">H</th><th className="p-2">Period</th>
                  <th className="p-2 text-right">N</th><th className="p-2 text-right">Win%</th>
                  <th className="p-2 text-right">Net P&L</th><th className="p-2 text-right">PF_net</th>
                </tr>
              </thead>
              <tbody>
                {t81PerCell.map((c: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="p-2">{c.model}</td>
                    <td className="p-2">{c.horizon}d</td>
                    <td className="p-2">{c.period}</td>
                    <td className="p-2 text-right">{c.nCompleted}</td>
                    <td className="p-2 text-right">{c.winRate ?? "—"}</td>
                    <td className={"p-2 text-right " + ((c.netPnl ?? 0) >= 0 ? "text-green-600" : "text-red-600")}>
                      {(c.netPnl ?? 0).toLocaleString()}
                    </td>
                    <td className="p-2 text-right">{c.profitFactor_net ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Alert className="mt-3">
            <AlertDescription className="text-xs">
              Retrospective exploratory comparison. Exit policies + ATR overlay introduced after historical results were inspected.
              Costs use <strong>psx_user_schedule_v2</strong> (zero slippage, per-side brokerage, ancillary fees, position-level CGT).
              Do NOT claim significance or profitability.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* ─── Model Detail View ─── */}
      {selectedModel && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{selectedModel.name} — Detail</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setSelectedModel(null)}>Close</Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div><span className="text-muted-foreground">Family:</span> {selectedModel.tierLabel || selectedModel.category || "—"}</div>
              <div><span className="text-muted-foreground">Status:</span> {statusBadge(selectedModel.verifiedStatus)}</div>
              <div><span className="text-muted-foreground">UI trained flag:</span> {String(selectedModel.uiTrainedFlag)} (NOT used as proof)</div>
              <div><span className="text-muted-foreground">Alias parent:</span> {selectedModel.aliasParent || "—"}</div>
              <div><span className="text-muted-foreground">Dir Acc (5d):</span> {selectedModel.dirAcc5d != null ? selectedModel.dirAcc5d.toFixed(4) : "Not available"}</div>
              <div><span className="text-muted-foreground">MAE (5d):</span> {selectedModel.mae5d != null ? selectedModel.mae5d.toFixed(6) : "Not available"}</div>
              <div><span className="text-muted-foreground">RMSE (5d):</span> {selectedModel.rmse5d != null ? selectedModel.rmse5d.toFixed(6) : "Not available"}</div>
              <div><span className="text-muted-foreground">R² (5d):</span> {selectedModel.r2_5d != null ? selectedModel.r2_5d.toFixed(4) : "Not available"}</div>
              <div><span className="text-muted-foreground">AUC:</span> {selectedModel.rocAuc != null ? selectedModel.rocAuc.toFixed(4) : "Not available"}</div>
              <div><span className="text-muted-foreground">Test samples (5d):</span> {selectedModel.n5d ?? "Not available"}</div>
              <div><span className="text-muted-foreground">Training duration:</span> {selectedModel.elapsed ? `${selectedModel.elapsed}s` : "Not available"}</div>
              <div><span className="text-muted-foreground">Blocker reason:</span> {selectedModel.blockerReason || "—"}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Status verified from Task 84 unified metrics. Metrics shown only where genuinely available.
              The static UI &quot;trained&quot; flag is displayed for transparency but is NOT used as proof of training.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Walk-Forward Report ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Walk-Forward Report</CardTitle>
        </CardHeader>
        <CardContent>
          {walkForward?.available ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
                <div><span className="text-muted-foreground">Universe:</span> {typeof walkForward.universe === "string" ? walkForward.universe : (walkForward.universe?.mode || walkForward.universeMode || "—")}</div>
                <div><span className="text-muted-foreground">Samples:</span> {walkForward.n_samples ?? walkForward.totalSamples ?? "—"}</div>
                <div><span className="text-muted-foreground">Models:</span> {walkForward.models?.length ?? walkForward.modelCount ?? "—"}</div>
                <div><span className="text-muted-foreground">Horizons:</span> {(walkForward.horizons || [5,10,21]).join(", ")}</div>
              </div>
              {walkForward.perModel && (
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="text-left border-b">
                        <th className="p-2">Model</th><th className="p-2 text-right">MAE</th><th className="p-2 text-right">RMSE</th>
                        <th className="p-2 text-right">R²</th><th className="p-2 text-right">Dir.Acc</th><th className="p-2 text-right">N</th>
                      </tr>
                    </thead>
                    <tbody>
                      {walkForward.perModel.map((m: any, i: number) => (
                        <tr key={i} className="border-b hover:bg-muted/50">
                          <td className="p-2">{m.model || m.name}</td>
                          <td className="p-2 text-right">{m.mae?.toFixed(6) ?? "—"}</td>
                          <td className="p-2 text-right">{m.rmse?.toFixed(6) ?? "—"}</td>
                          <td className="p-2 text-right">{m.r2 != null ? m.r2.toFixed(4) : "—"}</td>
                          <td className="p-2 text-right">{m.directional_accuracy != null ? m.directional_accuracy.toFixed(4) : "—"}</td>
                          <td className="p-2 text-right">{m.n ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Historical walk-forward OOS evaluation. Retrospective — NOT live predictions.
                Negative R² values are preserved (not hidden). Missing results shown as &quot;—&quot;.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{walkForward?.error || "Walk-forward report not available. Run: bun scripts/walk_forward_backtesting.py"}</p>
          )}
        </CardContent>
      </Card>

      {/* ─── Per-Stock Walk-Forward Matrix ─── */}
      {perStock?.available && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Per-Stock Walk-Forward Matrix</CardTitle>
            <p className="text-xs text-muted-foreground">{perStock.count || 0} cells — per-symbol per-model OOS metrics</p>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Symbol" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Symbols</SelectItem>
                  {[...new Set((perStock.cells || []).map((c: any) => c.symbol))].map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-left border-b">
                    <th className="p-2">Symbol</th><th className="p-2">Model</th><th className="p-2">H</th>
                    <th className="p-2 text-right">N</th><th className="p-2 text-right">MAE</th>
                    <th className="p-2 text-right">R²</th><th className="p-2 text-right">Dir.Acc</th>
                  </tr>
                </thead>
                <tbody>
                  {(perStock.cells || []).filter((c: any) => stockFilter === "all" || c.symbol === stockFilter).map((c: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{c.symbol}</td>
                      <td className="p-2">{c.model}</td>
                      <td className="p-2">{c.horizon}d</td>
                      <td className="p-2 text-right">{c.n}</td>
                      <td className="p-2 text-right">{c.mae?.toFixed(6) ?? "—"}</td>
                      <td className="p-2 text-right">{c.r2 != null ? c.r2.toFixed(4) : "—"}</td>
                      <td className="p-2 text-right">{c.dir_acc?.toFixed(4) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Per-symbol OOS evaluation from the 400 walk-forward samples. Negative R² preserved. Cells with insufficient data (&lt;3 samples) excluded.</p>
          </CardContent>
        </Card>
      )}

      {/* ─── Prospective Paper-Trade Status ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prospective Paper-Trade Status</CardTitle>
        </CardHeader>
        <CardContent>
          {prospective?.available ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
                <div><span className="text-muted-foreground">Status:</span> <Badge className={prospective.status === "ACTIVE" ? "bg-green-100 text-green-800" : prospective.status === "READY" ? "bg-cyan-100 text-cyan-800" : "bg-orange-100 text-orange-800"}>{prospective.status}</Badge></div>
                <div><span className="text-muted-foreground">Latest OHLCV:</span> {prospective.latest_ohlcv_session || "—"}</div>
                <div><span className="text-muted-foreground">Predictions:</span> {prospective.counts?.predictionsTotal ?? "—"}</div>
                <div><span className="text-muted-foreground">Trades:</span> {prospective.counts?.tradesTotal ?? "—"}</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
                <div><span className="text-muted-foreground">Pending entry:</span> {prospective.counts?.tradesByState?.pending_entry ?? "—"}</div>
                <div><span className="text-muted-foreground">Open:</span> {prospective.counts?.tradesByState?.open ?? "—"}</div>
                <div><span className="text-muted-foreground">Closed:</span> {prospective.counts?.tradesByState?.closed ?? "—"}</div>
                <div><span className="text-muted-foreground">Skipped:</span> {prospective.counts?.tradesByState?.skipped ?? "—"}</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><span className="text-muted-foreground">Outcomes pending:</span> {prospective.counts?.outcomesByStatus?.pending ?? "—"}</div>
                <div><span className="text-muted-foreground">Matured:</span> {prospective.counts?.outcomesByStatus?.matured ?? "—"}</div>
                <div><span className="text-muted-foreground">Risk levels:</span> {prospective.counts?.buyPredictionsWithRiskLevels ?? "—"}</div>
                <div><span className="text-muted-foreground">Legs:</span> {prospective.counts?.legsTotal ?? "—"}</div>
              </div>
              <Alert className="mt-3">
                <AlertDescription className="text-xs">
                  {prospective.status === "READY"
                    ? "Valid setup — no positions are currently open. All trades are pending entry (waiting for the next trading session after the data cutoff). This is NOT a defect."
                    : prospective.status === "ACTIVE"
                    ? "The ledger is running and managing eligible positions. ACTIVE is an operational status, NOT proof of skill or profitability."
                    : "Status reflects actual persisted records. No fabricated entries or outcomes."}
                  Do NOT interpret pending positions as filled or matured outcomes as proof of profitability.
                </AlertDescription>
              </Alert>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">{prospective?.error || "Prospective data not available. Run: bun scripts/prospective_paper_trading.ts"}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
