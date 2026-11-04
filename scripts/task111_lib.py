#!/usr/bin/env python3
"""Task 111 shared library — artifact envelope, universe, volatility state,
overlay-capable portfolio engine, benchmarks. Reuses task110_lib (read-only)
for the deterministic cost schedule, MA/crossover math and variance estimators."""
from __future__ import annotations
import json, math, statistics, sys, hashlib, sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task110_lib as L  # noqa: E402
import task110_phases_research as R  # noqa: E402  (compute_symbol_indicators, run_portfolio)

T111 = ROOT / "data" / "backtest_reports" / "task111"
SIG_DIR = T111 / "signals"
CACHE_NEWS = ROOT / "data" / "cache" / "task111" / "news"
GENERATION_ID = "task111-llm-multisource-gen1"

# Mirrors CAPITAL_PROTECTION_RULES in src/lib/latent/llm/stock-signal-engine.ts
def task111_rules() -> dict:
    return {
        "maxRiskPerPositionPct": 2.0,
        "maxOpenRiskPct": 6.0,
        "maxExposurePct": 100.0,
        "drawdownAlertPct": 5.0,
        "drawdownPausePct": 10.0,
        "minEvidenceQualityForBuy": 35,
        "minRRDefault": 1.5,
        "leverage": "never",
        "shortSelling": "structurally unsupported",
    }


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def git_head() -> str:
    import subprocess
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                              capture_output=True, text=True).stdout.strip()
    except Exception:
        return "unknown"


def artifact(name: str, report: str, status: str, base: Path | None = None, **fields) -> dict:
    """Write an artifact with the mandatory metadata envelope. `base` overrides
    the destination directory (defaults to the task111 report directory)."""
    obj = {
        "report": report,
        "task": "task112" if (base is not None and "task112" in str(base)) else "task111",
        "generated_at": now_iso(),
        "git_head": git_head(),
        "status": status,
        **fields,
    }
    dest = base or T111
    dest.mkdir(parents=True, exist_ok=True)
    (dest / name).write_text(json.dumps(obj, indent=1, default=str), encoding="utf-8")
    return obj


def write_csv(p: Path, rows: list[dict], fields: list[str]) -> int:
    p.parent.mkdir(parents=True, exist_ok=True)
    import csv
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)
    return len(rows)


def jread(p: Path):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


# ── volatility state (universe-wide, deterministic) ──────────────────────────
def universe_vol_state(inds: dict) -> dict:
    """Per-global-session realized-vol / BBW state across the universe.
    Realized estimators only (no implied vol exists for PSX)."""
    sess = L.sessions()
    sidx = {d: i for i, d in enumerate(sess)}
    n = len(sess)
    vol20 = [None] * n
    bbw = [None] * n
    contributions = [0] * n
    for s, ind in inds.items():
        closes = ind["closes"]
        rets = [None] * len(closes)
        for k in range(1, len(closes)):
            if closes[k] and closes[k - 1]:
                rets[k] = __import__("math").log(closes[k] / closes[k - 1])
        r20 = L.rolling_sample_variance(rets, 20)
        # BBW 20/2 per symbol
        m20 = L.rolling_mean(closes, 20)
        v20 = L.rolling_sample_variance(closes, 20)
        for k, d in enumerate(ind["idx"] if "idx" in ind else []):
            pass
        # map symbol bar positions to global sessions
        for k, b in enumerate(ind["bars"]):
            gi = sidx.get(b["date"])
            if gi is None or not b["valid"]:
                continue
            if r20[k] is not None and r20[k] >= 0:
                ann = (r20[k] ** 0.5) * (252 ** 0.5) * 100
                vol20[gi] = ann if vol20[gi] is None else vol20[gi] + ann
                contributions[gi] += 1
            if m20[k] is not None and m20[k] > 0 and v20[k] is not None:
                width = (2 * 2 * (v20[k] ** 0.5)) / m20[k] * 100
                bbw[gi] = width if bbw[gi] is None else bbw[gi] + width
    out = {"vol20_mean": [], "bbw_mean": [], "sessions": []}
    for i in range(n):
        out["sessions"].append(sess[i])
        out["vol20_mean"].append(round(vol20[i] / contributions[i], 3) if contributions[i] else None)
        out["bbw_mean"].append(round(bbw[i] / contributions[i], 3) if contributions[i] else None)
    return out


def vol_percentile_bands(vol_series: list[float | None], lookback: int = 250) -> tuple[float, float]:
    """Predeclared Normal/High bands: 40th/80th percentile of trailing history."""
    xs = sorted(v for v in vol_series if v is not None)
    if len(xs) < 50:
        return (None, None)

    def pct(p):
        i = min(len(xs) - 1, max(0, int(p * (len(xs) - 1))))
        return xs[i]
    return (pct(0.40), pct(0.80))


