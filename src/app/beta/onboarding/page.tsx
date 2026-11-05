"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useI18n } from "@/lib/latent/i18n";
import { ShieldCheck, ArrowRight, ArrowLeft, RotateCcw } from "lucide-react";

// Task 116 Part G — temporary beta onboarding (6 steps, feature-flagged).
// Progressive disclosure, plain language, back/edit/skip/restart supported.
// Consent is versioned (beta-consent-v1) and accepted explicitly in Step 1.

interface Status {
  betaEnabled: boolean;
  consentVersion: string;
}

export default function BetaOnboarding() {
  const router = useRouter();
  const t = useI18n((st) => st.t);
  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<boolean | null>(null);
  const [f, setF] = useState<Record<string, unknown>>({
    experienceLevel: "",
    objective: "",
    timeHorizon: "",
    lossReaction: "",
    volatilityComfort: "",
    canTolerateLoss: null as boolean | null,
    capitalNeedSoon: null as boolean | null,
    preferredSectors: [] as string[],
    watchlistSymbols: [] as string[],
    showDividends: null as boolean | null,
    shariahScreen: false,
    atlTaxAssumption: true,
    capitalRange: "",
  });

  useEffect(() => {
    fetch("/api/beta/status").then((r) => r.json()).then((d) => setStatus(d));
    fetch("/api/beta/profile").then((r) => r.json()).then((d) => {
      setExisting(!!d.profile);
      if (d.profile) setF((prev) => ({ ...prev, ...d.profile, profileComplete: undefined }));
    });
  }, []);

  const save = async (complete: boolean) => {
    setSaving(true);
    try {
      const res = await fetch("/api/beta/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          consentVersion: status?.consentVersion,
          profileComplete: complete,
        }),
      });
      if (res.ok) router.push(complete ? "/beta" : "");
    } finally {
      setSaving(false);
    }
  };

  if (status === null) {
    return <div className="min-h-screen bg-[#0A0E1A] p-8 text-[#94A3B8]">Loading…</div>;
  }
  if (!status.betaEnabled) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] p-8">
        <Card className="max-w-lg mx-auto bg-[#111726] border-white/10">
          <CardContent className="p-6 text-[#F4F7FB]">
            <p className="font-semibold">{t("beta.onboarding.disabled")}</p>
            <p className="mt-2 text-sm text-[#94A3B8]">The regular Latent.pk application remains fully available.</p>
            <Button className="mt-4" onClick={() => router.push("/")}>{t("beta.onboarding.back_to_app")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const steps: Array<{ title: string; body: React.ReactNode }> = [
    {
      title: "Welcome to the Latent.pk beta",
      body: (
        <div className="space-y-3 text-sm text-[#CBD5E1]">
          <p><b className="text-[#F4F7FB]">What Latent.pk does:</b> it analyzes Pakistan Stock Exchange market information and combines twelve technical strategy components with an AI analyst (GLM-4.6) into one research view.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Research results are <b>still being validated</b> — no strategy has passed independent promotion requirements.</li>
            <li>This beta <b>does not place broker orders</b> — it is investment-intelligence research, not automated trading.</li>
            <li>Outputs are educational/research information, <b>not guaranteed returns</b> and not personalized regulated investment advice.</li>
          </ul>
          <label className="flex items-start gap-2 pt-2 cursor-pointer">
            <Checkbox checked={!!f.consentAccepted} onCheckedChange={(v) => set("consentAccepted", v)} className="mt-0.5" />
            <span className="text-[#F4F7FB]">I have read and accept the beta notice (consent version {status.consentVersion}).</span>
          </label>
        </div>
      ),
    },
    {
      title: "Your experience with investing",
      body: (
        <RadioGroup value={String(f.experienceLevel)} onValueChange={(v) => set("experienceLevel", v)} className="space-y-2">
          {[
            ["new_to_psx", "New to PSX — I want plain-language explanations"],
            ["some_experience", "Some investing experience"],
            ["experienced", "Experienced investor/trader"],
          ].map(([v, label]) => (
            <label key={v} className="flex items-center gap-3 rounded-md border border-white/10 p-3 cursor-pointer hover:bg-white/5">
              <RadioGroupItem value={v} />
              <span className="text-sm text-[#F4F7FB]">{label}</span>
            </label>
          ))}
        </RadioGroup>
      ),
    },
    {
      title: "What are you researching? (optional)",
      body: (
        <RadioGroup value={String(f.objective)} onValueChange={(v) => set("objective", v)} className="space-y-2">
          {[
            ["learn", "Learn about PSX"],
            ["growth_research", "Long-term growth research"],
            ["income_research", "Dividend / income research"],
            ["swing_research", "Swing-trading research"],
            ["monitoring", "General market monitoring"],
          ].map(([v, label]) => (
            <label key={v} className="flex items-center gap-3 rounded-md border border-white/10 p-3 cursor-pointer hover:bg-white/5">
              <RadioGroupItem value={v} />
              <span className="text-sm text-[#F4F7FB]">{label}</span>
            </label>
          ))}
        </RadioGroup>
      ),
    },
    {
      title: "Time horizon and risk understanding",
      body: (
        <div className="space-y-4 text-sm">
          <div>
            <Label className="text-[#94A3B8]">Intended holding period</Label>
            <RadioGroup value={String(f.timeHorizon)} onValueChange={(v) => set("timeHorizon", v)} className="mt-2 space-y-2">
              {[["short", "Days to weeks"], ["medium", "A few months"], ["long", "A year or more"]].map(([v, label]) => (
                <label key={v} className="flex items-center gap-3 rounded-md border border-white/10 p-3 cursor-pointer hover:bg-white/5">
                  <RadioGroupItem value={v} />
                  <span className="text-[#F4F7FB]">{label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div>
            <Label className="text-[#94A3B8]">If an investment falls 20%, what would you most likely do?</Label>
            <RadioGroup value={String(f.lossReaction)} onValueChange={(v) => set("lossReaction", v)} className="mt-2 space-y-2">
              {[["sell", "Sell to prevent further losses"], ["trim", "Trim the position"], ["hold", "Hold and wait"], ["unsure", "Not sure"]].map(([v, label]) => (
                <label key={v} className="flex items-center gap-3 rounded-md border border-white/10 p-3 cursor-pointer hover:bg-white/5">
                  <RadioGroupItem value={v} />
                  <span className="text-[#F4F7FB]">{label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 text-[#F4F7FB]">
              <Checkbox checked={!!f.canTolerateLoss} onCheckedChange={(v) => set("canTolerateLoss", v)} />
              I could tolerate losing some of this capital without it affecting my life.
            </label>
            <label className="flex items-center gap-3 text-[#F4F7FB]">
              <Checkbox checked={!!f.capitalNeedSoon} onCheckedChange={(v) => set("capitalNeedSoon", v)} />
              I may need this capital soon (within ~1 year).
            </label>
          </div>
          <div>
            <Label className="text-[#94A3B8]">Comfort with price volatility</Label>
            <RadioGroup value={String(f.volatilityComfort)} onValueChange={(v) => set("volatilityComfort", v)} className="mt-2 flex gap-3">
              {[["low", "Low"], ["medium", "Medium"], ["high", "High"]].map(([v, label]) => (
                <label key={v} className="flex items-center gap-2 rounded-md border border-white/10 p-2 cursor-pointer">
                  <RadioGroupItem value={v} />
                  <span className="text-[#F4F7FB] text-xs">{label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <p className="text-xs text-[#94A3B8]">
            Willingness to take risk and financial capacity to take risk are kept separate. If answers are incomplete or
            conflict, your profile will show "Profile incomplete" rather than a falsely precise score.
          </p>
        </div>
      ),
    },
    {
      title: "Optional preferences",
      body: (
        <div className="space-y-4 text-sm">
          <div>
            <Label className="text-[#94A3B8]">Watchlist symbols (comma-separated, e.g. LUCK, HUBC, SYS)</Label>
            <Input
              className="mt-2 bg-white/5 border-white/10 text-[#F4F7FB]"
              placeholder="LUCK, HUBC"
              onChange={(e) =>
                set("watchlistSymbols", e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 30))
              }
            />
            <p className="mt-1 text-xs text-[#94A3B8]">Used to personalize your research view. We never auto-recommend securities from your profile.</p>
          </div>
          <label className="flex items-center gap-3 text-[#F4F7FB]">
            <Checkbox checked={!!f.showDividends} onCheckedChange={(v) => set("showDividends", v)} />
            Show dividend-related information
          </label>
          <label className="flex items-start gap-3 text-[#F4F7FB]">
            <Checkbox checked={!!f.shariahScreen} onCheckedChange={(v) => set("shariahScreen", v)} className="mt-0.5" />
            <span>Apply an optional Shariah-screening preference. This uses a stated methodology with a source as-of date — it never infers your religion and makes no compliance claim.</span>
          </label>
          <label className="flex items-start gap-3 text-[#F4F7FB]">
            <Checkbox checked={!!f.atlTaxAssumption} onCheckedChange={(v) => set("atlTaxAssumption", v)} className="mt-0.5" />
            <span>Use ATL (filer) tax assumptions for illustrative cost estimates.</span>
          </label>
          <div>
            <Label className="text-[#94A3B8]">Optional capital range (only if you want size-aware illustrations)</Label>
            <RadioGroup value={String(f.capitalRange)} onValueChange={(v) => set("capitalRange", v)} className="mt-2 flex flex-wrap gap-2">
              {["Under 100k", "100k–500k", "500k–1M", "1M+", ""].map((v) => (
                <label key={v || "skip"} className="flex items-center gap-2 rounded-md border border-white/10 p-2 cursor-pointer">
                  <RadioGroupItem value={v} />
                  <span className="text-[#F4F7FB] text-xs">{v || "Prefer not to say"}</span>
                </label>
              ))}
            </RadioGroup>
            <p className="mt-1 text-xs text-[#94A3B8]">Optional and coarse — exact amounts are never required to use the beta. Nothing is shared beyond your own session.</p>
          </div>
        </div>
      ),
    },
    {
      title: "Your profile summary",
      body: (
        <div className="space-y-3 text-sm text-[#CBD5E1]">
          <div className="rounded-md border border-white/10 p-3 space-y-1">
            <p><b className="text-[#F4F7FB]">Experience:</b> {String(f.experienceLevel) || "—"} · <b className="text-[#F4F7FB]">Objective:</b> {String(f.objective) || "—"} · <b className="text-[#F4F7FB]">Horizon:</b> {String(f.timeHorizon) || "—"}</p>
            <p><b className="text-[#F4F7FB]">Risk:</b> loss reaction {String(f.lossReaction) || "—"} · volatility {String(f.volatilityComfort) || "—"} · can tolerate loss {f.canTolerateLoss === null ? "—" : f.canTolerateLoss ? "yes" : "no"} · capital needed soon {f.capitalNeedSoon === null ? "—" : f.capitalNeedSoon ? "yes" : "no"}</p>
            <p><b className="text-[#F4F7FB]">Preferences:</b> watchlist {(f.watchlistSymbols as string[]).join(", ") || "—"} · dividends {f.showDividends ? "on" : "off"} · Shariah screen {f.shariahScreen ? "on" : "off"}</p>
          </div>
          <p className="text-xs text-[#94A3B8]">
            This profile adjusts explanations and which information is emphasized. It does NOT produce a guaranteed asset
            allocation or an instruction to buy any security. You can edit or restart it anytime. Profile is saved server-side
            against an anonymous cookie — "Saved on this device", not synced across devices.
          </p>
          <Button onClick={() => save(true)} disabled={saving || !f.consentAccepted} className="w-full bg-[#0E6E52] hover:bg-[#0A4E3A] text-white font-semibold">
            {saving ? t("beta.common.saving") : t("beta.onboarding.enter")}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      ),
    },
  ];

  const canNext = step !== 0 || !!f.consentAccepted;

  return (
    <div className="min-h-screen bg-[#0A0E1A] px-4 py-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="h-5 w-5 text-[#22E881]" />
          <div className="h-1.5 flex-1 rounded bg-white/10">
            <div className="h-1.5 rounded bg-[#0E6E52] transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <span className="text-xs text-[#94A3B8]">{step + 1}/{steps.length}</span>
        </div>
        <Card className="bg-[#111726] border-white/10">
          <CardContent className="p-6">
            <h1 className="text-xl font-bold text-[#F4F7FB] mb-4">{steps[step].title}</h1>
            {steps[step].body}
            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> {t("beta.common.back")}
              </Button>
              <div className="flex gap-2">
                {existing && (
                  <Button variant="ghost" size="sm" onClick={async () => { await fetch("/api/beta/profile", { method: "DELETE" }); setF({}); setExisting(false); setStep(0); }}>
                    <RotateCcw className="h-4 w-4 mr-1" /> {t("beta.common.restart")}
                  </Button>
                )}
                {step > 0 && step < steps.length - 1 && (
                  <Button variant="outline" onClick={() => setStep((s) => s + 1)}>{t("beta.common.skip")}</Button>
                )}
                {step < steps.length - 1 && (
                  <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)} className="bg-[#0E6E52] hover:bg-[#0A4E3A] text-white">
                    Next
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
