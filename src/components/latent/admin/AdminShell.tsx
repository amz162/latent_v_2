"use client";

// Task 121 — Admin control-center shell. Runs ONLY under the server-guarded
// (panel) layout: the layout verifies the AdminSession against the database
// before any child renders, so this client code is convenience, not security.
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Overview", icon: "◧" },
  { href: "/admin/users", label: "Users", icon: "◉" },
  { href: "/admin/permissions", label: "Permissions", icon: "⚿" },
  { href: "/admin/plans", label: "Plans & Limits", icon: "▤" },
  { href: "/admin/tabs", label: "Tabs & Features", icon: "▥" },
  { href: "/admin/strategies", label: "Strategies", icon: "◈" },
  { href: "/admin/models", label: "AI Models", icon: "Brain" },
  { href: "/admin/llm", label: "LLM Control", icon: "✦" },
  { href: "/admin/invitations", label: "Invitations", icon: "✉" },
  { href: "/admin/feedback", label: "Feedback", icon: "✎" },
  { href: "/admin/monitoring", label: "System Health", icon: "♥" },
  { href: "/admin/audit", label: "Audit Logs", icon: "≡" },
  { href: "/admin/settings", label: "Platform Settings", icon: "⚙" },
];

export function AdminShell({ username, children }: { username: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
    } catch {
      // proceed with redirect regardless
    }
    router.push("/admin/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#F4F7FB]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 h-screen w-64 shrink-0 border-r border-white/[0.06] bg-[#0D1220] flex flex-col z-40 transition-transform ${navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        >
          <div className="px-4 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#C68A1F] flex items-center justify-center text-[#0A0E1A] font-bold text-sm">
                A
              </div>
              <div>
                <div className="text-sm font-semibold">Latent.pk Admin</div>
                <div className="text-[10px] text-[#64748B] font-mono">control center</div>
              </div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 latent-no-scrollbar">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                  className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                    active
                      ? "bg-[#C68A1F]/10 text-[#C68A1F] border-r-2 border-[#C68A1F]"
                      : "text-[#94A3B8] hover:text-[#F4F7FB] hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="w-4 text-center text-xs" aria-hidden>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/[0.06] px-4 py-3">
            <div className="text-xs text-[#94A3B8] mb-2 font-mono truncate">{username}</div>
            <button
              onClick={signOut}
              className="text-xs text-[#94A3B8] hover:text-[#FF5C5C]"
            >
              Sign out
            </button>
          </div>
        </aside>
        {navOpen && (
          <div className="fixed inset-0 bg-black/60 z-30 lg:hidden" onClick={() => setNavOpen(false)} />
        )}

        {/* Main */}
        <main className="flex-1 min-w-0">
          <header className="lg:hidden sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#0A0E1A]/95 backdrop-blur px-4 py-3">
            <button onClick={() => setNavOpen(true)} className="text-sm text-[#94A3B8]" aria-label="Open menu">☰ Admin</button>
            <span className="text-xs font-mono text-[#64748B]">{username}</span>
          </header>
          <div className="p-4 lg:p-8 max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** JSON fetch helper with uniform error handling for admin pages. */
export function useAdminGet<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) { window.location.href = "/admin/login?error=session_expired"; throw new Error("session"); }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive && e.message !== "session") setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [url, tick]);
  return { data, error, loading, reload };
}

export async function adminPost(url: string, body: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

export function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-[#FF5C5C]" : tone === "warn" ? "text-[#C68A1F]" : tone === "ok" ? "text-[#00E676]" : "text-[#F4F7FB]";
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#111726] p-4">
      <div className="text-[11px] text-[#64748B] uppercase tracking-wide">{label}</div>
      <div className={`mt-1 text-2xl font-semibold font-mono ${color}`}>{value}</div>
    </div>
  );
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-40 ${on ? "bg-[#00E676]" : "bg-white/10"}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "ok" | "warn" | "bad" | "muted" | "accent" }) {
  const map = {
    ok: "bg-[#00E676]/10 text-[#00E676] border-[#00E676]/30",
    warn: "bg-[#C68A1F]/10 text-[#C68A1F] border-[#C68A1F]/30",
    bad: "bg-[#FF5C5C]/10 text-[#FF5C5C] border-[#FF5C5C]/30",
    muted: "bg-white/[0.04] text-[#94A3B8] border-white/10",
    accent: "bg-[#C68A1F]/10 text-[#C68A1F] border-[#C68A1F]/30",
  } as const;
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-mono ${map[tone]}`}>
      {children}
    </span>
  );
}
