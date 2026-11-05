// Task 117 Part G — reviewed, versioned news-domain allowlist loader.
//
// The SSRF guard (url-guard.ts) already enforces transport safety (https,
// public IPs, redirect revalidation, size/type caps). This module adds the
// editorial layer: a host must appear in allowlist.json to be fetchable at
// all. Default posture is REJECT. An allowlist entry is earned by review —
// never by appearing in an LLM response.

import allowlistJson from "./allowlist.json";

export interface AllowlistEntry {
  hostname: string;
  purpose: string;
  applicationUsage: string;
  httpsRequired: boolean;
  redirectPolicy: string;
  contentTypeRestriction: string;
  reviewStatus: string;
  addedOn: string;
}

export interface NewsAllowlist {
  allowlistVersion: string;
  reviewedAt: string;
  domains: AllowlistEntry[];
}

export const NEWS_ALLOWLIST = allowlistJson as NewsAllowlist;

const EXACT_HOSTS = new Set(NEWS_ALLOWLIST.domains.map((d) => d.hostname.toLowerCase()));

export type AllowlistMode = "enforce" | "monitor";

export function allowlistMode(): AllowlistMode {
  return process.env.NEWS_ALLOWLIST_MODE === "monitor" ? "monitor" : "enforce";
}

/** Exact-host match (no wildcard subdomains — canonical hosts listed explicitly). */
export function isAllowedNewsHost(hostname: string): boolean {
  return EXACT_HOSTS.has(hostname.toLowerCase().replace(/\.$/, ""));
}

export function allowlistSummary() {
  return {
    version: NEWS_ALLOWLIST.allowlistVersion,
    reviewedAt: NEWS_ALLOWLIST.reviewedAt,
    mode: allowlistMode(),
    domains: NEWS_ALLOWLIST.domains.map((d) => ({ hostname: d.hostname, reviewStatus: d.reviewStatus })),
  };
}
