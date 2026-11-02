"use client";
/**
 * Task 105 — Capital Protection Notice.
 * Displays the model/strategy disposition (research/shadow/no-trade) with
 * factual, non-alarmist wording. Used on AI-model signal surfaces and
 * strategy pages so no signal is presented as a validated profitable system.
 */
import { CAPITAL_PROTECTION_POLICY } from "@/lib/latent/trading-policy";

export function CapitalProtectionNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="note"
      data-testid="capital-protection-notice"
      className={
        "rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-200/90"
        + (compact ? "" : " mb-3")
      }
    >
      <span className="font-semibold">Research / shadow mode — not trading advice. </span>
      {CAPITAL_PROTECTION_POLICY.historicalEvidenceNote} Historical win rates
      shown are simulation outcomes, and confidence scores are model agreement
      indicators, not verified win probabilities. Short-sell signals are
      research displays; PSX retail short-selling rights are not verified by
      this platform.
    </div>
  );
}
