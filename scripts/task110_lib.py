#!/usr/bin/env python3
"""Task 110 — shared research library: data access, V2 cost engine port (parity
with src/lib/latent/trading-costs.ts), MA7/30 + Golden Cross rules, rolling
variance estimators (close-to-close / Parkinson / Garman-Klass), BBW, discrete
derivatives with session-gap guard, volatility regime classifier.

Conventions (documented in docs/task110-*.md):
  - Prices are RAW (provider 'psxdata' daily OHLC, not corporate-action adjusted).
  - A valid bar has o,h,l,c > 0 and h >= l; invalid bars are excluded from
    indicator input windows and counted as diagnostics (never zero-filled).
  - Session calendar = distinct OhlcvBar dates with >= MIN_SESSION_SYMBOLS bars
    (provider-data decided; no weekday arithmetic).
  - SMA_n(t) needs exactly n valid closes ending at t (full warmup, else None).
  - Crossover needs two consecutive valid MA observations; equality counts as
    "at-or-below" for Golden Cross and "at-or-above" for Death Cross.
  - Variance estimators are annualized exactly once (x252). GK negatives are
    kept in the series (no clipping) and reported as diagnostics; sqrt of a
    negative annualized variance yields None (volatility unavailable).
  - Derivatives are first/second differences between session-adjacent
    observations only (global-calendar index step == 1); across a data gap the
    derivative is None with a gap flag.
"""
from __future__ import annotations
import csv, json, sqlite3, statistics, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import task107_lib as LB  # noqa: E402  (PILOT25, db_connect, PKT, ...)

T110 = ROOT / "data/backtest_reports/task110"
DB_PATH = ROOT / "db/custom.db"
NOW = lambda: datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
GIT_HEAD = lambda: subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                                  capture_output=True, text=True).stdout.strip()

# ─── cost model: exact port of PSX_USER_SCHEDULE_V2 / computeSideCosts / ─────
# computeTradeCostsV2 (src/lib/latent/trading-costs.ts). Do not reorder ops.
TAX_RATES = {"ATL_15": 0.15, "NON_ATL_30": 0.30}
V2 = dict(commission_rate=0.0015, fixed_per_share=0.03, fixed_threshold=20.0,
          psx=0.0000035, nccpl=0.0000081, cdc=0.000036, slippage=0.0)


def side_costs(qty: float, price: float) -> dict:
    tv = price * qty
    if price > 0 and price <= V2["fixed_threshold"]:
        brokerage = qty * V2["fixed_per_share"]
    else:
        brokerage = tv * V2["commission_rate"]
    psx = tv * V2["psx"]
    nccpl = tv * V2["nccpl"]
    cdc = tv * V2["cdc"]
    slip = tv * V2["slippage"]
    return dict(transaction_value=tv, brokerage=brokerage, psx=psx, nccpl=nccpl,
                cdc=cdc, slippage=slip, side_total=brokerage + psx + nccpl + cdc + slip)


def trade_costs_v2(buy_qty: float, buy_price: float, exit_legs: list[tuple[float, float]],
                   gross_pnl: float, tax_profile: str = "ATL_15") -> dict:
    b = side_costs(buy_qty, buy_price)
    tot = {k: b[k] for k in ("brokerage", "psx", "nccpl", "cdc", "slippage")}
    for lq, lp in exit_legs:
        s = side_costs(lq, lp)
        for k in ("brokerage", "psx", "nccpl", "cdc", "slippage"):
            tot[k] += s[k]
    rate = TAX_RATES.get(tax_profile, 0.15)
    cgt = gross_pnl * rate if gross_pnl > 0 else 0.0
    total = tot["brokerage"] + tot["psx"] + tot["nccpl"] + tot["cdc"] + tot["slippage"] + cgt
    return dict(total_brokerage=tot["brokerage"], total_psx=tot["psx"],
                total_nccpl=tot["nccpl"], total_cdc=tot["cdc"], cgt=cgt,
                slippage=tot["slippage"], total_cost=total, gross_pnl=gross_pnl,
                net_pnl=gross_pnl - total, tax_profile=tax_profile, cgt_rate=rate)


