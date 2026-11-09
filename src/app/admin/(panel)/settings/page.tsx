"use client";

import { useState } from "react";

import { useAdminGet, adminPost, Toggle, Badge } from "@/components/latent/admin/AdminShell";

interface SettingsData {
  settings: Record<string, boolean | string>;
  meta: Record<string, { updatedAt: string; updatedBy: string | null; description: string }>;
  plans: Array<{ key: string; label: string; isDefault: boolean }>;
}

export default function AdminSettingsPage() {
  const { data, error, loading, reload } = useAdminGet<SettingsData>("/api/admin/settings");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = async (key: string, value: boolean | string, label: string) => {
    setBusy(key);
    const r = await adminPost("/api/admin/settings", { key, value });
    setBusy(null);
    setMsg({ ok: r.ok, text: r.ok ? `${key}: ${label}` : `${label} failed: ${(r.data.error as string) ?? r.status}` });
    if (r.ok) reload();
  };

  if (loading) return <div className="text-sm text-[#64748B] animate-pulse">Loading settings…</div>;
  if (error || !data) return <div className="text-sm text-[#FF5C5C]">Error: {error}</div>;

  const bools = Object.entries(data.settings).filter(([, v]) => typeof v === "boolean") as Array<[string, boolean]>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Platform Settings</h1>
      <p className="text-xs text-[#64748B] mb-4">
        All changes are validated and audited. Security-critical beta gates (env flag, BetaConfig) are intentionally NOT reachable here — settings can never weaken authentication.
      </p>
      {msg && <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]" : "border-[#FF5C5C]/30 bg-[#FF5C5C]/10 text-[#FF5C5C]"}`}>{msg.text}</div>}

      <div className="rounded-xl border border-white/[0.06] bg-[#111726] divide-y divide-white/[0.04]">
        {bools.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between p-4">
            <div className="max-w-xl">
              <div className="text-sm font-medium flex items-center gap-2">{key}{value && key === "maintenance_mode" && <Badge tone="bad">USERS LOCKED OUT</Badge>}</div>
              <div className="text-[11px] text-[#64748B]">{data.meta[key]?.description ?? ""}</div>
            </div>
            <Toggle on={value} disabled={busy !== null} onChange={(v) => set(key, v, v ? "on" : "off")} label={key} />
          </div>
        ))}
        <div className="p-4">
          <div className="text-sm font-medium mb-1">Default plan for new users</div>
          <div className="text-[11px] text-[#64748B] mb-2">{data.meta.registration_default_plan?.description}</div>
          <select
            value={String(data.settings.registration_default_plan)}
            disabled={busy !== null}
            onChange={(e) => set("registration_default_plan", e.target.value, `default plan → ${e.target.value}`)}
            className="rounded border border-white/10 bg-[#0A0E1A] px-2 py-1.5 text-xs"
          >
            {data.plans.map((p) => <option key={p.key} value={p.key}>{p.key} ({p.label})</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
