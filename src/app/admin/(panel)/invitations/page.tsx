"use client";

import { useState } from "react";
import { useAdminGet, adminPost, Badge } from "@/components/latent/admin/AdminShell";

interface Invite {
  id: string; label: string | null; status: string; maxRedemptions: number;
  redemptionCount: number; createdAt: string; expiresAt: string | null;
  redeemedProfiles: number; exhausted: boolean; expired: boolean;
}
interface InviteData {
  invitations: Invite[];
  events: Array<{ ts: string; inviteId: string; event: string; actorType: string; detail: unknown }>;
  globallyPaused: boolean;
}

export default function AdminInvitationsPage() {
  const { data, error, loading, reload } = useAdminGet<InviteData>("/api/admin/invitations");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [validateCode, setValidateCode] = useState("");
  const [validateResult, setValidateResult] = useState<string | null>(null);

  const act = async (body: Record<string, unknown>, label: string) => {
    setBusy(true);
    setMsg(null);
    const r = await adminPost("/api/admin/invitations", body);
    setBusy(false);
    if (r.ok && r.data.token) {
      setFreshToken(String(r.data.token));
      setMsg({ ok: true, text: "Invitation created — copy the code NOW, it is shown only once." });
    } else {
      setMsg({ ok: r.ok, text: r.ok ? `${label} OK` : `${label} failed: ${(r.data.error as string) ?? r.status}` });
    }
    if (r.ok && !r.data.token) reload();
  };

  const validate = async () => {
    setBusy(true);
    const r = await adminPost("/api/admin/invitations", { action: "validate", code: validateCode });
    setBusy(false);
    const d = r.data as { valid?: boolean; rejection?: string };
    setValidateResult(d.valid ? "VALID — redeemable now" : `NOT valid (${d.rejection ?? "invalid"})`);
  };

  if (loading) return <div className="text-sm text-[#64748B] animate-pulse">Loading invitations…</div>;
  if (error || !data) return <div className="text-sm text-[#FF5C5C]">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Invitation Management</h1>
      <p className="text-xs text-[#64748B] mb-4">Tokens are stored hashed; the raw code is displayed once at creation and never again.</p>
      {msg && <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]" : "border-[#FF5C5C]/30 bg-[#FF5C5C]/10 text-[#FF5C5C]"}`}>{msg.text}</div>}

      {freshToken && (
        <div className="mb-4 rounded-xl border-2 border-[#00E676] bg-[#00E676]/10 p-4">
          <div className="text-xs text-[#00E676] mb-1 font-semibold">NEW INVITATION — shown only once, copy it now:</div>
          <div className="font-mono text-lg tracking-widest text-[#F4F7FB]">{freshToken}</div>
          <button onClick={() => { setFreshToken(null); reload(); }} className="mt-2 rounded border border-[#00E676]/40 px-2 py-1 text-xs">Done</button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); act({ action: "create", label: f.get("label"), maxRedemptions: Number(f.get("max")) || 1, expiresInDays: Number(f.get("days")) || 0 }, "create"); }}
          className="rounded-xl border border-white/[0.06] bg-[#111726] p-4 space-y-2">
          <h2 className="text-sm font-semibold">Create invitation</h2>
          <input name="label" placeholder="label (cohort note)" className="w-full rounded border border-white/10 bg-[#0A0E1A] px-2 py-1.5 text-xs" />
          <div className="flex gap-2">
            <input name="max" type="number" min={1} max={500} defaultValue={1} className="w-1/2 rounded border border-white/10 bg-[#0A0E1A] px-2 py-1.5 text-xs font-mono" placeholder="max uses" />
            <input name="days" type="number" min={0} max={365} defaultValue={0} className="w-1/2 rounded border border-white/10 bg-[#0A0E1A] px-2 py-1.5 text-xs font-mono" placeholder="expiry days (0=none)" />
          </div>
          <button disabled={busy} className="w-full rounded bg-[#00E676] py-1.5 text-xs font-semibold text-[#0A0E1A] disabled:opacity-40">Create</button>
        </form>

        <div className="rounded-xl border border-white/[0.06] bg-[#111726] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Global pause</div>
              <div className="text-[11px] text-[#64748B]">status: <Badge tone={data.globallyPaused ? "warn" : "ok"}>{data.globallyPaused ? "PAUSED" : "normal"}</Badge></div>
            </div>
            <div className="space-x-1">
              <button disabled={busy} onClick={() => act({ action: "pause_all", reason: "paused via admin panel" }, "pause all")} className="rounded border border-[#C68A1F]/40 px-2 py-1 text-xs text-[#C68A1F]">Pause all</button>
              <button disabled={busy} onClick={() => act({ action: "resume_all" }, "resume all")} className="rounded border border-[#00E676]/40 px-2 py-1 text-xs text-[#00E676]">Resume</button>
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-3">
            <div className="text-xs font-semibold mb-1">Validate a code (dry-run, does NOT consume)</div>
            <div className="flex gap-2">
              <input value={validateCode} onChange={(e) => setValidateCode(e.target.value)} placeholder="LATENT-…" className="flex-1 rounded border border-white/10 bg-[#0A0E1A] px-2 py-1.5 text-xs font-mono" />
              <button disabled={busy || !validateCode} onClick={validate} className="rounded border border-white/10 px-2 py-1 text-xs">Check</button>
            </div>
            {validateResult && <div className="mt-1 text-[11px] text-[#94A3B8]">{validateResult}</div>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-x-auto mb-6">
        <table className="w-full text-xs min-w-[760px]">
          <thead className="bg-white/[0.03] text-left text-[#64748B]">
            <tr><th className="px-3 py-2 font-medium">Label</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Uses</th><th className="px-3 py-2 font-medium">Created</th><th className="px-3 py-2 font-medium">Expires</th><th className="px-3 py-2 font-medium text-right">Actions</th></tr>
          </thead>
          <tbody>
            {data.invitations.map((i) => (
              <tr key={i.id} className="border-t border-white/[0.04]">
                <td className="px-3 py-2">{i.label ?? <span className="text-[#64748B]">—</span>}</td>
                <td className="px-3 py-2"><Badge tone={i.status === "revoked" ? "bad" : i.expired ? "warn" : i.exhausted ? "warn" : "ok"}>{i.status === "revoked" ? "revoked" : i.expired ? "expired" : i.exhausted ? "exhausted" : "active"}</Badge></td>
                <td className="px-3 py-2 font-mono">{i.redemptionCount}/{i.maxRedemptions}</td>
                <td className="px-3 py-2 font-mono text-[#94A3B8]">{new Date(i.createdAt).toISOString().slice(0, 10)}</td>
                <td className="px-3 py-2 font-mono text-[#94A3B8]">{i.expiresAt ? new Date(i.expiresAt).toISOString().slice(0, 10) : "—"}</td>
                <td className="px-3 py-2 text-right space-x-1">
                  {i.status === "active" && <button disabled={busy} onClick={() => act({ action: "revoke", inviteId: i.id }, "revoke")} className="rounded border border-[#C68A1F]/40 px-1.5 py-0.5 text-[10px] text-[#C68A1F]">Revoke</button>}
                  {i.redemptionCount === 0 && <button disabled={busy} onClick={() => act({ action: "delete", inviteId: i.id }, "delete")} className="rounded border border-[#FF5C5C]/40 px-1.5 py-0.5 text-[10px] text-[#FF5C5C]">Delete</button>}
                </td>
              </tr>
            ))}
            {data.invitations.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-[#64748B]">No invitations yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111726] p-4">
        <h2 className="text-sm font-semibold mb-2">Redemption / audit trail (recent)</h2>
        <table className="w-full text-xs">
          <tbody>
            {data.events.slice(0, 20).map((e, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                <td className="py-1.5 pr-2 font-mono text-[#64748B]">{new Date(e.ts).toISOString().slice(0, 19).replace("T", " ")}</td>
                <td className="py-1.5 pr-2 font-mono">{e.event}</td>
                <td className="py-1.5 pr-2 font-mono text-[#94A3B8]">{e.inviteId.slice(0, 10)}…</td>
                <td className="py-1.5">{e.actorType}</td>
              </tr>
            ))}
            {data.events.length === 0 && <tr><td className="py-2 text-[#64748B]">No events yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
