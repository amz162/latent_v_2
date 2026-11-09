"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminGet, adminPost, Badge } from "@/components/latent/admin/AdminShell";

interface UserRow {
  profileId: string; createdAt: string; accessVia: string; inviteId: string | null;
  profileComplete: boolean; status: string; planKey: string; accessExpiresAt: string | null;
  lastSeenAt: string | null; suspendedReason: string | null; feedbackCount: number;
}
interface UsersData {
  total: number; page: number; pageSize: number; defaultPlan: string;
  plans: Array<{ key: string; label: string; isEnabled: boolean; isDefault: boolean }>;
  users: UserRow[];
}

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const qs = new URLSearchParams({ q, status, plan, page: String(page) }).toString();
  const { data, error, loading, reload } = useAdminGet<UsersData>(`/api/admin/users?${qs}`);

  const act = async (label: string, body: Record<string, unknown>) => {
    setBusy(label + (body.profileId as string));
    setMsg(null);
    const r = await adminPost("/api/admin/users", body);
    setBusy(null);
    setMsg({ ok: r.ok, text: r.ok ? `${label} OK` : `${label} failed: ${(r.data.error as string) ?? r.status}` });
    if (r.ok) { setConfirmDelete(null); reload(); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold">Users</h1>
          <p className="text-xs text-[#64748B]">{data ? `${data.total} profiles` : "…"} — every action is audited</p>
        </div>
        <a href="/api/admin/export/users" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs hover:bg-white/[0.04]">Export CSV</a>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="search id / invite id / invite code"
          className="rounded-lg border border-white/10 bg-[#0A0E1A] px-3 py-1.5 text-xs w-64" />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-[#0A0E1A] px-2 py-1.5 text-xs">
          <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
        </select>
        <select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-[#0A0E1A] px-2 py-1.5 text-xs">
          <option value="">All plans</option>
          {data?.plans.map((p) => <option key={p.key} value={p.key}>{p.label}{p.isDefault ? " (default)" : ""}{!p.isEnabled ? " (disabled)" : ""}</option>)}
        </select>
      </div>

      {msg && <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${msg.ok ? "border-[#00E676]/30 bg-[#00E676]/10 text-[#00E676]" : "border-[#FF5C5C]/30 bg-[#FF5C5C]/10 text-[#FF5C5C]"}`}>{msg.text}</div>}

      {loading ? <div className="text-sm text-[#64748B] animate-pulse">Loading…</div> : error ? <div className="text-sm text-[#FF5C5C]">Error: {error}</div> : (
        <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead className="bg-white/[0.03] text-left text-[#64748B]">
              <tr><th className="px-3 py-2 font-medium">Profile</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Plan</th><th className="px-3 py-2 font-medium">Via</th><th className="px-3 py-2 font-medium">Last seen</th><th className="px-3 py-2 font-medium">Expires</th><th className="px-3 py-2 font-medium">Feedback</th><th className="px-3 py-2 font-medium text-right">Actions</th></tr>
            </thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.profileId} className="border-t border-white/[0.04] align-top">
                  <td className="px-3 py-2">
                    <button onClick={() => setExpanded(expanded === u.profileId ? null : u.profileId)} className="font-mono text-[#00E676] hover:underline">{u.profileId.slice(0, 12)}…</button>
                    <div className="text-[10px] text-[#64748B]">{new Date(u.createdAt).toISOString().slice(0, 10)}{u.profileComplete ? " · complete" : ""}</div>
                    {expanded === u.profileId && (
                      <div className="mt-2 p-2 rounded-lg bg-black/30 border border-white/[0.06] max-w-xs">
                        <div className="text-[10px] text-[#64748B] mb-1">full id</div>
                        <div className="font-mono text-[10px] break-all">{u.profileId}</div>
                        <div className="mt-2 text-[10px] text-[#64748B]"><Link href={`/admin/permissions?profileId=${u.profileId}`} className="text-[#C68A1F] hover:underline">edit permissions →</Link></div>
                        {u.suspendedReason && <div className="mt-1 text-[10px] text-[#C68A1F]">reason: {u.suspendedReason}</div>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2"><Badge tone={u.status === "ACTIVE" ? "ok" : "bad"}>{u.status}</Badge></td>
                  <td className="px-3 py-2">
                    <select value={u.planKey} onChange={(e) => act("plan change", { action: "set_plan", profileId: u.profileId, planKey: e.target.value })}
                      className="rounded border border-white/10 bg-[#0A0E1A] px-1.5 py-1 text-[11px]" disabled={busy !== null}>
                      {data?.plans.filter((p) => p.isEnabled).map((p) => <option key={p.key} value={p.key}>{p.key}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 font-mono text-[#94A3B8]">{u.accessVia}{u.inviteId ? ` · ${u.inviteId.slice(0, 8)}…` : ""}</td>
                  <td className="px-3 py-2 font-mono text-[#94A3B8]">{u.lastSeenAt ? new Date(u.lastSeenAt).toISOString().slice(0, 16).replace("T", " ") : "never"}</td>
                  <td className="px-3 py-2 font-mono text-[#94A3B8]">
                    {u.accessExpiresAt ? new Date(u.accessExpiresAt).toISOString().slice(0, 10) : "—"}
                    <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); act("expiry", { action: "set_expiry", profileId: u.profileId, accessExpiresAt: f.get("exp") || null }); }}>
                      <input name="exp" type="date" className="mt-1 block rounded border border-white/10 bg-[#0A0E1A] px-1 py-0.5 text-[10px]" />
                    </form>
                  </td>
                  <td className="px-3 py-2 font-mono">{u.feedbackCount}</td>
                  <td className="px-3 py-2 text-right space-x-1 whitespace-nowrap">
                    {u.status === "ACTIVE" ? (
                      <button disabled={busy !== null} onClick={() => { const reason = window.prompt("Suspension reason (optional):") ?? ""; act("suspend", { action: "suspend", profileId: u.profileId, reason }); }} className="rounded border border-[#C68A1F]/40 px-1.5 py-0.5 text-[10px] text-[#C68A1F] hover:bg-[#C68A1F]/10">Suspend</button>
                    ) : (
                      <button disabled={busy !== null} onClick={() => act("reactivate", { action: "reactivate", profileId: u.profileId })} className="rounded border border-[#00E676]/40 px-1.5 py-0.5 text-[10px] text-[#00E676] hover:bg-[#00E676]/10">Reactivate</button>
                    )}
                    <button disabled={busy !== null} onClick={() => act("session reset", { action: "reset_sessions", profileId: u.profileId })} className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] hover:bg-white/[0.04]">Kill session</button>
                    <button disabled={busy !== null} onClick={() => setConfirmDelete(u)} className="rounded border border-[#FF5C5C]/40 px-1.5 py-0.5 text-[10px] text-[#FF5C5C] hover:bg-[#FF5C5C]/10">Delete</button>
                  </td>
                </tr>
              ))}
              {data?.users.length === 0 && <tr><td colSpan={8} className="px-3 py-4 text-[#64748B]">No users match the filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > data.pageSize && (
        <div className="flex items-center gap-2 mt-3 text-xs">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-30">← Prev</button>
          <span className="text-[#64748B]">page {data.page} of {Math.ceil(data.total / data.pageSize)}</span>
          <button disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-30">Next →</button>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md w-full rounded-xl border border-[#FF5C5C]/30 bg-[#111726] p-6">
            <h2 className="text-lg font-semibold text-[#FF5C5C] mb-2">Permanently delete user?</h2>
            <p className="text-sm text-[#94A3B8] mb-1 font-mono">{confirmDelete.profileId}</p>
            <p className="text-xs text-[#64748B] mb-4">
              This hard-deletes the profile and its permissions. Sessions die immediately and cannot be restored.
              Feedback rows are retained (marked as deleted profile). The action is recorded in the audit log.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(null)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs">Cancel</button>
              <button onClick={() => act("delete", { action: "delete", profileId: confirmDelete.profileId, confirm: "DELETE" })}
                className="rounded-lg bg-[#FF5C5C] px-3 py-1.5 text-xs font-semibold text-[#0A0E1A]">Delete permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
