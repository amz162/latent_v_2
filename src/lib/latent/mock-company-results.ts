// Pattern detection engine — no mock data, real data fetched on-demand
export interface QuarterMetric { revenue:number;profitAfterTax:number;eps:number;revenueYoYGrowth:number;profitYoYGrowth:number;epsYoYGrowth:number;grossMargin:number;netMargin:number;dividendPerShare:number;dividendPayoutRatio:number; }
export interface QuarterlyResult { symbol:string;company:string;period:string;periodEnd:string;metrics:QuarterMetric;notes?:string; }
export type PatternStrength = "Strong" | "Moderate" | "Weak";
export interface SupportingDataPoint { label: string; value: string; }
export interface DetectedPattern {
  type: string;
  label: string;
  severity: "positive" | "negative" | "neutral";
  strength?: PatternStrength;            // Issue 9: Strong / Moderate / Weak discrimination tier
  confidence: number;                    // 0–100, scaled to strength
  detail: string;
  supportingData?: SupportingDataPoint[]; // Issue 9: structured data points the user can verify against
  affectedQuarters: string[];
  laymanSummary?: string;
}
export interface QuarterSummary { quarter:1|2|3|4;quarterLabel:string;monthsLabel:string;avgRevenuePctOfTotal:number;avgProfitPctOfTotal:number;avgNetMargin:number;typicalPattern:"low"|"rising"|"peak"|"moderate";summary:string;causeSummary:string; }
export const MOCK_COMPANY_RESULTS:QuarterlyResult[]=[];

// ────────────────────────────────────────────────────────────────────────────
// Issue 11: Sector-specific seasonal cause summaries
// Maps PSX ticker symbols → sector → per-quarter cause explanation. Falls back
// to a generic Pakistan-monsoon narrative when symbol is unknown.
// ────────────────────────────────────────────────────────────────────────────

const SECTOR_SYMBOL_MAP: { sector: string; symbols: string[] }[] = [
  { sector: "Cement", symbols: ["LUCK", "DGKC", "MLCF", "FCCL", "KOHC", "ACPL", "PIOC", "CHCC", "GWLC", "DCL", "BEST", "FECT", "INCE", "DGIC"] },
  { sector: "Fertilizer", symbols: ["ENGRO", "EFERT", "FFBL", "FATIMA", "DAWH"] },
  { sector: "Oil & Gas", symbols: ["OGDC", "PPL", "POL", "MARI", "EPL"] },
  { sector: "Power", symbols: ["HUBC", "NPL", "KAPCO", "JPGL", "SPWL", "NCPL", "KEL", "LPL"] },
  { sector: "Banking", symbols: ["MEBL", "BAFL", "MCB", "UBL", "HBL", "ABL", "BOP", "BAHL", "SCBPL", "SNBL", "AKBL", "BISE", "AICL", "MEBB"] },
  { sector: "Technology", symbols: ["SYS", "AVN", "TRSM", "HUMNL", "PTC", "AVANT"] },
  { sector: "Oil Marketing", symbols: ["PSO", "APL", "SNGP", "SPL", "SSGC"] },
  { sector: "Refinery/Petrochemical", symbols: ["LOTCHEM", "ATRL", "NRL", "PRL", "BYCO", "SHEZ", "EPCL"] },
];

export function classifySector(symbol?: string): string {
  if (!symbol) return "Conglomerate";
  const up = symbol.toUpperCase();
  for (const m of SECTOR_SYMBOL_MAP) if (m.symbols.includes(up)) return m.sector;
  return "Conglomerate";
}

