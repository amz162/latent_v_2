#!/usr/bin/env python3
"""Task 110 research phases 2-5: data readiness, MA7/30, Golden Cross strategy,
cash-constrained portfolio simulation with full daily/trade ledgers."""
from __future__ import annotations
import statistics, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import task110_lib as L

DEFAULT_CAPITAL = 100_000.0
DEFAULT_SIZING_PCT = 0.20
DEFAULT_MAX_POSITIONS = 5
SERIES_TAIL_SESSIONS = 500  # per-symbol rows persisted in series CSVs (bounded)


# ─── phase 2 ─────────────────────────────────────────────────────────────────
def p2_data_inventory():
    sess = L.sessions()
    sidx = {d: i for i, d in enumerate(sess)}
    frontier = sess[-1]
    totals = L.db().execute("SELECT COUNT(*), COUNT(DISTINCT symbol) FROM OhlcvBar").fetchone()
    dup = L.db().execute(
        "SELECT COUNT(*) FROM (SELECT symbol,date,COUNT(*) n FROM OhlcvBar GROUP BY 1,2 HAVING n>1)"
    ).fetchone()[0]
    bad = L.db().execute(
        "SELECT COUNT(*) FROM OhlcvBar WHERE high<low OR open<=0 OR close<=0 OR high<=0 OR low<=0"
    ).fetchone()[0]
    # per-symbol coverage for the candidate universe + aggregate for the rest
    cov, uni = [], L.universe()
    for s in [r[0] for r in L.db().execute("SELECT DISTINCT symbol FROM OhlcvBar ORDER BY symbol")]:
        sm = L.symbol_summary(s)
        dates = [r[0] for r in L.db().execute("SELECT DISTINCT date FROM OhlcvBar WHERE symbol=? ORDER BY date", (s,))]
        # missing sessions vs global calendar over the symbol's own span (bounded work)
        span_idx = [sidx[d] for d in dates if d in sidx]
        missing = (span_idx[-1] - span_idx[0] + 1 - len(span_idx)) if len(span_idx) > 1 else 0
        gap_sessions = frontier_idx = None
        sm.update(missing_sessions_in_span=missing,
                  stale=(sm["last"] < L.add_days(frontier, -14)),
                  last_session_idx=span_idx[-1] if span_idx else None,
                  fresh=(sm["last"] >= L.add_days(frontier, -14)),
                  in_universe=s in uni)
        cov.append(sm)
    L.artifact("task110_market_data_inventory.json", "task110_market_data_inventory", "completed",
               source="db/custom.db OhlcvBar (provider psxdata)", frontier_session=frontier,
               total_bars=totals[0], total_symbols=totals[1], duplicate_symbol_dates=dup,
               invalid_bars=bad, invalid_bar_pct=round(100 * bad / totals[0], 3),
               session_calendar_basis=f"distinct dates with >={L.MIN_SESSION_SYMBOLS} bars (provider-data decided)",
               session_count=len(sess), universe=uni,
               universe_rule="PILOT25 ∩ valid>=300 sessions ∩ valid_share>=95% ∩ fresh(14d)",
               limitations=["raw unadjusted prices (no corporate-action adjustment available from provider)",
                            "34,525 bars violate h>=l or positivity somewhere in the 909-symbol history; excluded from indicator windows",
                            "no verified PSX holiday calendar; sessions are provider-observed dates"])
    L.write_csv(L.T110 / "task110_symbol_history_coverage.csv", cov,
                ["symbol", "bars", "first", "last", "valid", "high_lt_low", "nonpositive",
                 "missing_sessions_in_span", "stale", "fresh", "in_universe"])
    # price adjustment + calendar validation
    adj = dict(price_series_status="raw_price_series", adjusted_close_available=False,
               provider_fields=["open", "high", "low", "close", "volume"],
               corporate_action_adjustment="NOT available — all indicators use raw provider closes",
               discontinuity_detection="per-symbol >35% single-session close moves flagged below",
               symbol_flags={})
    for s in uni:
        bars = L.load_bars(s)
        jumps = []
        for i in range(1, len(bars)):
            a, b = bars[i - 1], bars[i]
            if a["valid"] and b["valid"] and a["close"] > 0:
                r = b["close"] / a["close"] - 1
                if abs(r) > 0.35:
                    jumps.append({"date": b["date"], "ret": round(r, 4),
                                  "note": "possible corporate action / data gap — raw series used as-is"})
        if jumps:
            adj["symbol_flags"][s] = jumps[:8]
    L.artifact("task110_price_adjustment_report.json", "task110_price_adjustment_report", "completed", **adj)
    # calendar: weekday distribution + gap histogram over last 3 years
    from datetime import datetime
    wd, gaps = {}, {}
    prev = None
    for d in sess:
        if d < "2023-11-01":
            prev = d
            continue
        wd[datetime.strptime(d, "%Y-%m-%d").strftime("%a")] = wd.get(datetime.strptime(d, "%Y-%m-%d").strftime("%a"), 0) + 1
        if prev:
            g = sidx[d] - sidx[prev]
            gaps[g] = gaps.get(g, 0) + 1
        prev = d
    L.artifact("task110_exchange_calendar_validation.json", "task110_exchange_calendar_validation", "completed",
               calendar_source="OhlcvBar distinct dates (>=10 symbols)", sessions_total=len(sess),
               sessions_since_2023=sum(wd.values()), weekday_distribution=wd,
               consecutive_session_gap_histogram=gaps,
               weekend_sessions=wd.get("Sat", 0) + wd.get("Sun", 0),
               note="Mon-Fri only expected; gaps of 2-4 sessions = weekends+holidays as observed by provider")