# ── overlay-capable portfolio engine (mirrors task110 execution semantics) ───
def run_portfolio_overlay(inds: dict, sizing_fn=None, pause_fn=None,
                          initial_capital=100_000.0, max_positions=5,
                          tax_profile="ATL_15") -> dict:
    """Same execution rules as task110 run_portfolio (signal at close t fills at
    next global session open; sells first; whole shares; V2 costs; no leverage,
    no shorts) with two research hooks: sizing_fn(symbol, date, base_pct) ->
    multiplier in [0,1] applied to position size, and pause_fn(date) -> True
    suppresses new BUY fills that session (drawdown protection). Entry signals
    are NEVER changed — only size/exposure, per the overlay contract."""
    sess = L.sessions()
    sidx = {d: i for i, d in enumerate(sess)}
    uni = sorted(inds)
    look = {}
    for s in uni:
        ind = inds[s]
        look[s] = {ind["bars"][k]["date"]: k for k in range(len(ind["bars"])) if ind["bars"][k]["valid"]}
    start_i = None
    for i in range(40, len(sess)):
        n = sum(1 for s in uni for d in [sess[i]] if d in look[s] and inds[s]["ma30"][look[s][d]] is not None)
        if n >= min(5, len(uni)):
            start_i = i
            break
    start_i = start_i or 40
    cash = initial_capital
    pos: dict[str, dict] = {}
    pending: list[dict] = []
    realized = 0.0
    trades, daily = [], []
    peak, max_dd = initial_capital, 0.0
    tot_buy_value = 0.0
    max_concentration = 0.0

    def mark(sym, i):
        ind = inds[sym]
        lk = look[sym]
        while i >= 0:
            p = lk.get(sess[i])
            if p is not None:
                return ind["closes"][p]
            i -= 1
        return None

    for i in range(start_i, len(sess)):
        d = sess[i]
        # fills
        sells = sorted([e for e in pending if e["signal"] == "DEATH"], key=lambda e: e["symbol"])
        buys = sorted([e for e in pending if e["signal"] == "GOLDEN"], key=lambda e: e["symbol"])
        pending = []
        for e in sells:
            s = e["symbol"]
            if s not in pos:
                continue
            p = look[s].get(d)
            if p is None or not inds[s]["bars"][p]["valid"]:
                continue
            px = inds[s]["bars"][p]["open"]
            sh = pos[s]["shares"]
            gross = (px - pos[s]["entry_px"]) * sh
            tc = L.trade_costs_v2(sh, pos[s]["entry_px"], [(sh, px)], gross, tax_profile)
            sell = L.side_costs(sh, px)
            cash += px * sh - sell["side_total"]
            realized += gross - sell["side_total"] - tc["cgt"]
            trades.append(dict(symbol=s, exit_date=d, exit_px=px, shares=sh, entry_px=pos[s]["entry_px"],
                               entry_date=pos[s]["entry_date"], gross_pnl=round(gross, 2),
                               costs=round(sell["side_total"] + tc["cgt"], 2), net_pnl=round(gross - sell["side_total"] - tc["cgt"], 2)))
            del pos[s]
        for e in buys:
            s = e["symbol"]
            if pause_fn and pause_fn(d):
                continue
            if s in pos or len(pos) >= max_positions:
                continue
            p = look[s].get(d)
            if p is None or not inds[s]["bars"][p]["valid"]:
                continue
            px = inds[s]["bars"][p]["open"]
            mult = sizing_fn(s, d) if sizing_fn else 1.0
            mult = max(0.0, min(1.0, mult))
            budget = min(cash, (cash + sum(pp["shares"] * (mark(pp["symbol"], i) or pp["entry_px"]) for pp in pos.values())) * 0.20 * mult)
            sh = int(budget / px) if px > 0 else 0
            if sh < 1:
                continue
            buy = L.side_costs(sh, px)
            if buy["side_total"] + px * sh > cash:
                sh -= 1
                if sh < 1:
                    continue
                buy = L.side_costs(sh, px)
            cost = px * sh + buy["side_total"]
            cash -= cost
            tot_buy_value += px * sh
            pos[s] = dict(symbol=s, entry_date=d, entry_px=px, shares=sh)
        # pending from today's closes
        for s in uni:
            lk = look[s]
            p = lk.get(d)
            if p is None:
                continue
            x = inds[s]["sig"][p]
            if x:
                pending.append(dict(symbol=s, signal=x))
        # mark to market
        inv = 0.0
        for s, pp in pos.items():
            m = mark(s, i)
            if m:
                inv += pp["shares"] * m
        equity = cash + inv
        peak = max(peak, equity)
        dd = (equity - peak) / peak
        max_dd = min(max_dd, dd)
        if equity > 0 and inv > 0:
            for pp in pos.values():
                m2 = mark(pp["symbol"], i)
                if m2:
                    max_concentration = max(max_concentration, (pp["shares"] * m2) / equity)
        daily.append(dict(date=d, cash=round(cash, 2), invested=round(inv, 2), equity=round(equity, 2),
                          drawdown_pct=round(dd * 100, 3), open_positions=len(pos),
                          exposure_pct=round(100 * inv / equity, 2) if equity > 0 else 0.0))
    wins = [t for t in trades if t["net_pnl"] > 0]
    losses = [t for t in trades if t["net_pnl"] <= 0]
    gw = sum(t["net_pnl"] for t in wins)
    gl = abs(sum(t["net_pnl"] for t in losses))
    final_equity = daily[-1]["equity"] if daily else initial_capital
    eqs = [row["equity"] for row in daily]
    rets = [math.log(eqs[i] / eqs[i - 1]) for i in range(1, len(eqs)) if eqs[i - 1] > 0 and eqs[i] > 0]
    ann_vol = round((statistics.pstdev(rets) * math.sqrt(252)) * 100, 3) if len(rets) >= 20 else None
    avg_eq = sum(eqs) / len(eqs) if eqs else initial_capital
    return dict(
        annualized_volatility_pct=ann_vol,
        avg_exposure_pct=round(sum(r["exposure_pct"] for r in daily) / max(1, len(daily)), 2),
        turnover=round(tot_buy_value / avg_eq, 3) if avg_eq > 0 else None,
        max_single_position_concentration_pct=round(max_concentration * 100, 2),
        cash_utilization_pct=round(100 - (sum(r["exposure_pct"] for r in daily) / max(1, len(daily))), 2),
        _daily=daily,
        initial_capital=initial_capital,
        final_equity=round(final_equity, 2),
        realized_net_pnl=round(realized, 2),
        unrealized_pnl=round(final_equity - initial_capital - realized, 2),
        roi_pct=round((final_equity / initial_capital - 1) * 100, 3),
        max_drawdown_pct=round(max_dd * 100, 3),
        trades=len(trades),
        wins=len(wins),
        losses=len(losses),
        win_rate_pct=round(100 * len(wins) / len(trades), 2) if trades else 0.0,
        profit_factor=round(gw / gl, 4) if gl > 0 else None,
        exposure_note="cash-constrained, whole shares, no leverage, no shorts, V2 costs (psx_user_schedule_v2)",
    )


