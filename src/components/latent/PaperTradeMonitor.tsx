"use client";

// Paper Trade Monitor (Task 107 v2) — every open forward paper position with
// its origin (frozen-protocol shadow decision), entry, SL/TP1-3 levels, the
// latest DELAYED provider snapshot price with BOTH timestamps (estimated
// source market time + real retrieval time), progress toward targets, and
// separate realized vs unrealized P&L. Snapshot semantics throughout: an
// observed crossing is not a fill, and intraperiod paths between snapshots
// are unknowable (observation_resolution_limited).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CapitalProtectionNotice } from "./CapitalProtectionNotice";

interface Position {
  tradeId: string;
  decisionId: string;
  generation: string;
  symbol: string;
  side: string;
  signalSource: string;
  modelVersion: string;
  strategy: string;
  signalTime: string;
  entryDate: string | null;
  entryPrice: number;
  quantity: number;
  remainingQuantity: number;
  sl: number | null;
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  bestTargetReached: number | null;
  latestPrice: number | null;
  marketTimestamp: string | null;
  retrievalTimestamp: string | null;
  providerDelayMinutes: number;
  timestampQuality: string;
  dataInterval: null;
  dataSource: string;
  status: string;
  resolvedLegsPnl: number;
  unrealizedGrossPnl: number | null;
  estimatedExitCosts: number | null;
  estimatedCgt: number | null;
  estimatedUnrealizedNetPnl: number | null;
  totalPositionNetPnlEstimate: number | null;
  sessionsAvailable: number | null;
  sessionsTo21: number | null;
  ambiguousSameBarDates: string[];
  freshness: string;
  resolutionCaveat: string;
}

interface Payload {
  generatedAt: string;
  feed: {
    provider: string;
    mode: string;
    dataType: string;
    providerDelayMinutes: number;
    barIntervalMinutes: null;
    pollIntervalSeconds: number;
    window: { start: string; end: string; tz: string };
    windowStatus: string;
    lastPollCycle: string | null;
    lastPollAt: string | null;
    snapshotStoreTotal: number | null;
  };
  banner: string;
  summary: Record<string, number | string>;
  positions: Position[];
  legacyPaperTrades: { n: number; note: string };
  disclaimers: string[];
  errors: string[];
}

const FILTERS = [
  ["all", "All"],
  ["open", "Open"],
  ["target_touched", "Target touched"],
  ["partially_exited", "Partial exit"],
  ["stop_loss_observed", "Stop-loss"],
  ["ambiguous_same_bar", "Ambiguous"],
  ["pending_data", "Pending data"],
  ["stale_data", "Stale data"],
] as const;

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  target_touched: "Target touched",
  partially_exited: "Partial exit",
  stop_loss_observed: "Stop-loss observed",
  ambiguous_same_bar: "Ambiguous same bar",
  pending_data: "Pending data",
  stale_data: "Stale data",
  time_up: "Time up",
  closed: "Closed",
};

