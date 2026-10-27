// ============================================================================
// Latent.pk — Price Pattern Finder nightly precompute worker.
//
// Calls POST /api/price-patterns/precompute on the Next.js dev server in
// batches of 10 symbols until every symbol has a fresh report stored in the
// PricePatternReport table. Then sleeps until the next 02:30 PKT (21:30 UTC)
// and runs the pass again. If the dev server is restarting (fetch fails), it
// retries after 60s instead of crashing.
// ============================================================================

const API = "http://127.0.0.1:3000/api/price-patterns/precompute";
const KEY = process.env.PRECOMPUTE_KEY || "latent-pk-nightly";
const BATCH = 10;
const MAX_BATCHES_PER_PASS = 500; // 500 × 10 = 5000 symbols — plenty for 908

const log = (...args: unknown[]) =>
  console.log(new Date().toISOString(), "[pattern-precompute]", ...args);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface BatchResponse {
  processed: number;
  failed: { symbol: string; reason: string }[];
  attempted: number;
  remaining: number;
  total: number;
  freshCount: number;
}

async function runBatch(): Promise<BatchResponse> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-precompute-key": KEY,
    },
    body: JSON.stringify({ limit: BATCH }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as BatchResponse;
}

async function runPass(tag: string): Promise<number> {
  log(`pass start (${tag})`);
  let processedTotal = 0;
  let consecutiveNoProgress = 0;

  for (let i = 0; i < MAX_BATCHES_PER_PASS; i++) {
    let r: BatchResponse;
    try {
      r = await runBatch();
    } catch (err) {
      log(`batch fetch failed (${err instanceof Error ? err.message : err}) — retrying in 60s`);
      await sleep(60_000);
      i--; // don't count failed transport attempts
      continue;
    }

    processedTotal += r.processed;
    const failedCount = r.failed?.length ?? 0;
    if (failedCount > 0) {
      log(`failed symbols this batch: ${r.failed.map((f) => `${f.symbol} (${f.reason})`).join(", ")}`);
    }

    if (r.processed > 0) consecutiveNoProgress = 0;
    else consecutiveNoProgress++;

    log(
      `batch done: processed=${r.processed} failed=${failedCount} ` +
      `remaining=${r.remaining} fresh=${r.freshCount}/${r.total} (pass total: ${processedTotal})`
    );

    if (r.remaining <= 0) break;
    if (consecutiveNoProgress >= 3) {
      log("3 batches with no progress — stopping this pass (failed symbols are on a 12h cooldown)");
      break;
    }
  }

  log(`pass done (${tag}) — processed ${processedTotal} symbol reports`);
  return processedTotal;
}

/** Next 02:30 Pakistan Standard Time (UTC+5) = 21:30 UTC of the same day. */
function msUntilNextNightly(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 21, 30, 0)
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

async function main() {
  log("worker started — first pass begins in 15s (dev server warm-up)");
  await sleep(15_000);

  await runPass("startup");

  for (;;) {
    const delay = msUntilNextNightly();
    log(`sleeping ${(delay / 3_600_000).toFixed(2)}h until 02:30 PKT nightly pass`);
    await sleep(delay);
    await runPass("nightly");
  }
}

main().catch((err) => {
  log("fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