# ─── data access ─────────────────────────────────────────────────────────────
_conn: sqlite3.Connection | None = None


def db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    return _conn


def bar_is_valid(b: dict) -> bool:
    return (b["open"] > 0 and b["high"] > 0 and b["low"] > 0 and b["close"] > 0
            and b["high"] >= b["low"])


def load_bars(symbol: str) -> list[dict]:
    rows = db().execute(
        "SELECT date, open, high, low, close, volume FROM OhlcvBar "
        "WHERE symbol=? ORDER BY date", (symbol,)).fetchall()
    return [dict(date=r[0], open=r[1], high=r[2], low=r[3], close=r[4],
                 volume=r[5], valid=bar_is_valid(dict(date=r[0], open=r[1], high=r[2],
                                                      low=r[3], close=r[4]))) for r in rows]


MIN_SESSION_SYMBOLS = 10


def sessions() -> list[str]:
    """Global PSX session calendar from provider data (>= MIN_SESSION_SYMBOLS bars)."""
    rows = db().execute(
        "SELECT date, COUNT(*) n FROM OhlcvBar GROUP BY date HAVING n>=? ORDER BY date",
        (MIN_SESSION_SYMBOLS,)).fetchall()
    return [r[0] for r in rows]


def session_index() -> dict[str, int]:
    return {d: i for i, d in enumerate(sessions())}


def symbol_summary(symbol: str) -> dict:
    r = db().execute(
        "SELECT COUNT(*), MIN(date), MAX(date), "
        "SUM(CASE WHEN open>0 AND high>0 AND low>0 AND close>0 AND high>=low THEN 1 ELSE 0 END), "
        "SUM(CASE WHEN high<low THEN 1 ELSE 0 END), "
        "SUM(CASE WHEN open<=0 OR close<=0 OR high<=0 OR low<=0 THEN 1 ELSE 0 END) "
        "FROM OhlcvBar WHERE symbol=?", (symbol,)).fetchone()
    return dict(symbol=symbol, bars=r[0], first=r[1], last=r[2], valid=r[3],
                high_lt_low=r[4], nonpositive=r[5])


def universe() -> list[str]:
    """Task 109-consistent research universe: PILOT25 symbols with sufficient
    history (>= 300 valid sessions) and fresh data (last session within 14
    calendar days of the global frontier). Deterministic and documented."""
    sess = sessions()
    frontier = sess[-1]
    out = []
    for s in LB.PILOT25:
        summ = symbol_summary(s)
        if summ["bars"] == 0:
            continue
        valid_share = (summ["valid"] or 0) / summ["bars"]
        if summ["valid"] >= 300 and valid_share >= 0.95 and summ["last"] >= add_days(frontier, -14):
            out.append(s)
    return sorted(out)


def add_days(date_s: str, days: int) -> str:
    d = datetime.strptime(date_s, "%Y-%m-%d")
    return (d + __import__("datetime").timedelta(days=days)).strftime("%Y-%m-%d")


# ─── indicators ──────────────────────────────────────────────────────────────

def sma_series(closes: list[float | None], n: int) -> list[float | None]:
    """SMA over exactly n valid observations ending at t; None during warmup.
    None inputs (invalid bars) are skipped by shifting the window backward over
    valid values only (window is n VALID sessions, per spec)."""
    out: list[float | None] = []
    window: list[float] = []
    for c in closes:
        if c is None:
            out.append(None)
            continue
        window.append(c)
        if len(window) > n:
            window.pop(0)
        out.append(sum(window) / n if len(window) == n else None)
    return out


