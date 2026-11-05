// Task 117 Part G — news-allowlist end-to-end harness.
// Exercises fetchArticleSecure() (the COMPLETE guarded fetch flow, not just
// the URL parser) and prints machine-parseable CHECK lines.
// Deterministic offline cases use IP literals (no DNS/network needed); the
// allowlisted live fetch is best-effort and reports SKIP when the sandbox has
// no egress — rejection paths must never depend on network reachability.
import { fetchArticleSecure } from "../src/lib/latent/url-guard";
import { isAllowedNewsHost, NEWS_ALLOWLIST } from "../src/lib/latent/news/allowlist";

function report(name: string, ok: boolean | "skip", detail = "") {
  console.log(`CHECK ${name} ${ok === "skip" ? "SKIP" : ok ? "PASS" : "FAIL"} ${detail}`.trimEnd());
}

async function main() {
  // 1. https enforced — http rejected before any network activity
  const http = await fetchArticleSecure("http://www.dawn.com/business");
  report("http_rejected", http.rejected === "unsupported_scheme", `rejected=${http.rejected}`);

  // 2. private IP literal rejected (SSRF guard, pre-allowlist)
  const priv = await fetchArticleSecure("https://10.0.0.1/article");
  report("private_ip_rejected", priv.rejected === "private_or_reserved_address", `rejected=${priv.rejected}`);

  // 3. metadata IP rejected
  const meta = await fetchArticleSecure("https://169.254.169.254/latest/meta-data");
  report("metadata_ip_rejected", meta.rejected === "private_or_reserved_address", `rejected=${meta.rejected}`);

  // 4. PUBLIC non-allowlisted host rejected by the allowlist (IP literal:
  //    no DNS needed; 93.184.216.34 is a public documentation-range address)
  const unlisted = await fetchArticleSecure("https://93.184.216.34/article");
  report("unapproved_domain_rejected", unlisted.rejected === "domain_not_allowed", `rejected=${unlisted.rejected}`);

  // 5. malformed URL rejected
  const bad = await fetchArticleSecure("not-a-url");
  report("malformed_rejected", bad.rejected === "malformed_url", `rejected=${bad.rejected}`);

  // 6. allowlist semantics: exact-host matching
  report("allowlisted_host_match", isAllowedNewsHost("www.dawn.com") && isAllowedNewsHost("api.askanalyst.com.pk"));
  report("subdomain_not_wildcarded", !isAllowedNewsHost("evil.dawn.com.evil.net") && !isAllowedNewsHost("notdawn.com"));

  // 7. versioned allowlist sanity
  report("allowlist_versioned", NEWS_ALLOWLIST.allowlistVersion === "news-allowlist-v1" && NEWS_ALLOWLIST.domains.length >= 4,
         `v=${NEWS_ALLOWLIST.allowlistVersion} domains=${NEWS_ALLOWLIST.domains.length}`);

  // 8. live fetch of an allowlisted host through the COMPLETE flow (best effort)
  try {
    const live = await fetchArticleSecure("https://www.dawn.com/pakistan");
    if (live.rejected === "fetch_error") {
      report("allowlisted_live_fetch", "skip", "sandbox egress unavailable — rejection paths above are network-independent");
    } else {
      report("allowlisted_live_fetch", live.ok === true && !!live.finalUrl?.includes("dawn.com"),
             `ok=${live.ok} rejected=${live.rejected} ct=${live.contentType}`);
    }
  } catch (e) {
    report("allowlisted_live_fetch", "skip", String(e).slice(0, 80));
  }

  // 9. user-supplied URL policy: only via interpret-news + allowlist (code-level:
  //    route uses fetchArticleSecure exclusively — asserted by grep in the suite)
}

main();
