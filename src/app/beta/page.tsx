"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/latent/i18n";
import { Activity, BrainCircuit, ShieldAlert, TrendingUp, Layers, RefreshCw, Eye } from "lucide-react";

// Task 116 Part H — one clean beta dashboard.
// Sections: Market Overview · Your Beta Research View · Stocks to Watch ·
// Strategy Breakdown · LLM Analyst · Risk & Education.
// Progressive disclosure: the default view shows one honest state + warnings;
// the advanced toggle reveals all 12 strategy outputs and methodology.
// "One honest number beats ten confusing ones."

interface StrategyRow {
  strategyId: string;
  strategyName: string;
  role: string;
  direction: string;
  validationStatus: string;
  eligibility: string;
  reason: string;
  sourceBarDate?: string;
  methodVersion?: string;
  rawScore?: number | null;
}

interface Fusion {
  state: string;
  stateReason: string;
  eligibleDirectional: number;
  alignedCount: number;
  alignmentLabel: string;
  familiesRepresented: number;
  excluded: Array<{ strategyId: string; status: string; reason: string }>;
  pairContext: string | null;
  regimeFlags: string[];
  familyBreakdown: Array<{ family: string; votes: number; positive: number; negative: number; cap: number }>;
}

interface SymbolInsight {
  symbol: string;
  available: boolean;
  reason?: string;
  fusion?: Fusion;
  strategies?: StrategyRow[];
  llm?: { decision: string; model: string; convictionLabel: string; convictionScore: number | null; reason: string | null; evidenceHash: string | null; note: string; dataCutoff: string } | null;
  llmAgreement?: { agreement: string; label: string; detail: string };
  risk?: { policyId: string; entryReference: number; stopLoss: number; takeProfits: number[]; atr14: number; warning: string } | null;
  evidenceQuality?: { sourceBarDate: string; barsUsed: number; dataFrontier: string | null; barFreshnessDays: number | null };
}

interface InsightResponse {
  meta: {
    generatedAt: string;
    dataFrontier: string | null;
    totalVerifiedBars: number;
    provider: Record<string, unknown>;
    warnings: string[];
    researchFacts: { gen1Checkpoint: string; llmMaturity: string };
    strategyInventory: Array<{ strategyId: string; strategyName: string; role: string; family: string; votesInFusion: boolean; restrictions: string }>;
  };
  perSymbol: SymbolInsight[];
}

const STATE_STYLES: Record<string, string> = {
  BULLISH_ALIGNMENT: "text-[#22E881] border-[#22E881]/40 bg-[#22E881]/5",
  BEARISH_PRESSURE: "text-[#FF5C5C] border-[#FF5C5C]/40 bg-[#FF5C5C]/5",
  MIXED_EVIDENCE: "text-[#C68A1F] border-[#C68A1F]/40 bg-[#C68A1F]/5",
  INSUFFICIENT_DATA: "text-[#94A3B8] border-white/10 bg-white/5",
  STALE_DATA: "text-[#94A3B8] border-white/10 bg-white/5",
  REGIME_UNCLEAR: "text-[#C68A1F] border-[#C68A1F]/40 bg-[#C68A1F]/5",
  PAIR_CONTEXT_ONLY: "text-[#94A3B8] border-white/10 bg-white/5",
};