def ma_relations(ma7: list[float | None], ma30: list[float | None]) -> list[int | None]:
    """+1 if MA7>MA30, 0 if equal, -1 if MA7<MA30, None if either missing."""
    out: list[int | None] = []
    for a, b in zip(ma7, ma30):
        out.append(None if a is None or b is None else (1 if a > b else (0 if a == b else -1)))
    return out


def crossovers(rel: list[int | None]) -> list[str | None]:
    """Golden/Death cross from two consecutive valid observations.
    prev<=0 and cur==+1 -> GOLDEN; prev>=0 and cur==-1 -> DEATH; else None.
    The first valid row can never be a signal (no previous relation)."""
    out: list[str | None] = []
    for t in range(len(rel)):
        prev, cur = (rel[t - 1], rel[t]) if t > 0 else (None, rel[t])
        sig = None
        if prev is not None and cur is not None:
            if prev <= 0 and cur == 1:
                sig = "GOLDEN"
            elif prev >= 0 and cur == -1:
                sig = "DEATH"
        out.append(sig)
    return out


# ─── volatility analytics ────────────────────────────────────────────────────
ANNUALIZATION = 252.0
LN2 = 0.6931471805599453


def log_returns(closes: list[float | None]) -> list[float | None]:
    out: list[float | None] = [None]
    for t in range(1, len(closes)):
        a, b = closes[t - 1], closes[t]
        out.append(None if a in (None, 0) or b in (None, 0) else __import__("math").log(b / a))
    return out


def rolling_mean(xs: list[float | None], n: int) -> list[float | None]:
    return sma_series(xs, n)


def rolling_sample_variance(xs: list[float | None], n: int) -> list[float | None]:
    """Sample variance (ddof=1) over exactly n valid consecutive observations.
    Consecutive means adjacent elements of the input series (pre-filtered to
    valid rows by the caller); any None yields None (no partial windows)."""
    out: list[float | None] = []
    for t in range(len(xs)):
        seg = xs[t - n + 1: t + 1] if t >= n - 1 else None
        if seg is None or any(v is None for v in seg):
            out.append(None)
            continue
        out.append(statistics.variance(seg))  # ddof=1
    return out


def parkinson_daily_variance(highs: list[float | None], lows: list[float | None],
                             n: int) -> list[float | None]:
    """(1/(4 ln2)) * mean[ ln(H/L)^2 ] over n valid sessions — DAILY variance.
    Annualization (x252, once) is applied by the caller."""
    import math
    terms: list[float | None] = []
    for h, l in zip(highs, lows):
        terms.append(None if h is None or l is None or l <= 0 or h < l else math.log(h / l) ** 2)
    means = rolling_mean(terms, n)
    return [None if m is None else m / (4.0 * LN2) for m in means]


def garman_klass_daily_variance(opens: list[float | None], highs: list[float | None],
                                lows: list[float | None], closes: list[float | None],
                                n: int) -> list[float | None]:
    """mean[ 0.5 ln(H/L)^2 - (2 ln2 - 1) ln(C/O)^2 ] — DAILY variance.
    Negatives are kept (no clipping) and flagged by the caller."""
    import math
    terms: list[float | None] = []
    for o, h, l, c in zip(opens, highs, lows, closes):
        if None in (o, h, l, c) or min(o, h, l, c) <= 0 or h < l:
            terms.append(None)
            continue
        terms.append(0.5 * math.log(h / l) ** 2 - (2 * LN2 - 1) * math.log(c / o) ** 2)
    return rolling_mean(terms, n)


def first_diff(xs: list[float | None], idx_by_pos: list[int] | None = None,
               require_adjacent: bool = True) -> list[float | None]:
    """d1[t] = x[t]-x[t-1]; None if either side missing or (require_adjacent)
    the two observations are not adjacent on the global session calendar."""
    out: list[float | None] = []
    for t in range(len(xs)):
        if t == 0 or xs[t] is None or xs[t - 1] is None:
            out.append(None)
            continue
        if require_adjacent and idx_by_pos is not None and idx_by_pos[t] - idx_by_pos[t - 1] != 1:
            out.append(None)
            continue
        out.append(xs[t] - xs[t - 1])
    return out


