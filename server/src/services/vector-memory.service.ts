import axios from "axios";
import { env } from "../config/env";
import { silentLogger } from "../utils/silent-logger";
import { VectorMemory, IVectorMemory } from "../models/VectorMemory";

const VECTOR_DIM = 64;

/**
 * Local fast fallback vectorizer (n-gram hashing + normalization)
 * Ensures 100% reliability even if external embedding API is unreachable.
 */
function localHashVectorize(text: string, dim: number = VECTOR_DIM): number[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = clean.split(/\s+/).filter(Boolean);
  const vec = new Array(dim).fill(0);

  if (tokens.length === 0) return vec;

  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash << 5) - hash + token.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dim;
    vec[idx] += 1;
  }

  // Unit-vector L2 normalize
  let sumSq = 0;
  for (let i = 0; i < dim; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1;
  for (let i = 0; i < dim; i++) {
    vec[i] /= norm;
  }

  return vec;
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator > 0 ? dot / denominator : 0;
}

class VectorMemoryService {
  /**
   * Vectorize text via 9router/OpenAI embedding endpoint or fallback
   */
  async vectorize(text: string): Promise<number[]> {
    if (!text || !text.trim()) {
      return new Array(VECTOR_DIM).fill(0);
    }

    // Try 9Router / OpenAI embeddings API if configured
    if (env.NINE_ROUTER_URL) {
      try {
        const resp = await axios.post(
          `${env.NINE_ROUTER_URL}/embeddings`,
          {
            input: text.slice(0, 1000),
            model: "text-embedding-3-small",
          },
          {
            headers: {
              Authorization: `Bearer ${env.NINE_ROUTER_API_KEY || "sk-dummy"}`,
              "Content-Type": "application/json",
            },
            timeout: 5000,
          }
        );

        const embedding = resp.data?.data?.[0]?.embedding;
        if (Array.isArray(embedding) && embedding.length > 0) {
          return embedding;
        }
      } catch (err: any) {
        // Fallback gracefully
        silentLogger.debug(
          `[VectorMemory] 9Router embeddings unavailable (${err.message}), using local vectorizer`
        );
      }
    }

    return localHashVectorize(text);
  }

  /**
   * Blok 1: RAG Search from Vector DB for Episodic/Reflective Memory
   */
  async searchEpisodicMemory(
    userId: string,
    personaId: string,
    query: string,
    topK: number = 3
  ): Promise<Array<{ query: string; reply: string; score: number }>> {
    try {
      if (!query || !query.trim()) return [];

      const queryVec = await this.vectorize(query);
      const candidates = await VectorMemory.find({
        userId,
        personaId: { $in: [personaId, "default"] },
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      if (!candidates || candidates.length === 0) return [];

      const scored = candidates.map((item) => {
        let score = 0;
        if (item.vector && item.vector.length === queryVec.length) {
          score = cosineSimilarity(queryVec, item.vector);
        } else {
          // If dimension mismatch, compute local comparison
          const vA = localHashVectorize(query);
          const vB = localHashVectorize(item.queryText);
          score = cosineSimilarity(vA, vB);
        }
        return {
          query: item.queryText,
          reply: item.replyText,
          score,
        };
      });

      // Filter and sort top matches
      return scored
        .filter((s) => s.score > 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    } catch (err: any) {
      silentLogger.warn(`[VectorMemory] RAG search error: ${err.message}`);
      return [];
    }
  }

  /**
   * Blok 4: Asynchronously Vectorize User Intent and Save to Vector DB
   */
  async vectorizeUserIntent(
    userId: string,
    personaId: string,
    queryText: string,
    replyText: string,
    intentTag?: string
  ): Promise<void> {
    try {
      if (!queryText || !queryText.trim()) return;

      const vector = await this.vectorize(queryText);
      await VectorMemory.create({
        userId,
        personaId: personaId || "default",
        queryText: queryText.trim(),
        replyText: (replyText || "").slice(0, 1000).trim(),
        vector,
        intentTag: intentTag || "",
      });

      silentLogger.info(
        `[VectorMemory] Vectorized and captured intent for user ${userId} (${personaId})`
      );
    } catch (err: any) {
      silentLogger.warn(`[VectorMemory] Failed to vectorize intent: ${err.message}`);
    }
  }
}

export const vectorMemoryService = new VectorMemoryService();
