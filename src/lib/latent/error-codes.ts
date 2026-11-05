// Task 117 Part J1 — error classification for the controlled beta.
//
// Every user-facing failure maps to ONE of these classes. The API returns the
// code + a plain-English user message; stack traces and environment details
// stay in the server log only (console.error on the server, never in payloads).

export type BetaErrorCode =
  | "provider_unavailable"
  | "market_data_stale"
  | "llm_unavailable"
  | "cache_degraded"
  | "database_unavailable"
  | "worker_stopped"
  | "profile_validation_error"
  | "invitation_invalid"
  | "rate_limited"
  | "internal_error";

interface Classified {
  code: BetaErrorCode;
  userMessage: string;
  httpStatus: number;
}

const CLASSIFICATIONS: Record<BetaErrorCode, Classified> = {
  provider_unavailable: {
    code: "provider_unavailable",
    userMessage: "The market data provider is temporarily unavailable. Previously verified research data is still shown.",
    httpStatus: 503,
  },
  market_data_stale: {
    code: "market_data_stale",
    userMessage: "Market data may be older than the latest trading session. Each view shows its own data date.",
    httpStatus: 200,
  },
  llm_unavailable: {
    code: "llm_unavailable",
    userMessage: "The AI analyst is unavailable right now. Strategy research results are shown without it — no substitute panel is invented.",
    httpStatus: 200,
  },
  cache_degraded: {
    code: "cache_degraded",
    userMessage: "Running in reduced-cache mode. Responses may be slower; data correctness is unaffected.",
    httpStatus: 200,
  },
  database_unavailable: {
    code: "database_unavailable",
    userMessage: "The service is temporarily unable to reach its database. Please try again shortly.",
    httpStatus: 503,
  },
  worker_stopped: {
    code: "worker_stopped",
    userMessage: "The data pipeline worker is not running. Data will not refresh until it restarts.",
    httpStatus: 200,
  },
  profile_validation_error: {
    code: "profile_validation_error",
    userMessage: "Some answers could not be saved because they were incomplete or out of range. Please review and retry.",
    httpStatus: 400,
  },
  invitation_invalid: {
    code: "invitation_invalid",
    userMessage: "This invitation is not valid or is no longer active. Please check the code or ask the operator for a new one.",
    httpStatus: 403,
  },
  rate_limited: {
    code: "rate_limited",
    userMessage: "Too many requests. Please wait a moment and try again.",
    httpStatus: 429,
  },
  internal_error: {
    code: "internal_error",
    userMessage: "Something went wrong on our side. The issue has been logged. Please try again shortly.",
    httpStatus: 500,
  },
};

export function classify(code: BetaErrorCode): Classified {
  return CLASSIFICATIONS[code];
}

/** Uniform error response: user message only — no stack, no env, no internals. */
export function errorResponse(code: BetaErrorCode, extra?: Record<string, unknown>) {
  const c = CLASSIFICATIONS[code];
  return Response.json({ error: c.code, message: c.userMessage, ...extra }, { status: c.httpStatus });
}
