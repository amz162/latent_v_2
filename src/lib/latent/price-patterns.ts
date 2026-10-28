// Latent.pk — Price Pattern Finder detection engine (Task 47)
//
// Pure TypeScript statistics over daily OHLCV bars. NO LLM here, NO next/*,
// NO "@/" imports — this file is shared between the Next.js API route and
// the standalone precompute script (bun run scripts/precompute_price_patterns.ts).
//
// DATA CONSTRAINT: OhlcvBar.high / OhlcvBar.low are NULL in this dataset, so
// every detector below uses ONLY open, close, volume. That means:
//   - no ATR / intraday range analysis
//   - no candlestick patterns
//   - gap "fill" and zone "bounce" logic are close-price based
//
// COMPLIANCE: user-visible strings never use "support"/"resistance" (we say
// "key price zone"), never claim "buyers/sellers confirmed" (we say buying/
// selling pressure inferred from price + volume), and never give advice.

export interface EngineBar {
  date: string; // YYYY-MM-DD
  open: number;
  close: number;
  volume: number;
}

export type PatternConfidence = "low" | "medium" | "high";

// Exact pattern shape required by the spec.
export interface PricePattern {
  type: string; // seasonality | volume_spike | pressure | key_zone | gap | drift
  key: string; // stable identity used to join LLM explanations back
  title: string;
  description: string;
  period: string; // e.g. "2018-2026"
  occurrences: number;
  years_seen: number;
  success_rate: number; // 0-100
  avg_move_pct: number; // signed %
  confidence: PatternConfidence;
  evidence_dates: string[]; // up to ~10 most recent manifestation dates
}

export interface SeasonalityMonth {
  month: number; // 0 = Jan
  avgReturnPct: number;
  winRate: number; // % of years positive
  samples: number; // years with data
  flagged: boolean; // recurred (same direction) in >= 4 of the last 5 years
  recentYears: { year: number; returnPct: number }[];
}

export interface VolumeSpikeInfo {
  date: string;
  volume: number;
  zScore: number;
  dayMovePct: number;
  next5MovePct: number | null;
}

export interface PressureDayInfo {
  date: string;
  kind: "buying" | "selling";
  volumeRatio: number;
  dayMovePct: number;
  next5MovePct: number | null;
}

export interface KeyZone {
  low: number;
  high: number;
  touches: number; // closes inside the zone
  visits: number; // distinct entry events
  bounces: number; // visits after which price moved up and away (>= 1%)
  rejections: number; // visits after which price moved down and away (>= 1%)
  avgVolumeAtTouch: number;
  volumeVsAvg: number; // ratio vs overall average volume in window
  avgMoveAwayPct: number; // avg |move| from the zone after a resolved visit
  evidence_dates: string[];
}

export interface GapStats {
  windowDays: number;
  gapUps: number;
  gapDowns: number;
  gapUpFilled: number;
  gapDownFilled: number;
  gapUpFillRate: number; // %
  gapDownFillRate: number; // %
  avgGapUpPct: number;
  avgGapDownPct: number;
}

export interface DriftStats {
  trigger: "volume_spike" | "high_52w" | "low_52w";
  count: number;
  avg5dPct: number;
  avg20dPct: number;
  hit5d: number; // % positive
  hit20d: number; // % positive
  evidence_dates: string[];
}

export interface PressureSummary {
  buyingDays: number;
  sellingDays: number;
  buyingAvgNext5Pct: number;
  sellingAvgNext5Pct: number;
  buyingHitRate: number; // % followed by positive 5d move
  sellingHitRate: number; // % followed by negative 5d move
  recentBuying: PressureDayInfo[];
  recentSelling: PressureDayInfo[];
}

export interface ChartPoint {
  date: string;
  close: number;
  volume: number;
}

export interface PricePatternAnalysis {
  symbol: string;
  dataStart: string;
  dataEnd: string;
  totalBars: number;
  patterns: PricePattern[];
  seasonality: SeasonalityMonth[] | null; // 12 entries, Jan..Dec
  volumeSpikes: VolumeSpikeInfo[]; // most recent first, capped
  pressure: PressureSummary | null;
  keyZones: KeyZone[];
  gaps: GapStats | null;
  drift: DriftStats[] | null;
  chart: ChartPoint[]; // last ~2 years of daily closes for the UI
  insufficient: boolean;
  message?: string;
}

