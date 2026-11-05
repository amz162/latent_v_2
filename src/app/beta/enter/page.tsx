"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/latent/i18n";
import { KeyRound, ShieldAlert } from "lucide-react";

// Task 117 Part C — invitation gate. The beta is invite-only: a valid code
// (created by the operator CLI, stored server-side as a hash) is required to
// create a beta profile. All failures show ONE generic message — the user can
// never tell whether a code was invalid, expired, revoked or exhausted.

interface Gate {
  betaEnabled: boolean;
  betaDisabledReason: string | null;
  operatorNote: string | null;
  registrationsPaused: boolean;
  invitationRequired: boolean;
}

export default function BetaEnter() {
  const router = useRouter();
  const t = useI18n((s) => s.t);
  const [gate, setGate] = useState<Gate | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/beta/status")
      .then((r) => r.json())
      .then((d: Gate) => setGate(d));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/beta/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.redeemed) {
        router.push(d.next ?? "/beta/onboarding");
        return;
      }
      if (d.betaDisabled) {
        setError(d.message ?? t("beta.enter.closed"));
        return;
      }
      setError(d.message ?? t("beta.enter.invalid"));
    } catch {
      setError(t("beta.enter.invalid"));
    } finally {
      setBusy(false);
    }
  };

  if (gate === null) {
    return <div className="min-h-screen bg-[#0A0E1A] p-8 text-[#94A3B8]">Loading…</div>;
  }

  if (!gate.betaEnabled) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-6">
        <Card className="max-w-lg w-full bg-[#111726] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-[#F4F7FB]">
              <ShieldAlert className="h-4 w-4 text-[#C68A1F]" /> {t("beta.enter.closed_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-[#94A3B8]">
            <p>{gate.operatorNote || t("beta.enter.closed")}</p>
            <p className="text-xs">{t("beta.onboarding.app_available")}</p>
            <Button size="sm" variant="outline" onClick={() => router.push("/")}>{t("beta.onboarding.back_to_app")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gate.invitationRequired) {
    // operator disabled the invite requirement: go straight to onboarding
    router.push("/beta/onboarding");
    return <div className="min-h-screen bg-[#0A0E1A] p-8 text-[#94A3B8]">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-6">
      <Card className="max-w-md w-full bg-[#111726] border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-[#F4F7FB]">
            <KeyRound className="h-4 w-4 text-[#22E881]" /> {t("beta.enter.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p className="text-[#94A3B8]">{t("beta.enter.subtitle")}</p>
          <form onSubmit={submit} className="space-y-3">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="LATENT-XXXXX-XXXXX-XXXXX"
              className="bg-[#0A0E1A] border-white/10 text-[#F4F7FB] font-mono"
              autoFocus
              maxLength={64}
            />
            {error && (
              <div className="rounded-md border border-[#FF5C5C]/40 bg-[#FF5C5C]/5 p-2.5">
                <p className="text-xs text-[#F4F7FB]">{error}</p>
                <p className="mt-1 text-xs text-[#94A3B8]" dir="rtl">{t("beta.enter.invalid_urdu")}</p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy || code.trim().length < 8}>
              {busy ? "…" : t("beta.enter.submit")}
            </Button>
          </form>
          <p className="text-[11px] text-[#94A3B8]">
            {t("beta.enter.privacy_note")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