function fmtPkr(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${v < 0 ? "−" : ""}PKR ${Math.abs(v).toLocaleString("en-PK", { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
}
function fmtPrice(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-PK", { maximumFractionDigits: 2 });
}
function pktTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-PK", { timeZone: "Asia/Karachi", hour12: false, month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function statusBadge(status: string) {
  const tone =
    status === "target_touched" ? "default"
    : status === "stop_loss_observed" ? "destructive"
    : status === "ambiguous_same_bar" ? "destructive"
    : status === "partially_exited" ? "secondary"
    : status === "pending_data" ? "outline"
    : "secondary";
  return <Badge variant={tone as "default" | "destructive" | "secondary" | "outline"}>{STATUS_LABEL[status] ?? status}</Badge>;
}

/** SL ← ENTRY → TP1 → TP2 → TP3 progress line. */
function LevelLadder({ p }: { p: Position }) {
  const lo = Math.min(p.sl ?? p.entryPrice, p.entryPrice, p.latestPrice ?? p.entryPrice) * 0.995;
  const hi = Math.max(p.tp3 ?? p.entryPrice, p.entryPrice, p.latestPrice ?? p.entryPrice) * 1.005;
  const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;
  const marks: { v: number; label: string; cls: string }[] = [
    { v: p.sl ?? p.entryPrice, label: "SL", cls: "bg-red-500" },
    { v: p.entryPrice, label: "ENTRY", cls: "bg-blue-500" },
    ...(p.tp1 != null ? [{ v: p.tp1, label: "TP1", cls: "bg-emerald-500" }] : []),
    ...(p.tp2 != null ? [{ v: p.tp2, label: "TP2", cls: "bg-emerald-500" }] : []),
    ...(p.tp3 != null ? [{ v: p.tp3, label: "TP3", cls: "bg-emerald-600" }] : []),
  ];
  return (
    <div className="relative h-8 w-full">
      <div className="absolute top-3 h-1 w-full rounded bg-muted" />
      {marks.map((m) => (
        <div key={m.label} className="absolute top-0 flex flex-col items-center" style={{ left: pct(m.v), transform: "translateX(-50%)" }}>
          <div className={`h-4 w-1 rounded ${m.cls}`} />
          <span className="mt-0.5 text-[9px] leading-none text-muted-foreground">{m.label}</span>
          <span className="text-[9px] leading-none font-medium">{fmtPrice(m.v)}</span>
        </div>
      ))}
      {p.latestPrice != null && (
        <div className="absolute top-1 flex flex-col items-center" style={{ left: pct(p.latestPrice), transform: "translateX(-50%)" }}>
          <div className="h-6 w-2 rounded bg-amber-500 shadow" />
          <span className="mt-3 text-[9px] leading-none font-bold text-amber-600">NOW {fmtPrice(p.latestPrice)}</span>
        </div>
      )}
    </div>
  );
}

export function PaperTradeMonitor() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [symbol, setSymbol] = useState<string>("all");
  const [strategy, setStrategy] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/paper-trading/monitor", { cache: "no-store" });
      if (!r.ok) throw new Error(`API ${r.status}`);
      setData(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000); // poll ≤ provider delay; 60s cache upstream
    return () => clearInterval(t);
  }, [load]);

  const symbols = useMemo(() => Array.from(new Set((data?.positions ?? []).map((p) => p.symbol))).sort(), [data]);
  const strategies = useMemo(() => Array.from(new Set((data?.positions ?? []).map((p) => p.strategy))).sort(), [data]);
  const rows = useMemo(
    () =>
      (data?.positions ?? []).filter(
        (p) =>
          (filter === "all" || p.status === filter || (filter === "stale_data" && p.freshness === "stale_data")) &&
          (symbol === "all" || p.symbol === symbol) &&
          (strategy === "all" || p.strategy === strategy)
      ),
    [data, filter, symbol, strategy]
  );

  const s = data?.summary;
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4">
      <CapitalProtectionNotice />
      <div>
        <h1 className="text-xl font-bold">Paper Trade Monitor</h1>
        <p className="text-sm text-muted-foreground">
          Forward shadow campaign positions (frozen protocol) tracked against delayed market observations. Research only — no real orders.
        </p>
      </div>

      {/* F. Required delay banner — uses actual feed state, never hardcoded examples */}
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
        <p className="font-semibold text-amber-700 dark:text-amber-400">⚠ {data?.banner ?? "Market data is delayed by approximately 15 minutes. The displayed price represents an earlier market timestamp, not the live exchange price."}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Feed window {data?.feed.window.start}–{data?.feed.window.end} PKT · status:{" "}
          <span className="font-medium">{data?.feed.windowStatus ?? "…"}</span> · provider delay ≈ {data?.feed.providerDelayMinutes ?? 15} min (user-observed) ·
          source data type: <span className="font-medium">{data?.feed.dataType ?? "…"}</span> · poll interval {data?.feed.pollIntervalSeconds ?? 120}s ·
          last engine poll {data?.feed.lastPollAt ? pktTime(data.feed.lastPollAt) : "—"} · stored snapshots {data?.feed.snapshotStoreTotal ?? "—"}
        </p>
      </div>

      {/* A. Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {[
          ["Open paper trades", s?.openPaperTrades],
          ["Symbols", s?.uniqueSymbols],
          ["Target touched", s?.targetTouched],
          ["Partial exits", s?.partialExits],
          ["Stop-loss observed", s?.stopLossObserved],
          ["Ambiguous", s?.ambiguous],
          ["Pending data", s?.pendingData],
        ].map(([label, v]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{v ?? "—"}</CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Unrealized MTM (estimate, net of exit costs)</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{fmtPkr(Number(s?.estimatedUnrealizedNetPnlTotalPkr ?? 0), 2)}</CardContent>
          <p className="px-6 pb-3 text-xs text-muted-foreground">Never counted as realized P&L. Realized (separate ledger): {fmtPkr(Number(s?.realizedNetPnlSeparatePkr ?? 0), 2)}</p>
        </Card>
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm">Legacy prospective trades (not the active campaign)</CardTitle></CardHeader>
          <CardContent className="text-xl font-bold">{data?.legacyPaperTrades.n ?? 0}</CardContent>
          <p className="px-6 pb-3 text-xs text-muted-foreground">{data?.legacyPaperTrades.note ?? ""}</p>
        </Card>
      </div>

      {/* G. Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([k, label]) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{label}</Button>
        ))}
        <select className="h-8 rounded-md border bg-background px-2 text-sm" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          <option value="all">All symbols</option>
          {symbols.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select className="h-8 rounded-md border bg-background px-2 text-sm" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
          <option value="all">All strategies</option>
          {strategies.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">{rows.length} shown</span>
      </div>

      {error && <div className="rounded-md border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-700">Monitor API error: {error}</div>}
      {data?.errors?.map((e, i) => (
        <div key={i} className="rounded-md border border-amber-400/40 bg-amber-500/10 p-2 text-xs text-amber-700">{e}</div>
      ))}

      {/* B. Active trade table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1100px] text-xs">
          <thead className="bg-muted/60 text-left">
            <tr>
              {["Stock", "Status", "Strategy", "Signal time", "Entry", "Qty (left)", "Latest", "Market time (est.)", "Received", "SL", "TP1", "TP2", "TP3", "Best TP", "Realized P&L", "Unrealized gross", "Est. net P&L", "Sessions left", ""].map((h) => (
                <th key={h} className="px-2 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.tradeId} className="border-t align-top">
                <td className="px-2 py-2 font-semibold">{p.symbol}<div className="font-normal text-[10px] text-muted-foreground">{p.side}</div></td>
                <td className="px-2 py-2">{statusBadge(p.status)}{p.freshness === "stale_data" && <div className="mt-1"><Badge variant="outline">stale</Badge></div>}</td>
                <td className="px-2 py-2">{p.strategy}<div className="text-[10px] text-muted-foreground">{p.modelVersion}</div></td>
                <td className="px-2 py-2">{p.signalTime}</td>
                <td className="px-2 py-2">{fmtPrice(p.entryPrice)}<div className="text-[10px] text-muted-foreground">{p.entryDate}</div></td>
                <td className="px-2 py-2">{p.quantity} ({p.remainingQuantity})</td>
                <td className="px-2 py-2 font-bold">{fmtPrice(p.latestPrice)}</td>
                <td className="px-2 py-2">{pktTime(p.marketTimestamp)}<div className="text-[10px] text-muted-foreground">{p.timestampQuality}</div></td>
                <td className="px-2 py-2">{pktTime(p.retrievalTimestamp)}<div className="text-[10px] text-muted-foreground">+{p.providerDelayMinutes}m delay</div></td>
                <td className="px-2 py-2 text-red-600">{fmtPrice(p.sl)}</td>
                <td className="px-2 py-2 text-emerald-600">{fmtPrice(p.tp1)}</td>
                <td className="px-2 py-2 text-emerald-600">{fmtPrice(p.tp2)}</td>
                <td className="px-2 py-2 text-emerald-700">{fmtPrice(p.tp3)}</td>
                <td className="px-2 py-2">{p.bestTargetReached ? fmtPrice(p.bestTargetReached) : "—"}</td>
                <td className="px-2 py-2">{fmtPkr(p.resolvedLegsPnl, 2)}</td>
                <td className="px-2 py-2">{fmtPkr(p.unrealizedGrossPnl, 2)}</td>
                <td className={`px-2 py-2 font-semibold ${(p.estimatedUnrealizedNetPnl ?? 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtPkr(p.estimatedUnrealizedNetPnl, 2)}</td>
                <td className="px-2 py-2">{p.sessionsTo21 ?? "—"}</td>
                <td className="px-2 py-2"><Button size="sm" variant="ghost" onClick={() => setOpenId(openId === p.tradeId ? null : p.tradeId)}>{openId === p.tradeId ? "Hide" : "Detail"}</Button></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={19} className="px-3 py-6 text-center text-muted-foreground">No positions match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {openId && (() => {
        const p = data?.positions.find((x) => x.tradeId === openId);
        if (!p) return null;
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{p.symbol} — {p.strategy} · trade detail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <LevelLadder p={p} />
              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="mb-1 font-semibold">Where it came from</p>
                  <p>Signal origin: {p.signalSource}</p>
                  <p>Model: {p.modelVersion}</p>
                  <p>Signal time: {p.signalTime} · horizon: 21 sessions</p>
                  <p>Entry reason: next-session open, {p.quantity} shares @ {fmtPrice(p.entryPrice)} ({p.entryDate})</p>
                  <p>Generation: {p.generation}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="mb-1 font-semibold">Where it is going (research levels — not guarantees)</p>
                  <p>SL {fmtPrice(p.sl)} · TP1 {fmtPrice(p.tp1)} · TP2 {fmtPrice(p.tp2)} · TP3 {fmtPrice(p.tp3)}</p>
                  <p>Latest observed: {fmtPrice(p.latestPrice)} (market est. {pktTime(p.marketTimestamp)}, received {pktTime(p.retrievalTimestamp)}, delay +{p.providerDelayMinutes}m)</p>
                  <p>Distance to SL: {p.latestPrice != null && p.sl != null ? fmtPrice(Math.round((p.latestPrice - p.sl) * 100) / 100) : "—"} · to TP1: {p.latestPrice != null && p.tp1 != null ? fmtPrice(Math.round((p.tp1 - p.latestPrice) * 100) / 100) : "—"}</p>
                  <p>Resolved legs P&L: {fmtPkr(p.resolvedLegsPnl, 2)} · est. exit costs {fmtPkr(p.estimatedExitCosts, 2)} · est. CGT {fmtPkr(p.estimatedCgt, 2)}</p>
                  <p>Est. net if exited now: <span className="font-semibold">{fmtPkr(p.totalPositionNetPnlEstimate, 2)}</span></p>
                </div>
              </div>
              <div className="rounded-md border p-3">
                <p className="mb-1 font-semibold">Detection events & resolution limits</p>
                {p.ambiguousSameBarDates.length > 0 && (
                  <p className="text-red-600">Ambiguous same-day touches (daily bars cannot order SL vs TP): {p.ambiguousSameBarDates.join(", ")}</p>
                )}
                <p className="text-muted-foreground">{p.resolutionCaveat}</p>
                <p className="text-muted-foreground">Data source: {p.dataSource} · interval: {p.dataInterval ?? "snapshot (no candle interval)"} · freshness: {p.freshness}</p>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      <div className="space-y-1 rounded-lg border p-3 text-[11px] text-muted-foreground">
        {data?.disclaimers.map((d, i) => <p key={i}>• {d}</p>)}
        <p>• Source data type: {data?.feed.dataType}. The provider publishes no source market timestamp on quotes; the market time shown is estimated as received-time − {data?.feed.providerDelayMinutes ?? 15} min (estimated_source_timestamp).</p>
      </div>
    </div>
  );
}