export default function BetaDashboard() {
  const router = useRouter();
  const t = useI18n((s) => s.t);
  const [data, setData] = useState<InsightResponse | null>(null);
  const [profile, setProfile] = useState<{ watchlistSymbols: string[]; profileComplete: boolean; riskUnderstanding?: { status: string } } | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/beta/profile")
      .then((r) => r.json())
      .then((d) => {
        setProfile(d.profile);
        const wl = d.profile?.watchlistSymbols?.length ? d.profile.watchlistSymbols.join(",") : "";
        return fetch(`/api/beta/insight${wl ? `?symbols=${encodeURIComponent(wl)}` : ""}`);
      })
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch("/api/beta/status").then((r) => r.json()).then((d) => {
      if (!d.betaEnabled) { router.push("/"); return; }
    });
    fetch("/api/beta/profile").then((r) => r.json()).then((d) => {
      if (!d.profile?.profileComplete) { router.push("/beta/onboarding"); return; }
    });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0E1A] px-4 md:px-6 py-6">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* permanent beta banner */}
        <div className="rounded-lg border border-[#8F630F]/40 bg-[#8F630F]/10 p-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#C68A1F]" />
            <p className="text-sm font-semibold text-[#F4F7FB]">{t("beta.dashboard.banner")}</p>
          </div>
          <p className="mt-1 text-xs text-[#94A3B8]">{t("beta.dashboard.banner_sub")}</p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-[#F4F7FB]">{t("beta.dashboard.title")}</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-[#94A3B8]">
              <Eye className="h-3.5 w-3.5" /> {t("beta.dashboard.advanced")}
              <Switch checked={advanced} onCheckedChange={setAdvanced} />
            </label>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={"h-3.5 w-3.5 mr-1" + (loading ? " animate-spin" : "")} /> {t("beta.common.refresh")}
            </Button>
          </div>
        </div>

        {loading && <Card className="bg-[#111726] border-white/10"><CardContent className="p-8 text-center text-[#94A3B8]">Computing 12-strategy fusion…</CardContent></Card>}

        {data && (
          <>
            {/* 1. Market Overview */}
            <Card className="bg-[#111726] border-white/10">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-[#F4F7FB]"><Activity className="h-4 w-4 text-[#22E881]" /> {t("beta.dashboard.market_overview")}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="rounded-md border bg-white/[0.03] p-2"><div className="text-[#94A3B8]">{t("beta.dashboard.data_frontier")}</div><div className="font-mono text-[#F4F7FB]">{data.meta.dataFrontier ?? "—"}</div></div>
                <div className="rounded-md border bg-white/[0.03] p-2"><div className="text-[#94A3B8]">{t("beta.dashboard.verified_bars")}</div><div className="font-mono text-[#F4F7FB]">{data.meta.totalVerifiedBars.toLocaleString()}</div></div>
                <div className="rounded-md border bg-white/[0.03] p-2"><div className="text-[#94A3B8]">{t("beta.dashboard.provider")}</div><div className="text-[#F4F7FB]">{String(data.meta.provider.status ?? "—")}</div></div>
                <div className="rounded-md border bg-white/[0.03] p-2"><div className="text-[#94A3B8]">{t("beta.dashboard.last_update")}</div><div className="font-mono text-[#F4F7FB]">{new Date(data.meta.generatedAt).toLocaleTimeString()}</div></div>
              </CardContent>
            </Card>

            {/* research facts (always visible) */}
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-[#94A3B8]">
                <p className="font-semibold text-[#F4F7FB] mb-1">{t("beta.dashboard.research_facts")}</p>
                <p>{data.meta.researchFacts.gen1Checkpoint}</p>
                <p className="mt-1">{data.meta.researchFacts.llmMaturity}</p>
              </div>
              {profile?.riskUnderstanding?.status !== "consistent" && (
                <div className="rounded-lg border border-[#C68A1F]/40 bg-[#C68A1F]/10 p-3 text-xs">
                  <p className="font-semibold text-[#F4F7FB]">{t("beta.dashboard.profile_incomplete")}</p>
                  <p className="mt-1 text-[#94A3B8]">{t("beta.dashboard.profile_incomplete_sub")}</p>
                  <Link href="/beta/onboarding" className="mt-2 inline-block text-[#22E881] underline text-xs">{t("beta.dashboard.review_profile")}</Link>
                </div>
              )}
            </div>

            {/* 2 + 3. Research view / Stocks to Watch (one card per symbol) */}
            <div className="grid md:grid-cols-2 gap-3">
              {(data.perSymbol ?? []).map((s) => (
                <Card key={s.symbol} className="bg-[#111726] border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between text-[#F4F7FB]">
                      <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-[#22E881]" /> {s.symbol}</span>
                      {s.available && s.fusion && (
                        <Badge variant="outline" className={"font-mono text-[10px] " + (STATE_STYLES[s.fusion.state] ?? "text-[#94A3B8]")}>{s.fusion.state}</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    {!s.available ? (
                      <p className="text-[#94A3B8]">{s.reason}</p>
                    ) : (
                      <>
                        <p className="text-[10px] font-mono text-[#22E881]">{s.fusion?.alignmentLabel} · {s.fusion?.familiesRepresented} families</p>
                        <p className="text-[#CBD5E1]">{s.fusion?.stateReason}</p>
                        {s.llmAgreement && (
                          <div className={"rounded-md border p-2 " + (s.llmAgreement.agreement === "conflicts" ? "border-[#FF5C5C]/40 bg-[#FF5C5C]/5" : "border-white/10 bg-white/[0.03]")}>
                            <p className="text-[10px] font-semibold text-[#F4F7FB]">{t("beta.dashboard.llm_agreement")}: {s.llmAgreement.label}</p>
                            <p className="mt-1 text-[#94A3B8]">{s.llmAgreement.detail}</p>
                          </div>
                        )}
                        {s.risk && (
                          <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                            <p className="text-[10px] text-[#94A3B8] font-mono">SL {s.risk.stopLoss?.toFixed(2)} · TP1/2/3 {s.risk.takeProfits.map((x) => x?.toFixed(2)).join(" / ")} <span className="text-[#C68A1F]">({s.risk.policyId})</span></p>
                            <p className="mt-1 text-[10px] text-[#C68A1F]">{t("beta.dashboard.not_an_order")}</p>
                          </div>
                        )}
                        {advanced && s.strategies && (
                          <details className="rounded-md border border-white/10 bg-white/[0.02] p-2">
                            <summary className="cursor-pointer text-[11px] text-[#94A3B8]">{t("beta.dashboard.strategy_breakdown")} ({s.strategies.length})</summary>
                            <div className="mt-2 space-y-1.5">
                              {s.strategies.map((st) => (
                                <div key={st.strategyId} className="border-t border-white/5 pt-1.5 first:border-0 first:pt-0">
                                  <p className="text-[11px] text-[#F4F7FB]">
                                    {st.strategyName} · <span className="text-[#94A3B8]">{st.role}</span>
                                    {st.validationStatus !== "active" && <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">{st.validationStatus}</Badge>}
                                  </p>
                                  <p className="text-[10px] text-[#94A3B8]">{st.reason}</p>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 4. Strategy inventory (advanced) */}
            {advanced && (
              <Card className="bg-[#111726] border-white/10">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-[#F4F7FB]"><Layers className="h-4 w-4 text-[#22E881]" /> {t("beta.dashboard.strategy_inventory")}</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead><tr className="border-b text-[#94A3B8]"><th className="py-1.5 pr-2">Strategy</th><th className="pr-2">Role</th><th className="pr-2">Family</th><th className="pr-2">Votes</th><th className="pr-2">Restrictions</th></tr></thead>
                      <tbody>
                        {data.meta.strategyInventory.map((m) => (
                          <tr key={m.strategyId} className="border-b border-white/5">
                            <td className="py-1.5 pr-2 text-[#F4F7FB]">{m.strategyName}</td>
                            <td className="pr-2 text-[#94A3B8]">{m.role}</td>
                            <td className="pr-2 text-[#94A3B8]">{m.family}</td>
                            <td className="pr-2">{m.votesInFusion ? <Badge className="bg-[#0E6E52] text-[10px]">yes</Badge> : <Badge variant="outline" className="text-[10px]">no</Badge>}</td>
                            <td className="pr-2 text-[#94A3B8]">{m.restrictions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 5 + 6. LLM analyst + education links */}
            <div className="grid md:grid-cols-2 gap-3">
              <Card className="bg-[#111726] border-white/10">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-[#F4F7FB]"><BrainCircuit className="h-4 w-4 text-[#22E881]" /> {t("beta.dashboard.llm_analyst")}</CardTitle></CardHeader>
                <CardContent className="text-xs text-[#94A3B8] space-y-1">
                  <p>{t("beta.dashboard.llm_role")}</p>
                  <Link href="/" className="inline-block mt-1 text-[#22E881] underline">{t("beta.dashboard.open_llm_signals")}</Link>
                  <p className="font-mono text-[10px]">{t("beta.dashboard.llm_uncalibrated")}</p>
                </CardContent>
              </Card>
              <Card className="bg-[#111726] border-white/10">
                <CardHeader className="pb-2"><CardTitle className="text-sm text-[#F4F7FB]">{t("beta.dashboard.risk_education")}</CardTitle></CardHeader>
                <CardContent className="text-xs text-[#94A3B8] space-y-1">
                  <p>{t("beta.dashboard.risk_education_body")}</p>
                  <p>{data.meta.warnings[1]}</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