# ─── phase 3 ─────────────────────────────────────────────────────────────────
def compute_symbol_indicators(symbol: str) -> dict:
    bars = L.load_bars(symbol)
    sidx = L.session_index()
    closes = [b["close"] if b["valid"] else None for b in bars]
    ma7 = L.sma_series(closes, 7)
    ma30 = L.sma_series(closes, 30)
    rel = L.ma_relations(ma7, ma30)
    sig = L.crossovers(rel)
    idx = [sidx.get(b["date"], -1) for b in bars]
    return dict(symbol=symbol, bars=bars, closes=closes, ma7=ma7, ma30=ma30,
                rel=rel, sig=sig, idx=idx)


def p3_ma_report(uni: list[str] | None = None):
    uni = uni or L.universe()
    rows, latest, total_g, total_d = [], [], 0, 0
    for s in uni:
        ind = compute_symbol_indicators(s)
        g = sum(1 for x in ind["sig"] if x == "GOLDEN")
        d = sum(1 for x in ind["sig"] if x == "DEATH")
        total_g += g
        total_d += d
        t = len(ind["bars"]) - 1
        latest.append(dict(symbol=s, date=ind["bars"][t]["date"], close=ind["closes"][t],
                           ma7=ind["ma7"][t], ma30=ind["ma30"][t],
                           ma7_minus_ma30=(ind["ma7"][t] - ind["ma30"][t]) if ind["ma7"][t] is not None else None,
                           relationship=ind["rel"][t], last_signal=next(
                               (ind["sig"][k] for k in range(t, -1, -1) if ind["sig"][k]), None),
                           warmup_complete=ind["ma30"][t] is not None))
        for k, b in enumerate(ind["bars"]):
            if ind["sig"][k] or ind["rel"][k] is not None:
                rows.append(dict(symbol=s, date=b["date"], close=ind["closes"][k],
                                 ma7=ind["ma7"][k], ma30=ind["ma30"][k],
                                 ma7_minus_ma30=(ind["ma7"][k] - ind["ma30"][k]) if ind["ma7"][k] is not None else None,
                                 relationship=ind["rel"][k], prev_relationship=ind["rel"][k - 1] if k else None,
                                 crossover_signal=ind["sig"][k],
                                 signal_timestamp=b["date"] + "T15:30:00+05:00 (decision after completed session close)",
                                 data_cutoff=b["date"], price_quality="valid_raw" if b["valid"] else "INVALID_EXCLUDED",
                                 indicator_version="sma7_30_v1_raw"))
    L.artifact("task110_ma_7_30_report.json", "task110_ma_7_30_report", "completed",
               definition="MA_n(t) = (1/n) * sum of the last n VALID session closes ending at t",
               price_field="raw provider close (unadjusted)", warmup="None until n valid sessions observed; no zero-fill",
               equality_convention="MA7==MA30 is relationship 0 (at/below for golden, at/above for death)",
               first_row_rule="no signal possible on the first valid observation (needs prev+cur)",
               universe=uni, goldens=total_g, deaths=total_d,
               latest=latest,
               limitations=["raw prices: corporate actions appear as level jumps, not adjusted returns"])
    L.write_csv(L.T110 / "task110_ma_7_30_signals.csv", rows,
                ["symbol", "date", "close", "ma7", "ma30", "ma7_minus_ma30", "relationship",
                 "prev_relationship", "crossover_signal", "signal_timestamp", "data_cutoff",
                 "price_quality", "indicator_version"])
    return uni


