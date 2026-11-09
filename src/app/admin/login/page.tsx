"use client";

// Task 121 — admin login page. The only door to the control center; there is
// no registration, no default account and no password hint anywhere.
import { useEffect, useState } from "react";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("error");
    if (e === "session_expired") setNotice("Session expired — sign in again.");
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        window.location.href = "/admin";
        return;
      }
      setError(d.message ?? "Invalid username or password.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#F4F7FB] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[#C68A1F]/20 bg-[#111726] p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-lg bg-[#C68A1F] flex items-center justify-center text-[#0A0E1A] font-bold">
              A
            </div>
            <div>
              <div className="font-semibold">Administrator Sign in</div>
              <div className="text-[11px] text-[#64748B] font-mono">latent.pk control center</div>
            </div>
          </div>

          {notice && (
            <div className="mb-4 rounded-lg border border-[#C68A1F]/30 bg-[#C68A1F]/10 px-3 py-2 text-sm text-[#C68A1F]">
              {notice}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-[#FF5C5C]/30 bg-[#FF5C5C]/10 px-3 py-2 text-sm text-[#FF5C5C]">
              {error}
            </div>
          )}

          <form onSubmit={submit}>
            <label className="block text-xs text-[#94A3B8] mb-1.5" htmlFor="username">Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full rounded-lg border border-white/10 bg-[#0A0E1A] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C68A1F]/40"
            />
            <label className="block text-xs text-[#94A3B8] mb-1.5 mt-4" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-white/10 bg-[#0A0E1A] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C68A1F]/40"
            />
            <button
              type="submit"
              disabled={busy || !username || !password}
              className="mt-5 w-full rounded-lg bg-[#C68A1F] py-2.5 text-sm font-semibold text-[#0A0E1A] hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-[11px] text-[#64748B]">
            Accounts are created by the operator CLI only. 5 failed attempts
            lock the account for 15 minutes. Sessions expire after 12 hours.
          </p>
        </div>
        <p className="mt-4 text-center text-[11px] text-[#475569] font-mono">
          All access is logged to the append-only audit trail.
        </p>
      </div>
    </div>
  );
}
