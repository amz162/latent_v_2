"use client";

import { useState } from "react";

import { useAdminGet, adminPost, Badge, Toggle } from "@/components/latent/admin/AdminShell";

interface Strategy {
  strategyId: string; strategyName: string; role: string; family: string;
  votesInFusion: boolean; methodVersion: string; restrictions: string;
  userVisible: boolean; availabilityEnabled: boolean; readOnly: boolean;
}

export default function AdminStrategiesPage() {
  const { data, error, loading, reload } = useAdminGet<{ strategies: Strategy[]; note: string }>("/api/admin/strategies");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const upd = async (strategyId: string, body: Record<string, unknown>, label: string) => {
    setBusy(strategyId);
    const r = await adminPost("/api/admin/strategies", { strategyId, ...body });
    setBusy(null);
    setMsg({ ok: r.ok, text: r.ok ? `${strategyId}: ${label}` : `${label} failed: ${(r.data.error as string) ?? r.status}` });
    if (r.ok) reload();
  };

  if (loading) return <div className="text-sm text-[#64748B] animate-pulse">Loading strategies…</div>;
  if (error || !data) return <div className="text-sm text-[#FF5C5C]">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Strategy Management</h1>
      <p className="text-xs text-[#64748B] mb-4">{data.note}</p>
      {msg && <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]" : "border-[#FF5C5C]/30 bg-[#FF5C5C]/10 text-[#FF5C5C]"}`}>{msg.text}</div>}

      <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
        <table className="w-full text-xs min-w-[860px]">
          <thead className="bg-white/[0.03] text-left text-[#64748B]">
            <tr><th className="px-3 py-2 font-medium">Strategy</th><th className="px-3 py-2 font-medium">Role</th><th className="px-3 py-2 font-medium">Restrictions (code)</th><th className="px-3 py-2 font-medium text-right">Visible / Available / Read-only</th></tr>
          </thead>
          <tbody>
            {data.strategies.map((s) => (
              <tr key={s.strategyId} className="border-t border-white/[0.04]">
                <td className="px-3 py-2">
                  <div className="font-medium">{s.strategyName}</div>
                  <div className="font-mono text-[10px] text-[#64748B]">{s.strategyId} · {s.methodVersion}</div>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={s.votesInFusion ? "ok" : "muted"}>{s.role}</Badge>
                  <div className="text-[10px] text-[#64748B] mt-1">{s.family}</div>
                </td>
                <td className="px-3 py-2 text-[10px] text-[#94A3B8] max-w-[340px]">{s.restrictions}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-3">
                    <Toggle on={s.userVisible} disabled={busy !== null} onChange={(v) => upd(s.strategyId, { userVisible: v }, `visibility ${v ? "on" : "off"}`)} label="visible" />
                    <Toggle on={s.availabilityEnabled} disabled={busy !== null} onChange={(v) => upd(s.strategyId, { availabilityEnabled: v }, `availability ${v ? "on" : "off"}`)} label="available" />
                    <Toggle on={s.readOnly} disabled={busy !== null} onChange={(v) => upd(s.strategyId, { readOnly: v }, `read-only ${v ? "on" : "off"}`)} label="read-only" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
