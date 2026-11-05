// ─── Reasoning Parser ───────────────────────────────────────────────
// Pure functions to parse LLM reasoning text into structured points
// with methodology category tags. Shared by LLMProviderCard and others.

export interface ReasoningPoint {
  text: string;
  categories: string[];
}

// Extract category tags from reasoning text based on keywords
export function extractCategories(reasoning: string): string[] {
  const keywords: Record<string, string> = {
    SMC: "SMC",
    ICT: "ICT",
    MSNR: "MSNR",
    "Risk/Reward": "Risk/Reward",
    Fundamental: "Fundamental",
    Structure: "Structure",
  };

  const found: string[] = [];
  const lower = reasoning.toLowerCase();
  for (const [key, label] of Object.entries(keywords)) {
    if (lower.includes(key.toLowerCase())) {
      found.push(label);
    }
  }
  // Remove duplicates while preserving order
  return [...new Set(found)];
}

// Parse reasoning bullet points into structured points
export function parseReasoningPoints(reasoning: string): ReasoningPoint[] {
  if (!reasoning) return [];

  const points: ReasoningPoint[] = [];
  const lines = reasoning.split("\n");

  let hasBullets = false;
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines
    if (!trimmed) continue;
    // Skip lines that don't start with bullet point marker
    if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
      hasBullets = true;
      const pointText = trimmed.replace(/^[-•]\s*/, "").trim();
      if (!pointText) continue;
      const categories = extractCategories(pointText);
      points.push({ text: pointText, categories });
    }
  }

  // If no bullet points found but we have reasoning, split by sentence/line
  if (!hasBullets && reasoning.trim()) {
    const sentences = reasoning
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const sentence of sentences) {
      const categories = extractCategories(sentence);
      points.push({ text: sentence, categories });
    }
  }

  return points;
}
