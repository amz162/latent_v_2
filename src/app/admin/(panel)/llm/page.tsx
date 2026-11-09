"use client";

import { useState } from "react";

import { useAdminGet, adminPost, Badge, StatCard, Toggle } from "@/components/latent/admin/AdminShell";

interface LlmData {
  settings: { llm_requests_enabled: boolean; feature_pause: boolean };
  shadowOnly: boolean;
  provider: { name: string; observedModel: string | null; recentCalls: number; okCalls: number; failedCalls: number; totalTokensRecent: number; failuresByReason: Record<string, number> };
  artifacts: { signalHistoryRecords: number; evidenceCacheFiles: number };
  recentAudit: Array<{ ts: string; action: string; result: string }>;
}

export default function AdminLlmPage() {
  const { data, error, loading, reload } = useAdminGet<LlmData>("/api/admin/llm");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const setSwitch = async (body: Record<string, boolean>, label: string) => {
    setBusy(true);
    const r = await adminPost("/api/admin/llm", body);
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? label : `${label} failed` });
    if (r.ok) reload();
  };

  if (loading) return <div className="text-sm text-[#64748B] animate-pulse">Loading LLM state…</div>;
  if (error || !data) return <div className="text-sm text-[#FF5C5C]">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">LLM Control</h1>
      <p className="text-xs text-[#64748B] mb-4">Pipeline is READ-ONLY and SHADOW-ONLY — the admin controls below gate on-demand analysis endpoints and visibility; they never touch frozen research records. No credentials are exposed here.</p>
      {msg && <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]" : "border-[#FF5C5C]/30 bg-[#FF5C5C]/10 text-[#FF5C5C]"}`}>{msg.text}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Recent provider calls" value={data.provider.recentCalls} />
        <StatCard label="OK / failed" value={`${data.provider.okCalls} / ${data.provider.failedCalls}`} />
        <StatCard label="Tokens (recent)" value={data.provider.totalTokensRecent} />
        <StatCard label="History records" value={data.artifacts.signalHistoryRecords} tone="ok" />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-white/[0.06] bg-[#111726] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">On-demand LLM analysis</div>
              <div className="text-[11px] text-[#64748B]">explanations, news interpretation, pattern summaries</div>
            </div>
            <Toggle on={data.settings.llm_requests_enabled} disabled={busy} onChange={(v) => setSwitch({ llm_requests_enabled: v }, `LLM requests ${v ? "enabled" : "disabled"}`)} label="llm" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Global compute pause</div>
              <div className="text-[11px] text-[#64748B]">pauses LLM + on-demand backtest compute</div>
            </div>
            <Toggle on={data.settings.feature_pause} disabled={busy} onChange={(v) => setSwitch({ feature_pause: v }, `feature pause ${v ? "on" : "off"}`)} label="pause" />
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#111726] p-4">
          <h2 className="text-sm font-semibold mb-2">Provider</h2>
          <div className="text-xs space-y-1">
            <div>provider: <span className="font-mono">{data.provider.name}</span></div>
            <div>observed model: <span className="font-mono text-[#94A3B8]">{data.provider.observedModel ?? "—"}</span></div>
            <div>evidence cache files: <span className="font-mono">{data.artifacts.evidenceCacheFiles}</span></div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111726] p-4 mb-4">
        <h2 className="text-sm font-semibold mb-2">Failures / rejected outputs (recent ledger)</h2>
        {Object.keys(data.provider.failuresByReason).length === 0 ? (
          <p className="text-xs text-[#64748B]">No failures recorded in the recent ledger.</p>
        ) : (
          <ul className="text-xs space-y-1">
            {Object.entries(data.provider.failuresByReason).map(([k, n]) => (
              <li key={k} className="flex justify-between"><span className="font-mono text-[#94A3B8]">{k}</span><Badge tone="bad">{n}</Badge></li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
