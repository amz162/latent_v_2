// Latent.pk — SSRF-safe outbound URL fetch policy (Task 116 Part B3)
//
// Production rule: user-controlled URLs may ONLY be fetched through
// fetchArticleSecure(). The guard enforces:
//   - https only (http rejected; a provider allowlist could extend this,
//     none is justified today)
//   - explicit scheme/host validation, no credentials in URL
//   - DNS resolution checked for EVERY resolved address (IPv4+IPv6):
//     loopback, link-local (169.254.0.0/16 incl. cloud metadata
//     169.254.169.254), private (RFC1918 + fc00::/7), reserved, ULA,
//     multicast and 0.0.0.0 ranges are rejected — this closes the
//     public-host → private-IP redirect trick as well, because every
//     redirect hop is re-validated end-to-end
//   - manual redirect handling (max 3 hops), never auto-followed
//   - response size cap, content-type allowlist, strict timeouts
//   - no cookies/authorization forwarded; only a public User-Agent
//   - rejection reasons logged without echoing full internal detail

import dns from "node:dns/promises";
type DnsLookupAddress = { address: string; family: number };
import net from "node:net";
import { isAllowedNewsHost, allowlistMode } from "@/lib/latent/news/allowlist";

export type UrlGuardRejection =
  | "malformed_url"
  | "unsupported_scheme"
  | "credentials_in_url"
  | "private_or_reserved_address"
  | "dns_resolution_failed"
  | "domain_not_allowed"
  | "content_type_not_allowed"
  | "response_too_large"
  | "too_many_redirects"
  | "fetch_error"
  | "empty_body";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;
const ALLOWED_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "text/plain",
  "application/json",
];

export interface SafeFetchResult {
  ok: boolean;
  status?: number;
  body?: string;
  finalUrl?: string;
  contentType?: string;
  rejected?: UrlGuardRejection;
  detail?: string;
}

function isPrivateIPv4(ip: string): boolean {
  const o = ip.split(".").map(Number);
  if (o.length !== 4 || o.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = o;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // RFC1918 private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 private
  if (a === 192 && b === 168) return true; // RFC1918 private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24 TEST-NET
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split("%")[0]; // strip zone id
  if (addr === "::" || addr === "::1") return true; // unspecified + loopback
  if (addr.startsWith("fe8") || addr.startsWith("fe9") || addr.startsWith("fea") || addr.startsWith("feb"))
    return true; // fe80::/10 link-local
  if (addr.startsWith("fc") || addr.startsWith("fd")) return true; // fc00::/7 ULA
  if (addr.startsWith("ff")) return true; // multicast
  // IPv4-mapped / IPv4-compatible (::ffff:10.0.0.1 etc.) — check embedded v4
  const lastColon = addr.lastIndexOf(":");
  const tail = lastColon >= 0 ? addr.slice(lastColon + 1) : addr;
  if (tail.includes(".")) return isPrivateIPv4(tail);
  if (addr.startsWith("64:ff9b:")) return true; // NAT64 well-known prefix
  if (addr.startsWith("100::")) return true; // discard-only
  if (addr.startsWith("2001:db8:")) return true; // documentation
  if (addr.startsWith("2002:")) {
    // 6to4: embedded IPv4 = first two 16-bit groups
    const parts = addr.split(":");
    const h1 = parseInt(parts[1] || "", 16);
    const h2 = parseInt(parts[2] || "", 16);
    if (!Number.isNaN(h1) && !Number.isNaN(h2)) {
      const v4 = `${(h1 >> 8) & 0xff}.${h1 & 0xff}.${(h2 >> 8) & 0xff}.${h2 & 0xff}`;
      if (isPrivateIPv4(v4)) return true;
    }
  }
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  return net.isIPv4(ip) ? isPrivateIPv4(ip) : net.isIPv6(ip) ? isPrivateIPv6(ip) : true;
}

/** Validate scheme/host/DNS of a URL string. Returns the rejection reason or null. */
export async function validatePublicHttpUrl(
  raw: string
): Promise<{ url: URL; rejection: null } | { url: null; rejection: UrlGuardRejection }> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { url: null, rejection: "malformed_url" };
  }
  if (url.protocol !== "https:") return { url: null, rejection: "unsupported_scheme" };
  if (url.username || url.password) return { url: null, rejection: "credentials_in_url" };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // A literal IP host must be public; a name must resolve ONLY to public IPs.
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) return { url: null, rejection: "private_or_reserved_address" };
    return { url, rejection: null };
  }
  if (!host.includes(".") || host.endsWith(".local") || host.endsWith(".internal"))
    return { url: null, rejection: "private_or_reserved_address" };
  let addrs: DnsLookupAddress[];
  try {
    addrs = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    return { url: null, rejection: "dns_resolution_failed" };
  }
  if (!addrs.length) return { url: null, rejection: "dns_resolution_failed" };
  // DNS rebinding defence: EVERY resolved address must be public.
  if (addrs.some((a) => isPrivateAddress(a.address)))
    return { url: null, rejection: "private_or_reserved_address" };
  return { url, rejection: null };
}