def second_diff(d1: list[float | None], idx_by_pos: list[int] | None = None) -> list[float | None]:
    """d2[t] = d1[t]-d1[t-1]; requires d1 at t-1 AND t-2 with adjacency of
    (t-2,t-1) and (t-1,t)."""
    out: list[float | None] = []
    for t in range(len(d1)):
        ok = t >= 2 and d1[t] is not None and d1[t - 1] is not None and d1[t - 2] is not None
        if ok and idx_by_pos is not None:
            ok = (idx_by_pos[t] - idx_by_pos[t - 1] == 1 and
                  idx_by_pos[t - 1] - idx_by_pos[t - 2] == 1)
        out.append((d1[t] - d1[t - 1]) if ok else None)
    return out


# ─── volatility regime classifier ────────────────────────────────────────────
# States (research watches only — never executable signals):
REGIME_STATES = ["long_vol_watch", "volatility_expansion", "volatility_compression",
                 "short_vol_watch", "mean_reversion_watch", "transition", "wait",
                 "insufficient_data"]


def classify_regime(bbw: float | None, bbw_d1: float | None, bbw_d2: float | None,
                    park_ann: float | None, gk_ann: float | None,
                    park_d1: float | None, cc_d1: float | None,
                    prev_regime: str | None) -> tuple[str, str]:
    """Persistence rule: an expansion/compression watch requires the BBW
    derivative condition on the CURRENT and PREVIOUS observation (d1 and d2
    same sign twice) plus at least one realized-variance estimator confirming
    (d1 same sign). Returns (regime, reason)."""
    need = (bbw is not None and bbw_d1 is not None and bbw_d2 is not None)
    if not need:
        return "insufficient_data", "BBW or derivatives missing (warmup/gap)"
    expansion_now = bbw_d1 > 0 and bbw_d2 > 0
    compression_now = bbw_d1 < 0 and bbw_d2 < 0
    vol_confirm_up = (park_d1 is not None and park_d1 > 0) or (cc_d1 is not None and cc_d1 > 0)
    vol_confirm_dn = (park_d1 is not None and park_d1 < 0) or (cc_d1 is not None and cc_d1 < 0)
    rel = gk_ann if (gk_ann is not None and park_ann is not None and park_ann > 0) else None
    gk_park_ratio = (gk_ann / park_ann) if rel is not None else None
    if expansion_now and vol_confirm_up:
        return "long_vol_watch", "BBW d1>0 and d2>0 with realized-variance expansion confirmation (research watch; NOT implied volatility, NOT an option signal)"
    if compression_now and vol_confirm_dn:
        return "volatility_compression", "BBW d1<0 and d2<0 with realized-variance contraction confirmation (research watch; distinct from short-option premium selling)"
    if bbw_d1 > 0:
        return "volatility_expansion", "BBW first derivative positive (single-observation; persistence not yet confirmed)"
    if bbw_d1 < 0:
        return "mean_reversion_watch", "BBW contracting (d1<0); price-based mean reversion is a separate hypothesis requiring return evidence"
    return "wait", "no expansion/compression condition met"


# ─── artifact helpers ────────────────────────────────────────────────────────

def jwrite(p: Path, obj) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, indent=1, default=str))


def jread(p: Path):
    return json.loads(Path(p).read_text())


def artifact(name: str, report: str, status: str, **fields) -> dict:
    obj = {"report": report, "task": "task110", "generated_at": NOW(),
           "git_head": GIT_HEAD(), "status": status, **fields}
    jwrite(T110 / name, obj)
    return obj


def write_csv(p: Path, rows: list[dict], fields: list[str]) -> int:
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in fields})
    return len(rows)