# ── benchmarks ───────────────────────────────────────────────────────────────
def benchmark_cash(initial=100_000.0) -> dict:
    return dict(strategy="cash_no_trade", initial_capital=initial, final_equity=initial,
                roi_pct=0.0, max_drawdown_pct=0.0, trades=0,
                note="cash baseline — no market risk, no costs")


def benchmark_buy_hold_equal_weight(inds: dict, initial=100_000.0, tax_profile="ATL_15") -> dict:
    """Equal-weight buy-and-hold across the universe at the first common session
    with MA30 warmup (same execution/cost semantics, sold at the final session)."""
    sess = L.sessions()
    sidx = {d: i for i, d in enumerate(sess)}
    uni = sorted(inds)
    start_i = None
    for i in range(40, len(sess)):
        n = sum(1 for s in uni for d in [sess[i]] if d in {b["date"] for k, b in enumerate(inds[s]["bars"]) if inds[s]["bars"][k]["valid"]} and inds[s]["ma30"][[b["date"] for k, b in enumerate(inds[s]["bars"]) if inds[s]["bars"][k]["valid"]].index(sess[i])] is not None)
        if n >= min(5, len(uni)):
            start_i = i
            break
    start_i = start_i or 40
    per = initial / max(1, len(uni))
    total = 0.0
    cost_tot = 0.0
    for s in uni:
        ind = inds[s]
        lk = {b["date"]: k for k, b in enumerate(ind["bars"]) if ind["bars"][k]["valid"]}
        entry_d = next((sess[i] for i in range(start_i, len(sess)) if sess[i] in lk), None)
        if entry_d is None:
            continue
        k0 = lk[entry_d]
        px0 = ind["bars"][k0]["open"]
        sh = int(per / px0) if px0 > 0 else 0
        if sh < 1:
            continue
        buy = L.side_costs(sh, px0)
        # last valid close at/before frontier
        k1 = max(lk.values())
        px1 = ind["closes"][k1]
        out_d = ind["bars"][k1]["date"]
        sell = L.side_costs(sh, px1)
        gross = (px1 - px0) * sh
        tc = L.trade_costs_v2(sh, px0, [(sh, px1)], gross, tax_profile)
        cost_tot += buy["side_total"] + sell["side_total"] + tc["cgt"]
        total += sh * px1 - sell["side_total"] - tc["cgt"]
    invested = initial
    final = total
    return dict(strategy="buy_hold_equal_weight", initial_capital=initial, final_equity=round(final, 2),
                roi_pct=round((final / initial - 1) * 100, 3),
                total_costs=round(cost_tot, 2),
                note="equal-weight whole-share buy&hold at first common MA30-warm session, marked at frontier close, V2 costs")


def load_llm_signals() -> dict[str, dict]:
    out = {}
    if SIG_DIR.exists():
        for p in sorted(SIG_DIR.glob("*.json")):
            if p.name.endswith(".evidence.json"):
                continue
            try:
                out[p.stem] = jread(p)
            except Exception:
                pass
    return out
