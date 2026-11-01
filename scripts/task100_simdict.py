#!/usr/bin/env python3
"""Task 100 — machine-readable simulator data dictionary (twin of
docs/investment-simulator-metrics.md). Fields traced to actual source."""
import json
from pathlib import Path

D = {
  "generated_by": "scripts/task100_simdict.py",
  "source_files": [
    "src/lib/latent/investment-simulator.ts", "src/lib/latent/tp-sl-engine.ts",
    "src/lib/latent/strategy-engine.ts", "src/lib/latent/risk-levels.ts",
    "src/lib/latent/trading-costs.ts", "src/lib/latent/simulator-ranking.ts",
    "src/lib/latent/backtest.ts"],
  "contexts": {
    "investment_simulator": {"entry": "close of bar nearest slot target (findEntryIdx, deterministic, timestamp-based)",
      "costs": {"commission": "0.0015 x entryAmount x 2 (both sides)", "slippage": "0.0015 x entryAmount (one-way)",
                 "cgt": "0.15 x grossPnl if grossPnl > 0 else 0",
                 "note": "LEGACY flat model — NO PSX/NCCPL/CDC fees, NO fixed 0.03/share rule, NO ATL/NON-ATL selector"}},
    "strategy_backtest": {"entry": "next session OPEN after decision date (cutoffIdx+1)",
      "costs": {"brokerage": "0.03 x qty if fillPrice<=20 else 0.0015 x value (per side)",
                 "psx_fee": "0.0000035 x value per side", "nccpl_fee": "0.0000081 x value per side",
                 "cdc_fee": "0.000036 x value per side", "slippage": "0 (zero by profile)",
                 "cgt": "0.15 ATL / 0.30 NON-ATL x grossPnl once per position if grossPnl>0",
                 "identity": "netPnl = grossPnl - totalCost; verified 4713/4713 completed rows (max dev 0.01 PKR)"}},
    "ensemble_tracker_backtest": {"win_rule": "net P&L > 0 per trade (backtest.ts L286-289)"},
  },
  "fields": {
    "prediction": {
      "current_price": "sample close at decision date (walk-forward sample 'close')",
      "entry_price_strategy": "next session open (task100_backtest.ts entryBar.open)",
      "entry_price_simulator": "nearest-slot bar close (investment-simulator.ts:264)",
      "signal_price": "close at decision date; signal levels from risk-levels.ts ATR policy",
      "predicted_direction": "sign of predicted 5d forward return (signal contract: pred > threshold => BUY)",
      "predicted_return": "model's predicted 5d forward return (frozen-protocol OOS)",
      "actual_return": "matured 5d forward return (close-to-close, per-stock shift)",
      "confidence": "ensemble confidence 0-100 (tracker) or classifier probability (Task 100 calibration)",
    },
    "risk_targets": {
      "atr14": "ATR(14) over 15 bars ending at cutoff (investment-simulator.atr; Wilder-compatible TR)",
      "sl": "entry - 1.5 x atr14 (BUY); policy atr14-1.5-1-2-3 (risk-levels.ts:40)",
      "tp1": "entry + 1.0 x atr14", "tp2": "entry + 2.0 x atr14", "tp3": "entry + 3.0 x atr14",
      "expected_rr": "tp distance / sl distance at signal time (net R:R for variant_b eligibility)",
      "realized_rr": "realized exit vs realized loss at position level",
      "best_target_reached": "HIGHEST TP touched (TP3>TP2>TP1>'—'), preserved even if later SL exit",
      "exit_reason": "actual exit: SL | TP3 | TRAILING_SL_AT_TP1 | TRAILING_SL_AT_TP2 | SCALE_TP1_TP2_TP3 | TIME_UP",
      "holding_duration": "entryDate -> last leg exitDate (sessions)",
    },
    "trading_performance": {
      "total_signals": "nCandidates — all emitted signals for the cell",
      "eligible_signals": "candidates passing variant_b net-RR gate (or all for baseline/variant_a)",
      "skipped_signals": "nSkipped — variant_b gate failures (skipped_rr_below_minimum); excluded from denominators",
      "total_positions": "nCompleted — skipped==false AND exitReason realized",
      "winning_losing": "netPnl > 0 / <= 0 after ALL costs",
      "win_rate": "nWinning / nCompleted x 100 (NOT per-leg; scale-out = ONE position)",
      "gross_pnl": "sum of position gross P&L (before costs)",
      "commission_psx_nccpl_cdc_cgt_slippage": "per-component sums over completed positions (v2 profile; slippage always 0)",
      "net_pnl": "sum of position net P&L; identity gross-totalCost==net verified per row",
      "profit_factor": "grossProfit/grossLoss (gross view); netProfitFactor for net view",
      "average_win_loss": "mean net P&L of winning / losing positions",
      "expectancy": "avgNetPerTrade = netPnl / nCompleted (PKR per trade; PRIMARY ranking metric in Task 100)",
      "max_drawdown": "min over chronological cumulative net P&L minus running peak (task100_backtest.ts summarize)",
      "exposure": "avgHoldSessions = mean holding sessions of completed positions",
      "streaks": "not used for ranking (simulator-ranking.ts: streak counter never ranks)",
    },
    "strategies": {
      "fixed_first_hit": "first touch of SL or TP3 closes 100%; TP1/TP2 milestones only",
      "max_tp_step_trailing": "TP1/TP2 hits step the stop to the reached TP; TP3 closes; exits often TRAILING_SL_AT_TPx",
      "scale_out_50_25_25": "50% at TP1, 25% at TP2, 25% at TP3; SL closes remainder; 1-3 legs of ONE position",
      "baseline_variant": "atr14-1.5-1-2-3 from cutoff bar",
      "variant_a": "atr_tp1_rr_1_1_v1 — TP1/SL distances recomputed from actual entry (1:1 at TP1)",
      "variant_b": "atr_min_net_rr_2_v1 — SKIP unless estimated net R:R after costs >= minimum",
    },
    "ranking": {
      "backtest_score": "empirical winRate / 100 (simulator-ranking.ts computeBacktestScore) — NOT a calibrated probability",
      "ranking_criteria": "winRate/backtestScore sort by winRate; netPnL sorts by net P&L; streak never ranks",
      "min_win_rate_filter": "requires totalTrades > 0; zero-trade results never qualify",
      "reconciliation": "totalTrades==trades.length; winTrades==count(netPnl>0); netPnL==sum(trades.netPnl) tol 0.01",
    },
    "simulator_aggregates": {
      "total_gain": "cumulative net P&L of trades entered at or before row date (SIP rows add 0)",
      "final_amount": "capital + totalSip + totalGain (realized pool after all closes)",
      "total_return_pct": "totalPnl / totalInvested x 100",
      "unresolved_count": "TIME_UP trades (no SL/TP3 by window end; exited last close) — never discarded",
      "best_target_attainment_rate": "fraction bestTargetReached != '—' (target attainment, NOT realized ROI)",
      "compounding": "entryAmount = capital + SIPs deposited before entry + P&L of trades CLOSED before entry; open trades do not fund",
    },
  },
  "worked_example": {
    "trade": "buy 1000 @ 50, exit 1 leg @ 52, ATL_15",
    "buy_side": {"value": 50000, "brokerage": 75.0, "psx": 0.175, "nccpl": 0.405, "cdc": 1.8},
    "sell_side": {"value": 52000, "brokerage": 78.0, "psx": 0.182, "nccpl": 0.4212, "cdc": 1.872},
    "gross_pnl": 2000.0, "cgt_15pct": 300.0, "total_cost": 457.86, "net_pnl": 1542.14,
    "low_price_note": "5000 sh @ 10 -> brokerage 5000 x 0.03 = 150/side (fixed rule)",
  },
  "task100_verdict_pointers": {
    "win_rate_vs_profitability": "task100_strategy_diagnostics.json",
    "exit_reason_distribution": "frozen final-test run: SL 123, TRAILING_SL_AT_TP1 72, TIME_UP 62, TRAILING_SL_AT_TP2 25, TP3 20",
    "cost_reconciliation": "task100_cost_reconciliation.json — identity OK 4713/4713 completed; CGT 0 on all 2528 losing; slippage always 0",
  },
}
p = Path("data/backtest_reports/task100/task100_simulator_data_dictionary.json")
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(json.dumps(D, indent=2))
print("wrote", p)
