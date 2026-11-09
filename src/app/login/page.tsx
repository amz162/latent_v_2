"use client";

// Task 121 — user login. Reuses the existing, secure invite-redemption
// endpoint (POST /api/beta/invite/redeem) as the credential mechanism: the
// invitation code IS the password, it is validated server-side against the
// sha256-hashed invite table, and failures are indistinguishable (no
// enumeration). Open-access mode (operator flag) uses the existing profile
// auto-creation path. No passwords are introduced.

import { useEffect, useState } from "react";

export default function LoginPage() {
  const [status, setStatus] = useState<{
    invitationRequired: boolean;
    betaEnabled: boolean;
    paused: boolean;
  } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/beta/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setStatus({
          invitationRequired: !!d.invitationRequired,
          betaEnabled: d.betaEnabled !== false && !d.betaDisabled,
          paused: !!d.registrationsPaused,
        });
      })
      .catch(() => setStatus({ invitationRequired: true, betaEnabled: true, paused: false }));
  }, []);

  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const urlError = params.get("error");
  useEffect(() => {
    if (urlError === "account_suspended") setError("This account is suspended. Contact your administrator.");
    else if (urlError === "account_expired") setError("This account has expired. Contact your administrator.");
    else if (urlError === "session_expired") setError("Your session has ended. Please sign in again.");
  }, [urlError]);

  const redeem = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/beta/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (res.status === 429) setError("Too many attempts. Please wait and try again.");
      else if (d.betaDisabled) setError("Access is currently closed. Check back later.");
      else setError("This invitation is not valid or is no longer active.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const openAccess = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/beta/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
        return;
      }
      setError("Could not start a session. Please try again.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#F4F7FB] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-[#111726] p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-lg bg-[#00E676] flex items-center justify-center text-[#0A0E1A] font-bold">
              L
            </div>
            <div>
              <div className="font-semibold">Latent.pk</div>
              <div className="text-[11px] text-[#64748B] font-mono">research · shadow-trading</div>
            </div>
          </div>

          <h1 className="text-xl font-semibold mb-1">Sign in</h1>
          <p className="text-sm text-[#94A3B8] mb-6">
            Use your invitation code to access your dashboard.
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-[#FF5C5C]/30 bg-[#FF5C5C]/10 px-3 py-2 text-sm text-[#FF5C5C]">
              {error}
            </div>
          )}

          {!status ? (
            <div className="h-40 animate-pulse rounded-lg bg-white/[0.03]" />
          ) : !status.betaEnabled ? (
            <div className="rounded-lg border border-[#C68A1F]/30 bg-[#C68A1F]/10 px-4 py-3 text-sm text-[#C68A1F]">
              Access is currently closed by the administrator.
            </div>
          ) : status.invitationRequired ? (
            <form onSubmit={redeem}>
              <label className="block text-xs text-[#94A3B8] mb-1.5" htmlFor="invite">
                Invitation code
              </label>
              <input
                id="invite"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="LATENT-XXXXX-XXXXX-XXXXX"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-white/10 bg-[#0A0E1A] px-3 py-2.5 text-sm font-mono tracking-wider uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-[#475569] focus:outline-none focus:ring-2 focus:ring-[#00E676]/40"
              />
              <button
                type="submit"
                disabled={busy || code.trim().length < 8}
                className="mt-4 w-full rounded-lg bg-[#00E676] py-2.5 text-sm font-semibold text-[#0A0E1A] hover:opacity-90 disabled:opacity-40"
              >
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>
          ) : (
            <button
              onClick={openAccess}
              disabled={busy}
              className="w-full rounded-lg bg-[#00E676] py-2.5 text-sm font-semibold text-[#0A0E1A] hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Starting session…" : "Continue"}
            </button>
          )}

          <p className="mt-6 text-[11px] text-[#64748B]">
            Invitations are issued by your administrator. Signing out ends your
            session; you will need an invitation code to sign in again.
          </p>
        </div>
        <p className="mt-4 text-center text-[11px] text-[#475569] font-mono">
          Research &amp; paper-trading only — no real-money execution.
        </p>
      </div>
    </div>
  );
}