const SECTOR_CAUSES: Record<string, { 1: string; 2: string; 3: string; 4: string }> = {
  Cement: {
    1: "Pakistan's Q1 (Jul–Sep) is monsoon season — heavy rains disrupt construction sites, clinker transport, and outdoor pours. Cement dispatches typically dip 15–20% as builders delay pours; LUCK/DGKC/MLCF all see the seasonal trough here.",
    2: "Q2 (Oct–Dec) is post-monsoon recovery — dry, cool weather drives peak construction season. Cement demand rises 20%+ as North-bound infrastructure projects resume and rural housing ramps up; dispatch numbers lift sharply.",
    3: "Q3 (Jan–Mar) — winter peak construction continues in the south while the north slows from cold. Companies push hard on dispatches to hit FY targets; LUCK often books the year's largest profit here.",
    4: "Q4 (Apr–Jun) — pre-monsoon slowdown as heat builds, water scarcity affects curing, and builders wrap up before rains. Companies finalize annual results; dispatches moderate, final dividends declared here.",
  },
  Fertilizer: {
    1: "Pakistan's Q1 (Jul–Sep) — Kharif harvest ending softens urea offtake as sowing winds down. ENGRO/EFERT see weaker demand, but inventory builds for the next sowing season.",
    2: "Q2 (Oct–Dec) — Rabi sowing peak. Urea demand spikes as wheat cultivation starts across Punjab and Sindh. Fertilizer companies book some of their highest dispatches of the year here.",
    3: "Q3 (Jan–Mar) — mid-Rabi. Top-dressing applications continue, urea offtake stays firm. ENGRO/EFERT often book strong profits; this is also when interim dividends are announced.",
    4: "Q4 (Apr–Jun) — transition from Rabi harvest to Kharif sowing prep; urea demand moderate. Companies finalize annual results, declare final dividends, and reposition inventory for the next sowing cycle.",
  },
  "Oil & Gas": {
    1: "Pakistan's Q1 (Jul–Sep) — summer gas consumption peaks (ACs, industry) but wellhead production from OGDC/PPL/MARI stays steady. Royalty flows and gas tariffs support revenue; this is a high-cash quarter.",
    2: "Q2 (Oct–Dec) — winter gas consumption peaks as heating loads rise and CNG/power demand increases. OGDC/PPL typically book strong profits; gas infrastructure stays near full utilization.",
    3: "Q3 (Jan–Mar) — winter demand continues in the north, gas consumption stays high. Companies often declare interim dividends here; production plateaus at mature fields but new wells add incremental flow.",
    4: "Q4 (Apr–Jun) — transition to summer; residential heating demand drops, but power-sector gas offtake rises as AC load grows. Companies finalize annual results and declare final dividends.",
  },
  Power: {
    1: "Pakistan's Q1 (Jul–Sep) — mild weather means lower heating/cooling demand; HUBC and other IPPs see lower dispatches as grid load eases. Capacity payments still flow, but merchant profits moderate.",
    2: "Q2 (Oct–Dec) — winter heating demand lifts power offtake; IPPs run at higher capacity factors. HUBC typically books stronger revenue and profits here.",
    3: "Q3 (Jan–Mar) — winter peak demand continues in the north; power sector stays at high utilization. Companies often declare interim dividends here as cash builds.",
    4: "Q4 (Apr–Jun) — summer cooling demand begins ramping up as AC load rises; power demand approaches annual peak. Companies finalize annual results and declare final dividends.",
  },
  Banking: {
    1: "Pakistan's Q1 (Jul–Sep) — banks see lower fee income as post-budget slowdown hits corporate activity. ADR spreads stay healthy, but loan growth is tepid; MEBL's fee line typically softens here.",
    2: "Q2 (Oct–Dec) — post-monsoon pickup in trade financing and corporate lending; banks see stronger fee income and FX income from imports. MEBL typically books stronger profits here.",
    3: "Q3 (Jan–Mar) — mid-fiscal-year. Banks push lending targets. Many banks declare interim dividends here; MEBL's quarterly profit often peaks as fee income and ADR spreads combine.",
    4: "Q4 (Apr–Jun) — fiscal year-end. Banks finalize annual results, declare final dividends + bonus shares, and clean up balance sheets. MEBL often pays its largest dividend here, plus a stock bonus.",
  },
  Technology: {
    1: "Pakistan's Q1 (Jul–Sep) — new software/IT contracts typically start at the beginning of the fiscal year. SYS and peers ramp up revenue recognition as client budgets open; deals inked in Q4 start billing.",
    2: "Q2 (Oct–Dec) — delivery milestones hit on multi-quarter engagements; revenue scales up as resources ramp. Tech firms often see their highest quarterly revenue of the year here as project execution peaks.",
    3: "Q3 (Jan–Mar) — continued execution; client renewals and contract extensions come in. SYS often books strong profits here; interim dividends (if any) declared.",
    4: "Q4 (Apr–Jun) — year-end push to recognize deferred revenue and lock in new multi-year deals before fiscal close. Tech firms accelerate bookings; final dividends and bonuses declared.",
  },
  "Oil Marketing": {
    1: "Pakistan's Q1 (Jul–Sep) — monsoon disruptions hit fuel logistics and retail offtake. PSO and APL see moderate demand; inventory builds as imports arrive but dispatch lags in wet weather.",
    2: "Q2 (Oct–Dec) — winter demand lifts furnace oil (for power) and HSD; oil marketing companies see higher volumes as industrial activity resumes. PSO often books strong gross profits here.",
    3: "Q3 (Jan–Mar) — peak winter fuel demand continues; PSO/APL dispatches stay high. Companies often declare interim dividends here as receivables clear from circular-debt flow.",
    4: "Q4 (Apr–Jun) — year-end inventory build as companies prep for summer driving season and AC-driven power demand. Companies finalize annual results and declare final dividends.",
  },
  "Refinery/Petrochemical": {
    1: "Pakistan's Q1 (Jul–Sep) — monsoon season softens fuel demand; refinery throughput dips slightly as logistics and downstream offtake slow. LOTCHEM/ATRL see moderate margins.",
    2: "Q2 (Oct–Dec) — winter heating and post-monsoon industrial activity lift furnace oil and diesel demand; refinery utilization rises. Crack spreads typically stay healthy.",
    3: "Q3 (Jan–Mar) — winter peak demand for heating fuels; refinery margins stay firm. Companies often declare interim dividends here.",
    4: "Q4 (Apr–Jun) — summer AC-driven power demand lifts furnace oil offtake; refineries prep for higher throughput. Companies finalize annual results and declare final dividends.",
  },
  Conglomerate: {
    1: "Pakistan's Q1 (Jul–Sep) coincides with monsoon season — heavy rains disrupt construction, transport, and outdoor activity, while the Kharif-harvest ending softens fertilizer and agri-input offtake. Summer heat also curbs industrial output, so most cyclical sectors see weaker demand.",
    2: "Q2 (Oct–Dec) brings post-monsoon recovery: dry cool weather drives peak construction (cement, steel lift), Rabi sowing boosts fertilizer demand, and Eid/festive spending lifts consumer goods. Banks also see stronger fee income — that seasonal tailwind is why volumes jump.",
    3: "Q3 (Jan–Mar) is mid-fiscal-year. Winter peak continues for construction and industry, companies push hard to meet annual targets, and many declare interim dividends here — that's why this quarter often books the year's largest profits.",
    4: "Q4 (Apr–Jun) is fiscal year-end. Companies finalize annual results, declare final dividends, and clean up balance sheets. Meanwhile summer heat and pre-monsoon conditions start slowing construction and agri-input demand — making this a natural transition quarter.",
  },
};

export function getSectorCauseSummary(sector: string, quarter: 1 | 2 | 3 | 4): string {
  const causes = SECTOR_CAUSES[sector] || SECTOR_CAUSES.Conglomerate;
  return causes[quarter];
}

