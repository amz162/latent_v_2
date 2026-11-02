/**
 * Task 102 — point-in-time leakage tests (spec Phase 3 + Phase 16).
 * Drives getFundamentalsAsOf() with synthetic fixtures covering every required
 * case; also asserts the genuine-KSE-100 as-of discipline while the source is
 * blocked. Writes data/backtest_reports/task102/task102_pit_leakage_tests.json
 * Run: bun scripts/task102_pit_tests.ts
 */
import * as fs from "fs";
import {
  getFundamentalsAsOf, filingToPitRecord, conservativePublicationInstant,
  type PitFundamentalRecord,
} from "../src/lib/fundamentals/point-in-time";
import { getKse100AsOf, kse100Status } from "../src/lib/market-data/kse100-provider";

let pass = 0, fail = 0;
const results: any[] = [];
function check(id: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  ok  ${id}`); }
  else { fail++; console.log(`FAIL  ${id} ${detail}`); }
  results.push({ id, pass: ok, detail });
}

const rec = (sym: string, pubDate: string, vals: Record<string, number>,
             amended = false, amendIso: string | null = null): PitFundamentalRecord => ({
  ...filingToPitRecord({ symbol: sym, filingDate: pubDate, filingType: "quarterly_accounts",
                          isAmended: amended, amendmentDatetime: amendIso }),
  values: vals,
});

const SYM = "TEST";
// v1 published 2025-01-10; amended version announced 2025-02-20
const v1 = rec(SYM, "2025-01-10", { eps: 10 });
const v2amended = { ...rec(SYM, "2025-01-10", { eps: 12 }, true, "2025-02-20T12:00:00.000Z"),
                     periodEnd: null };
const early = rec(SYM, "2024-12-02", { eps: 8 });
const late = rec(SYM, "2025-06-30", { eps: 99 });       // announced after decisions below
const noTs: PitFundamentalRecord = { ...rec(SYM, "2025-03-01", { eps: 50 }),
  publicationDatetime: null, dataQualityStatus: "unavailable" };
const ALL = [early, v1, v2amended, late, noTs];

// 1. statement announced AFTER the decision date -> excluded
const d1 = getFundamentalsAsOf(SYM, new Date("2025-05-15T10:00:00Z"), ALL);
check("late_published_excluded", d1 !== null && d1.values["eps"] === 12,
  "late filing (eps 99) must never appear; amended v2 (eps 12) should be in force");

// 2. statement announced BEFORE the decision date -> included
const d2 = getFundamentalsAsOf(SYM, new Date("2025-01-20T10:00:00Z"), ALL);
check("early_published_included", d2?.values["eps"] === 10, `got ${d2?.values["eps"]}`);

// 3. later amended statement -> amendment does not leak before its time
const d3a = getFundamentalsAsOf(SYM, new Date("2025-02-10T10:00:00Z"), ALL);
check("amendment_not_leaking_before_amendment_date", d3a?.values["eps"] === 10,
  `pre-amendment decision must see v1 (eps 10), got ${d3a?.values["eps"]}`);
const d3b = getFundamentalsAsOf(SYM, new Date("2025-03-01T10:00:00Z"), ALL);
check("amendment_visible_after_amendment_date", d3b?.values["eps"] === 12,
  `post-amendment decision must see v2 (eps 12), got ${d3b?.values["eps"]}`);

// 4. missing publication timestamp -> unavailable (never guessed)
const d4 = getFundamentalsAsOf(SYM, new Date("2025-03-05T10:00:00Z"),
  [noTs]);
check("unknown_publication_timestamp_unavailable", d4 === null,
  "records without publication info must never be returned");

// 5. two filings with different publication times -> latest available wins
const f1 = rec(SYM, "2024-10-05", { revenue: 100 });
const f2 = rec(SYM, "2025-01-10", { revenue: 120 });
const d5 = getFundamentalsAsOf(SYM, new Date("2025-02-01T10:00:00Z"), [f1, f2]);
check("latest_available_version_wins", d5?.values["revenue"] === 120,
  `got ${d5?.values["revenue"]}`);

// 6. after-close announcement -> conservative 17:00 PKT rule
const afterClose = filingToPitRecord({ symbol: SYM, filingDate: "2025-04-10",
  filingType: "quarterly_accounts" });
check("conservative_instant_is_1700_pkt",
  conservativePublicationInstant("2025-04-10") === "2025-04-10T12:00:00.000Z",
  afterClose.publicationDatetime ?? "null");
const sameDay = getFundamentalsAsOf(SYM, new Date("2025-04-10T06:00:00Z"), [afterClose]); // 11:00 PKT
const nextDay = getFundamentalsAsOf(SYM, new Date("2025-04-11T04:00:00Z"), [afterClose]); // 09:00 PKT
check("after_close_same_session_not_available", sameDay === null,
  "market-hours decision on announcement day must NOT see the filing");
check("after_close_next_session_available", nextDay !== null,
  "next-session decision must see the filing");

// 7. genuine KSE-100 as-of discipline while source is blocked
const kst = kse100Status();
const kbar = getKse100AsOf("2025-01-15");
check("kse100_blocked_returns_null_not_proxy", kbar === null,
  `status=${kst.status}; adapter must never substitute the internal proxy`);
check("kse100_status_reports_blockers", kst.status === "blocked_external_data" &&
  kst.blockers.length >= 5, `status=${kst.status}, blockers=${kst.blockers.length}`);

// 8. as-of never returns a later filing (explicit boundary re-check)
const d8 = getFundamentalsAsOf(SYM, new Date("2025-01-09T23:00:00Z"), ALL);
check("as_of_boundary_day_before", d8?.values["eps"] === 8 || d8 === null,
  `got ${d8?.values["eps"]}`);

const out = { pass, fail, tests: results, at: new Date().toISOString() };
fs.mkdirSync("data/backtest_reports/task102", { recursive: true });
fs.writeFileSync("data/backtest_reports/task102/task102_pit_leakage_tests.json",
  JSON.stringify(out, null, 2));
console.log(`pit tests: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
