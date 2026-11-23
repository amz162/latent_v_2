// Next.js instrumentation entry. The docs convention is `instrumentation.ts`
// (root or src/) exporting register(); runtime-specific code is imported
// conditionally via NEXT_RUNTIME. This repo's scheduler lived only in
// `instrumentation.node.ts`, which Next.js never loads by that name — so the
// 5 PM PKT auto-update scheduler silently never started (data went stale).
// Fixed by delegating to it from this properly-named entry point. The global
// flag inside instrumentation.node.ts guards against double registration.
export async function register() {
  console.log(`[instrumentation] register() called, NEXT_RUNTIME=${process.env.NEXT_RUNTIME}`);
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const m = await import("./instrumentation.node");
      console.log(`[instrumentation] node module loaded, exports: ${Object.keys(m).join(",")}`);
      if (typeof m.register === "function") {
        await m.register();
        console.log("[instrumentation] node register() completed");
      } else {
        console.error("[instrumentation] no register export found on instrumentation.node");
      }
    } catch (e) {
      console.error("[instrumentation] failed to load instrumentation.node:", e);
    }
  }
}