// ============================================================
// Issue 9: Discriminating pattern-detection algorithm
// ============================================================
//
// Goal: surface genuinely informative patterns — both bullish AND bearish —
// and stop labelling almost every stock as "all quarters profitable".
//
// Each detected pattern carries:
//   * strength:   Strong / Moderate / Weak  — magnitude + run-length tier
//   * confidence: 0-100, scaled to strength (Strong: 78-95, Moderate: 58-78, Weak: 40-58)
//   * supportingData: structured {label,value} pairs so the user can verify the claim
//   * affectedQuarters: the periods that triggered the pattern
//   * laymanSummary: plain-English version
//
// Patterns are only emitted when their threshold genuinely holds — bearish
// patterns get symmetric treatment to bullish ones, so a deteriorating
// business shows red flags just as clearly as a healthy one shows green ones.
// ============================================================
function _conf(s: PatternStrength, base = 0): number {
  const floor = s === "Strong" ? 78 : s === "Moderate" ? 58 : 40;
  const cap = s === "Strong" ? 95 : s === "Moderate" ? 78 : 58;
  return Math.max(floor, Math.min(cap, floor + base));
}
function _fmtNumShort(n: number): string {
  if (!isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e9) return `${sign}Rs ${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}Rs ${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}Rs ${(a / 1e3).toFixed(1)}K`;
  return `${sign}Rs ${a.toFixed(0)}`;
}

