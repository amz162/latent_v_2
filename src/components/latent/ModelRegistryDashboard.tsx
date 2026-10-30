"use client";
/**
 * Task 85 — Model Registry + Strategy Results Dashboard.
 * Fetches from /api/models/registry + /api/backtest/task81-results.
 * Displays the 58-model registry with verified statuses + Task 81 cost-aware strategy results.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  useEffect(() => {
    (async () => {
      try {
        const [r1, r2] = await Promise.all([
          fetch("/api/models/registry").then((r) => r.json()),
          fetch("/api/backtest/task81-results").then((r) => r.json()),
        ]);
        setRegistry(r1);
        setT81(r2);
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
                  <tr key={m.name} className="border-b hover:bg-muted/50">
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
    </div>
  );
}
