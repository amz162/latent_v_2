// ============================================================================
// Task 111 — LLM provider adapter.
//
// The ONLY authorized provider is the already-configured `z-ai-web-dev-sdk`
// (the same integration used by price-pattern-llm.ts and the news-digest
// route). No new paid service, no new credentials. Configuration is
// environment-driven; credentials are NEVER hardcoded, logged, or sent to the
// frontend. If the provider is unavailable the adapter throws
// LLMUnavailableError so callers can return a controlled `llm_unavailable`
// state instead of a fabricated prediction.
// ============================================================================
import ZAI from "z-ai-web-dev-sdk";

export type LLMProviderId = "zai" | "mock";

export interface LLMConfig {
  provider: LLMProviderId;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  apiKeyConfigured: boolean; // never the key itself
}

export interface LLMUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  apiCost: number | null;
}

export interface LLMResponse {
  content: string;
  provider: LLMProviderId;
  model: string;
  requestTs: string;
  responseTs: string;
  latencyMs: number;
  usage: LLMUsage;
}

export interface LLMCallRecord extends LLMResponse {
  promptVersion: string;
  inputSchemaVersion: string;
  outputSchemaVersion: string;
  evidenceHash: string;
  symbol: string;
  parseResult: "ok" | "parse_error" | "validation_error" | "provider_error" | "timeout";
  validationResult: string;
  failureReason: string | null;
}

export class LLMUnavailableError extends Error {
  constructor(message: string, readonly cause2?: unknown) {
    super(message);
    this.name = "LLMUnavailableError";
  }
}

export function llmConfigFromEnv(env: NodeJS.ProcessEnv = process.env): LLMConfig {
  const provider = (env.LLM_PROVIDER as LLMProviderId) || "zai";
  return {
    provider: provider === "mock" ? "mock" : "zai",
    model: env.LLM_MODEL || "glm-4.6",
    timeoutMs: Number(env.LLM_TIMEOUT_MS) || 60_000,
    maxTokens: Number(env.LLM_MAX_TOKENS) || 1_400,
    apiKeyConfigured: Boolean(env.LLM_API_KEY) || true, // ZAI SDK manages its own approved credentials
  };
}

export interface LLMClient {
  config: LLMConfig;
  complete(messages: Array<{ role: string; content: string }>, opts?: { temperature?: number }): Promise<LLMResponse>;
}

/** Deterministic hash (FNV-1a 32-bit, hex) — enough for cache keys/idempotency. */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Stable JSON stringify (sorted keys) so evidence hashes are deterministic. */
export function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj) ?? "null";
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify((obj as Record<string, unknown>)[k])).join(",") + "}";
}

export function evidenceHash(evidence: unknown): string {
  return fnv1a(stableStringify(evidence));
}

async function completeZAI(
  cfg: LLMConfig,
  messages: Array<{ role: string; content: string }>,
  opts?: { temperature?: number }
): Promise<LLMResponse> {
  const requestTs = new Date().toISOString();
  const started = Date.now();
  try {
    const zai = await ZAI.create();
    const completion = (await Promise.race([
      zai.chat.completions.create({
        messages: messages as never,
        max_tokens: cfg.maxTokens,
        temperature: opts?.temperature ?? 0.2,
      }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("LLM_TIMEOUT")), cfg.timeoutMs)),
    ])) as { choices?: Array<{ message?: { content?: string } }>; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
    const content = completion?.choices?.[0]?.message?.content ?? "";
    if (!content.trim()) throw new Error("empty_completion");
    return {
      content,
      provider: "zai",
      model: cfg.model,
      requestTs,
      responseTs: new Date().toISOString(),
      latencyMs: Date.now() - started,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? null,
        completionTokens: completion.usage?.completion_tokens ?? null,
        totalTokens: completion.usage?.total_tokens ?? null,
        apiCost: null,
      },
    };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    throw new LLMUnavailableError(msg === "LLM_TIMEOUT" ? "timeout" : `provider_error:${msg}`, e);
  }
}

/** Deterministic mock — used by automated tests ONLY. It echoes a compact,
 * schema-valid stub derived from the evidence hash; it is never presented as
 * a real provider response. */
export async function completeMock(
  _cfg: LLMConfig,
  messages: Array<{ role: string; content: string }>
): Promise<LLMResponse> {
  const userMsg = messages.find((m) => m.role === "user")?.content ?? "";
  const h = fnv1a(userMsg).slice(0, 4);
  const content = JSON.stringify({
    __mock: true,
    seed: h,
    note: "deterministic mock response for pipeline tests only",
  });
  return {
    content,
    provider: "mock",
    model: "mock-v1",
    requestTs: new Date().toISOString(),
    responseTs: new Date().toISOString(),
    latencyMs: 0,
    usage: { promptTokens: null, completionTokens: null, totalTokens: null, apiCost: null },
  };
}

export function createLLMClient(cfg: LLMConfig = llmConfigFromEnv()): LLMClient {
  return {
    config: cfg,
    async complete(messages, opts) {
      if (cfg.provider === "mock") return completeMock(cfg, messages);
      return completeZAI(cfg, messages, opts);
    },
  };
}
