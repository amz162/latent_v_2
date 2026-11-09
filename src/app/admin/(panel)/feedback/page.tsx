"use client";

import { useState } from "react";
import { useAdminGet, adminPost, Badge } from "@/components/latent/admin/AdminShell";

interface FeedbackRow {
  id: string; category: string; message: string; route: string | null;
  status: string; createdAt: string; profileId: string | null; profileExists: boolean;
}

export default function AdminFeedbackPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminGet<{ total: number; page: number; pageSize: number; feedback: FeedbackRow[] }>(
    `/api/admin/feedback?status=${status}&page=${page}`
  );
  const [busy, setBusy] = useState<string | null>(null);

  const triage = async (id: string, next: string) => {
    setBusy(id);
    await adminPost("/api/admin/feedback", { id, status: next });
    setBusy(null);
    reload();
  };

  if (loading) return <div className="text-sm text-[#64748B] animate-pulse">Loading feedback…</div>;
  if (error || !data) return <div className="text-sm text-[#FF5C5C]">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Feedback</h1>
      <p className="text-xs text-[#64748B] mb-4">All users&apos; feedback (users only ever see their own submissions). {data.total} total.</p>
      <div className="flex gap-2 mb-4">
        {["", "new", "triaged", "resolved"].map((s) => (
          <button key={s || "all"} onClick={() => { setStatus(s); setPage(1); }} className={`rounded border px-2 py-1 text-xs ${status === s ? "border-[#00E676] text-[#00E676]" : "border-white/10 text-[#94A3B8]"}`}>
            {s || "all"}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {data.feedback.map((f) => (
          <div key={f.id} className="rounded-xl border border-white/[0.06] bg-[#111726] p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Badge tone="muted">{f.category}</Badge>
                <Badge tone={f.status === "resolved" ? "ok" : f.status === "triaged" ? "accent" : "warn"}>{f.status}</Badge>
                <span className="font-mono text-[10px] text-[#64748B]">{new Date(f.createdAt).toISOString().slice(0, 16).replace("T", " ")}</span>
              </div>
              <div className="space-x-1">
                {f.status === "new" && <button disabled={busy === f.id} onClick={() => triage(f.id, "triaged")} className="rounded border border-[#C68A1F]/40 px-1.5 py-0.5 text-[10px] text-[#C68A1F]">Triage</button>}
                {f.status !== "resolved" && <button disabled={busy === f.id} onClick={() => triage(f.id, "resolved")} className="rounded border border-[#00E676]/40 px-1.5 py-0.5 text-[10px] text-[#00E676]">Resolve</button>}
              </div>
            </div>
            <p className="text-sm text-[#F4F7FB] whitespace-pre-wrap">{f.message}</p>
            <div className="mt-1 text-[10px] font-mono text-[#64748B]">
              route: {f.route ?? "—"} · profile: {f.profileId ? `${f.profileId.slice(0, 10)}…${f.profileExists ? "" : " (deleted)"}` : "anonymous"}
            </div>
          </div>
        ))}
        {data.feedback.length === 0 && <p className="text-sm text-[#64748B]">No feedback in this filter.</p>}
      </div>
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
