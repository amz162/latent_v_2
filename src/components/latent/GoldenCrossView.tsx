"use client";

// Task 110 — Window 1: "Golden Cross — 7/30 SMA" research dashboard.
// RESEARCH / BACKTEST ONLY: every number comes from /api/golden-cross, which
// simulates the strategy over the real OhlcvBar history with the production
// V2 cost engine. Nothing here is tradable advice and no order path exists.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Task110Chart, type Marker } from "./Task110Chart";

const UNIVERSE = ["ANL", "BOP", "CNERGY", "FCCL", "HASCOL", "HUBC", "HUMNL", "KEL", "LOTCHEM", "LUCK", "MEBL", "MLCF", "OGDC", "PAEL", "PIBTL", "PPL", "PRL", "PSO", "SYS", "TELE", "TRG", "UNITY", "WTL"];

interface GcResponse {
  symbol: string;
  status: string;
  notice: string;
  dataCutoff: string;
  dataUpdatedAt: string | null;
  current: { date: string; close: number | null; ma7: number | null; ma30: number | null; relationship: number | null; lastSignal: { signal: string; date: string } | null; state: string };
  series: Array<{ date: string; close: number | null; ma7: number | null; ma30: number | null; signal: string | null }>;
  markers: Array<{ date: string; signal: string; price: number | null }> | null;
  portfolio: {
    config: { initialCapital: number; sizingPct: number; maxPositions: number; taxProfile: string; start: string; end: string; sessions: number };
    account: Record<string, number | string | null>;
    openPositions: Array<{ symbol: string; shares: number; entryDate: string; entryPrice: number; lastClose: number | null; marketValue: number; unrealizedPnl: number }>;
    unfilledRecent: Array<{ date: string; symbol: string; reason: string }>;
  };
  equityCurve: Array<{ date: string; equity: number; drawdown: number }>;
  dailyLedger: Array<Record<string, string | number>>;
  dailyLedgerTotalRows: number;
  tradeLedger: Array<Record<string, string | number>>;
  tradeLedgerTotalRows: number;
  error?: string;
  detail?: string;
}