# ─── phase 4 ─────────────────────────────────────────────────────────────────
def p4_golden_cross(uni: list[str]):
    """Strict execution model: signal after completed close at session t fills at
    the OPEN of the immediately next GLOBAL session t+1; if the symbol has no
    valid bar that session the signal is UNFILLED (no fabrication, no slippage
    beyond the V2 profile which has zero synthetic slippage)."""
    sess = L.sessions()
    sidx = {d: i for i, d in enumerate(sess)}
    inds = {s: compute_symbol_indicators(s) for s in uni}
    events, per_symbol = [], {}
    for s in uni:
        ind = inds[s]
        pos_by_date = {b["date"]: k for k, b in enumerate(ind["bars"])}
        g = dcount = 0
        for k, b in enumerate(ind["bars"]):
            x = ind["sig"][k]
            if not x:
                continue
            g += x == "GOLDEN"
            dcount += x == "DEATH"
            d = b["date"]
            nxt = sess[sidx[d] + 1] if sidx[d] + 1 < len(sess) else None
            fill = None
            if nxt and nxt in pos_by_date:
                nb = ind["bars"][pos_by_date[nxt]]
                if nb["valid"]:
                    fill = dict(exec_date=nxt, exec_price=nb["open"])
            events.append(dict(symbol=s, signal=x, signal_date=d, close_at_signal=ind["closes"][k],
                               ma7=ind["ma7"][k], ma30=ind["ma30"][k],
                               exec_date=fill["exec_date"] if fill else None,
                               exec_price=fill["exec_price"] if fill else None,
                               fill_status="FILLED_NEXT_OPEN" if fill else
                               ("UNFILLED_NO_NEXT_SESSION_BAR" if nxt else "UNFILLED_NO_NEXT_SESSION")))
        per_symbol[s] = dict(golden=g, death=dcount)
    events.sort(key=lambda e: (e["signal_date"], e["symbol"]))
    L.artifact("task110_golden_cross_signal_report.json", "task110_golden_cross_signal_report", "completed",
               strategy="golden_cross_7_30_v1 — 7/30 SMA Crossover — Golden Cross Research Strategy",
               rules=dict(golden="prev MA7<=prev MA30 and cur MA7>cur MA30 (two consecutive valid observations)",
                          death="prev MA7>=prev MA30 and cur MA7<cur MA30",
                          sell_closes_long_only="no short entries", execution="next global session open after signal close",
                          unfilled="signals without a valid next-session bar are never fabricated"),
               universe=uni, per_symbol=per_symbol,
               total_golden=sum(v["golden"] for v in per_symbol.values()),
               total_death=sum(v["death"] for v in per_symbol.values()),
               note="7/30 is the user-specified configuration, not a market convention claim")
    L.write_csv(L.T110 / "task110_golden_cross_trade_events.csv", events,
                ["symbol", "signal", "signal_date", "close_at_signal", "ma7", "ma30",
                 "exec_date", "exec_price", "fill_status"])
    return inds, events


