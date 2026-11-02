/**
 * Task 106 — Canonical confidence-field semantics (single source of truth).
 *
 * Task 105 evidence: out-of-sample Spearman(confidence, outcome) ≈ −0.002..−0.07
 * and final-test AUC 0.496–0.527. NO live-served confidence field has verified
 * calibration. These names must be used everywhere a score is displayed so an
 * agreement score is never read as a win probability.
 */

export type ConfidenceField =
  | "raw_model_score"
  | "ensemble_agreement"
  | "directional_score"
  | "calibrated_probability"
  | "predicted_net_positive_probability";

export const CONFIDENCE_FIELD_NAMES: Record<ConfidenceField, string> = {
  raw_model_score: "Raw model score",
  ensemble_agreement: "Ensemble agreement",
  directional_score: "Directional score",
  calibrated_probability: "Calibrated probability",
  predicted_net_positive_probability: "Predicted P(net-positive trade)",
};

export const CALIBRATION_STATUS_MESSAGE = "Probability calibration not established";

/** What each displayed number actually is (user-facing wording). */
export const CONFIDENCE_FIELD_MEANINGS: Record<ConfidenceField, string> = {
  raw_model_score:
    "Raw model output before any calibration. Higher is not a win chance.",
  ensemble_agreement:
    "Share of trained models agreeing on this direction. An agreement " +
    "indicator — NOT a probability of winning.",
  directional_score:
    "Indicator/rule strength for direction. Not a probability.",
  calibrated_probability:
    "A probability fitted to realized outcomes. Exposed only where a valid " +
    "calibration method AND separate evaluation evidence exist.",
  predicted_net_positive_probability:
    "Modeled probability that the associated TP/SL trade ends net-positive " +
    "after costs (Task 101/104 protocol). Research-only: out-of-sample " +
    "calibration is not established.",
};

/**
 * Whether a field may be presented as a probability in the CURRENT evidence
 * regime. Only research artifacts satisfy this today.
 */
export function calibrationEstablished(field: ConfidenceField): boolean {
  return field === "calibrated_probability" || field === "predicted_net_positive_probability";
}

/** Tooltip for any confidence display; always policy/evidence-driven. */
export function confidenceTooltip(field: ConfidenceField): string {
  const base = CONFIDENCE_FIELD_NAMES[field] + ": " + CONFIDENCE_FIELD_MEANINGS[field];
  return calibrationEstablished(field) && field === "calibrated_probability"
    ? base
    : `${base} ${CALIBRATION_STATUS_MESSAGE}.`;
}