export function GoldenCrossView() {
  const [symbol, setSymbol] = useState("HUBC");
  const [capital, setCapital] = useState(100000);
  const [sizing, setSizing] = useState(20);
  const [data, setData] = useState<GcResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/golden-cross?symbol=${symbol}&capital=${capital}&sizing=${sizing}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || `HTTP ${r.status}`);
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, capital, sizing]);

  useEffect(() => {
    void load();
  }, [load]);

  const chart = useMemo(() => {
    if (!data) return null;
    const dates = data.series.map((s) => s.date);
    const markers: Marker[] = (data.markers || [])
      .map((m) => {
        const i = dates.indexOf(m.date);
        return i >= 0 && m.price != null ? { x: i, price: m.price, kind: m.signal === "GOLDEN" ? ("BUY" as const) : ("SELL" as const) } : null;
      })
      .filter(Boolean) as Marker[];
    return { dates, markers };
  }, [data]);

  const a = data?.portfolio.account;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Golden Cross — 7/30 SMA</h1>
          <p className="text-xs text-muted-foreground">
            7/30 SMA crossover research system over real PSX daily history · raw unadjusted prices · V2 hypothetical costs · signal fills at next-session open
          </p>
        </div>
        <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400">
          RESEARCH / BACKTEST ONLY — not tradable advice
        </Badge>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <label className="text-xs">
            <div className="mb-1 text-muted-foreground">Symbol</div>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {UNIVERSE.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted-foreground">Initial capital (PKR)</div>
            <Input className="h-9 w-36" type="number" min={1000} step={1000} value={capital} onChange={(e) => setCapital(Number(e.target.value) || 100000)} />
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted-foreground">Sizing (% equity/trade)</div>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={sizing} onChange={(e) => setSizing(Number(e.target.value))}>
              {[5, 10, 20, 25].map((p) => (
                <option key={p} value={p}>
                  {p}%
                </option>
              ))}
            </select>
          </label>
          <button className="h-9 rounded-md border px-3 text-sm hover:bg-accent" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Run"}
          </button>
          {data && (
            <span className="text-xs text-muted-foreground">
              data cutoff {data.dataCutoff} · research status <b>{data.status}</b>
            </span>
          )}
        </CardContent>
      </Card>

      {err && (
        <Card>
          <CardContent className="py-4 text-sm text-red-600">Failed to load: {err}</CardContent>
        </Card>
      )}

      {data && chart && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Stat label="Close" value={fmt(data.current.close)} />
            <Stat label="MA7" value={fmt(data.current.ma7)} />
            <Stat label="MA30" value={fmt(data.current.ma30)} />
            <Stat label="State" value={data.current.state.toUpperCase()} />
            <Stat label="Last signal" value={data.current.lastSignal ? `${data.current.lastSignal.signal} @ ${data.current.lastSignal.date}` : "—"} />
            <Stat label="Drawdown" value={fmt(a?.maxDrawdown as number)} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Price with MA7/MA30 and cross markers ({symbol})</CardTitle>
            </CardHeader>
            <CardContent>
              <Task110Chart
                dates={chart.dates}
                series={[
                  { label: "Close", color: "#2563eb", points: data.series.map((s) => s.close) },
                  { label: "MA7", color: "#f59e0b", points: data.series.map((s) => s.ma7) },
                  { label: "MA30", color: "#7c3aed", points: data.series.map((s) => s.ma30) },
                ]}
                markers={chart.markers}
                yLabel="price"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Portfolio equity (PKR {data.portfolio.config.initialCapital.toLocaleString()} start, {data.portfolio.config.sizingPct * 100}% sizing, max {data.portfolio.config.maxPositions} positions, {data.portfolio.config.taxProfile})</CardTitle>
            </CardHeader>
            <CardContent>
              <Task110Chart
                dates={data.equityCurve.map((e) => e.date)}
                series={[{ label: "Equity", color: "#059669", points: data.equityCurve.map((e) => e.equity) }]}
                yLabel="equity"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Performance summary (net of V2 costs; MTM never realized)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:grid-cols-6">
                <Stat label="Final equity" value={fmt(a?.finalEquity as number)} />
                <Stat label="ROI" value={`${fmt(a?.roiPct as number)}%`} />
                <Stat label="Realized net P&L" value={fmt(a?.realizedNetPnl as number)} />
                <Stat label="Unrealized P&L" value={fmt(a?.unrealizedPnl as number)} />
                <Stat label="Trades" value={String(a?.trades ?? "—")} />
                <Stat label="Win rate" value={a?.winRatePct != null ? `${a.winRatePct}%` : "—"} />
                <Stat label="Profit factor" value={String(a?.profitFactor ?? "—")} />
                <Stat label="Expectancy/trade" value={fmt(a?.expectancyPerTrade as number)} />
                <Stat label="Total costs" value={fmt(a?.totalCosts as number)} />
                <Stat label="Cash" value={fmt(a?.finalCash as number)} />
                <Stat label="Sessions" value={String(data.portfolio.config.sessions)} />
                <Stat label="Loss streak max" value={String(a?.longestLossStreak ?? "—")} />
              </div>
              {Number(a?.roiPct) < 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  The evidence for this configuration is NEGATIVE net of costs. Per policy it stays research_only and is not promoted.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Daily account ledger (last {data.dailyLedger.length} of {data.dailyLedgerTotalRows} sessions — every session has a row)</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-auto">
              <Table
                cols={["Date", "Signal", "Action", "Pos", "Cash", "Invested", "Realized", "Unreal", "Costs", "Equity", "DD"]}
                rows={data.dailyLedger.map((r) => [
                  String(r.date),
                  String(r.signal || "—"),
                  String(r.action || "—"),
                  String(r.positionAfter),
                  fmt(Number(r.cashBalance)),
                  fmt(Number(r.investedCapital)),
                  fmt(Number(r.realizedPnlCum)),
                  fmt(Number(r.unrealizedPnl)),
                  fmt(Number(r.costsToday)),
                  fmt(Number(r.portfolioEquity)),
                  fmt(Number(r.currentDrawdown)),
                ])}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Trade ledger (last {data.tradeLedger.length} of {data.tradeLedgerTotalRows} completed trades)</CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-auto">
              <Table
                cols={["Signal date", "Exec date", "Symbol", "Entry", "Exit", "Shares", "Gross", "Costs", "Net", "Ret %", "Sessions", "W/L"]}
                rows={data.tradeLedger.map((r) => [
                  String(r.signalDate),
                  String(r.executionDate),
                  String(r.symbol),
                  fmt(Number(r.entryPrice)),
                  fmt(Number(r.exitPrice)),
                  String(r.shares),
                  fmt(Number(r.grossPnl)),
                  fmt(Number(r.totalCosts)),
                  fmt(Number(r.netPnl)),
                  fmt(Number(r.returnPct)),
                  String(r.holdingSessions),
                  String(r.winLoss),
                ])}
              />
            </CardContent>
          </Card>

          {data.portfolio.openPositions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Open positions (unrealized — never counted as realized)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table
                  cols={["Symbol", "Shares", "Entry date", "Entry", "Last close", "Market value", "Unrealized"]}
                  rows={data.portfolio.openPositions.map((o) => [
                    o.symbol,
                    String(o.shares),
                    o.entryDate,
                    fmt(o.entryPrice),
                    fmt(o.lastClose),
                    fmt(o.marketValue),
                    fmt(o.unrealizedPnl),
                  ])}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function fmt(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Table({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="border-b text-muted-foreground">
          {cols.map((c) => (
            <th key={c} className="px-2 py-1.5 font-medium">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border/50">
            {r.map((c, j) => (
              <td key={j} className="whitespace-nowrap px-2 py-1">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
