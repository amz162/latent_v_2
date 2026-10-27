# Task 26-A — Confidence clamp (>100 → 0-100) + Confidence bar background visibility

## Issue 1 — Clamp confidence to 0-100/100

### Files changed

**`src/lib/latent/ensemble.ts`** (4 confidence outputs + 1 agreement):
- Added `const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n || 0)));` at top of file (line 5).
- `majorityVoteEnsemble` (line 146): `confidence: clamp100(trained.length > 0 ? Math.max(buyCount, sellCount, holdCount) / trained.length * 100 : 0)`
- `probabilityWeightedEnsemble` (line 170): `confidence: clamp100(Math.abs(avgRet) * 1000)` — was the main culprit returning >100 when avgRet > 0.10.
- `tierWeightedEnsemble` (line 201): `confidence: clamp100(Math.abs(wr) * 1000)`
- `computeFinalConsensus` (line 223): `confidence: ens.length > 0 ? clamp100(ens.reduce((s, e) => s + e.confidence, 0) / ens.length) : 0`
- `computeFinalConsensus` agreement (line 224): `agreement: clamp100(Math.max(buyV, sellV, holdV) / (ens.length || 1) * 100)`

**`src/app/api/ai-model-signals/[symbol]/route.ts`** (per-model + 10 ensemble entries + 2 fallback confidences):
- Added `clamp100 = (n: any): number => { ... }` helper near top (lines 21-29) — also guards NaN/Infinity.
- Per-model `p.confidence` (line 123): `confidence: clamp100(p.confidence)`.
- Each of the 10 ensemble entries (`clEnsPred`, `clExtPred`, `cl2EnsPred`, `piEnsPred`, `gmEnsPred`, `cgEnsPred`, `xEnsPred`, `gianEnsPred`, `gianExtPred`, `mEnsPred`) — wrapped their `confidence` field with `clamp100(...)` (lines 165, 185, 209, 236, 264, 291, 322, 348, 370, 392).
- Technical fallback overwrite (line 485): `fcAny.confidence = clamp100(confidence);` (was `Math.round(confidence)`).
- Technical fallback ensemble push (line 496): `confidence: clamp100(confidence)`.

**`src/app/api/signals/all/route.ts`** (per-model + 7 ensemble entries + final fc.confidence):
- Added `clamp100` helper (lines 48-56).
- Per-model `p.confidence` (line 123): wrapped.
- Each of the 7 ensemble entries in `buildEnsemblesForSymbol` (CL, CL_EXT, CL2, PI, GM, CG, X) — wrapped (lines 167, 187, 210, 233, 257, 280, 304).
- `out.push({...confidence: clamp100(fc.confidence)...})` (line 413) — final fc.confidence clamp at boundary.

**`src/components/latent/SignalSection.tsx`** (UI display layer):
- Line 436: changed `{s.confidence}/100` to `{Math.max(0, Math.min(100, Math.round(s.confidence || 0)))}/100`.
- Line 442: changed `Math.min(100, Math.max(0, s.confidence))` to `Math.min(100, Math.max(0, s.confidence || 0))` (added `|| 0` for null safety).

**`src/components/latent/AiModelSignals.tsx`** (UI display layer):
- Line 117 (final consensus): wrapped `data.finalConsensus.confidence` and `data.finalConsensus.agreement` in `Math.max(0, Math.min(100, Math.round(...||0)))`.
- Line 131 (per-ensemble card): wrapped `en.confidence` in `Math.max(0, Math.min(100, Math.round(en.confidence || 0)))`.

## Issue 2 — Confidence bar background visibility

**`src/components/latent/SignalSection.tsx`** (line 439):
- Changed `bg-white/[0.06]` (barely visible on `#131829` card) to `bg-white/[0.15]` + added `border border-white/[0.10]` for clear visibility.
- Filled portion stays `bg-[#00E676]` (BUY) / `bg-[#FF5C5C]` (SELL) — unchanged.

### Other "bg-white/[0.06]" bars checked (left UNCHANGED — not confidence bars)
- `Dashboard.tsx` line 291 — allocation bar (allocationPct, not confidence) — left alone.
- `SignalDetail.tsx` line 264 — text only `Confidence: <span>...</span>` — no bar to fix.

## Verification

1. `bun run lint` — only a pre-existing error in `src/components/latent/StockSearch.tsx` line 19 ("set-state-in-effect") that I did NOT touch. No new errors introduced.
2. `tail /home/z/my-project/dev.log` (recent 25 lines) — only HTTP 200 entries, no compile/runtime errors.
3. `curl 'http://127.0.0.1:3000/api/ai-model-signals/ENGRO?refresh=1'`:
   - finalConsensus.confidence = **70** ✓
   - finalConsensus.agreement = **54** ✓
   - All 13 ensemble confidences in [20, 100] (max = 100, clamped from previously >100 for Probability/Tier/CL/CL-Extender which used raw_prob*1000).
   - Per-model confidences: max = 100, min = 0, all in [0, 100] ✓.
4. `curl 'http://127.0.0.1:3000/api/signals/all?refresh=1'`:
   - 352 signals, max confidence = 79, min = 26, all ≤ 100 ✓.

## Final clamp behavior
- Backend `clamp100` (in ensemble.ts + 2 API routes): `Math.max(0, Math.min(100, Math.round(Number(n) || 0)))` with `isFinite` guard on the API side.
- UI `Math.max(0, Math.min(100, Math.round(value || 0)))` defensive inline clamps in SignalSection.tsx and AiModelSignals.tsx (defense-in-depth — even if API layer is bypassed by future code paths).
- Bar background visibility: `bg-white/[0.15]` + `border border-white/[0.10]` clearly contrasts with the dark card `bg-[#131829]`.
