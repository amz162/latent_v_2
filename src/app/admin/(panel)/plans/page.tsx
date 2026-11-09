"use client";

import { useState } from "react";
import { useAdminGet, adminPost, Badge, Toggle } from "@/components/latent/admin/AdminShell";

interface Plan {
  key: string; label: string; isEnabled: boolean; isDefault: boolean; profileCount: number;
  limits: Record<string, number | null>;
  permissions: Array<{ permissionKey: string; effect: string }>;
}
interface PlansData {
  plans: Plan[];
  registry: Array<{ key: string; label: string; category: string }>;
}

const LIMIT_LABELS: Record<string, string> = {
  maxDailyLlmRequests: "Daily LLM requests",
  maxDailyReportExports: "Daily report exports",
  maxDailySimulatorRuns: "Daily simulator runs",
  maxDailyApiRequests: "Daily API requests",
  accountExpiryDays: "Account expiry (days, blank = none)",
};

export default function AdminPlansPage() {
  const { data, error, loading, reload } = useAdminGet<PlansData>("/api/admin/plans");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showMatrix, setShowMatrix] = useState<string | null>(null);

  const save = async (key: string, body: Record<string, unknown>, label: string) => {
    setBusy(key + label);
    const r = await adminPost("/api/admin/plans", { key, ...body });
    setBusy(null);
    setMsg({ ok: r.ok, text: r.ok ? `${key}: ${label} saved` : `${label} failed: ${(r.data.error as string) ?? r.status}` });
    if (r.ok) reload();
  };

  if (loading) return <div className="text-sm text-[#64748B] animate-pulse">Loading plans…</div>;
  if (error || !data) return <div className="text-sm text-[#FF5C5C]">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Plans &amp; Limits</h1>
      <p className="text-xs text-[#64748B] mb-4">
        Limits are enforced server-side with race-safe atomic counters. Blank/empty = unlimited. Plan grants apply to every profile on the plan; per-user overrides live in Permissions.
      </p>
      {msg && <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]" : "border-[#FF5C5C]/30 bg-[#FF5C5C]/10 text-[#FF5C5C]"}`}>{msg.text}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        {data.plans.map((p) => (
          <div key={p.key} className="rounded-xl border border-white/[0.06] bg-[#111726] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-semibold">{p.key}</div>
                <div className="text-[10px] text-[#64748B] font-mono">{p.profileCount} profile(s)</div>
              </div>
              <div className="flex items-center gap-2">
                {p.isDefault && <Badge tone="accent">default</Badge>}
                <Toggle on={p.isEnabled} disabled={p.isDefault} onChange={(v) => save(p.key, { isEnabled: v }, "enabled")} label="enabled" />
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const limits: Record<string, number | null> = {};
                for (const k of Object.keys(LIMIT_LABELS)) {
                  const raw = String(f.get(k) ?? "").trim();
                  limits[k] = raw === "" ? null : parseInt(raw, 10);
                }
                save(p.key, { label: String(f.get("label") ?? p.label), isDefault: f.get("isDefault") === "on", limits }, "plan");
              }}
              className="space-y-2"
            >
              <input name="label" defaultValue={p.label} className="w-full rounded border border-white/10 bg-[#0A0E1A] px-2 py-1.5 text-xs" placeholder="Plan label" />
              <label className="flex items-center gap-2 text-xs text-[#94A3B8]">
                <input type="checkbox" name="isDefault" defaultChecked={p.isDefault} className="accent-[#00E676]" /> default plan for new users
              </label>
              {Object.entries(LIMIT_LABELS).map(([k, label]) => (
                <div key={k}>
                  <label className="block text-[10px] text-[#64748B]">{label}</label>
                  <input name={k} type="number" min={0} defaultValue={p.limits?.[k] ?? ""} placeholder="unlimited"
                    className="w-full rounded border border-white/10 bg-[#0A0E1A] px-2 py-1 text-xs font-mono" />
                </div>
              ))}
              <button disabled={busy !== null} className="w-full rounded bg-[#00E676] py-1.5 text-xs font-semibold text-[#0A0E1A] disabled:opacity-40">Save plan</button>
            </form>
            <button onClick={() => setShowMatrix(showMatrix === p.key ? null : p.key)} className="mt-3 text-[11px] text-[#C68A1F] hover:underline">
              {showMatrix === p.key ? "hide" : "edit"} plan permissions ({p.permissions.filter((x) => x.effect === "ALLOW").length} granted)
            </button>
            {showMatrix === p.key && (
              <div className="mt-2 max-h-72 overflow-y-auto rounded-lg bg-black/30 border border-white/[0.06] p-2 space-y-1">
                {data.registry.map((r) => {
                  const row = p.permissions.find((x) => x.permissionKey === r.key);
                  const eff = row?.effect ?? ((r.key === "feature.profile") ? "ALLOW" : "DENY");
                  return (
                    <div key={r.key} className="flex items-center justify-between text-[11px]">
                      <span className="font-mono truncate max-w-[55%]" title={r.key}>{r.key}</span>
                      <span className="space-x-1">
                        <button disabled={busy !== null} onClick={() => save(p.key, { permissions: [{ permissionKey: r.key, effect: "ALLOW" }] }, `${r.key} ALLOW`)} className={`rounded px-1 py-0.5 border ${eff === "ALLOW" ? "border-[#00E676] text-[#00E676]" : "border-white/10 text-[#64748B]"}`}>A</button>
                        <button disabled={busy !== null} onClick={() => save(p.key, { permissions: [{ permissionKey: r.key, effect: "DENY" }] }, `${r.key} DENY`)} className={`rounded px-1 py-0.5 border ${eff === "DENY" ? "border-[#FF5C5C] text-[#FF5C5C]" : "border-white/10 text-[#64748B]"}`}>D</button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