export function detectPatterns(r: QuarterlyResult[]): DetectedPattern[] {
  if (r.length < 4) return [];
  const out: DetectedPattern[] = [];
  const first = r[0];
  const last = r[r.length - 1];

  // ---------- 1. EPS growth / decline streak (consecutive YoY) ----------
  {
    // Longest run ending at the latest quarter where YoY EPS growth > 10%
    let bullRun = 0;
    for (let i = r.length - 1; i >= 0; i--) {
      if (r[i].metrics.epsYoYGrowth > 10) bullRun++;
      else break;
    }
    let bearRun = 0;
    for (let i = r.length - 1; i >= 0; i--) {
      if (r[i].metrics.epsYoYGrowth < -10) bearRun++;
      else break;
    }
    if (bullRun >= 3) {
      const slice = r.slice(-bullRun);
      const avg = slice.reduce((a, x) => a + x.metrics.epsYoYGrowth, 0) / slice.length;
      const s: PatternStrength = bullRun >= 5 ? "Strong" : bullRun >= 4 ? "Moderate" : "Weak";
      out.push({
        type: "EPS_GROWTH_STREAK",
        label: "EPS Growth Streak",
        severity: "positive",
        strength: s,
        confidence: _conf(s, bullRun * 2),
        detail: `${bullRun} consecutive quarters of YoY EPS growth > 10% (avg ${avg.toFixed(1)}%).`,
        supportingData: [
          { label: "Streak length", value: `${bullRun} qtrs` },
          { label: "Avg YoY growth", value: `${avg.toFixed(1)}%` },
          { label: "Latest EPS YoY", value: `${last.metrics.epsYoYGrowth.toFixed(1)}%` },
        ],
        affectedQuarters: slice.map((x) => x.period),
        laymanSummary: "Profits rising YoY, quarter after quarter — strong earnings momentum.",
      });
    }
    if (bearRun >= 3) {
      const slice = r.slice(-bearRun);
      const avg = slice.reduce((a, x) => a + x.metrics.epsYoYGrowth, 0) / slice.length;
      const s: PatternStrength = bearRun >= 5 ? "Strong" : bearRun >= 4 ? "Moderate" : "Weak";
      out.push({
        type: "EPS_DECLINE_STREAK",
        label: "EPS Decline Streak",
        severity: "negative",
        strength: s,
        confidence: _conf(s, bearRun * 2),
        detail: `${bearRun} consecutive quarters of YoY EPS decline > 10% (avg ${avg.toFixed(1)}%).`,
        supportingData: [
          { label: "Streak length", value: `${bearRun} qtrs` },
          { label: "Avg YoY decline", value: `${avg.toFixed(1)}%` },
          { label: "Latest EPS YoY", value: `${last.metrics.epsYoYGrowth.toFixed(1)}%` },
        ],
        affectedQuarters: slice.map((x) => x.period),
        laymanSummary: "Profits falling YoY, quarter after quarter — an earnings recession.",
      });
    }
  }

  // ---------- 2. Margin expansion / contraction (>=4 qtr trend) ----------
  {
    const ms = r.map((x) => x.metrics.netMargin);
    if (ms.length >= 4) {
      const win = ms.slice(-Math.min(ms.length, 6));
      const slope = computeSlope(win);
      const delta = win[win.length - 1] - win[0];
      if (slope >= 0.75 && delta >= 2) {
        const s: PatternStrength = slope >= 3 ? "Strong" : slope >= 1.5 ? "Moderate" : "Weak";
        out.push({
          type: "MARGIN_EXPANSION",
          label: "Margin Expansion",
          severity: "positive",
          strength: s,
          confidence: _conf(s, Math.floor(Math.abs(delta))),
          detail: `Net margin expanded from ${win[0].toFixed(1)}% to ${win[win.length - 1].toFixed(1)}% (+${delta.toFixed(1)}pp) over the last ${win.length} quarters.`,
          supportingData: [
            { label: "Start margin", value: `${win[0].toFixed(1)}%` },
            { label: "Latest margin", value: `${win[win.length - 1].toFixed(1)}%` },
            { label: "Change", value: `+${delta.toFixed(1)}pp` },
            { label: "Slope", value: `${slope.toFixed(2)}pp/qtr` },
          ],
          affectedQuarters: [r[ms.length - win.length].period, last.period],
          laymanSummary: "Company keeps more profit per rupee of sales — improving cost efficiency or pricing power.",
        });
      } else if (slope <= -0.75 && delta <= -2) {
        const s: PatternStrength = slope <= -3 ? "Strong" : slope <= -1.5 ? "Moderate" : "Weak";
        out.push({
          type: "MARGIN_CONTRACTION",
          label: "Margin Contraction",
          severity: "negative",
          strength: s,
          confidence: _conf(s, Math.floor(Math.abs(delta))),
          detail: `Net margin compressed from ${win[0].toFixed(1)}% to ${win[win.length - 1].toFixed(1)}% (${delta.toFixed(1)}pp) over the last ${win.length} quarters.`,
          supportingData: [
            { label: "Start margin", value: `${win[0].toFixed(1)}%` },
            { label: "Latest margin", value: `${win[win.length - 1].toFixed(1)}%` },
            { label: "Change", value: `${delta.toFixed(1)}pp` },
            { label: "Slope", value: `${slope.toFixed(2)}pp/qtr` },
          ],
          affectedQuarters: [r[ms.length - win.length].period, last.period],
          laymanSummary: "Company keeps less profit per rupee of sales — rising cost pressure or pricing weakness.",
        });
      }
    }
  }

  // ---------- 3. Revenue acceleration / deceleration (QoQ trend) ----------
  if (r.length >= 5) {
    const rates: { period: string; rate: number }[] = [];
    for (let i = r.length - 4; i <= r.length - 1; i++) {
      if (r[i - 1] && r[i - 1].metrics.revenue > 0) {
        const rate = ((r[i].metrics.revenue - r[i - 1].metrics.revenue) / r[i - 1].metrics.revenue) * 100;
        rates.push({ period: r[i].period, rate });
      }
    }
    if (rates.length >= 3) {
      let acc = true;
      for (let i = 1; i < rates.length; i++) {
        if (rates[i].rate <= rates[i - 1].rate + 2) { acc = false; break; }
      }
      let dec = true;
      for (let i = 1; i < rates.length; i++) {
        if (rates[i].rate >= rates[i - 1].rate - 2) { dec = false; break; }
      }
      if (acc) {
        const spread = rates[rates.length - 1].rate - rates[0].rate;
        const s: PatternStrength = spread >= 15 ? "Strong" : spread >= 8 ? "Moderate" : "Weak";
        out.push({
          type: "REVENUE_ACCELERATION",
          label: "Revenue Acceleration",
          severity: "positive",
          strength: s,
          confidence: _conf(s, Math.floor(spread)),
          detail: `QoQ revenue growth accelerating: ${rates.map((rt) => rt.rate.toFixed(1) + "%").join(" -> ")} over the last ${rates.length} quarters.`,
          supportingData: rates.map((rt, i) => ({ label: `QoQ #${i + 1} (${rt.period})`, value: `${rt.rate.toFixed(1)}%` })),
          affectedQuarters: rates.map((rt) => rt.period),
          laymanSummary: "Sales growth is speeding up — demand momentum strengthening.",
        });
      } else if (dec) {
        const spread = rates[0].rate - rates[rates.length - 1].rate;
        const s: PatternStrength = spread >= 15 ? "Strong" : spread >= 8 ? "Moderate" : "Weak";
        out.push({
          type: "REVENUE_DECELERATION",
          label: "Revenue Deceleration",
          severity: "negative",
          strength: s,
          confidence: _conf(s, Math.floor(spread)),
          detail: `QoQ revenue growth decelerating: ${rates.map((rt) => rt.rate.toFixed(1) + "%").join(" -> ")} over the last ${rates.length} quarters.`,
          supportingData: rates.map((rt, i) => ({ label: `QoQ #${i + 1} (${rt.period})`, value: `${rt.rate.toFixed(1)}%` })),
          affectedQuarters: rates.map((rt) => rt.period),
          laymanSummary: "Sales growth is slowing down — demand momentum fading.",
        });
      }
    }
  }

  // ---------- 4. Earnings turnaround / reversal (loss <-> profit) ----------
  {
    const earlyPAT = first.metrics.profitAfterTax;
    const lastPAT = last.metrics.profitAfterTax;
    if (earlyPAT < 0 && lastPAT > 0) {
      const swing = lastPAT - earlyPAT;
      const s: PatternStrength = swing >= 1e9 ? "Strong" : swing >= 5e8 ? "Moderate" : "Weak";
      out.push({
        type: "EARNINGS_TURNAROUND",
        label: "Earnings Turnaround",
        severity: "positive",
        strength: s,
        confidence: _conf(s, Math.floor(Math.log10(Math.max(1, swing)))),
        detail: `Moved from a loss of ${_fmtNumShort(earlyPAT)} (${first.period}) to a profit of ${_fmtNumShort(lastPAT)} (${last.period}).`,
        supportingData: [
          { label: "Earliest PAT", value: _fmtNumShort(earlyPAT) },
          { label: "Latest PAT", value: _fmtNumShort(lastPAT) },
          { label: "Swing", value: `+${_fmtNumShort(swing)}` },
        ],
        affectedQuarters: [first.period, last.period],
        laymanSummary: "Recovered from a loss to a profit — a fundamental inflection point.",
      });
    } else if (earlyPAT > 0 && lastPAT < 0) {
      const swing = earlyPAT - lastPAT;
      const s: PatternStrength = swing >= 1e9 ? "Strong" : swing >= 5e8 ? "Moderate" : "Weak";
      out.push({
        type: "EARNINGS_REVERSAL",
        label: "Earnings Reversal",
        severity: "negative",
        strength: s,
        confidence: _conf(s, Math.floor(Math.log10(Math.max(1, swing)))),
        detail: `Moved from a profit of ${_fmtNumShort(earlyPAT)} (${first.period}) to a loss of ${_fmtNumShort(lastPAT)} (${last.period}).`,
        supportingData: [
          { label: "Earliest PAT", value: _fmtNumShort(earlyPAT) },
          { label: "Latest PAT", value: _fmtNumShort(lastPAT) },
          { label: "Swing", value: `-${_fmtNumShort(swing)}` },
        ],
        affectedQuarters: [first.period, last.period],
        laymanSummary: "Slipped from profit to loss — a fundamental deterioration.",
      });
    }
  }

  // ---------- 5. Dividend growth streak / cut (>=4 fiscal years) ----------
  // Group by FY; pick the latest DPS per FY (since DPS is declared at year-end).
  {
    const fyMap = new Map<string, QuarterlyResult>();
    for (const x of r) {
      const m = x.period.match(/FY\s?(\d+)/i);
      const fy = m ? m[1] : x.period.replace(/.*FY/, "");
      const cur = fyMap.get(fy);
      if (!cur || new Date(x.periodEnd).getTime() > new Date(cur.periodEnd).getTime()) {
        fyMap.set(fy, x);
      }
    }
    const fyYears = Array.from(fyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const divPayingYears = fyYears.filter(([, q]) => q.metrics.dividendPerShare > 0);
    if (divPayingYears.length >= 4) {
      const dpsSeries = divPayingYears.map(([, q]) => q.metrics.dividendPerShare);
      const nonDecreasing = dpsSeries.every((d, i) => i === 0 || d >= dpsSeries[i - 1] - 0.01);
      const strictlyIncreasing = dpsSeries.every((d, i) => i === 0 || d > dpsSeries[i - 1] + 0.01);
      const firstDPS = dpsSeries[0];
      const lastDPS = dpsSeries[dpsSeries.length - 1];
      const growthPct = firstDPS > 0 ? ((lastDPS - firstDPS) / firstDPS) * 100 : 0;
      if (nonDecreasing && growthPct >= 0) {
        const s: PatternStrength =
          divPayingYears.length >= 5 && strictlyIncreasing && growthPct >= 50
            ? "Strong"
            : divPayingYears.length >= 4 && strictlyIncreasing
            ? "Moderate"
            : "Weak";
        out.push({
          type: "DIVIDEND_GROWTH_STREAK",
          label: "Dividend Growth Streak",
          severity: "positive",
          strength: s,
          confidence: _conf(s, divPayingYears.length * 3),
          detail: `${divPayingYears.length} consecutive fiscal years of dividends${strictlyIncreasing ? " with increases" : " (non-decreasing)"}. DPS: Rs.${firstDPS.toFixed(2)} -> Rs.${lastDPS.toFixed(2)} (+${growthPct.toFixed(1)}%).`,
          supportingData: [
            { label: "Years paying", value: `${divPayingYears.length}` },
            { label: "First DPS", value: `Rs.${firstDPS.toFixed(2)}` },
            { label: "Latest DPS", value: `Rs.${lastDPS.toFixed(2)}` },
            { label: "Growth", value: `+${growthPct.toFixed(1)}%` },
          ],
          affectedQuarters: divPayingYears.map(([, q]) => q.period),
          laymanSummary: "Dividends paid every year, with no cuts — a shareholder-friendly, reliable payout.",
        });
      } else {
        // Find the largest YoY DPS cut
        let biggestCut = { fy: "", period: "", from: 0, to: 0, cutPct: 0 };
        for (let i = 1; i < dpsSeries.length; i++) {
          const from = dpsSeries[i - 1];
          const to = dpsSeries[i];
          if (from > 0 && to < from) {
            const cutPct = ((from - to) / from) * 100;
            if (cutPct > biggestCut.cutPct) {
              biggestCut = { fy: divPayingYears[i][0], period: divPayingYears[i][1].period, from, to, cutPct };
            }
          }
        }
        if (biggestCut.cutPct >= 5) {
          const s: PatternStrength =
            biggestCut.cutPct >= 50 ? "Strong" : biggestCut.cutPct >= 25 ? "Moderate" : "Weak";
          out.push({
            type: "DIVIDEND_CUT",
            label: "Dividend Cut",
            severity: "negative",
            strength: s,
            confidence: _conf(s, Math.floor(biggestCut.cutPct / 5)),
            detail: `DPS cut from Rs.${biggestCut.from.toFixed(2)} to Rs.${biggestCut.to.toFixed(2)} (-${biggestCut.cutPct.toFixed(1)}%) in FY${biggestCut.fy} (${biggestCut.period}).`,
            supportingData: [
              { label: "Before cut", value: `Rs.${biggestCut.from.toFixed(2)}` },
              { label: "After cut", value: `Rs.${biggestCut.to.toFixed(2)}` },
              { label: "Cut size", value: `-${biggestCut.cutPct.toFixed(1)}%` },
              { label: "When", value: `FY${biggestCut.fy}` },
            ],
            affectedQuarters: divPayingYears.map(([, q]) => q.period),
            laymanSummary: "Management reduced the dividend — a red flag for cash flow or earnings confidence.",
          });
        }
      }
    }
  }

  // ---------- 6. Long-term CAGR thresholds (>=3 yrs of data) ----------
  if (r.length >= 12) {
    const years = (new Date(last.periodEnd).getTime() - new Date(first.periodEnd).getTime()) / (365 * 24 * 60 * 60 * 1000);
    if (years >= 2.5) {
      if (first.metrics.eps > 0 && last.metrics.eps > 0) {
        const epsCAGR = computeCAGR(first.metrics.eps, last.metrics.eps, years);
        if (epsCAGR >= 5) {
          const s: PatternStrength = epsCAGR >= 20 ? "Strong" : epsCAGR >= 12 ? "Moderate" : "Weak";
          out.push({
            type: "EPS_CAGR",
            label: "EPS CAGR",
            severity: "positive",
            strength: s,
            confidence: _conf(s, Math.floor(epsCAGR / 2)),
            detail: `EPS CAGR of ${epsCAGR.toFixed(1)}% over ${years.toFixed(1)} years (Rs.${first.metrics.eps.toFixed(2)} -> Rs.${last.metrics.eps.toFixed(2)}).`,
            supportingData: [
              { label: "Period", value: `${years.toFixed(1)} yrs` },
              { label: "First EPS", value: `Rs.${first.metrics.eps.toFixed(2)}` },
              { label: "Latest EPS", value: `Rs.${last.metrics.eps.toFixed(2)}` },
              { label: "CAGR", value: `${epsCAGR.toFixed(1)}%` },
            ],
            affectedQuarters: [first.period, last.period],
            laymanSummary: "Per-share profit compounding nicely over multiple years.",
          });
        } else if (epsCAGR <= -3) {
          const s: PatternStrength = epsCAGR <= -15 ? "Strong" : epsCAGR <= -8 ? "Moderate" : "Weak";
          out.push({
            type: "EPS_NEGATIVE_CAGR",
            label: "EPS Erosion",
            severity: "negative",
            strength: s,
            confidence: _conf(s, Math.floor(-epsCAGR / 2)),
            detail: `EPS contracted at ${epsCAGR.toFixed(1)}% CAGR over ${years.toFixed(1)} years (Rs.${first.metrics.eps.toFixed(2)} -> Rs.${last.metrics.eps.toFixed(2)}).`,
            supportingData: [
              { label: "Period", value: `${years.toFixed(1)} yrs` },
              { label: "First EPS", value: `Rs.${first.metrics.eps.toFixed(2)}` },
              { label: "Latest EPS", value: `Rs.${last.metrics.eps.toFixed(2)}` },
              { label: "CAGR", value: `${epsCAGR.toFixed(1)}%` },
            ],
            affectedQuarters: [first.period, last.period],
            laymanSummary: "Per-share profit eroding year after year — a structural decline.",
          });
        }
      }
      if (first.metrics.revenue > 0 && last.metrics.revenue > 0) {
        const revCAGR = computeCAGR(first.metrics.revenue, last.metrics.revenue, years);
        if (revCAGR >= 10) {
          const s: PatternStrength = revCAGR >= 25 ? "Strong" : revCAGR >= 15 ? "Moderate" : "Weak";
          out.push({
            type: "REVENUE_CAGR",
            label: "Revenue CAGR",
            severity: "positive",
            strength: s,
            confidence: _conf(s, Math.floor(revCAGR / 2)),
            detail: `Revenue CAGR of ${revCAGR.toFixed(1)}% over ${years.toFixed(1)} years.`,
            supportingData: [
              { label: "Period", value: `${years.toFixed(1)} yrs` },
              { label: "First rev", value: _fmtNumShort(first.metrics.revenue) },
              { label: "Latest rev", value: _fmtNumShort(last.metrics.revenue) },
              { label: "CAGR", value: `${revCAGR.toFixed(1)}%` },
            ],
            affectedQuarters: [first.period, last.period],
            laymanSummary: "Top-line compounding strongly over multiple years.",
          });
        } else if (revCAGR <= -3) {
          const s: PatternStrength = revCAGR <= -15 ? "Strong" : revCAGR <= -8 ? "Moderate" : "Weak";
          out.push({
            type: "REVENUE_NEGATIVE_CAGR",
            label: "Revenue Erosion",
            severity: "negative",
            strength: s,
            confidence: _conf(s, Math.floor(-revCAGR / 2)),
            detail: `Revenue contracted at ${revCAGR.toFixed(1)}% CAGR over ${years.toFixed(1)} years.`,
            supportingData: [
              { label: "Period", value: `${years.toFixed(1)} yrs` },
              { label: "First rev", value: _fmtNumShort(first.metrics.revenue) },
              { label: "Latest rev", value: _fmtNumShort(last.metrics.revenue) },
              { label: "CAGR", value: `${revCAGR.toFixed(1)}%` },
            ],
            affectedQuarters: [first.period, last.period],
            laymanSummary: "Sales shrinking year after year — a shrinking business.",
          });
        }
      }
    }
  }

  // ---------- 7. Earnings volatility (>=6 qtrs) ----------
  if (r.length >= 6) {
    const eg = r.map((x) => x.metrics.epsYoYGrowth).filter((v) => isFinite(v));
    if (eg.length >= 6) {
      const sd = computeStdDev(eg);
      if (sd >= 18) {
        const s: PatternStrength = sd >= 40 ? "Strong" : sd >= 25 ? "Moderate" : "Weak";
        out.push({
          type: "HIGH_VOLATILITY",
          label: "High Earnings Volatility",
          severity: "negative",
          strength: s,
          confidence: _conf(s, Math.floor(sd / 5)),
          detail: `YoY EPS growth has a std-dev of ${sd.toFixed(1)}pp over the last ${eg.length} quarters — unpredictable earnings.`,
          supportingData: [
            { label: "Std dev", value: `${sd.toFixed(1)}pp` },
            { label: "Sample", value: `${eg.length} qtrs` },
            { label: "Avg growth", value: `${(eg.reduce((a, b) => a + b, 0) / eg.length).toFixed(1)}%` },
          ],
          affectedQuarters: [first.period, last.period],
          laymanSummary: "Profits swing wildly quarter-to-quarter — unpredictable earnings warrant a lower multiple.",
        });
      }
    }
  }

  // ---------- 8. Sustainable high-payout (multi-quarter, with growth) ----------
  if (r.length >= 4) {
    const last4 = r.slice(-4);
    const allSustainable = last4.every(
      (x) =>
        x.metrics.dividendPerShare > 0 &&
        x.metrics.dividendPayoutRatio >= 40 &&
        x.metrics.dividendPayoutRatio <= 85
    );
    const allGrowing = last4.every((x) => x.metrics.epsYoYGrowth > 0);
    if (allSustainable && allGrowing) {
      const avgPayout = last4.reduce((a, x) => a + x.metrics.dividendPayoutRatio, 0) / last4.length;
      const avgGrowth = last4.reduce((a, x) => a + x.metrics.epsYoYGrowth, 0) / last4.length;
      const s: PatternStrength = avgGrowth >= 20 ? "Strong" : avgGrowth >= 10 ? "Moderate" : "Weak";
      out.push({
        type: "SUSTAINABLE_PAYOUT",
        label: "Sustainable High Payout",
        severity: "positive",
        strength: s,
        confidence: _conf(s, Math.floor(avgGrowth / 2)),
        detail: `Last ${last4.length} quarters: ${avgPayout.toFixed(1)}% avg payout with ${avgGrowth.toFixed(1)}% avg EPS YoY growth — dividend covered by growing earnings.`,
        supportingData: [
          { label: "Avg payout", value: `${avgPayout.toFixed(1)}%` },
          { label: "Avg EPS YoY", value: `${avgGrowth.toFixed(1)}%` },
          { label: "Window", value: `${last4.length} qtrs` },
        ],
        affectedQuarters: last4.map((x) => x.period),
        laymanSummary: "Pays a healthy dividend AND profits are still growing — sustainable shareholder returns.",
      });
    }
  }

  // ---------- 9. Stagnant sales + falling profits ----------
  if (r.length >= 4) {
    const last4 = r.slice(-4);
    const revs = last4.map((x) => x.metrics.revenue);
    const minRev = Math.min(...revs);
    const maxRev = Math.max(...revs);
    const revSpread = minRev > 0 ? ((maxRev - minRev) / minRev) * 100 : 0;
    const pat0 = last4[0].metrics.profitAfterTax;
    const patN = last4[last4.length - 1].metrics.profitAfterTax;
    const patChange = Math.abs(pat0) > 0 ? ((patN - pat0) / Math.abs(pat0)) * 100 : 0;
    if (revSpread < 8 && patChange < -15) {
      const s: PatternStrength = patChange < -40 ? "Strong" : patChange < -25 ? "Moderate" : "Weak";
      out.push({
        type: "STAGNANT_SALES_PROF_DECLINE",
        label: "Stagnant Sales, Falling Profits",
        severity: "negative",
        strength: s,
        confidence: _conf(s, Math.floor(-patChange / 5)),
        detail: `Revenue range only ${revSpread.toFixed(1)}% (flat) but profit fell ${patChange.toFixed(1)}% over the last ${last4.length} quarters.`,
        supportingData: [
          { label: "Rev spread", value: `${revSpread.toFixed(1)}%` },
          { label: "PAT change", value: `${patChange.toFixed(1)}%` },
          { label: "Window", value: `${last4.length} qtrs` },
        ],
        affectedQuarters: last4.map((x) => x.period),
        laymanSummary: "Sales are flat while profits fall — classic cost-pressure squeeze.",
      });
    }
  }

  // === Issue 12 (preserved): Enhanced seasonal pattern detection ===
  // 12.1 — Same-calendar-quarter YoY revenue growth/decline across years
  if (r.length >= 8) {
    const byQ: Record<number, QuarterlyResult[]> = { 1: [], 2: [], 3: [], 4: [] };
    for (const x of r) {
      const mo = new Date(x.periodEnd).getMonth() + 1;
      const q: 1 | 2 | 3 | 4 = mo >= 7 && mo <= 9 ? 1 : mo >= 10 && mo <= 12 ? 2 : mo >= 1 && mo <= 3 ? 3 : 4;
      byQ[q].push(x);
    }
    for (const qNum of [1, 2, 3, 4] as const) {
      const qs = byQ[qNum];
      if (qs.length < 3) continue;
      qs.sort((a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime());
      let pos = 0, neg = 0;
      for (const x of qs) {
        if (x.metrics.revenueYoYGrowth > 5) pos++;
        else if (x.metrics.revenueYoYGrowth < -5) neg++;
      }
      // Issue 9: tighten the seasonal threshold so that borderline quarters
      // (barely 50/50 split) don't trigger. Require a clear majority and a
      // minimum count of supporting years.
      const posFrac = pos / qs.length;
      const negFrac = neg / qs.length;
      if (pos >= 4 && posFrac >= 0.6 && pos > neg + 1) {
        const s: PatternStrength = posFrac >= 0.8 ? "Strong" : posFrac >= 0.7 ? "Moderate" : "Weak";
        out.push({
          type: `SEASONAL_QUARTER_${qNum}_STRENGTH`,
          label: `Q${qNum} is a seasonally strong quarter`,
          severity: "positive",
          strength: s,
          confidence: _conf(s, pos * 4),
          detail: `Q${qNum} shows YoY revenue growth in ${pos} of ${qs.length} years (${(posFrac * 100).toFixed(0)}%) — a recurring seasonal upswing.`,
          supportingData: [
            { label: "Years up", value: `${pos}/${qs.length}` },
            { label: "Share", value: `${(posFrac * 100).toFixed(0)}%` },
            { label: "Quarter", value: `Q${qNum}` },
          ],
          affectedQuarters: qs.map((x) => x.period),
          laymanSummary: `Q${qNum} reliably books higher sales every year — the company's strongest recurring season.`,
        });
      } else if (neg >= 4 && negFrac >= 0.6 && neg > pos + 1) {
        const s: PatternStrength = negFrac >= 0.8 ? "Strong" : negFrac >= 0.7 ? "Moderate" : "Weak";
        out.push({
          type: `SEASONAL_QUARTER_${qNum}_WEAKNESS`,
          label: `Q${qNum} is a seasonally weak quarter`,
          severity: "negative",
          strength: s,
          confidence: _conf(s, neg * 4),
          detail: `Q${qNum} shows YoY revenue decline in ${neg} of ${qs.length} years (${(negFrac * 100).toFixed(0)}%) — a recurring seasonal slowdown.`,
          supportingData: [
            { label: "Years down", value: `${neg}/${qs.length}` },
            { label: "Share", value: `${(negFrac * 100).toFixed(0)}%` },
            { label: "Quarter", value: `Q${qNum}` },
          ],
          affectedQuarters: qs.map((x) => x.period),
          laymanSummary: `Q${qNum} reliably books lower sales every year — a seasonal trough to expect.`,
        });
      }
    }
  }

  return out;
}

export function groupByCompany(r:QuarterlyResult[]):{symbol:string;company:string;results:QuarterlyResult[]}[]{const m=new Map<string,QuarterlyResult[]>();for(const x of r){if(!m.has(x.symbol))m.set(x.symbol,[]);m.get(x.symbol)!.push(x);}return Array.from(m.entries()).map(([s,rs])=>({symbol:s,company:rs[0].company,results:rs.sort((a,b)=>new Date(a.periodEnd).getTime()-new Date(b.periodEnd).getTime())}));}
export function computeCAGR(s:number,e:number,y:number):number{if(s<=0||e<=0||y<=0)return 0;return(Math.pow(e/s,1/y)-1)*100;}
export function computeStdDev(v:number[]):number{if(v.length<2)return 0;const m=v.reduce((a,b)=>a+b,0)/v.length;return Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length);}
export function computeSlope(v:number[]):number{const n=v.length;if(n<2)return 0;const xs=Array.from({length:n},(_,i)=>i);const mX=xs.reduce((a,b)=>a+b,0)/n;const mY=v.reduce((a,b)=>a+b,0)/n;let num=0,den=0;for(let i=0;i<n;i++){num+=(xs[i]-mX)*(v[i]-mY);den+=(xs[i]-mX)**2;}return den>0?num/den:0;}
export function generateQuarterlySummary(r:QuarterlyResult[], symbol?:string):QuarterSummary[]{if(r.length<4)return[];const sector=classifySector(symbol);const byQ:Record<number,QuarterlyResult[]>={1:[],2:[],3:[],4:[]};const byY=new Map<string,QuarterlyResult[]>();for(const x of r){const mo=new Date(x.periodEnd).getMonth()+1;let q:1|2|3|4=mo>=7&&mo<=9?1:mo>=10&&mo<=12?2:mo>=1&&mo<=3?3:4;byQ[q].push(x);const fy=x.period.replace(/.*FY/,"");if(!byY.has(fy))byY.set(fy,[]);byY.get(fy)!.push(x);}const sums:QuarterSummary[]=[];for(const qNum of[1,2,3,4]as const){const qs=byQ[qNum];if(!qs.length)continue;let tr=0,tv=0;for(const[_,yr]of Array.from(byY.entries())){const yt=yr.reduce((s,x)=>s+x.metrics.revenue,0);const qr=yr.find(x=>{const m=new Date(x.periodEnd).getMonth()+1;return(m>=7&&m<=9&&qNum===1)||(m>=10&&m<=12&&qNum===2)||(m>=1&&m<=3&&qNum===3)||(m>=4&&m<=6&&qNum===4);});if(qr&&yt>0){tr+=qr.metrics.revenue/yt;tv++;}}const arP=tv>0?(tr/tv)*100:25;let tp=0,tpv=0;for(const[_,yr]of Array.from(byY.entries())){const yt=yr.reduce((s,x)=>s+x.metrics.profitAfterTax,0);const qr=yr.find(x=>{const m=new Date(x.periodEnd).getMonth()+1;return(m>=7&&m<=9&&qNum===1)||(m>=10&&m<=12&&qNum===2)||(m>=1&&m<=3&&qNum===3)||(m>=4&&m<=6&&qNum===4);});if(qr&&yt>0){tp+=qr.metrics.profitAfterTax/yt;tpv++;}}const apP=tpv>0?(tp/tpv)*100:25;const am=qs.reduce((s,x)=>s+x.metrics.netMargin,0)/qs.length;let tp_:QuarterSummary["typicalPattern"];if(arP<22)tp_="low";else if(arP>28)tp_="peak";else if(qNum===1)tp_="low";else if(qNum===4)tp_="peak";else if(qNum===2)tp_="rising";else tp_="moderate";const pq=qNum===1?4:qNum-1;const pqs=byQ[pq]||[];const par=pqs.length>0?pqs.reduce((s,x)=>s+x.metrics.revenue,0)/pqs.length:0;const car=qs.reduce((s,x)=>s+x.metrics.revenue,0)/qs.length;const st=par>0?(car>par*1.03?"up":car<par*0.97?"down":"flat"):"flat";const ppr=pqs.length>0?pqs.reduce((s,x)=>s+x.metrics.profitAfterTax,0)/pqs.length:0;const cap=qs.reduce((s,x)=>s+x.metrics.profitAfterTax,0)/qs.length;const pt=ppr>0?(cap>ppr*1.03?"up":cap<ppr*0.97?"down":"flat"):"flat";const sd=st==="up"?"go UP":st==="down"?"go DOWN":"stay FLAT";const pd=pt==="up"?"go UP":pt==="down"?"go DOWN":"stay FLAT";const ml=qNum===1?"Jul-Sep":qNum===2?"Oct-Dec":qNum===3?"Jan-Mar":"Apr-Jun";let s="";switch(tp_){case"low":s=`In Q${qNum}, sales typically ${sd} from the previous quarter. This is the off-season — lower volumes. Profits usually ${pd} too.`;break;case"rising":s=`In Q${qNum}, sales ${sd} strongly — the seasonal tailwind kicks in. Profits ${pd} as the company scales up.`;break;case"peak":s=`In Q${qNum}, sales ${sd} and often peak for the year. The company books its largest profit. Management often declares dividends here.`;break;case"moderate":s=`In Q${qNum}, sales ${sd} — stabilizing at moderate levels. Profits ${pd}. Transition quarter.`;break;}const cs=getSectorCauseSummary(sector,qNum);sums.push({quarter:qNum,quarterLabel:`Q${qNum}`,monthsLabel:ml,avgRevenuePctOfTotal:arP,avgProfitPctOfTotal:apP,avgNetMargin:am,typicalPattern:tp_,summary:s,causeSummary:cs});}return sums;}
