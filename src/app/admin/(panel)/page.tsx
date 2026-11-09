"use client";

import { useAdminGet, StatCard, Badge } from "@/components/latent/admin/AdminShell";

interface Overview {
  users: { total: number; active: number; suspended: number; expired: number; newLast7d: number; lastActivityAt: string | null };
  invitations: { active: number; revoked: number; expired: number; feedbackNew: number };
  system: {
    db: string;
    worker: { heartbeatAt: string | null; note: string | null; pid: number | null; stale: boolean | null } | null;
    provider: { updatedAt: string | null } | null;
    strategies: { visible: number; total: number };
    models: { visible: number; total: number };
    llmSignalHistory: number;
  };
  recentAudit: Array<{ ts: string; actorType: string; action: string; targetId: string | null; result: string }>;
  securityEvents: Array<{ ts: string; action: string; failureReason: string | null; result: string }>;
  sources: { note: string };
}

function fmtTs(t: string | null): string {
  if (!t) return "—";
  return new Date(t).toISOString().replace("T", " ").slice(0, 19) + "Z";
}

export default function AdminOverviewPage() {
  const { data, error, loading } = useAdminGet<Overview>("/api/admin/overview");
  if (loading) return <div className="animate-pulse text-sm text-[#64748B]">Loading overview…</div>;
  if (error || !data) return <div className="text-sm text-[#FF5C5C]">Failed to load: {error}</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">Overview</h1>
      <p className="text-xs text-[#64748B] mb-6">{data.sources.note}</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Registered users" value={data.users.total} />
        <StatCard label="Active" value={data.users.active} tone="ok" />
        <StatCard label="Suspended" value={data.users.suspended} tone={data.users.suspended ? "warn" : undefined} />
        <StatCard label="Expired accounts" value={data.users.expired} tone={data.users.expired ? "warn" : undefined} />
        <StatCard label="New (7d)" value={data.users.newLast7d} />
        <StatCard label="Pending invitations" value={data.invitations.active} />
        <StatCard label="Expired invitations" value={data.invitations.expired} tone={data.invitations.expired ? "warn" : undefined} />
        <StatCard label="New feedback" value={data.invitations.feedbackNew} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-white/[0.06] bg-[#111726] p-4">
          <h2 className="text-sm font-semibold mb-3">System health</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-[11px] text-[#64748B]">Database</div><Badge tone={data.system.db === "ok" ? "ok" : "bad"}>{data.system.db}</Badge></div>
            <div><div className="text-[11px] text-[#64748B]">Worker heartbeat</div>
              <Badge tone={data.system.worker ? (data.system.worker.stale ? "warn" : "ok") : "bad"}>
                {data.system.worker ? fmtTs(data.system.worker.heartbeatAt) : "missing"}
              </Badge>
            </div>
            <div><div className="text-[11px] text-[#64748B]">Provider state</div><Badge tone={data.system.provider ? "ok" : "warn"}>{data.system.provider ? fmtTs(data.system.provider.updatedAt) : "missing"}</Badge></div>
            <div><div className="text-[11px] text-[#64748B]">Last user activity</div><span className="font-mono text-xs">{fmtTs(data.users.lastActivityAt)}</span></div>
            <div><div className="text-[11px] text-[#64748B]">Strategies visible</div><span className="font-mono text-xs">{data.system.strategies.visible}/{data.system.strategies.total}</span></div>
            <div><div className="text-[11px] text-[#64748B]">Models visible</div><span className="font-mono text-xs">{data.system.models.visible}/{data.system.models.total}</span></div>
            <div><div className="text-[11px] text-[#64748B]">LLM signal history</div><span className="font-mono text-xs">{data.system.llmSignalHistory} records</span></div>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-[#111726] p-4">
          <h2 className="text-sm font-semibold mb-3">Recent security events</h2>
          {data.securityEvents.length === 0 ? (
            <p className="text-xs text-[#64748B]">No denied/failed events recorded.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {data.securityEvents.map((e, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="py-1.5 pr-2 font-mono text-[#64748B]">{fmtTs(e.ts)}</td>
                    <td className="py-1.5 pr-2 font-mono">{e.action}</td>
                    <td className="py-1.5"><Badge tone="bad">{e.failureReason ?? e.result}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#111726] p-4">
        <h2 className="text-sm font-semibold mb-3">Recent administrative actions</h2>
        <table className="w-full text-xs">
          <thead><tr className="text-left text-[#64748B]"><th className="py-1 pr-2 font-medium">Time</th><th className="py-1 pr-2 font-medium">Actor</th><th className="py-1 pr-2 font-medium">Action</th><th className="py-1 pr-2 font-medium">Target</th><th className="py-1 font-medium">Result</th></tr></thead>
          <tbody>
            {data.recentAudit.map((a, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                <td className="py-1.5 pr-2 font-mono text-[#64748B]">{fmtTs(a.ts)}</td>
                <td className="py-1.5 pr-2">{a.actorType}</td>
                <td className="py-1.5 pr-2 font-mono">{a.action}</td>
                <td className="py-1.5 pr-2 font-mono text-[#94A3B8]">{a.targetId?.slice(0, 14) ?? "—"}</td>
                <td className="py-1.5"><Badge tone={a.result === "ok" ? "ok" : "bad"}>{a.result}</Badge></td>
              </tr>
            ))}
            {data.recentAudit.length === 0 && <tr><td colSpan={5} className="py-2 text-[#64748B]">No audit entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
