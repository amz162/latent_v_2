# Task 106 — Long-Only and Sell Policy

## The four concepts (never conflated)

| Concept | Meaning | Allowed? |
| --- | --- | --- |
| `SELL_TO_CLOSE` | Selling an existing long position | Yes — always permissible |
| `BEARISH_SIGNAL` | Model expects negative direction (an opinion) | Displayed as an opinion |
| `BEARISH_RESEARCH_ONLY` | Bearish entries inside research/hypothetical simulation | Yes, labeled hypothetical |
| `SHORT_ENTRY` | Opening a genuine short position | **Disabled** (`compliance_unverified`) |

`src/lib/latent/trading-policy.ts` implements `classifySellAction()`. Exhaustive fixture tests (`task106_sell_semantics_tests.json`, 23 cases) prove that **no input combination yields `SHORT_ENTRY`** while compliance is unverified, that a SELL input can never be inverted into a BUY, and that the historical short-side research simulation still executes (labeled hypothetical).

## Research basis (2026-11-02)

- A licensed PSX brokerage's own glossary states retail investors **generally cannot short shares directly in the ready market**; blank sales are a closely-controlled exception (https://www.bsl.com.pk/glossary/short-selling).
- The NCCPL SLB mechanism (Category A short-selling eligible securities since 2015) exists, but its participant eligibility for this application's users could not be verified (circular PDF returns HTTP 403; snippet-only evidence).
- Single-stock deliverable futures permit shorts with limited eligible contracts — the application has no futures pathway.

**Verdict: `compliance_unverified` → long-only default.** Reversal requires verified eligibility documentation for the intended account type plus a compliant execution pathway plus an explicit policy version bump.

## Where this is enforced

- Policy module (`classifySellAction`) — the single decision point.
- AI Models UI: SELL badges render as **`SELL·R`** with a policy-driven tooltip ("Bearish — research/hypothetical only — compliance: compliance_unverified").
- Investment Simulator and strategy engine keep SELL capability for research simulation only, disclosed by the capital-protection notice.
- Shadow observations: long-candidate only.
- Historical SELL signals and short-side research results are preserved, never deleted, never converted into BUY predictions.