export const LIQUID_SUGGESTIONS = ["ENGRO", "OGDC", "LUCK", "HUBC", "SYS", "MEBL", "PSO", "PPL"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CONFIDENCE_THRESHOLDS = { high: 12, medium: 6 } as const;

function confidenceFor(occurrences: number): PatternConfidence {
  if (occurrences >= CONFIDENCE_THRESHOLDS.high) return "high";
  if (occurrences >= CONFIDENCE_THRESHOLDS.medium) return "medium";
  return "low";
}

function pct(n: number, digits = 1): string {
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}%` : `${s}%`;
}

function distinctYears(dates: string[]): number {
  const years = new Set<string>();
  for (const d of dates) years.add(d.slice(0, 4));
  return years.size;
}

function periodOf(dates: string[]): string {
  if (!dates.length) return "n/a";
  const sorted = [...dates].sort();
  const first = sorted[0].slice(0, 4);
  const last = sorted[sorted.length - 1].slice(0, 4);
  return first === last ? first : `${first}-${last}`;
}

function lastN<T>(arr: T[], n: number): T[] {
  return arr.length <= n ? arr.slice() : arr.slice(arr.length - n);
}

function mean(vals: number[]): number {
  if (!vals.length) return 0;
  let s = 0;
  for (const v of vals) s += v;
  return s / vals.length;
}

function stdev(vals: number[], mu: number): number {
  if (vals.length < 2) return 0;
  let s = 0;
  for (const v of vals) s += (v - mu) * (v - mu);
  return Math.sqrt(s / (vals.length - 1));
}

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Monthly seasonality
// ─────────────────────────────────────────────────────────────────────────────

interface MonthReturn { year: number; month: number; returnPct: number; endDate: string }

function computeMonthlyReturns(bars: EngineBar[]): MonthReturn[] {
  const out: MonthReturn[] = [];
  if (bars.length < 2) return out;

  // Group indices by year-month
  const groups = new Map<string, number[]>();
  for (let i = 0; i < bars.length; i++) {
    const ym = bars[i].date.slice(0, 7); // YYYY-MM
    if (!groups.has(ym)) groups.set(ym, []);
    groups.get(ym)!.push(i);
  }

  const ymKeys = [...groups.keys()].sort();
  const lastYm = ymKeys[ymKeys.length - 1];
  const totalBars = bars.length;

  let prevMonthEndClose: number | null = null;
  for (const ym of ymKeys) {
    const idxs = groups.get(ym)!;
    const year = Number(ym.slice(0, 4));
    const month = Number(ym.slice(5, 7)) - 1;
    const monthEndDate = bars[idxs[idxs.length - 1]].date;

    // Skip partial final month (< 15 trading days) — its return would be truncated.
    const isFinalMonth = ym === lastYm;
    if (isFinalMonth && idxs.length < 15) {
      if (prevMonthEndClose === null) prevMonthEndClose = bars[idxs[idxs.length - 1]].close;
      continue;
    }

    if (idxs.length >= 3 && prevMonthEndClose !== null && prevMonthEndClose > 0) {
      const endClose = bars[idxs[idxs.length - 1]].close;
      out.push({
        year,
        month,
        returnPct: (safeDiv(endClose, prevMonthEndClose) - 1) * 100,
        endDate: monthEndDate,
      });
    }
    prevMonthEndClose = bars[idxs[idxs.length - 1]].close;
    void totalBars;
  }
  return out;
}

function detectSeasonality(bars: EngineBar[], patterns: PricePattern[]): SeasonalityMonth[] | null {
  const monthly = computeMonthlyReturns(bars);
  if (monthly.length < 6) return null;

  const months: SeasonalityMonth[] = [];
  for (let m = 0; m < 12; m++) {
    const rows = monthly.filter((r) => r.month === m).sort((a, b) => a.year - b.year);
    if (rows.length < 1) {
      months.push({ month: m, avgReturnPct: 0, winRate: 0, samples: 0, flagged: false, recentYears: [] });
      continue;
    }
    const avg = mean(rows.map((r) => r.returnPct));
    const wins = rows.filter((r) => r.returnPct > 0).length;

    // Flag criterion: same direction in >= 4 of the last 5 years with data.
    const last5 = lastN(rows, 5);
    let flagged = false;
    if (last5.length === 5) {
      const pos = last5.filter((r) => r.returnPct > 0).length;
      const neg = last5.filter((r) => r.returnPct < 0).length;
      flagged = pos >= 4 || neg >= 4;
    }

    months.push({
      month: m,
      avgReturnPct: round2(avg),
      winRate: round1(safeDiv(wins, rows.length) * 100),
      samples: rows.length,
      flagged,
      recentYears: lastN(rows, 6).map((r) => ({ year: r.year, returnPct: round2(r.returnPct) })),
    });

    if (!flagged) continue;

    const down = avg < 0 || (last5.length === 5 && last5.filter((r) => r.returnPct < 0).length >= 4);
    const directionWord = down ? "weak" : "strong";
    const consistency = down
      ? `${last5.filter((r) => r.returnPct < 0).length} of the last 5 years`
      : `${last5.filter((r) => r.returnPct > 0).length} of the last 5 years`;
    const winRatePct = round1(safeDiv(wins, rows.length) * 100);

    patterns.push({
      type: "seasonality",
      key: `seasonality_${down ? "down" : "up"}_${m}`,
      title: `${MONTH_NAMES[m]}: historically ${directionWord} month`,
      description:
        `Across ${rows.length} years of data, ${MONTH_NAMES[m]} ended with a gain over the previous month ` +
        `${wins} times (${winRatePct}% of the time), with an average move of ${pct(avg)}. ` +
        `The same direction repeated in ${consistency}.`,
      period: `${rows[0].year}-${rows[rows.length - 1].year}`,
      occurrences: rows.length,
      years_seen: rows.length,
      success_rate: round1(winRatePct),
      avg_move_pct: round2(avg),
      confidence: confidenceFor(rows.length),
      evidence_dates: lastN(rows, 10).map((r) => r.endDate),
    });
  }
  return months;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Volume spikes (z-score vs trailing 20-day average volume)
// ─────────────────────────────────────────────────────────────────────────────

const SPIKE_WINDOW = 20;
const SPIKE_Z = 2.0;

function trailingVolumeStats(bars: EngineBar[], i: number): { avg: number; std: number } | null {
  if (i < SPIKE_WINDOW) return null;
  const vals: number[] = [];
  for (let j = i - SPIKE_WINDOW; j < i; j++) vals.push(bars[j].volume);
  const avg = mean(vals);
  if (avg <= 0) return null;
  const std = stdev(vals, avg);
  return { avg, std };
}

function detectVolumeSpikes(bars: EngineBar[], patterns: PricePattern[]): VolumeSpikeInfo[] {
  const spikes: VolumeSpikeInfo[] = [];
  for (let i = SPIKE_WINDOW; i < bars.length; i++) {
    const st = trailingVolumeStats(bars, i);
    if (!st || st.std <= 0) continue;
    const z = (bars[i].volume - st.avg) / st.std;
    if (z < SPIKE_Z) continue;
    const dayMovePct = (safeDiv(bars[i].close, bars[i - 1].close) - 1) * 100;
    const next5MovePct = i + 5 < bars.length ? (safeDiv(bars[i + 5].close, bars[i].close) - 1) * 100 : null;
    spikes.push({ date: bars[i].date, volume: bars[i].volume, zScore: round2(z), dayMovePct: round2(dayMovePct), next5MovePct: next5MovePct === null ? null : round2(next5MovePct) });
  }
  if (spikes.length < 2) return spikes;

  const dayMoves = spikes.map((s) => s.dayMovePct);
  const avgDay = mean(dayMoves);
  const winDays = spikes.filter((s) => s.dayMovePct > 0).length;
  const next5s = spikes.map((s) => s.next5MovePct).filter((v): v is number => v !== null);
  const avgNext5 = next5s.length ? mean(next5s) : 0;
  const next5Up = next5s.filter((v) => v > 0).length;

  const dates = spikes.map((s) => s.date);
  patterns.push({
    type: "volume_spike",
    key: "volume_spike",
    title: "Unusually heavy volume days",
    description:
      `On ${spikes.length} days, trading volume spiked to 2+ standard deviations above its recent 20-day norm. ` +
      `The closing price rose on ${winDays} of those days (${round1(safeDiv(winDays, spikes.length) * 100)}%), averaging ${pct(avgDay)} on the day; ` +
      `over the following 5 trading days the average move was ${pct(avgNext5)} (up ${next5Up} of ${next5s.length} times).`,
    period: periodOf(dates),
    occurrences: spikes.length,
    years_seen: distinctYears(dates),
    success_rate: round1(safeDiv(winDays, spikes.length) * 100),
    avg_move_pct: round2(avgDay),
    confidence: confidenceFor(spikes.length),
    evidence_dates: lastN(dates, 10),
  });
  return spikes;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Absorption / distribution (buying & selling pressure)
// ─────────────────────────────────────────────────────────────────────────────

const PRESSURE_VOLUME_RATIO = 1.3; // volume >= 1.3x the trailing 20-day average

function detectPressure(bars: EngineBar[], patterns: PricePattern[]): PressureSummary | null {
  const buying: PressureDayInfo[] = [];
  const selling: PressureDayInfo[] = [];

  for (let i = SPIKE_WINDOW; i < bars.length; i++) {
    const st = trailingVolumeStats(bars, i);
    if (!st) continue;
    const ratio = safeDiv(bars[i].volume, st.avg);
    if (ratio < PRESSURE_VOLUME_RATIO) continue;
    const dayMovePct = (safeDiv(bars[i].close, bars[i - 1].close) - 1) * 100;
    const next5MovePct = i + 5 < bars.length ? (safeDiv(bars[i + 5].close, bars[i].close) - 1) * 100 : null;
    let kind: "buying" | "selling";
    if (dayMovePct > 0.2) kind = "buying";
    else if (dayMovePct < -0.2) kind = "selling";
    else kind = bars[i].close >= bars[i].open ? "buying" : "selling"; // flat day: direction of the open->close move
    const info: PressureDayInfo = {
      date: bars[i].date,
      kind,
      volumeRatio: round2(ratio),
      dayMovePct: round2(dayMovePct),
      next5MovePct: next5MovePct === null ? null : round2(next5MovePct),
    };
    (kind === "buying" ? buying : selling).push(info);
  }

  if (buying.length + selling.length === 0) return null;

  const summarize = (days: PressureDayInfo[]) => {
    const next5s = days.map((d) => d.next5MovePct).filter((v): v is number => v !== null);
    return { avgNext5: next5s.length ? mean(next5s) : 0, n: next5s.length };
  };
  const b = summarize(buying);
  const s = summarize(selling);
  const buyUp = buying.map((d) => d.next5MovePct).filter((v): v is number => v !== null).filter((v) => v > 0).length;
  const sellDown = selling.map((d) => d.next5MovePct).filter((v): v is number => v !== null).filter((v) => v < 0).length;

  if (buying.length >= 2) {
    patterns.push({
      type: "pressure",
      key: "pressure_buying",
      title: "Heavy-volume days with flat-to-rising price (buying pressure)",
      description:
        `On ${buying.length} days, volume ran 30%+ above its recent norm while the closing price finished flat or higher. ` +
        `Over the next 5 trading days the price averaged ${pct(b.avgNext5)} and was higher after ${buyUp} of ${b.n} such days ` +
        `(${round1(safeDiv(buyUp, b.n) * 100)}%). Pressure is inferred from price + volume behavior only.`,
      period: periodOf(buying.map((d) => d.date)),
      occurrences: buying.length,
      years_seen: distinctYears(buying.map((d) => d.date)),
      success_rate: round1(safeDiv(buyUp, b.n) * 100),
      avg_move_pct: round2(b.avgNext5),
      confidence: confidenceFor(buying.length),
      evidence_dates: lastN(buying.map((d) => d.date), 10),
    });
  }

  if (selling.length >= 2) {
    patterns.push({
      type: "pressure",
      key: "pressure_selling",
      title: "Heavy-volume days with flat-to-falling price (selling pressure)",
      description:
        `On ${selling.length} days, volume ran 30%+ above its recent norm while the closing price finished flat or lower. ` +
        `Over the next 5 trading days the price averaged ${pct(s.avgNext5)} and was lower after ${sellDown} of ${s.n} such days ` +
        `(${round1(safeDiv(sellDown, s.n) * 100)}%). Pressure is inferred from price + volume behavior only.`,
      period: periodOf(selling.map((d) => d.date)),
      occurrences: selling.length,
      years_seen: distinctYears(selling.map((d) => d.date)),
      success_rate: round1(safeDiv(sellDown, s.n) * 100),
      avg_move_pct: round2(s.avgNext5),
      confidence: confidenceFor(selling.length),
      evidence_dates: lastN(selling.map((d) => d.date), 10),
    });
  }

  return {
    buyingDays: buying.length,
    sellingDays: selling.length,
    buyingAvgNext5Pct: round2(b.avgNext5),
    sellingAvgNext5Pct: round2(s.avgNext5),
    buyingHitRate: round1(safeDiv(buyUp, b.n) * 100),
    sellingHitRate: round1(safeDiv(sellDown, s.n) * 100),
    recentBuying: buying.slice(-10).reverse(),
    recentSelling: selling.slice(-10).reverse(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Key price zones (close-price clustering — never called support/resistance)
// ─────────────────────────────────────────────────────────────────────────────

const ZONE_YEARS = 3;
const ZONE_BIN_PCT = 0.02; // 2% bins
const ZONE_EXIT_PCT = 0.01; // "moved away" = 1%+ beyond the zone boundary
const ZONE_EXIT_SCAN = 20; // bars to scan for the move-away after a visit

function detectKeyZones(bars: EngineBar[], patterns: PricePattern[]): KeyZone[] {
  const years = ZONE_YEARS * 252;
  const window = bars.length > years ? bars.slice(bars.length - years) : bars.slice();
  if (window.length < 120) return [];

  const closes = window.map((b) => b.close);
  const avgVolume = mean(window.map((b) => b.volume).filter((v) => v > 0));
  const binWidth = Math.max(mean(closes) * ZONE_BIN_PCT, 0.01);

  // Count closes per 2% bin
  const counts = new Map<number, number>();
  for (const c of closes) {
    const bin = Math.floor(c / binWidth);
    counts.set(bin, (counts.get(bin) || 0) + 1);
  }
  const touchThreshold = Math.max(10, Math.ceil(window.length * 0.015));

  // Group qualifying bins into runs of contiguous bins, then extract compact
  // zones (max 3 bins ≈ 6% wide) from each run so a long trending range does
  // not collapse into one meaningless mega-zone.
  const qualifyingBins = [...counts.entries()]
    .filter(([, cnt]) => cnt >= touchThreshold)
    .map(([bin]) => bin)
    .sort((a, b) => a - b);
  const runs: { start: number; end: number }[] = [];
  for (const bin of qualifyingBins) {
    const prev = runs[runs.length - 1];
    if (prev && bin === prev.end + 1) prev.end = bin;
    else runs.push({ start: bin, end: bin });
  }
  const MAX_ZONE_BINS = 3;
  const zoneSegs: { lowBin: number; highBin: number }[] = [];
  for (const run of runs) {
    const unused = new Set<number>();
    for (let b = run.start; b <= run.end; b++) unused.add(b);
    while (unused.size) {
      let best: { lowBin: number; highBin: number; touches: number } | null = null;
      for (const start of unused) {
        // Extend only through contiguous UNUSED bins so zones never overlap.
        let highBin = start;
        while (highBin + 1 <= run.end && highBin - start + 1 < MAX_ZONE_BINS && unused.has(highBin + 1)) highBin++;
        let t = 0;
        for (let b = start; b <= highBin; b++) if (unused.has(b)) t += counts.get(b) || 0;
        if (!best || t > best.touches) best = { lowBin: start, highBin, touches: t };
      }
      if (!best) break;
      if (best.touches < touchThreshold) break;
      zoneSegs.push({ lowBin: best.lowBin, highBin: best.highBin });
      for (let b = best.lowBin; b <= best.highBin; b++) unused.delete(b);
    }
  }
  zoneSegs.sort((a, b) => b.lowBin - a.lowBin);

  const zones: KeyZone[] = [];
  for (const seg of zoneSegs) {
    const low = seg.lowBin * binWidth;
    const high = (seg.highBin + 1) * binWidth;
    const binTouches = [...counts.entries()]
      .filter(([bin]) => bin >= seg.lowBin && bin <= seg.highBin)
      .reduce((s, [, cnt]) => s + cnt, 0);
    if (binTouches < touchThreshold) continue;
    const insideIdx: number[] = [];
    for (let i = 0; i < window.length; i++) {
      if (window[i].close >= low && window[i].close < high) insideIdx.push(i);
    }
    if (insideIdx.length < touchThreshold) continue;

    // Split into visits (consecutive runs of closes inside the zone)
    const visits: number[][] = [];
    let cur: number[] = [];
    let prevIdx = -2;
    for (const i of insideIdx) {
      if (i === prevIdx + 1) cur.push(i);
      else {
        if (cur.length) visits.push(cur);
        cur = [i];
      }
      prevIdx = i;
    }
    if (cur.length) visits.push(cur);

    let bounces = 0;
    let rejections = 0;
    let moveAwaySum = 0;
    let moveAwayN = 0;
    const mid = (low + high) / 2;
    for (const visit of visits) {
      const exitScanStart = visit[visit.length - 1] + 1;
      if (exitScanStart >= window.length) continue;
      for (let j = exitScanStart; j < Math.min(exitScanStart + ZONE_EXIT_SCAN, window.length); j++) {
        const c = window[j].close;
        if (c >= high * (1 + ZONE_EXIT_PCT)) {
          bounces++;
          moveAwaySum += Math.abs((c - mid) / mid) * 100;
          moveAwayN++;
          break;
        }
        if (c <= low * (1 - ZONE_EXIT_PCT)) {
          rejections++;
          moveAwaySum += Math.abs((c - mid) / mid) * 100;
          moveAwayN++;
          break;
        }
      }
    }

    const touchVolume = mean(visitVolume(window, visits));
    const zone: KeyZone = {
      low: round2(low),
      high: round2(high),
      touches: insideIdx.length,
      visits: visits.length,
      bounces,
      rejections,
      avgVolumeAtTouch: Math.round(touchVolume),
      volumeVsAvg: round2(safeDiv(touchVolume, avgVolume)),
      avgMoveAwayPct: round2(moveAwayN ? moveAwaySum / moveAwayN : 0),
      evidence_dates: lastN(visits.map((v) => window[v[0]].date), 10),
    };
    zones.push(zone);
  }

  zones.sort((a, b) => b.touches - a.touches);

  // Top zones become patterns
  for (const [idx, z] of zones.slice(0, 4).entries()) {
    if (z.visits < 2) continue;
    const decided = z.bounces + z.rejections;
    if (decided < 2) continue;
    const success = round1(safeDiv(z.bounces, decided) * 100);
    patterns.push({
      type: "key_zone",
      key: `key_zone_${idx}`,
      title: `Key price zone around Rs. ${z.low.toFixed(2)}-${z.high.toFixed(2)}`,
      description:
        `Closing prices clustered inside the Rs. ${z.low.toFixed(2)}-${z.high.toFixed(2)} band ${z.touches} times over the last ` +
        `${ZONE_YEARS} years — far more often than elsewhere on the chart. After ${z.visits} separate visits, the price moved ` +
        `up and away from the zone ${z.bounces} times and moved down through it ${z.rejections} times (moves of 1%+). ` +
        `Volume on touch days ran ${z.volumeVsAvg >= 1 ? `${Math.round((z.volumeVsAvg - 1) * 100)}% above` : `${Math.round((1 - z.volumeVsAvg) * 100)}% below`} the normal daily volume.`,
      period: `${window[0].date.slice(0, 4)}-${window[window.length - 1].date.slice(0, 4)}`,
      occurrences: z.visits,
      years_seen: distinctYears(z.evidence_dates),
      success_rate: success,
      avg_move_pct: z.avgMoveAwayPct > 0 ? z.avgMoveAwayPct : round2(ZONE_EXIT_PCT * 100),
      confidence: confidenceFor(z.visits),
      evidence_dates: z.evidence_dates,
    });
  }

  return zones;
}

function visitVolume(window: EngineBar[], visits: number[][]): number[] {
  const out: number[] = [];
  for (const v of visits) for (const i of v) out.push(window[i].volume);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Gap behavior (open vs previous close; close-price based fills)
// ─────────────────────────────────────────────────────────────────────────────

const GAP_THRESHOLD_PCT = 0.5;
const GAP_FILL_WINDOW = 5;

function detectGaps(bars: EngineBar[], patterns: PricePattern[]): GapStats | null {
  let gapUps = 0, gapDowns = 0, gapUpFilled = 0, gapDownFilled = 0;
  let gapUpSum = 0, gapDownSum = 0;
  const upDates: string[] = [];
  const downDates: string[] = [];

  for (let i = 1; i < bars.length; i++) {
    const gapPct = (safeDiv(bars[i].open, bars[i - 1].close) - 1) * 100;
    if (Math.abs(gapPct) < GAP_THRESHOLD_PCT) continue;
    const prevClose = bars[i - 1].close;
    let filled = false;
    for (let j = i; j <= Math.min(i + GAP_FILL_WINDOW, bars.length - 1); j++) {
      if (gapPct > 0 ? bars[j].close <= prevClose : bars[j].close >= prevClose) { filled = true; break; }
    }
    if (gapPct > 0) {
      gapUps++; gapUpSum += gapPct;
      if (filled) gapUpFilled++;
      upDates.push(bars[i].date);
    } else {
      gapDowns++; gapDownSum += gapPct;
      if (filled) gapDownFilled++;
      downDates.push(bars[i].date);
    }
  }

  if (gapUps + gapDowns === 0) return null;

  const stats: GapStats = {
    windowDays: GAP_FILL_WINDOW,
    gapUps,
    gapDowns,
    gapUpFilled,
    gapDownFilled,
    gapUpFillRate: round1(safeDiv(gapUpFilled, gapUps) * 100),
    gapDownFillRate: round1(safeDiv(gapDownFilled, gapDowns) * 100),
    avgGapUpPct: round2(safeDiv(gapUpSum, gapUps)),
    avgGapDownPct: round2(safeDiv(gapDownSum, gapDowns)),
  };

  if (gapUps >= 2) {
    patterns.push({
      type: "gap",
      key: "gap_up",
      title: "Gap-up openings and how often they get filled",
      description:
        `The stock opened at least 0.5% above its previous close on ${gapUps} days (average gap ${pct(stats.avgGapUpPct)}). ` +
        `Within ${GAP_FILL_WINDOW} trading days, the price came back to that previous close ${gapUpFilled} times — a ` +
        `${stats.gapUpFillRate}% fill rate (closes only).`,
      period: periodOf(upDates),
      occurrences: gapUps,
      years_seen: distinctYears(upDates),
      success_rate: stats.gapUpFillRate,
      avg_move_pct: stats.avgGapUpPct,
      confidence: confidenceFor(gapUps),
      evidence_dates: lastN(upDates, 10),
    });
  }

  if (gapDowns >= 2) {
    patterns.push({
      type: "gap",
      key: "gap_down",
      title: "Gap-down openings and how often they get filled",
      description:
        `The stock opened at least 0.5% below its previous close on ${gapDowns} days (average gap ${pct(stats.avgGapDownPct)}). ` +
        `Within ${GAP_FILL_WINDOW} trading days, the price recovered to that previous close ${gapDownFilled} times — a ` +
        `${stats.gapDownFillRate}% fill rate (closes only).`,
      period: periodOf(downDates),
      occurrences: gapDowns,
      years_seen: distinctYears(downDates),
      success_rate: stats.gapDownFillRate,
      avg_move_pct: stats.avgGapDownPct,
      confidence: confidenceFor(gapDowns),
      evidence_dates: lastN(downDates, 10),
    });
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Post-event drift (after volume spikes / 52-week highs / 52-week lows)
// ─────────────────────────────────────────────────────────────────────────────

const DRIFT_LOOKBACK_52W = 250; // prior bars that define the 52-week window
const DRIFT_MIN_HISTORY = 250; // skip the 52w detectors when history is shorter

function detectDrift(bars: EngineBar[], patterns: PricePattern[], spikeDates: Set<string>): DriftStats[] {
  const n = bars.length;
  const forwardReturn = (i: number, days: number): number | null =>
    i + days < n ? (safeDiv(bars[i + days].close, bars[i].close) - 1) * 100 : null;

  const collect = (trigger: DriftStats["trigger"], indices: number[]): DriftStats | null => {
    if (indices.length < 2) return null;
    const r5s: number[] = [], r20s: number[] = [];
    for (const i of indices) {
      const r5 = forwardReturn(i, 5);
      if (r5 !== null) r5s.push(r5);
      const r20 = forwardReturn(i, 20);
      if (r20 !== null) r20s.push(r20);
    }
    if (!r5s.length) return null;
    const hit5 = r5s.filter((v) => v > 0).length;
    const hit20 = r20s.filter((v) => v > 0).length;
    const dates = indices.map((i) => bars[i].date);
    const avg5 = mean(r5s);
    const avg20 = r20s.length ? mean(r20s) : 0;
    return {
      trigger,
      count: indices.length,
      avg5dPct: round2(avg5),
      avg20dPct: round2(avg20),
      hit5d: round1(safeDiv(hit5, r5s.length) * 100),
      hit20d: r20s.length ? round1(safeDiv(hit20, r20s.length) * 100) : 0,
      evidence_dates: lastN(dates, 10),
    };
  };

  const stats: DriftStats[] = [];
  const pushPattern = (d: DriftStats) => {
    const titles: Record<DriftStats["trigger"], string> = {
      volume_spike: "After a heavy-volume day",
      high_52w: "After closing at a 52-week high",
      low_52w: "After closing at a 52-week low",
    };
    patterns.push({
      type: "drift",
      key: `drift_${d.trigger}`,
      title: titles[d.trigger],
      description:
        `This happened ${d.count} times. Over the next 5 trading days the price averaged ${pct(d.avg5dPct)} ` +
        `(positive ${d.hit5d}% of the time); over the next 20 trading days it averaged ${pct(d.avg20dPct)} ` +
        `(positive ${d.hit20d}% of the time).`,
      period: periodOf(d.evidence_dates.length ? d.evidence_dates : []),
      occurrences: d.count,
      years_seen: distinctYears(d.evidence_dates),
      success_rate: d.hit5d,
      avg_move_pct: d.avg5dPct,
      confidence: confidenceFor(d.count),
      evidence_dates: d.evidence_dates,
    });
    stats.push(d);
  };

  // Volume-spike trigger reuses spike dates
  const spikeIdx: number[] = [];
  for (let i = 0; i < n; i++) if (spikeDates.has(bars[i].date)) spikeIdx.push(i);
  const sp = collect("volume_spike", spikeIdx);
  if (sp) pushPattern(sp);

  if (n > DRIFT_MIN_HISTORY) {
    const highIdx: number[] = [], lowIdx: number[] = [];
    for (let i = DRIFT_LOOKBACK_52W; i < n; i++) {
      let hi = -Infinity, lo = Infinity;
      for (let j = i - DRIFT_LOOKBACK_52W; j < i; j++) {
        if (bars[j].close > hi) hi = bars[j].close;
        if (bars[j].close < lo) lo = bars[j].close;
      }
      if (bars[i].close >= hi) highIdx.push(i);
      if (bars[i].close <= lo) lowIdx.push(i);
    }
    const h = collect("high_52w", highIdx);
    if (h) pushPattern(h);
    const l = collect("low_52w", lowIdx);
    if (l) pushPattern(l);
  }

  return stats;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

const CHART_BARS = 520; // ~2 years of trading days for the UI chart
const MIN_BARS = 60;

export function analyzePricePatterns(symbol: string, bars: EngineBar[]): PricePatternAnalysis {
  const clean = bars
    .filter((b) => Number.isFinite(b.open) && Number.isFinite(b.close) && b.close > 0)
    .map((b) => ({ date: b.date, open: b.open, close: b.close, volume: Number.isFinite(b.volume) ? b.volume : 0 }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (clean.length < MIN_BARS) {
    return {
      symbol,
      dataStart: clean[0]?.date ?? "",
      dataEnd: clean[clean.length - 1]?.date ?? "",
      totalBars: clean.length,
      patterns: [],
      seasonality: null,
      volumeSpikes: [],
      pressure: null,
      keyZones: [],
      gaps: null,
      drift: null,
      chart: clean.slice(-CHART_BARS).map((b) => ({ date: b.date, close: b.close, volume: b.volume })),
      insufficient: true,
      message:
        `Only ${clean.length} trading days of history available — at least ${MIN_BARS} are needed to detect recurring price patterns reliably. ` +
        `Try one of the more heavily traded symbols instead.`,
    };
  }

  const patterns: PricePattern[] = [];
  const seasonality = detectSeasonality(clean, patterns);
  const volumeSpikes = detectVolumeSpikes(clean, patterns);
  const pressure = detectPressure(clean, patterns);
  const keyZones = detectKeyZones(clean, patterns);
  const gaps = detectGaps(clean, patterns);
  const spikeDates = new Set(volumeSpikes.map((s) => s.date));
  const drift = detectDrift(clean, patterns, spikeDates);

  // Hard rule: never emit a pattern with occurrences < 2.
  const finalPatterns = patterns
    .filter((p) => p.occurrences >= 2)
    .sort((a, b) => {
      const rank = { high: 3, medium: 2, low: 1 } as const;
      const d = rank[b.confidence] - rank[a.confidence];
      return d !== 0 ? d : b.occurrences - a.occurrences;
    });

  return {
    symbol,
    dataStart: clean[0].date,
    dataEnd: clean[clean.length - 1].date,
    totalBars: clean.length,
    patterns: finalPatterns,
    seasonality,
    volumeSpikes: volumeSpikes.slice(-30).reverse(),
    pressure,
    keyZones,
    gaps,
    drift,
    chart: clean.slice(-CHART_BARS).map((b) => ({ date: b.date, close: b.close, volume: b.volume })),
    insufficient: false,
  };
}

// ─── Task 53 compatibility layer (restored after sandbox reset) ─────────────
// These exports are consumed by src/lib/latent/price-patterns-service.ts +
// src/lib/latent/price-pattern-llm.ts. They wrap the existing analyzePricePatterns
// engine + map to the response shapes the service/LLM expect. Pure mechanical
// mapping — no invented data.
//
// Lost in a sandbox reset before being pushed; restored here as part of the
// Task 59 integrity restoration (the build error "Export PATTERN_DISCLAIMER
// doesn't exist in target module" flagged the missing exports).

/** A simple OHLCV bar (DB-loaded via loadPriceBars — date/open/close/volume). */
export interface PriceBar {
  date: string;
  open: number;
  close: number;
  volume: number;
}

/** Detection result — wraps PricePatternAnalysis + maps to the service/LLM shape. */
export interface DetectionResult {
  symbol: string;
  coverage: { bars: number; firstDate: string; lastDate: string };
  patterns: Array<PricePattern & { id: string }>; // .id = .key (alias for the LLM join)
  zones: KeyZone[];
  seasonality: SeasonalityMonth[] | null;
  unusual: any[]; // volumeSpikes + gaps + drift — passed to the LLM as unusual_events
}

/** The client-facing report response shape. */
export interface PricePatternReportResponse {
  symbol: string;
  company: string;
  cached: boolean;
  computedAt: string;
  coverage: DetectionResult["coverage"];
  patterns: Array<PricePattern & { id: string; explanation?: string }>;
  zones: KeyZone[];
  seasonality: SeasonalityMonth[] | null;
  unusual: any[];
  llmNotes: string[];
  chart: { dates: string[]; closes: number[] };
  disclaimer: string;
}

export const PATTERN_DISCLAIMER =
  "Past price patterns do not guarantee future results. This analysis is a mechanical detection of recurring historical price behavior, not investment advice.";

/** Convert PriceBar[] (no high/low) → EngineBar[] (synthesize high/low from open/close). */
function priceBarsToEngineBars(bars: PriceBar[]): EngineBar[] {
  return bars.map((b) => ({
    date: b.date,
    open: b.open,
    high: Math.max(b.open, b.close),
    low: Math.min(b.open, b.close),
    close: b.close,
    volume: b.volume,
  }));
}

/**
 * Detect price patterns from PriceBar[] — the service entry point. Wraps the
 * existing analyzePricePatterns engine + maps the result to DetectionResult.
 * The symbol is NOT taken from the bars (they don't carry it) — the service
 * sets it later in buildReportResponse via its `sym` param.
 */
export function detectPricePatterns(bars: PriceBar[]): DetectionResult {
  if (!bars || bars.length === 0) {
    return {
      symbol: "",
      coverage: { bars: 0, firstDate: "", lastDate: "" },
      patterns: [],
      zones: [],
      seasonality: null,
      unusual: [],
    };
  }
  const engineBars = priceBarsToEngineBars(bars);
  // analyzePricePatterns needs a symbol; pass "" — the service overrides it.
  const analysis = analyzePricePatterns("", engineBars);
  // Map PricePatternAnalysis → DetectionResult (mechanical mapping).
  const patterns = analysis.patterns.map((p) => ({ ...p, id: p.key }));
  const zones = analysis.keyZones;
  const unusual: any[] = [
    ...(analysis.volumeSpikes || []),
    ...(analysis.gaps ? [analysis.gaps] : []),
    ...(analysis.drift || []),
  ];
  return {
    symbol: analysis.symbol || "",
    coverage: { bars: analysis.totalBars, firstDate: analysis.dataStart, lastDate: analysis.dataEnd },
    patterns,
    zones,
    seasonality: analysis.seasonality,
    unusual,
  };
}

/** Legacy adapter — maps DetectionResult.seasonality to the old UI shape (if needed). */
export function toLegacySeasonality(seasonality: SeasonalityMonth[] | null): SeasonalityMonth[] | null {
  return seasonality;
}

/** Legacy adapter — maps DetectionResult.zones to the old UI shape (if needed). */
export function toLegacyZones(zones: KeyZone[]): KeyZone[] {
  return zones;
}
