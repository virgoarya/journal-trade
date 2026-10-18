// ─── LLM Provider Model Configuration ─────────────────────────────
// Model utama + fallback untuk 9Router. Dipisah dari service agar
// mudah di-test tanpa memicu env/network load.

export interface LLMModelConfig {
  name: string;
  label: string;
  model: string;
  /** Model cadangan jika model utama gagal/rate-limited */
  fallbackModel?: string;
  /** Priority order - lower number = higher priority */
  priority: number;
  /** Apakah model mendukung function calling / tool use via Vercel AI SDK */
  supportsTools: boolean;
  /** Max tokens yang aman untuk model ini */
  maxTokens: number;
}

// Verify all models have priority set:
// gemini: 1, mistral: 2, gpt: 3, deepseek: 4, nemotron: 5, claude-opus: 6
export const NINE_ROUTER_MODELS: LLMModelConfig[] = [
  { name: "gemini",      label: "Gemini 3.5 Flash Lite", model: "gemini/gemini-3.5-flash-lite",       fallbackModel: "claude-opus-4.6", priority: 1, supportsTools: true,  maxTokens: 2500 },
  { name: "mistral",     label: "Mistral Medium",        model: "mistral/mistral-medium-latest",      fallbackModel: "claude-opus-4.6", priority: 2, supportsTools: true,  maxTokens: 1024 },
  { name: "gpt",         label: "JEV 1.13",              model: "openrouter/typesafe/jev-1.13",       fallbackModel: "claude-opus-4.6", priority: 3, supportsTools: true,  maxTokens: 1024 },
  { name: "nemotron",    label: "Llama 3.1 8B FP8",      model: "cf/@cf/meta/llama-3.1-8b-instruct-fp8-fast", fallbackModel: "claude-opus-4.6", priority: 5, supportsTools: false, maxTokens: 1024 },
  { name: "claude-opus", label: "Claude Opus 4.6",       model: "claude-opus-4.6",                    fallbackModel: "gemini/gemini-3.5-flash-lite", priority: 6, supportsTools: true,  maxTokens: 2500 },
];

/** Last-resort: 9Router meta-router yang otomatis pilih model free yang hidup. Dipakai
 *  HANYA di callDualEngine (non-tool), tidak masuk TOOL_CAPABLE_MODELS karena
 *  9router auto-routing tidak menjamin tool-calling stabil. */
export const NINE_ROUTER_EMERGENCY_FALLBACK = "auto-free-model";

/** Model yang mendukung function calling, diurutkan prioritas */
export const TOOL_CAPABLE_MODELS = NINE_ROUTER_MODELS.filter(m => m.supportsTools);
