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
  { name: "gemini",      label: "Gemini 3.5 Flash Lite", model: "gemini/gemini-3.5-flash-lite",       fallbackModel: "claude-opus-4.6", priority: 1, supportsTools: true,  maxTokens: 1024 },
  { name: "mistral",     label: "Mistral Medium",        model: "mistral/mistral-medium-latest",      fallbackModel: "claude-opus-4.6", priority: 2, supportsTools: true,  maxTokens: 1024 },
  { name: "gpt",         label: "GPT 5.5",               model: "cx/gpt-5.5",                         fallbackModel: "claude-opus-4.6", priority: 3, supportsTools: true,  maxTokens: 1024 },
  { name: "deepseek",    label: "Qwen 3.6 27B",          model: "groq/qwen/qwen3.6-27b",              fallbackModel: "claude-opus-4.6", priority: 4, supportsTools: false, maxTokens: 1024 },
  { name: "nemotron",    label: "Nemotron 3 Ultra 550B", model: "nvidia/nvidia/nemotron-3-ultra-550b-a55b", fallbackModel: "claude-opus-4.6", priority: 5, supportsTools: false, maxTokens: 1024 },
  { name: "claude-opus", label: "Claude Opus 4.6",       model: "claude-opus-4.6",                    fallbackModel: undefined, priority: 6, supportsTools: true,  maxTokens: 1024 },
];

/** Model yang mendukung function calling, diurutkan prioritas */
export const TOOL_CAPABLE_MODELS = NINE_ROUTER_MODELS.filter(m => m.supportsTools);
