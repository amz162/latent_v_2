"use client";

import { useAdminGet, Badge } from "@/components/latent/admin/AdminShell";

interface Monitoring {
  application: { status: string; dbStatus: string; dbQuickCheck: string; frontier: string | null };
  worker: { present?: boolean; heartbeatAt?: string | null; ageSeconds?: number | null; stale?: boolean | null; pid?: number | null; note?: string | null };
  lastCycle: { classification: string | null; ts: string | null } | null;
  provider: { present?: boolean; updatedAt?: string | null; providers?: unknown };
  security: { authFailures24h: number; rateLimitEvents24h: number; apiErrors24h: number };
  backgroundJobs: { schedulerLastRun: string | null; workerLockNote: string };
  disk: { dataDir: string | null; dbFile: string | null };
  note: string;
}

function fmt(t: string | null | undefined): string {
  if (!t) return "—";
  return new Date(t).toISOString().replace("T", " ").slice(0, 19) + "Z";
}

export default function AdminMonitoringPage() {
  const { data, error, loading } = useAdminGet<Monitoring>("/api/admin/monitoring");
  if (loading) return <div className="text-sm text-[#64748B] animate-pulse">Loading monitoring…</div>;
  if (error || !data) return <div className="text-sm text-[#FF5C5C]">Error: {error}</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1">System Health</h1>
      <p className="text-xs text-[#64748B] mb-4">{data.note}</p>

      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Application">
          <Row k="Status" v={<Badge tone={data.application.status === "ok" ? "ok" : "bad"}>{data.application.status}</Badge>} />
          <Row k="Database" v={<Badge tone={data.application.dbStatus === "ok" ? "ok" : "bad"}>{data.application.dbStatus} · quick_check {data.application.dbQuickCheck}</Badge>} />
          <Row k="Data frontier (verified)" v={<span className="font-mono">{data.application.frontier ?? "—"}</span>} />
          <Row k="Disk — data/" v={<span className="font-mono">{data.disk.dataDir ?? "—"}</span>} />
          <Row k="Disk — db" v={<span className="font-mono">{data.disk.dbFile ?? "—"}</span>} />
        </Panel>
        <Panel title="Worker (task 107/108)">
          <Row k="Heartbeat" v={<Badge tone={data.worker.stale === true ? "warn" : data.worker.present ? "ok" : "bad"}>{fmt(data.worker.heartbeatAt)}{data.worker.ageSeconds !== null && data.worker.ageSeconds !== undefined ? ` (${data.worker.ageSeconds}s ago)` : ""}</Badge>} />
          <Row k="PID" v={<span className="font-mono">{data.worker.pid ?? "—"}</span>} />
          <Row k="Note" v={<span className="text-[11px] text-[#94A3B8]">{data.worker.note ?? "—"}</span>} />
          <Row k="Scheduler last run" v={<span className="font-mono text-[11px]">{fmt(data.backgroundJobs.schedulerLastRun)}</span>} />
          <Row k="Locking" v={<span className="text-[11px] text-[#94A3B8]">{data.backgroundJobs.workerLockNote}</span>} />
        </Panel>
        <Panel title="Provider">
          <Row k="State updated" v={<span className="font-mono">{fmt(data.provider.updatedAt)}</span>} />
          <Row k="Detail" v={<pre className="text-[10px] font-mono text-[#94A3B8] whitespace-pre-wrap max-h-40 overflow-y-auto">{JSON.stringify(data.provider.providers, null, 1) || "—"}</pre>} />
        </Panel>
        <Panel title="Security (24h)">
          <Row k="Auth failures" v={<span className="font-mono">{data.security.authFailures24h}</span>} />
          <Row k="Rate-limit events" v={<span className="font-mono">{data.security.rateLimitEvents24h}</span>} />
          <Row k="API errors" v={<span className="font-mono">{data.security.apiErrors24h}</span>} />
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111726] p-4">
      <h2 className="text-sm font-semibold mb-2">{title}</h2>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-[#64748B] shrink-0">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
