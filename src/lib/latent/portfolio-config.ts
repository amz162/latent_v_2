/**
 * Task 61 — Portfolio simulation configuration.
 *
 * Explicit, documented configuration for the walk-forward portfolio simulator.
 * No magic numbers scattered across the implementation — all assumptions are
 * declared here + recorded in the portfolio report.
 *
 * DEFAULT (Phase 2): long-only, one position per stock, no pyramiding, no
 * leverage, max 10% equity per position, max 10 concurrent positions, max gross
 * exposure = 100% of equity. These are EXPLICIT RESEARCH ASSUMPTIONS, not claims
 * that this configuration is optimal.
 */
export interface PortfolioConfig {
  // Capital
  initial_capital: number; // PKR — hypothetical starting capital (NOT the user's actual capital)

  // Position limits
  max_concurrent_positions: number; // max open positions at any time
  max_position_size_fraction: number; // max fraction of CURRENT equity for one position (0.10 = 10%)
  max_gross_exposure_fraction: number; // max total open-position value / equity (1.0 = no leverage)
  max_exposure_per_stock_fraction: number; // max exposure to a single stock (0.10 = 10%)
  allow_multiple_entries_same_stock: boolean; // false = one position per stock (no pyramiding)

  // Signal + strategy
  signal_threshold: number; // BUY if predicted return > threshold (long-only)
  direction: "long_only"; // long-only (PSX short-sale not supported)
  forecast_horizon: number; // 5, 10, or 21 sessions
  strategy: "fixed_horizon" | "progressive_tp_sl";
  cost_profile_id: "standard_psx" | "high_slippage_psx";

  // Execution
  entry_convention: "next_session_open"; // enter at next eligible session's OPEN
  fractional_shares: boolean; // false = integer quantities (floor to whole shares)
  board_lot_size: number; // 0 = no board-lot rounding; >0 = round down to multiples

  // Missing data
  missing_data_policy: "skip_with_reason"; // skip signals without valid bars + record reason

  // ATR (progressive TP/SL only)
  atr_period: number;
  atr_sl_multiplier: number;
  atr_tp1_multiplier: number;
  atr_tp2_multiplier: number;
  atr_tp3_multiplier: number;

  // End-of-test convention
  end_of_test_convention: "mark_to_market"; // mark remaining open positions to the last available close

  // Selection bias
  exploratory_test: boolean; // true = final-test results are exploratory (prior tasks inspected them)
}

/** Default portfolio configuration (Phase 2 spec). */
export const DEFAULT_PORTFOLIO_CONFIG: PortfolioConfig = {
  initial_capital: 1_000_000,
  max_concurrent_positions: 10,
  max_position_size_fraction: 0.10,
  max_gross_exposure_fraction: 1.0,
  max_exposure_per_stock_fraction: 0.10,
  allow_multiple_entries_same_stock: false,
  signal_threshold: 0.01,
  direction: "long_only",
  forecast_horizon: 5, // default; overridden per-combo
  strategy: "fixed_horizon", // default; overridden per-combo
  cost_profile_id: "standard_psx",
  entry_convention: "next_session_open",
  fractional_shares: false,
  board_lot_size: 0, // no board-lot rounding (configurable)
  missing_data_policy: "skip_with_reason",
  atr_period: 14,
  atr_sl_multiplier: 1.5,
  atr_tp1_multiplier: 1.0,
  atr_tp2_multiplier: 2.0,
  atr_tp3_multiplier: 3.0,
  end_of_test_convention: "mark_to_market",
  exploratory_test: true,
};

/**
 * Create a config variant for a specific model/horizon/strategy/cost combo.
 * Returns a copy of the default with the specified overrides.
 */
export function makeConfig(
  overrides: Partial<Pick<PortfolioConfig, "forecast_horizon" | "strategy" | "cost_profile_id" | "initial_capital">>
): PortfolioConfig {
  return { ...DEFAULT_PORTFOLIO_CONFIG, ...overrides };
}
