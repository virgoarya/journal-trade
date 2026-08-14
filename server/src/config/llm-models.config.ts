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
}

// Verify all models have priority set:
// gemini: 1, mistral: 2, gpt: 3, deepseek: 4, nemotron: 5, claude-opus: 6
export const NINE_ROUTER_MODELS: LLMModelConfig[] = [
  { name: "gemini",      label: "Gemini 3.1 Flash", model: "gc/gemini-3.1-flash-lite-preview",     fallbackModel: "gc/gemini-2.5-flash", priority: 1 },
  { name: "mistral",     label: "Mistral Large",    model: "mistral/mistral-large-latest",         fallbackModel: "mistral/mistral-medium-latest", priority: 2 },
  { name: "gpt",         label: "GPT OSS 120B",     model: "groq/openai/gpt-oss-120b",             fallbackModel: "groq/llama-3.3-70b-versatile", priority: 3 },
  { name: "deepseek",    label: "DeepSeek 3.2",     model: "kr/deepseek-3.2",                      fallbackModel: "openrouter/poolside/laguna-s-2.1:free", priority: 4 },
  { name: "nemotron",    label: "Nemotron 3.5",     model: "openrouter/nvidia/nemotron-3.5-lightning:free", fallbackModel: "kr/minimax-m2.5", priority: 5 },
  { name: "claude-opus", label: "Claude Opus 4.6",  model: "ag/claude-opus-4-6-thinking",          fallbackModel: "kr/claude-sonnet-4.5", priority: 6 },
];
