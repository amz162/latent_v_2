/**
 * Task 103 — index/proxy separation & feature-availability contract tests
 * (spec Phase 4). Run: bun scripts/task103_kse100_contract.ts
 * Writes data/backtest_reports/task103/task103_kse100_contract_tests.json
 */
import * as fs from "fs";
import { getKse100AsOf, kse100Status } from "../src/lib/market-data/kse100-provider";
import { kse100Availability, internalProxyAvailability, marketRegimeGate } from "../src/lib/market-data/feature-availability";

let pass = 0, fail = 0;
const results: any[] = [];
function check(id: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  ok  ${id}`); }
  else { fail++; console.log(`FAIL  ${id} ${detail}`); }
  results.push({ id, pass: ok, detail });
}

const st = kse100Status();
check("kse100_blocked_no_fabricated_data",
  st.status === "blocked_external_data" && st.rows === 0 && st.source === null,
  `status=${st.status} rows=${st.rows}`);
check("kse100_asof_null_while_blocked", getKse100AsOf("2026-10-29") === null);
check("kse100_availability_state_unavailable",
  kse100Availability("2026-11-02T12:00:00Z").state === "unavailable",
  JSON.stringify(kse100Availability("2026-11-02T12:00:00Z")));
check("kse100_regime_gate_unknown_while_blocked",
  marketRegimeGate("verified_index").decision === "unknown",
  JSON.stringify(marketRegimeGate("verified_index")));
const proxy = internalProxyAvailability(true);
check("proxy_explicitly_labeled", proxy.state === "internal_proxy"
  && proxy.namespace === "market_internal_proxy"
  && /NOT the KSE-100/i.test(proxy.label));
check("proxy_absent_is_unavailable", internalProxyAvailability(false).valueAllowed === false);
// the proxy path NEVER flows through the verified-index gate:
check("verified_gate_cannot_serve_proxy",
  marketRegimeGate("verified_index").decision !== "proxy_features");
// stale genuine index degrades to unavailable (freshness contract)
check("freshness_fields_present", typeof kse100Availability().stale === "boolean"
  && kse100Availability().hasOwnProperty("asOf"));

fs.mkdirSync("data/backtest_reports/task103", { recursive: true });
fs.writeFileSync("data/backtest_reports/task103/task103_kse100_contract_tests.json",
  JSON.stringify({ report: "task103_kse100_contract_tests", pass, fail, results,
    note: "contract: verified_index / internal_proxy / unavailable; a verified_index "
        + "consumer can never receive proxy values; blocked source -> regime unknown",
    at: new Date().toISOString() }, null, 2));
console.log(`kse100 contract tests: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);
