# Task 111 — National and International News Intelligence

Module: `src/lib/latent/news/market-news-intelligence.ts`.

## Three categories

- **Company news** — `api.askanalyst.com.pk/api/news/{symbol}` (the platform's existing integration), cached 12h.
- **National (Pakistan)** — monetary policy, SBP, inflation, IMF, PKR, energy tariffs, circular debt, budget — via
  `functions.web_search` snapshots through the authorized z-ai SDK (retrieval-only), cached 12h.
- **International** — global rates, oil, commodities, FX, risk sentiment, geopolitical events affecting Pakistan — same mechanism.

## Source registry

`task111_news_source_registry.json` records source ID, publisher, domain, country, category, reliability
(`aggregator` for askanalyst; `unverified` for web-search snapshots), retrieval method, licensing/access status.
No paid services were added; no paywalls bypassed; no restricted scraping; rate limits respected via disk caching.

## Record format

Every item carries headline, publisher, URL (where available), publication datetime (null when unverified — never
guessed), retrieval datetime, event datetime (null when distinct time unknown), language, country, companies/symbols/
sectors, event category, sanitized summary, sentiment (bullish/bearish/neutral/mixed/uncertain), materiality,
horizon, reliability, corroborating sources (distinct publishers only), conflicting coverage, data-quality state.

## Integrity rules

- **No news found is NOT positive news** — missing categories are recorded `unavailable` in the evidence package.
- Syndicated duplicates are detected by headline hash and never counted as independent corroboration
  (`task111_news_integrity_report.json`).
- Positive sentiment is not a positive-return forecast; classification is a deterministic lexicon plus optional LLM annotation.
- Publication-timestamp policy: without a verified publication time an item is unusable for historical point-in-time
  testing; retrieval timestamps are always recorded.

## Prompt-injection defense

Article text is untrusted input. HTML/control characters are stripped, length is capped, and instruction-like payloads
("ignore previous instructions", "reveal your system prompt", credential-exfiltration patterns, script tags) are detected
and flagged (`injectionFlagged`); flagged items keep `dataQualityState: unverified`. The system prompt forbids following
instructions embedded in articles. Injection vectors are covered in `scripts/task111_tests.py` and
`task111_news_injection_tests.json`.
