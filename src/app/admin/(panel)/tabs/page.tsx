"use client";

import { useState } from "react";

import { useAdminGet, adminPost, Badge, Toggle } from "@/components/latent/admin/AdminShell";

interface TabEntry {
  key: string; category: string; label: string; description: string;
  globalEnabled: boolean; defaultEffect: string; isCore: boolean; interactKey: string | null;
  planGrants: string[]; userAllowOverrides: number; updatedAt: string | null;
}

export default function AdminTabsPage() {
  const { data, error, loading, reload } = useAdminGet<{ entries: TabEntry[] }>("/api/admin/tabs");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = async (key: string, globalEnabled: boolean) => {
    setBusy(key);
    const r = await adminPost("/api/admin/tabs", { key, globalEnabled });
    setBusy(null);
    setMsg({ ok: r.ok, text: r.ok ? `${key}: global ${globalEnabled ? "enabled" : "disabled"}` : `failed: ${(r.data.error as string) ?? r.status}` });
    if (r.ok) reload();
  };

  if (loading) return <div className="text-sm text-[#64748B] animate-pulse">Loading registry…</div>;
  if (error || !data) return <div className="text-sm text-[#FF5C5C]">Error: {error}</div>;

  const tabs = data.entries.filter((e) => e.category === "tab");
  const features = data.entries.filter((e) => e.category === "feature");

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Tabs &amp; Features</h1>
      <p className="text-xs text-[#64748B] mb-4">
        The global switch denies a tab for EVERY user (admins bypass). Per-plan grants and per-user overrides are managed under Plans / Permissions. A hidden tab is also blocked at its API.
      </p>
      {msg && <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]" : "border-[#FF5C5C]/30 bg-[#FF5C5C]/10 text-[#FF5C5C]"}`}>{msg.text}</div>}

      {[
        { title: "Tabs", rows: tabs },
        { title: "Features", rows: features },
      ].map((group) => (
        <div key={group.title} className="mb-6">
          <h2 className="text-sm font-semibold mb-2">{group.title}</h2>
          <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
            <table className="w-full text-xs min-w-[720px]">
              <thead className="bg-white/[0.03] text-left text-[#64748B]">
                <tr><th className="px-3 py-2 font-medium">Key</th><th className="px-3 py-2 font-medium">Plans granting</th><th className="px-3 py-2 font-medium">User overrides</th><th className="px-3 py-2 font-medium">Default</th><th className="px-3 py-2 font-medium text-right">Global</th></tr>
              </thead>
              <tbody>
                {group.rows.map((e) => (
                  <tr key={e.key} className="border-t border-white/[0.04]">
                    <td className="px-3 py-2">
                      <div className="font-mono">{e.key}{e.isCore && <span className="ml-1 text-[9px] text-[#64748B]">(core)</span>}</div>
                      <div className="text-[10px] text-[#64748B]">{e.label}{e.interactKey ? ` · interact: ${e.interactKey}` : ""}</div>
                    </td>
                    <td className="px-3 py-2">{e.planGrants.length ? e.planGrants.map((p) => <Badge key={p} tone="ok">{p}</Badge>) : <span className="text-[#64748B]">—</span>}</td>
                    <td className="px-3 py-2 font-mono">{e.userAllowOverrides || "—"}</td>
                    <td className="px-3 py-2 font-mono text-[#94A3B8]">{e.defaultEffect}</td>
                    <td className="px-3 py-2 text-right">
                      <Toggle on={e.globalEnabled} disabled={e.isCore || busy !== null} onChange={(v) => toggle(e.key, v)} label={`${e.key} global`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
