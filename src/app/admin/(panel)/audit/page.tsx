"use client";

import { useState } from "react";
import { useAdminGet, Badge } from "@/components/latent/admin/AdminShell";

interface AuditEntry {
  id: string; ts: string; actorType: string; actorId: string; action: string;
  targetType: string | null; targetId: string | null;
  before: unknown; after: unknown; result: string; failureReason: string | null;
  correlationId: string | null; route: string | null;
}

export default function AdminAuditPage() {
  const [action, setAction] = useState("");
  const [result, setResult] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const qs = new URLSearchParams({ action, result, q, page: String(page) }).toString();
  const { data, error, loading } = useAdminGet<{ total: number; page: number; pageSize: number; entries: AuditEntry[] }>(
    `/api/admin/audit?${qs}`
  );

  if (loading) return <div className="text-sm text-[#64748B] animate-pulse">Loading audit log…</div>;
  if (error || !data) return <div className="text-sm text-[#FF5C5C]">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Audit Logs</h1>
      <p className="text-xs text-[#64748B] mb-4">Append-only administrative trail — rows are never updated or deleted by any code path. {data.total} entries.</p>
      <div className="flex flex-wrap gap-2 mb-4">
        <input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="action contains…" className="rounded-lg border border-white/10 bg-[#0A0E1A] px-3 py-1.5 text-xs w-48" />
        <select value={result} onChange={(e) => { setResult(e.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-[#0A0E1A] px-2 py-1.5 text-xs">
          <option value="">All results</option><option value="ok">ok</option><option value="denied">denied</option><option value="error">error</option>
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="search target/actor" className="rounded-lg border border-white/10 bg-[#0A0E1A] px-3 py-1.5 text-xs w-56" />
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-x-auto">
        <table className="w-full text-xs min-w-[860px]">
          <thead className="bg-white/[0.03] text-left text-[#64748B]">
            <tr><th className="px-3 py-2 font-medium">Time</th><th className="px-3 py-2 font-medium">Actor</th><th className="px-3 py-2 font-medium">Action</th><th className="px-3 py-2 font-medium">Target</th><th className="px-3 py-2 font-medium">Result</th></tr>
          </thead>
          <tbody>
            {data.entries.map((e) => (
              <tr key={e.id} className="border-t border-white/[0.04] cursor-pointer hover:bg-white/[0.02]" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                <td className="px-3 py-2 font-mono text-[#64748B]">{new Date(e.ts).toISOString().slice(0, 19).replace("T", " ")}</td>
                <td className="px-3 py-2">{e.actorType}<div className="font-mono text-[10px] text-[#64748B]">{e.actorId.slice(0, 12)}</div></td>
                <td className="px-3 py-2 font-mono">{e.action}</td>
                <td className="px-3 py-2 font-mono text-[#94A3B8]">{e.targetType ?? "—"}{e.targetId ? ` · ${e.targetId.slice(0, 10)}…` : ""}</td>
                <td className="px-3 py-2"><Badge tone={e.result === "ok" ? "ok" : e.result === "denied" ? "warn" : "bad"}>{e.failureReason ?? e.result}</Badge></td>
              </tr>
            ))}
            {data.entries.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-[#64748B]">No entries match.</td></tr>}
          </tbody>
        </table>
      </div>

      {expanded && (() => {
        const e = data.entries.find((x) => x.id === expanded)!;
        return (
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#111726] p-4 text-xs">
            <div className="font-mono text-[10px] text-[#64748B] mb-2">{e.id} · route {e.route ?? "—"} · correlation {e.correlationId ?? "—"}</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><div className="text-[#64748B] mb-1">before</div><pre className="font-mono text-[10px] whitespace-pre-wrap bg-black/30 rounded p-2">{e.before ? JSON.stringify(e.before, null, 1) : "null"}</pre></div>
              <div><div className="text-[#64748B] mb-1">after</div><pre className="font-mono text-[10px] whitespace-pre-wrap bg-black/30 rounded p-2">{e.after ? JSON.stringify(e.after, null, 1) : "null"}</pre></div>
            </div>
          </div>
        );
      })()}

      {data.total > data.pageSize && (
        <div className="flex items-center gap-2 mt-3 text-xs">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-30">← Prev</button>
          <span className="text-[#64748B]">page {data.page} of {Math.ceil(data.total / data.pageSize)}</span>
          <button disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)} className="rounded border border-white/10 px-2 py-1 disabled:opacity-30">Next →</button>
        </div>
      )}
    </div>
  );
}
