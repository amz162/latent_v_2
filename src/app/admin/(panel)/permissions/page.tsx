"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdminGet, adminPost, Badge } from "@/components/latent/admin/AdminShell";

interface RegistryEntry { key: string; category: string; label: string; description: string; globalEnabled: boolean; defaultEffect: string; isCore: boolean; interactKey: string | null }
interface PermData {
  registry: RegistryEntry[];
  plans: Array<{ key: string; label: string; permissions: Array<{ permissionKey: string; effect: string }> }>;
  profile: { profileId: string; planKey: string; status: string } | null;
  overrides: Array<{ permissionKey: string; effect: string; setByAdminId: string | null; updatedAt: string }>;
  history: Array<{ ts: string; action: string; actorId: string; targetId: string | null; before: unknown; after: unknown }>;
}

/** Compute the effective effect for display: user override > plan > registry default. */
function effective(e: RegistryEntry, planPerms: Map<string, string>, override?: { effect: string }): "ALLOW" | "DENY" {
  if (override) return override.effect === "ALLOW" ? "ALLOW" : "DENY";
  const plan = planPerms.get(e.key);
  if (plan) return plan === "ALLOW" ? "ALLOW" : "DENY";
  if (e.globalEnabled && (e.isCore || e.defaultEffect === "ALLOW")) return "ALLOW";
  return "DENY";
}

export default function AdminPermissionsPage() {
  const [profileId, setProfileId] = useState("");
  const { data, error, loading, reload } = useAdminGet<PermData>(
    `/api/admin/permissions${profileId ? `?profileId=${profileId}` : ""}`
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // pre-select profile from ?profileId= (linked from the Users page)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("profileId");
    if (p) setProfileId(p);
  }, []);

  const planPerms = useMemo(() => {
    const plan = data?.plans.find((p) => p.key === data?.profile?.planKey);
    return new Map((plan?.permissions ?? []).map((x) => [x.permissionKey, x.effect]));
  }, [data]);

  const overrideMap = useMemo(
    () => new Map((data?.overrides ?? []).map((o) => [o.permissionKey, o])),
    [data]
  );

  const setOverride = async (key: string, effect: "ALLOW" | "DENY" | null) => {
    if (!profileId) return;
    setBusy(key);
    const r = await adminPost("/api/admin/permissions", { profileId, permissionKey: key, effect });
    setBusy(null);
    setMsg(r.ok ? `${key}: ${effect === null ? "reset to plan default" : effect}` : `failed: ${(r.data.error as string) ?? r.status}`);
    if (r.ok) reload();
  };

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">User Permissions Manager</h1>
      <p className="text-xs text-[#64748B] mb-4">
        Resolution order: per-user override → plan grant → registry default. Overrides take effect immediately.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={profileId}
          onChange={(e) => setProfileId(e.target.value.trim())}
          placeholder="BetaProfile id (from Users page)"
          className="rounded-lg border border-white/10 bg-[#0A0E1A] px-3 py-1.5 text-xs font-mono w-96"
        />
        {data?.profile && <Badge tone="accent">plan: {data.profile.planKey} · {data.profile.status}</Badge>}
      </div>
      {msg && <div className="mb-3 rounded-lg border border-[#00E676]/30 bg-[#00E676]/10 px-3 py-2 text-xs text-[#00E676]">{msg}</div>}
      {loading ? <div className="text-sm text-[#64748B] animate-pulse">Loading…</div> : error ? <div className="text-sm text-[#FF5C5C]">Error: {error}</div> : (
        <>
          <div className="rounded-xl border border-white/[0.06] overflow-x-auto mb-6">
            <table className="w-full text-xs min-w-[760px]">
              <thead className="bg-white/[0.03] text-left text-[#64748B]">
                <tr><th className="px-3 py-2 font-medium">Permission</th><th className="px-3 py-2 font-medium">Plan</th><th className="px-3 py-2 font-medium">Override</th><th className="px-3 py-2 font-medium">Effective</th><th className="px-3 py-2 font-medium text-right">Set override</th></tr>
              </thead>
              <tbody>
                {data?.registry.map((e) => {
                  const ov = overrideMap.get(e.key);
                  const eff = effective(e, planPerms, ov);
                  return (
                    <tr key={e.key} className="border-t border-white/[0.04]">
                      <td className="px-3 py-2">
                        <div className="font-mono">{e.key}{e.isCore && <span className="ml-1 text-[9px] text-[#64748B]">(core)</span>}</div>
                        <div className="text-[10px] text-[#64748B]">{e.label}{e.interactKey ? ` · interact: ${e.interactKey}` : ""}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-[#94A3B8]">{planPerms.get(e.key) ?? `(default ${e.defaultEffect})`}</td>
                      <td className="px-3 py-2">{ov ? <Badge tone={ov.effect === "ALLOW" ? "ok" : "bad"}>{ov.effect}</Badge> : <span className="text-[#64748B]">—</span>}</td>
                      <td className="px-3 py-2">
                        <Badge tone={eff === "ALLOW" ? (e.globalEnabled ? "ok" : "warn") : "bad"}>
                          {eff}{!e.globalEnabled && " (global off)"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right space-x-1">
                        <button disabled={!profileId || busy !== null} onClick={() => setOverride(e.key, "ALLOW")} className="rounded border border-[#00E676]/40 px-1.5 py-0.5 text-[10px] text-[#00E676] hover:bg-[#00E676]/10 disabled:opacity-30">Allow</button>
                        <button disabled={!profileId || busy !== null} onClick={() => setOverride(e.key, "DENY")} className="rounded border border-[#FF5C5C]/40 px-1.5 py-0.5 text-[10px] text-[#FF5C5C] hover:bg-[#FF5C5C]/10 disabled:opacity-30">Deny</button>
                        <button disabled={!profileId || busy !== null || !ov} onClick={() => setOverride(e.key, null)} className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] hover:bg-white/[0.04] disabled:opacity-30">Reset</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#111726] p-4">
            <h2 className="text-sm font-semibold mb-2">Permission change history (audit)</h2>
            {data?.history.length === 0 && <p className="text-xs text-[#64748B]">No changes recorded yet.</p>}
            <table className="w-full text-xs">
              <tbody>
                {data?.history.map((h, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="py-1.5 pr-2 font-mono text-[#64748B]">{new Date(h.ts).toISOString().slice(0, 19).replace("T", " ")}</td>
                    <td className="py-1.5 pr-2 font-mono">{h.action}</td>
                    <td className="py-1.5 pr-2 font-mono text-[#94A3B8]">{h.targetId?.slice(0, 10) ?? "—"}</td>
                    <td className="py-1.5 font-mono text-[#94A3B8]">{JSON.stringify(h.before ?? h.after ?? {})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
