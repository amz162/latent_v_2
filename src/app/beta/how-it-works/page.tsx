"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/latent/i18n";
import { BookOpen, BrainCircuit, ShieldAlert } from "lucide-react";

// Task 117 Part I2/I3 — beginner-friendly explanations. Plain language first;
// no strategy is presented as a trade recommendation; regime/context gates are
// explicitly NOT signals. Content mirrors STRATEGY_INVENTORY semantics.

interface ComponentDoc {
  id: string;
  name: string;
  measures: string;
  role: string;
  votes: boolean;
  unavailableWhy: string;
  limitation: string;
}

const COMPONENTS: ComponentDoc[] = [
  {
    id: "golden_cross",
    name: "Golden Cross (SMA 7/30)",
    measures: "Whether the short 7-session average price has crossed above (bullish) or below (bearish) the longer 30-session average — a smoothed view of trend direction.",
    role: "Directional trend component.",
    votes: true,
    unavailableWhy: "Fewer than ~30 verified sessions of history for the symbol.",
    limitation: "Moving averages lag: by the time a cross appears, part of the move has already happened. In sideways markets it whipsaws.",
  },
  {
    id: "macd",
    name: "MACD",
    measures: "The gap between two moving averages (and its own signal line) — momentum: is the trend strengthening or fading?",
    role: "Directional momentum component.",
    votes: true,
    unavailableWhy: "Insufficient history for its 26-session slow average.",
    limitation: "Also lagging; gives false reversals in choppy, low-volume PSX names.",
  },
  {
    id: "rsi_divergence",
    name: "RSI Divergence",
    measures: "Cases where price makes a new high/low but the RSI momentum gauge does not — a warning that a move may be exhausting.",
    role: "Directional reversal-warning component.",
    votes: true,
    unavailableWhy: "No clean swing high/low structure in the recent window.",
    limitation: "Divergences can persist for weeks before (or without) any reversal — 'early' often means 'wrong'.",
  },
  {
    id: "zscore_mean_reversion",
    name: "Z-Score Mean Reversion",
    measures: "How many standard deviations today's price sits from its rolling average — statistically stretched or cheap?",
    role: "Directional mean-reversion component.",
    votes: true,
    unavailableWhy: "Insufficient history to estimate a stable mean and deviation.",
    limitation: "In a genuine downtrend, 'cheap' keeps getting cheaper. Works only while prices really do oscillate.",
  },
  {
    id: "ornstein_uhlenbeck",
    name: "Ornstein-Uhlenbeck Spread",
    measures: "Whether a pair of related stocks (e.g. LUCK/DGKC) keeps reverting to a stable spread, and how fast.",
    role: "Pairs context — used to describe spread regime, never as a standalone signal.",
    votes: false,
    unavailableWhy: "The partner symbol lacks verified history, or the spread is not statistically stationary.",
    limitation: "A spread that was stable for years can break permanently (structural change) — reversion assumptions fail exactly when money is at risk.",
  },
  {
    id: "linear_regression_channel",
    name: "Linear Regression Channel",
    measures: "A straight-line fit through recent prices with parallel bands — is price respecting a trend channel or breaking out of it?",
    role: "Directional trend-context component.",
    votes: true,
    unavailableWhy: "Poor linear fit (low R²) — the window has no usable channel.",
    limitation: "Straight lines rarely describe markets for long; channels break without warning.",
  },
  {
    id: "pairs_kalman",
    name: "Pairs Kalman",
    measures: "An adaptive statistical estimate of the evolving relationship between two related stocks and how far the pair has drifted from it.",
    role: "Pairs context — same restrictions as Ornstein-Uhlenbeck.",
    votes: false,
    unavailableWhy: "Partner history insufficient, or adaptive hedge ratio unstable.",
    limitation: "Model adapts with a lag; in fast regime changes the 'fair spread' it shows is already outdated.",
  },
  {
    id: "variance_ratio",
    name: "Variance Ratio",
    measures: "Whether price moves compound randomly or trend / mean-revert statistically across multi-session horizons.",
    role: "Regime gate — shapes how other signals are interpreted; does NOT vote direction.",
    votes: false,
    unavailableWhy: "Insufficient sessions for a stable multi-horizon variance estimate.",
    limitation: "Statistical tests on noisy financial data are weak; the regime label can flip with one new session.",
  },
  {
    id: "hurst_exponent",
    name: "Hurst Exponent",
    measures: "A single number (0.5 = random walk) summarizing whether a symbol has historically trended (<0.5 mean-reverting, >0.5 trending).",
    role: "Regime gate — context only, never a directional vote.",
    votes: false,
    unavailableWhy: "Window too short for a reliable estimate.",
    limitation: "Small-sample Hurst estimates are notoriously unstable; treat as a soft hint, not a fact.",
  },
  {
    id: "autocorrelation",
    name: "Autocorrelation",
    measures: "Whether today's return has any statistical relationship with yesterday's, or the last few days'.",
    role: "Regime gate — context only.",
    votes: false,
    unavailableWhy: "Insufficient return history.",
    limitation: "Significant autocorrelation often disappears out-of-sample; transaction costs erase tiny edges.",
  },
  {
    id: "donchian_atr_breakout",
    name: "Donchian + ATR Breakout",
    measures: "Price breaking above/below its N-session high/low range, sized against recent volatility (ATR).",
    role: "Directional breakout component.",
    votes: true,
    unavailableWhy: "Window shorter than the Donchian lookback.",
    limitation: "Most breakouts fail and reverse; this component is right when trends run and bleeds when they don't.",
  },
  {
    id: "bollinger_bandwidth_regime",
    name: "Bollinger Band Width Regime",
    measures: "Whether volatility is compressed (quiet) or expanded (violent) relative to its own history.",
    role: "Regime gate — describes market condition; does NOT vote direction.",
    votes: false,
    unavailableWhy: "Insufficient history for the rolling bands.",
    limitation: "Compression can persist far longer than expected; expansion direction is not implied.",
  },
];

