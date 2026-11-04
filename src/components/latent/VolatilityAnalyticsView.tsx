"use client";

// Task 110 — Window 2: "Volatility & Convexity Analytics" research dashboard.
// Distinct from the Golden Cross window. Realized-volatility only
// (close-to-close / Parkinson / Garman-Klass, annualized exactly once), BBW
// with first/second discrete derivatives, and a descriptive regime watch.
// The provider supplies NO implied-volatility or options data, so nothing here
// is an option signal; no options execution exists anywhere behind this API.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Task111SignalPanel } from "./Task111SignalPanel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Task110Chart } from "./Task110Chart";

const UNIVERSE = ["ANL", "BOP", "CNERGY", "FCCL", "HASCOL", "HUBC", "HUMNL", "KEL", "LOTCHEM", "LUCK", "MEBL", "MLCF", "OGDC", "PAEL", "PIBTL", "PPL", "PRL", "PSO", "SYS", "TELE", "TRG", "UNITY", "WTL"];

interface VolPoint {
  date: string;
  close: number;
  ccVarAnn: number | null;
  parkVarAnn: number | null;
  gkVarAnn: number | null;
  ccVolPct: number | null;
  parkVolPct: number | null;
  gkVolPct: number | null;
  bbw: number | null;
  bbwD1: number | null;
  bbwD2: number | null;
  ccVarAnnD1: number | null;
  ccVarAnnD2: number | null;
  parkVarAnnD1: number | null;
  parkVarAnnD2: number | null;
  gkVarAnnD1: number | null;
  gkVarAnnD2: number | null;
}

interface VolResponse {
  symbol: string;
  status: string;
  notice: string;
  config: { varWindow: number; bbwWindow: number; bollingerK: number; annualization: number; stdConvention: string; priceBasis: string };
  dataCutoff: string;
  dataUpdatedAt: string | null;
  dataFreshness: { marketDataDate: string; retrievedAt: string; provider: string } | null;
  gkNegatives: number;
  gkNegativePolicy: string;
  regime: { regime: string; reason: string };
  estimatorNotes: Record<string, string>;
  latest: VolPoint;
  series: VolPoint[];
  error?: string;
  detail?: string;
}

const REGIME_LABEL: Record<string, string> = {
  long_vol_watch: "LONG VOL WATCH",
  volatility_expansion: "VOLATILITY EXPANSION",
  volatility_compression: "VOL COMPRESSION WATCH",
  short_vol_watch: "SHORT VOL WATCH (never assigned from realized data)",
  mean_reversion_watch: "MEAN REVERSION WATCH",
  transition: "TRANSITION",
  wait: "WAIT",
  insufficient_data: "INSUFFICIENT DATA",
};

