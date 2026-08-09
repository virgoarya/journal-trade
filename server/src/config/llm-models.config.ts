// ─── LLM Provider Model Configuration ─────────────────────────────
// Model utama + fallback untuk 9Router. Dipisah dari service agar
// mudah di-test tanpa memicu env/network load.

export interface LLMModelConfig {
  name: string;
  label: string;
  model: string;
  /** Model cadangan jika model utama gagal/rate-limited */
  fallbackModel?: string;
}

export const NINE_ROUTER_MODELS: LLMModelConfig[] = [
  { name: "deepseek",   label: "DeepSeek V4",      model: "oc/deepseek-v4-flash-free",            fallbackModel: "oc/laguna-s-2.1-free" },
  { name: "gpt",          label: "GPT OSS 120B",     model: "groq/openai/gpt-oss-120b",             fallbackModel: "groq/llama-3.3-70b-versatile" },
  { name: "gemini",     label: "Gemini 3.1 Flash", model: "gc/gemini-3.1-flash-lite-preview",     fallbackModel: "gc/gemini-2.5-pro" },
  { name: "mistral",    label: "Mistral Large",    model: "mistral/mistral-large-latest",         fallbackModel: "mistral/mistral-medium-latest" },
  { name: "nemotron",   label: "Nemotron 3 Ultra", model: "oc/nemotron-3-ultra-free",             fallbackModel: "nvidia/minimaxai/minimax-m3" },
  { name: "claude-opus", label: "Claude Opus 4.6",    model: "ag/claude-opus-4-6-thinking",          fallbackModel: "kr/claude-sonnet-4.5" },
];