export default function HowItWorks() {
  const t = useI18n((s) => s.t);
  return (
    <div className="min-h-screen bg-[#0A0E1A] px-4 md:px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-[#F4F7FB] flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#22E881]" /> How Latent works
          </h1>
          <Link href="/beta"><Button size="sm" variant="outline">{t("beta.common.back")}</Button></Link>
        </div>

        <div className="rounded-lg border border-[#8F630F]/40 bg-[#8F630F]/10 p-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-[#C68A1F]" />
            <p className="text-sm font-semibold text-[#F4F7FB]">{t("beta.dashboard.banner")}</p>
          </div>
          <p className="mt-1 text-xs text-[#94A3B8]">{t("beta.dashboard.banner_sub")}</p>
        </div>

        <Card className="bg-[#111726] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#F4F7FB]">The one-paragraph version</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-[#CBD5E1] space-y-2">
            <p>
              Latent.pk looks at publicly available Pakistan Stock Exchange price history. Twelve statistical
              strategy components each form their own opinion from verified daily bars. A transparent fusion step
              counts only the components that are allowed to vote direction; gates that merely describe market
              conditions never vote. If enough eligible components agree, the screen shows a research state such
              as BULLISH_ALIGNMENT — this is a description of the evidence, not advice and not an order.
            </p>
            <p>
              Separately, an AI analyst (GLM-4.6) reads stored evidence snapshots and writes its own research
              verdict. Where the AI agrees or disagrees with the strategy screen, the disagreement is shown
              honestly. Nothing here has been proven to make money: research is still being validated, and you
              remain responsible for any decision you make.
            </p>
          </CardContent>
        </Card>

        <h2 className="text-lg font-semibold text-[#F4F7FB] pt-2">The twelve components</h2>
        <div className="grid md:grid-cols-2 gap-3">
          {COMPONENTS.map((c) => (
            <Card key={c.id} className="bg-[#111726] border-white/10">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm flex items-center justify-between text-[#F4F7FB]">
                  <span>{c.name}</span>
                  {c.votes ? (
                    <Badge className="bg-[#0E6E52] text-[10px]">votes direction</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">context / regime only</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1.5">
                <p className="text-[#CBD5E1]"><b className="text-[#F4F7FB]">What it measures:</b> {c.measures}</p>
                <p className="text-[#94A3B8]"><b className="text-[#CBD5E1]">Current role:</b> {c.role}</p>
                <p className="text-[#94A3B8]"><b className="text-[#CBD5E1]">Why it may be unavailable:</b> {c.unavailableWhy}</p>
                <p className="text-[#C68A1F]"><b>Key limitation:</b> {c.limitation}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-[#111726] border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-[#F4F7FB]">
              <BrainCircuit className="h-4 w-4 text-[#22E881]" /> The AI analyst (GLM-4.6)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-[#CBD5E1] space-y-2">
            <p>
              <b className="text-[#F4F7FB]">What it is:</b> a large language model that reads a stored evidence
              snapshot (verified price facts, patterns, news) and writes a research decision — BUY / NO_TRADE /
              HOLD — with a conviction score and a written reason.
            </p>
            <p>
              <b className="text-[#F4F7FB]">What it is NOT:</b> it is not a thirteenth vote inside the strategy
              fusion, it is not a probability of success, and its conviction is <b>uncalibrated</b> — the number
              has never been checked against real outcomes at scale.
            </p>
            <p>
              <b className="text-[#F4F7FB]">Honesty rules:</b> decisions are stored immutably before outcomes are
              known; if the AI and the strategy screen disagree, you see the conflict, never an average; if no AI
              decision exists for a symbol, the panel says so instead of inventing one.
            </p>
            <p className="text-[#C68A1F]">
              <b>Key limitation:</b> zero matured LLM-cohort forward outcomes exist (as of the Task 115
              checkpoint), so there is no performance evidence for the AI layer at all.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#111726] border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[#F4F7FB]">What you will never see here</CardTitle></CardHeader>
          <CardContent className="text-xs text-[#94A3B8] space-y-1">
            <p>· No guaranteed-return language, no success-rate badges without evidence.</p>
            <p>· No order placement, no broker connection, no automatic trading.</p>
            <p>· No composite &quot;risk score&quot; for your profile — willingness and capacity are shown separately and honestly.</p>
            <p>· No claim that Latent.pk is a licensed broker or investment adviser.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
