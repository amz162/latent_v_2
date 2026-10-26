// next.config.patched.ts — the "allowedDevOrigins" fix for the preview panel.
//
// PROBLEM
// The Z.ai Preview Panel loads the app through the Caddy gateway on :81,
// which reverse-proxies to the Next.js dev server on 127.0.0.1:3000. Because
// the iframe's origin differs from the dev server's host, Next.js 16 logs:
//   "Cross origin request detected from 127.0.0.1 to /_next/* resource.
//    In a future major version of Next.js, you will need to explicitly
//    configure 'allowedDevOrigins' in next.config to allow this."
// The HTML page (GET /) still returns 200, but the /_next/* dev assets
// (HMR client, JS chunks) are flagged — and in a future version they will be
// BLOCKED, which makes the preview show "server starts after some sec"
// forever (the page HTML loads but the JS never executes so nothing renders).
//
// FIX
// Whitelist the loopback origins that the gateway uses to reach the dev
// server. This is the single documented Next.js 16 remedy for that warning.
//
// EVERYTHING ELSE UNTOUCHED
// The only diff vs next.config.orig.ts is the `allowedDevOrigins` line below.
// `output`, `typescript.ignoreBuildErrors`, `reactStrictMode` are identical.
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the Preview Panel iframe (different origin, proxied via Caddy :81
  // -> 127.0.0.1:3000) to load /_next/* dev assets. See note above.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "0.0.0.0",
  ],
};

export default nextConfig;