# ─── phase 5 ─────────────────────────────────────────────────────────────────
def run_portfolio(inds: dict, sizing_pct=DEFAULT_SIZING_PCT, max_positions=DEFAULT_MAX_POSITIONS,
                  initial_capital=DEFAULT_CAPITAL, tax_profile="ATL_15",
                  sizing_mode="pct_equity") -> dict:
    sess = L.sessions()
    sidx = {d: i for i, d in enumerate(sess)}
    uni = sorted(inds)
    # valid-bar position lookup per symbol: date -> (pos, open, close)
    look = {}
    for s in uni:
        ind = inds[s]
        look[s] = {ind["bars"][k]["date"]: k for k in range(len(ind["bars"])) if ind["bars"][k]["valid"]}
    # start: first global session where >=5 symbols have MA30 (warmup done)
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
    trades, daily, open_log = [], [], []
    peak, max_dd = initial_capital, 0.0
    tot_buy_val = 0.0

    def mark(sym, i):
        """Last valid close at or before global session index i (no future data)."""
        ind = inds[sym]
        lk = look[sym]
        while i >= 0:
            p = lk.get(sess[i])
            if p is not None:
                return ind["closes"][p]
            i -= 1
        return None

    def mark_prev(sym, i):
        return mark(sym, i - 1) if i > 0 else None

    for i in range(start_i, len(sess)):
        d = sess[i]
        costs_today = 0.0
        # 1) fills pending from previous session close (sells first, then buys alphabetically)
        sells = sorted([e for e in pending if e["signal"] == "DEATH"], key=lambda e: e["symbol"])
        buys = sorted([e for e in pending if e["signal"] == "GOLDEN"], key=lambda e: e["symbol"])
        pending = []
        actions = []
        for e in sells:
            s = e["symbol"]
            if s not in pos:
                continue
            p = look[s].get(d)
            if p is None or not inds[s]["bars"][p]["valid"]:
                continue  # no fill this session; signal lapses (no fabrication)
            px = inds[s]["bars"][p]["open"]
            sh = pos[s]["shares"]
            gross = (px - pos[s]["entry_px"]) * sh
            tc = L.trade_costs_v2(sh, pos[s]["entry_px"], [(sh, px)], gross, tax_profile)
            # cash flows split entry/exit so no cost is charged twice: buy-side was
            # deducted at entry; here only sell-side + CGT leave the account.
            sell = L.side_costs(sh, px)
            cgt = gross * L.TAX_RATES[tax_profile] if gross > 0 else 0.0
            cash += px * sh - sell["side_total"] - cgt
            realized += tc["net_pnl"]
            costs_today += sell["side_total"] + cgt
            hold = i - sidx[pos[s]["entry_date"]]
            trades.append(dict(signal_date=pos[s]["signal_date"], execution_date=pos[s]["entry_date"],
                               symbol=s, side="BUY→SELL", signal_reason="GOLDEN_7_30",
                               entry_price=pos[s]["entry_px"], exit_price=px, shares=sh,
                               gross_pnl=round(gross, 2), total_costs=round(tc["total_cost"], 2),
                               net_pnl=round(tc["net_pnl"], 2),
                               return_pct=round(100 * tc["net_pnl"] / (pos[s]["entry_px"] * sh), 4),
                               holding_sessions=hold, win_loss="WIN" if tc["net_pnl"] > 0 else "LOSS",
                               closing_reason="DEATH_CROSS"))
            del pos[s]
            actions.append(f"SELL {s} {sh}@{px}")
        for e in buys:
            s = e["symbol"]
            if s in pos:
                continue
            if len(pos) >= max_positions:
                open_log.append(dict(date=d, symbol=s, reason="UNFILLED_MAX_POSITIONS"))
                continue
            p = look[s].get(d)
            if p is None or not inds[s]["bars"][p]["valid"]:
                open_log.append(dict(date=d, symbol=s, reason="UNFILLED_NO_NEXT_SESSION_BAR"))
                continue
            px = inds[s]["bars"][p]["open"]
            equity = cash + sum((mark_prev(x, i) or pos[x]["entry_px"]) * pos[x]["shares"] for x in pos)
            budget = equity * sizing_pct if sizing_mode == "pct_equity" else equity / max_positions
            sh = int(budget // px)
            if sh <= 0 or px * sh + 0 > cash:
                open_log.append(dict(date=d, symbol=s, reason="UNFILLED_INSUFFICIENT_CASH",
                                     wanted_shares=sh))
                continue
            sc = L.side_costs(sh, px)
            if px * sh + sc["side_total"] > cash:
                open_log.append(dict(date=d, symbol=s, reason="UNFILLED_INSUFFICIENT_CASH",
                                     wanted_shares=sh))
                continue
            cash -= px * sh + sc["side_total"]
            tot_buy_val += px * sh
            costs_today += sc["side_total"]
            pos[s] = dict(shares=sh, entry_px=px, entry_date=d, signal_date=e["signal_date"],
                          entry_side_cost=sc["side_total"])
            actions.append(f"BUY {s} {sh}@{px}")
        # 2) new signals at this session's close → queue for next session
        sigs_today = []
        for s in uni:
            p = look[s].get(d)
            if p is None:
                continue
            x = inds[s]["sig"][p]
            if x:
                pending.append(dict(symbol=s, signal=x, signal_date=d))
                sigs_today.append(f"{x}:{s}")
        # 3) marks + ledger row
        invested = 0.0
        for s in pos:
            mp = mark(s, i)
            invested += (mp or pos[s]["entry_px"]) * pos[s]["shares"]
        equity = cash + invested
        peak = max(peak, equity)
        dd = equity - peak
        max_dd = min(max_dd, dd)
        daily.append(dict(date=d, symbol="PORTFOLIO", close="", ma7="", ma30="",
                          signal=";".join(sigs_today), action=";".join(actions),
                          entry_exit_ref="next-session-open fills", qty="",
                          position_after=len(pos), cash_balance=round(cash, 2),
                          invested_capital=round(invested, 2), realized_pnl_cum=round(realized, 2),
                          unrealized_pnl=round(invested - sum(p["entry_px"] * p["shares"] for p in pos.values()), 2),
                          costs_today=round(costs_today, 2),
                          total_net_pnl=round(equity - initial_capital, 2),
                          portfolio_equity=round(equity, 2), current_drawdown=round(dd, 2)))
    # final marks
    open_positions = []
    for s, p in pos.items():
        mp = mark(s, len(sess) - 1)
        open_positions.append(dict(symbol=s, shares=p["shares"], entry_date=p["entry_date"],
                                   entry_price=p["entry_px"], last_close=mp,
                                   market_value=round(mp * p["shares"], 2),
                                   entry_costs=round(p["entry_side_cost"], 2),
                                   unrealized_pnl=round((mp - p["entry_px"]) * p["shares"], 2)))
    # account-level unrealized is net of sunk entry costs so that
    # realized_net + unrealized == final_equity - initial_capital exactly
    unreal_net = (sum(o["unrealized_pnl"] for o in open_positions)
                  - sum(o["entry_costs"] for o in open_positions))
    final_equity = cash + sum(o["market_value"] for o in open_positions)
    wins = [t for t in trades if t["net_pnl"] > 0]
    losses = [t for t in trades if t["net_pnl"] <= 0]
    streak = worst = 0
    for t in trades:
        streak = streak + 1 if t["net_pnl"] <= 0 else 0
        worst = max(worst, streak)
    yrs = (len(sess) - start_i) / 252
    exp = statistics.fmean([r["invested_capital"] / r["portfolio_equity"] for r in daily
                            if r["portfolio_equity"]]) if daily else None
    avg_eq = statistics.fmean([r["portfolio_equity"] for r in daily]) if daily else None
    return dict(
        config=dict(sizing_mode=sizing_mode, sizing_pct=sizing_pct, max_positions=max_positions,
                    initial_capital=initial_capital, tax_profile=tax_profile,
                    execution="signal at close t -> next global session open; unfilled otherwise",
                    universe=uni, sessions=len(sess) - start_i, start=sess[start_i], end=sess[-1]),
        account=dict(initial_capital=initial_capital, final_cash=round(cash, 2),
                     open_position_value=round(sum(o["market_value"] for o in open_positions), 2),
                     final_equity=round(final_equity, 2),
                     realized_net_pnl=round(realized, 2),
                     unrealized_pnl=round(unreal_net, 2),
                     total_net_pnl=round(final_equity - initial_capital, 2),
                     roi_pct=round(100 * (final_equity - initial_capital) / initial_capital, 3),
                     cagr_pct=round(100 * ((final_equity / initial_capital) ** (1 / yrs) - 1), 3) if yrs >= 3 else None,
                     max_drawdown=round(max_dd, 2),
                     trades=len(trades), wins=len(wins), losses=len(losses),
                     win_rate_pct=round(100 * len(wins) / len(trades), 2) if trades else None,
                     avg_win=round(statistics.fmean([t["net_pnl"] for t in wins]), 2) if wins else None,
                     avg_loss=round(statistics.fmean([t["net_pnl"] for t in losses]), 2) if losses else None,
                     profit_factor=round(sum(t["net_pnl"] for t in wins) / abs(sum(t["net_pnl"] for t in losses)), 4) if losses and sum(t["net_pnl"] for t in losses) != 0 else None,
                     expectancy_per_trade=round((final_equity - initial_capital) / len(trades), 2) if trades else None,
                     total_costs=round(sum(t["total_costs"] for t in trades), 2),
                     exposure_pct=round(100 * exp, 2) if exp else None,
                     turnover=round(tot_buy_val / avg_eq, 2) if avg_eq else None,
                     longest_loss_streak=worst),
        open_positions=open_positions, unfilled=open_log,
        _daily=daily, _trades=trades, _peak=peak,
        _buy_value=tot_buy_val, _sessions_held=len(sess) - start_i)


def p5_portfolio(inds: dict):
    uni = sorted(inds)
    scenarios = {}
    headline = None
    for mode, pct in [("pct_equity", 0.05), ("pct_equity", 0.10), ("pct_equity", 0.20),
                      ("pct_equity", 0.25), ("equal_alloc", None)]:
        r = run_portfolio(inds, sizing_pct=pct or 0.20, sizing_mode=mode)
        key = f"{mode}_{int((pct or 0)*100)}pct"
        scenarios[key] = dict(config=r["config"], account=r["account"], trades=len(r["_trades"]))
        if mode == "pct_equity" and pct == 0.20:
            headline = r
    r_nonatl = run_portfolio(inds, sizing_pct=0.20, tax_profile="NON_ATL_30")
    scenarios["pct_equity_20pct_NON_ATL_30"] = dict(config=r_nonatl["config"],
                                                    account=r_nonatl["account"], trades=len(r_nonatl["_trades"]))
    daily, trades = headline["_daily"], headline["_trades"]
    n = L.write_csv(L.T110 / "task110_golden_cross_daily_ledger.csv", daily,
                    ["date", "symbol", "close", "ma7", "ma30", "signal", "action",
                     "entry_exit_ref", "qty", "position_after", "cash_balance",
                     "invested_capital", "realized_pnl_cum", "unrealized_pnl",
                     "costs_today", "total_net_pnl", "portfolio_equity", "current_drawdown"])
    L.write_csv(L.T110 / "task110_golden_cross_trade_ledger.csv", trades,
                ["signal_date", "execution_date", "symbol", "side", "signal_reason",
                 "entry_price", "exit_price", "shares", "gross_pnl", "total_costs",
                 "net_pnl", "return_pct", "holding_sessions", "win_loss", "closing_reason"])
    equity_rows = [dict(date=r["date"], equity=r["portfolio_equity"], drawdown=r["current_drawdown"])
                   for r in daily]
    L.write_csv(L.T110 / "task110_golden_cross_equity_curve.csv", equity_rows, ["date", "equity", "drawdown"])
    acc = headline["account"]
    dd = dict(max_drawdown=acc["max_drawdown"],
              max_drawdown_pct=round(100 * acc["max_drawdown"] / headline["config"]["initial_capital"], 2),
              basis="chronological close-of-session portfolio equity, peak-to-trough",
              trough_date=next((r["date"] for r in daily if r["current_drawdown"] == acc["max_drawdown"]), None))
    L.artifact("task110_golden_cross_drawdown.json", "task110_golden_cross_drawdown", "completed", **dd)
    # benchmarks over identical window: cash + equal-weight buy&hold (cash-constrained,
    # whole shares, V2 entry costs deducted from the same PKR 100,000)
    start, cap = headline["config"]["start"], headline["config"]["initial_capital"]
    sess = L.sessions()
    i0 = sess.index(start)
    per, cash_bh, bh_cost = {}, cap, 0.0
    for s in uni:
        ind = inds[s]
        posd = next((k for k in range(len(ind["bars"])) if ind["bars"][k]["date"] == start and ind["bars"][k]["valid"]), None)
        if posd is None:
            continue
        budget = cap / len(uni)
        px = ind["bars"][posd]["open"]
        sh = int(budget // px)
        if sh <= 0:
            continue
        sc = L.side_costs(sh, px)
        if px * sh + sc["side_total"] > cash_bh:
            continue
        cash_bh -= px * sh + sc["side_total"]
        bh_cost += sc["side_total"]
        lastp = max((k for k in look_ok(ind)), default=None)
        lastc = ind["closes"][lastp] if lastp is not None else px
        per[s] = dict(shares=sh, entry_open=px, last_close=lastc,
                      market_value=round(sh * lastc, 2))
    bh_final = cash_bh + sum(v["market_value"] for v in per.values())
    bh = dict(cash_benchmark_return_pct=0.0,
              buy_and_hold=dict(initial_capital=cap, final_cash=round(cash_bh, 2),
                                final_market_value=round(sum(v["market_value"] for v in per.values()), 2),
                                entry_costs=round(bh_cost, 2), final_equity=round(bh_final, 2),
                                roi_pct=round(100 * (bh_final - cap) / cap, 3),
                                symbols_invested=len(per),
                                note="equal-weight whole-share basket at first strategy session open, held to frontier; V2 entry costs cash-constrained; unrealized MTM never realized"))
    L.artifact("task110_golden_cross_benchmark_comparison.json", "task110_golden_cross_benchmark_comparison",
               "completed", strategy=headline["account"], **bh,
               existing_technical_baseline="Task 109 shadow strategies (delayed-data cohorts) are not capital-comparable; see task110_strategy_baseline_comparison.json",
               limitations=["buy-and-hold on raw prices includes corporate-action distortions"])
    res = dict(headline_scenario="pct_equity_20pct_max5_ATL15", account=acc,
               config=headline["config"], scenarios=scenarios,
               open_positions=headline["open_positions"],
               unfilled_summary={k: sum(1 for u in headline["unfilled"] if u["reason"] == k)
                                 for k in {u["reason"] for u in headline["unfilled"]}},
               return_integrity="ROI = (final_equity - initial_capital)/initial_capital*100; unrealized MTM never counted as realized")
    L.artifact("task110_golden_cross_portfolio_results.json", "task110_golden_cross_portfolio_results",
               "completed", **res)
    # CLI print of the daily ledger (head+tail; full CSV saved)
    print(f"=== DAILY ACCOUNT LEDGER (first 15 of {n} rows; full CSV saved) ===")
    for r in daily[:15]:
        print(r["date"], r["symbol"], "sig:", r["signal"] or "-", "act:", r["action"] or "-",
              "cash:", r["cash_balance"], "inv:", r["invested_capital"], "eq:", r["portfolio_equity"], "dd:", r["current_drawdown"])
    print("=== ... last 15 ===")
    for r in daily[-15:]:
        print(r["date"], r["symbol"], "sig:", r["signal"] or "-", "act:", r["action"] or "-",
              "cash:", r["cash_balance"], "inv:", r["invested_capital"], "eq:", r["portfolio_equity"], "dd:", r["current_drawdown"])
    return headline


def look_ok(ind):
    return [k for k in range(len(ind["bars"])) if ind["bars"][k]["valid"]]