export function VolatilityAnalyticsView() {
  const [symbol, setSymbol] = useState("HUBC");
  const [varWindow, setVarWindow] = useState(10);
  const [bbwWindow, setBbwWindow] = useState(20);
  const [data, setData] = useState<VolResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/volatility?symbol=${symbol}&varWindow=${varWindow}&bbwWindow=${bbwWindow}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || `HTTP ${r.status}`);
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, varWindow, bbwWindow]);

  useEffect(() => {
    void load();
  }, [load]);

  const s = data?.series;
  const dates = useMemo(() => (s ? s.map((p) => p.date) : []), [s]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Task111SignalPanel symbol={symbol} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Volatility &amp; Convexity Analytics</h1>
          <p className="text-xs text-muted-foreground">
            Realized volatility (close-to-close · Parkinson · Garman-Klass), Bollinger Band Width with discrete derivatives, and volatility-regime research watches — real PSX daily OHLC only
          </p>
        </div>
        <Badge variant="outline" className="border-sky-500/60 bg-sky-500/10 text-sky-700 dark:text-sky-400">
          RESEARCH WATCH ONLY — realized vol ≠ implied vol; never an option signal
        </Badge>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <label className="text-xs">
            <div className="mb-1 text-muted-foreground">Symbol</div>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {UNIVERSE.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted-foreground">Variance window (sessions)</div>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={varWindow} onChange={(e) => setVarWindow(Number(e.target.value))}>
              {[5, 10, 20, 30].map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <div className="mb-1 text-muted-foreground">BBW window / k</div>
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={bbwWindow} onChange={(e) => setBbwWindow(Number(e.target.value))}>
              {[10, 20, 30].map((w) => (
                <option key={w} value={w}>
                  {w} / 2.0
                </option>
              ))}
            </select>
          </label>
          <button className="h-9 rounded-md border px-3 text-sm hover:bg-accent" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Run"}
          </button>
          {data && (
            <span className="text-xs text-muted-foreground">
              market data date {data.dataCutoff} · retrieved {data.dataUpdatedAt ? new Date(data.dataUpdatedAt).toISOString().slice(0, 16) + "Z" : "—"} · status <b>{data.status}</b>
            </span>
          )}
        </CardContent>
      </Card>

      {err && (
        <Card>
          <CardContent className="py-4 text-sm text-red-600">Failed to load: {err}</CardContent>
        </Card>
      )}

      {data && s && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <Card className="col-span-2 md:col-span-2">
              <CardContent className="py-4">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Latest regime (descriptive research watch)</div>
                <div className="mt-1 text-base font-bold">{REGIME_LABEL[data.regime.regime] || data.regime.regime}</div>
                <div className="mt-1 text-xs text-muted-foreground">{data.regime.reason}</div>
              </CardContent>
            </Card>
            <KV label="Close-to-close var (ann)" value={fx(data.latest.ccVarAnn)} sub={pct(data.latest.ccVolPct)} />
            <KV label="Parkinson var (ann)" value={fx(data.latest.parkVarAnn)} sub={pct(data.latest.parkVolPct)} />
            <KV label="Garman-Klass var (ann)" value={fx(data.latest.gkVarAnn)} sub={pct(data.latest.gkVolPct)} />
            <KV label="BBW (d1 / d2)" value={fx(data.latest.bbw)} sub={`${fx(data.latest.bbwD1)} / ${fx(data.latest.bbwD2)}`} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Annualized volatility % — all three estimators (each annualized exactly once: √(252 × daily variance))</CardTitle>
            </CardHeader>
            <CardContent>
              <Task110Chart
                dates={dates}
                series={[
                  { label: "Close-to-close", color: "#2563eb", points: s.map((p) => p.ccVolPct) },
                  { label: "Parkinson", color: "#f59e0b", points: s.map((p) => p.parkVolPct) },
                  { label: "Garman-Klass", color: "#dc2626", points: s.map((p) => p.gkVolPct) },
                ]}
                yLabel="annualized vol %"
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Bollinger Band Width ({data.config.bbwWindow}-session, k={data.config.bollingerK})</CardTitle>
              </CardHeader>
              <CardContent>
                <Task110Chart dates={dates} series={[{ label: "BBW", color: "#7c3aed", points: s.map((p) => p.bbw) }]} yLabel="BBW" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">BBW first &amp; second discrete derivatives</CardTitle>
              </CardHeader>
              <CardContent>
                <Task110Chart
                  dates={dates}
                  series={[
                    { label: "BBW d1", color: "#0d9488", points: s.map((p) => p.bbwD1) },
                    { label: "BBW d2", color: "#9333ea", points: s.map((p) => p.bbwD2), dash: true },
                  ]}
                  yLabel="BBW derivatives"
                />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Discrete first/second differences per session (never computed across a missing-session gap). Not literal continuous-time derivatives.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Annualized variance — first difference (CC / Parkinson / GK)</CardTitle>
              </CardHeader>
              <CardContent>
                <Task110Chart
                  dates={dates}
                  series={[
                    { label: "CC var d1", color: "#2563eb", points: s.map((p) => p.ccVarAnnD1) },
                    { label: "Park var d1", color: "#f59e0b", points: s.map((p) => p.parkVarAnnD1) },
                    { label: "GK var d1", color: "#dc2626", points: s.map((p) => p.gkVarAnnD1) },
                  ]}
                  yLabel="variance d1"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Annualized variance — second difference (CC / Parkinson / GK)</CardTitle>
              </CardHeader>
              <CardContent>
                <Task110Chart
                  dates={dates}
                  series={[
                    { label: "CC var d2", color: "#2563eb", points: s.map((p) => p.ccVarAnnD2) },
                    { label: "Park var d2", color: "#f59e0b", points: s.map((p) => p.parkVarAnnD2) },
                    { label: "GK var d2", color: "#dc2626", points: s.map((p) => p.gkVarAnnD2) },
                  ]}
                  yLabel="variance d2"
                />
              </CardContent>
            </Card>
            <Card className="xl:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Close price with Bollinger envelope basis ({symbol})</CardTitle>
              </CardHeader>
              <CardContent>
                <Task110Chart dates={dates} series={[{ label: "Close", color: "#2563eb", points: s.map((p) => p.close) }]} yLabel="price" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Method, limitations and evidence status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                <b>Annualization:</b> every estimator is annualized exactly once (×{data.config.annualization}); volatility = √(annualized variance), reported in %. {data.config.stdConvention}; {data.config.priceBasis}.
              </p>
              <p><b>GK negatives:</b> {data.gkNegatives} negative Garman-Klass rolling estimates in the loaded history — kept unclipped and counted ({data.gkNegativePolicy}).</p>
              <p><b>Estimator assumptions:</b> {Object.values(data.estimatorNotes).join(" · ")}.</p>
              <p><b>Implied vs realized:</b> this screen shows REALIZED volatility only. The provider supplies no options/implied-volatility data; long-convexity and short-volatility outputs are descriptive watches and never executable signals (blocked_options_data).</p>
              <p><b>Limitations:</b> delayed daily bars; raw unadjusted prices (corporate actions can contaminate log returns); Parkinson/GK assume continuous sampling and driftless dynamics; sessions are provider-observed dates, not an official exchange calendar.</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function KV({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function fx(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return Math.abs(x) >= 1000 ? x.toLocaleString(undefined, { maximumFractionDigits: 1 }) : x.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function pct(x: number | null | undefined): string {
  return x == null ? "" : `${x.toFixed(2)}% vol`;
}