/**
 * SSRF-hardened fetch for user-supplied article URLs. Manual redirect
 * handling: every hop is re-validated (scheme + DNS + private ranges), so a
 * trusted public URL cannot bounce into a private address. Task 117 Part G:
 * the host must ALSO be on the reviewed news-domain allowlist (exact match) —
 * unapproved external domains are rejected by default.
 */
export async function fetchArticleSecure(rawUrl: string): Promise<SafeFetchResult> {
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const guard = await validatePublicHttpUrl(current);
    if (!guard.url) return { ok: false, rejected: guard.rejection };
    if (!isAllowedNewsHost(guard.url.hostname)) {
      if (allowlistMode() === "enforce") {
        return { ok: false, rejected: "domain_not_allowed" };
      }
      // monitor mode logs for review but still proceeds (transport checks above apply)
      console.warn(`[url-guard] NEWS_ALLOWLIST monitor: host not in allowlist: ${guard.url.hostname}`);
    }
    let res: Response;
    try {
      res = await fetch(guard.url, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          // Public product UA only — never forward cookies/auth.
          "User-Agent": "Mozilla/5.0 (compatible; LatentBot/1.0; +https://latent.pk)",
          Accept: "text/html,application/xhtml+xml,text/plain",
        },
        cache: "no-store",
      });
    } catch (err) {
      return {
        ok: false,
        rejected: "fetch_error",
        detail: err instanceof Error ? err.message : "network failure",
      };
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, status: res.status, rejected: "fetch_error", detail: "redirect without location" };
      if (hop === MAX_REDIRECTS) return { ok: false, rejected: "too_many_redirects" };
      try {
        current = new URL(loc, guard.url).toString();
      } catch {
        return { ok: false, rejected: "malformed_url", detail: "bad redirect target" };
      }
      continue; // re-validate the redirect target from scratch
    }
    if (!res.ok) return { ok: false, status: res.status, rejected: "fetch_error", detail: `upstream ${res.status}` };
    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.includes(contentType))
      return { ok: false, status: res.status, contentType, rejected: "content_type_not_allowed" };
    const len = Number(res.headers.get("content-length") || "0");
    if (len > MAX_RESPONSE_BYTES) return { ok: false, status: res.status, rejected: "response_too_large" };
    const body = await res.text();
    if (body.length > MAX_RESPONSE_BYTES) return { ok: false, status: res.status, rejected: "response_too_large" };
    if (!body.trim()) return { ok: false, status: res.status, rejected: "empty_body" };
    return { ok: true, status: res.status, body, finalUrl: guard.url.toString(), contentType };
  }
  return { ok: false, rejected: "too_many_redirects" };
}
