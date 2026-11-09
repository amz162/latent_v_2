"use client";

import { useState } from "react";
import { useAdminGet, adminPost, Badge, Toggle } from "@/components/latent/admin/AdminShell";

interface ModelRow {
  modelId: string; tier: string; tierLabel: string; category: string;
  trained: boolean; untrainedReason: string | null;
  userVisible: boolean; detailsVisible: boolean;
}

export default function AdminModelsPage() {
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useAdminGet<{ models: ModelRow[]; note: string }>("/api/admin/models");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const upd = async (modelId: string, body: Record<string, unknown>, label: string) => {
    setBusy(modelId);
    const r = await adminPost("/api/admin/models", { modelId, ...body });
    setBusy(null);
    setMsg({ ok: r.ok, text: r.ok ? `${modelId}: ${label}` : `${label} failed: ${(r.data.error as string) ?? r.status}` });
    if (r.ok) reload();
  };

  if (loading) return <div className="text-sm text-[#64748B] animate-pulse">Loading model inventory…</div>;
  if (error || !data) return <div className="text-sm text-[#FF5C5C]">Error: {error}</div>;

  const models = data.models.filter((m) =>
    !q || m.modelId.toLowerCase().includes(q.toLowerCase()) || m.tierLabel.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">AI Model Management</h1>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter…" className="rounded-lg border border-white/10 bg-[#0A0E1A] px-3 py-1.5 text-xs w-56" />
      </div>
      <p className="text-xs text-[#64748B] mb-4">{data.note} — {data.models.filter((m) => m.trained).length} trained, {data.models.filter((m) => !m.trained).length} blocked/untrained (historical experiments).</p>
      {msg && <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]" : "border-[#FF5C5C]/30 bg-[#FF5C5C]/10 text-[#FF5C5C]"}`}>{msg.text}</div>}

      <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
        <table className="w-full text-xs min-w-[820px]">
          <thead className="bg-white/[0.03] text-left text-[#64748B]">
            <tr><th className="px-3 py-2 font-medium">Model</th><th className="px-3 py-2 font-medium">Tier</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium text-right">Visible / Details</th></tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.modelId} className="border-t border-white/[0.04]">
                <td className="px-3 py-2 font-medium">{m.modelId}</td>
                <td className="px-3 py-2"><Badge tone="muted">{m.tier}</Badge></td>
                <td className="px-3 py-2">
                  {m.trained ? <Badge tone="ok">trained</Badge> : <Badge tone="warn">blocked/untrained</Badge>}
                  {m.untrainedReason && <div className="text-[10px] text-[#64748B] mt-1 max-w-[240px]">{m.untrainedReason}</div>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-3">
                    <Toggle on={m.userVisible} disabled={busy !== null} onChange={(v) => upd(m.modelId, { userVisible: v }, `visibility ${v ? "on" : "off"}`)} label="visible" />
                    <Toggle on={m.detailsVisible} disabled={busy !== null} onChange={(v) => upd(m.modelId, { detailsVisible: v }, `details ${v ? "on" : "off"}`)} label="details" />
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
