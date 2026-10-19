import { HawkAgent, DoveAgent, ContrarianAgent } from "../agents/specific.agents";
import { AgentInsight } from "../models/AgentInsight";
import { silentLogger } from "../utils/silent-logger";
import { userMemoryService } from "./user-memory.service";
import { AITradeLog } from "../models/AITradeLog";

export interface DebateResult {
  hawk: { reply: string; toolsUsed: string[] };
  dove: { reply: string; toolsUsed: string[] };
  contrarian: { reply: string; toolsUsed: string[] };
  consensus: string;
  debateMode: "parallel" | "sequential";
}

export interface SingleAgentResult {
  personaId: string;
  name: string;
  reply: string;
  toolsUsed: string[];
}

class AgentConsensusService {

  /**
   * MODE 1: Parallel Debate (original)
   * Semua agent jawab bersamaan, tidak saling lihat.
   */
  async runParallelDebate(userPrompt: string, context: any): Promise<DebateResult> {
    const hawk = new HawkAgent();
    const dove = new DoveAgent();
    const contrarian = new ContrarianAgent();

    silentLogger.info("[AgentConsensus] Running PARALLEL debate...");

    const [hawkRes, doveRes, contrarianRes] = await Promise.all([
      hawk.think(userPrompt, context),
      dove.think(userPrompt, context),
      contrarian.think(userPrompt, context),
    ]);

    const consensus = await this.synthesize(hawkRes.reply, doveRes.reply, contrarianRes.reply, userPrompt, context);

    return {
      hawk: hawkRes,
      dove: doveRes,
      contrarian: contrarianRes,
      consensus,
      debateMode: "parallel",
    };
  }

  /**
   * MODE 2: Sequential Debate Chain
   * Hawk → Dove (respon Hawk) → Contrarian (respon Hawk+Dove) → Consensus
   * Setiap agent saling melihat analisis sebelumnya dan menantang/confirm.
   */
  async runSequentialDebate(userPrompt: string, context: any): Promise<DebateResult> {
    silentLogger.info("[AgentConsensus] Running SEQUENTIAL debate chain...");

    // Stage 1: Hawk gives initial analysis
    const hawk = new HawkAgent();
    const hawkPrompt = `Analisis awal Anda terhadap pertanyaan ini. Fokus pada risiko dan data pengetatan moneter.

PERTANYAAN: ${userPrompt}`;
    const hawkRes = await hawk.think(hawkPrompt, context);
    silentLogger.info("[AgentConsensus] Stage 1 (Hawk) complete");

    // Stage 2: Dove responds to Hawk's analysis
    const dove = new DoveAgent();
    const dovePrompt = `Hawk baru saja menganalisis:

---
${hawkRes.reply}
---

Tanggapi analisis Hawk ini dari sudut pandang akomodasi dan peluang. Setujui, bantah, atau tambahkan perspektif bullish yang mungkin terlewat.

PERTANYAAN AWAL: ${userPrompt}`;
    const doveRes = await dove.think(dovePrompt, context);
    silentLogger.info("[AgentConsensus] Stage 2 (Dove) complete");

    // Stage 3: Contrarian challenges both
    const contrarian = new ContrarianAgent();
    const contrarianPrompt = `Dua agent sudah berdebat:

HAWK (Bearish): ${hawkRes.reply}

DOVE (Bullish): ${doveRes.reply}

Sebagai Devil's Advocate, temukan kelemahan dalam argumen KEDUANYA. Apa yang mereka berdua salah atau lewatkan? Identifikasi anomali atau risiko tersembunyi yang diabaikan.

PERTANYAAN AWAL: ${userPrompt}`;
    const contrarianRes = await contrarian.think(contrarianPrompt, context);
    silentLogger.info("[AgentConsensus] Stage 3 (Contrarian) complete");

    // Stage 4: Consensus synthesis
    const consensus = await this.synthesize(hawkRes.reply, doveRes.reply, contrarianRes.reply, userPrompt, context);

    // Simpan debate chain ke MongoDB
    try {
      await AgentInsight.create({
        personaId: "consensus",
        insightType: "debate",
        content: consensus,
        conviction: this.extractConviction(consensus),
        regime: context.currentRegime,
        triggers: ["sequential_debate"],
        assets: context.assets?.map((a: any) => a.symbol || a.ticker) || [],
        metadata: {
          mode: "sequential",
          hawk: hawkRes.reply.substring(0, 500),
          dove: doveRes.reply.substring(0, 500),
          contrarian: contrarianRes.reply.substring(0, 500),
        },
      });
    } catch (e: any) {
      silentLogger.warn("[AgentConsensus] Failed to save debate:", e.message);
    }

    return {
      hawk: hawkRes,
      dove: doveRes,
      contrarian: contrarianRes,
      consensus,
      debateMode: "sequential",
    };
  }

  /**
   * Run single agent by personaId
   */
  async runSingleAgent(personaId: string, userPrompt: string, context: any): Promise<SingleAgentResult> {
    let agent;
    switch (personaId.toLowerCase()) {
      case "hawk": agent = new HawkAgent(); break;
      case "dove": agent = new DoveAgent(); break;
      case "contrarian": agent = new ContrarianAgent(); break;
      default:
        throw new Error(`Unknown persona: ${personaId}. Available: hawk, dove, contrarian`);
    }

    silentLogger.info(`[AgentConsensus] Running single agent: ${agent.name}`);
    const result = await agent.think(userPrompt, context);

    // Simpan insight
    try {
      await AgentInsight.create({
        personaId: personaId as any,
        insightType: "debate",
        content: result.reply,
        conviction: this.extractConviction(result.reply),
        regime: context.currentRegime,
        triggers: ["single_query"],
        assets: context.assets?.map((a: any) => a.symbol || a.ticker) || [],
      });
    } catch (e: any) {
      silentLogger.warn("[AgentConsensus] Failed to save insight:", e.message);
    }

    return {
      personaId,
      name: agent.name,
      reply: result.reply,
      toolsUsed: result.toolsUsed,
    };
  }

  /**
   * Synthesize consensus dari 3 agent outputs
   */
  private async synthesize(
    hawkReply: string,
    doveReply: string,
    contrarianReply: string,
    userPrompt: string,
    context: any,
  ): Promise<string> {
    const consensusPrompt = `Sebagai Head of Institutional Desk, buat sintesis konsensus akhir dari perdebatan 3 agent:

HAWK (Bearish/Risk): ${hawkReply}

DOVE (Bullish/Opportunity): ${doveReply}

CONTRARIAN (Devil's Advocate): ${contrarianReply}

PERTANYAAN AWAL: ${userPrompt}

Buat kesimpulan eksekutif yang:
1. Menyebutkan area KONSENSUS (dimana ketiga setuju)
2. Menyebutkan area DIVERGEN (dimana berbeda pendapat)
3. Memberikan BIAS AKHIR (Bullish/Bearish/Netral) dengan conviction (TINGGI/SEDANG/RENDAH)
4. Actionable insight untuk trader

Maksimal 3 paragraf padat dalam Bahasa Indonesia institusional.`;

    const synthesizer = new HawkAgent();
    synthesizer.systemPrompt = "ROLE: Head of Institutional Desk. Anda adalah penulis sintesis konsensus yang objektif, presisi, dan actionable. Bukan hawkish, bukan dovish — netral dan data-driven.";
    const result = await synthesizer.think(consensusPrompt, context);
    return result.reply;
  }

  /**
   * Calculate weighted consensus from agent votes.
   * Weights: Hawk=1.5 (risk priority), Dove=1.0, Contrarian=1.0
   * Threshold: ≥60% for GOOD/BAD verdict, else SKIP
   */
  async calculateWeightedConsensus(
    votes: Array<{ persona: string; bias: string; confidence: number; weight: number }>,
  ): Promise<{ verdict: "GOOD" | "BAD" | "SKIP"; consensusScore: number; finalBias: string; bullishScore: number; bearishScore: number }> {
    const weights: Record<string, number> = { hawk: 1.5, dove: 1.0, contrarian: 1.0 };

    let bullishWeighted = 0;
    let bearishWeighted = 0;
    let totalWeight = 0;

    for (const vote of votes) {
      const w = weights[vote.persona] ?? vote.weight ?? 1.0;
      totalWeight += w;
      if (vote.bias === "BULLISH") {
        bullishWeighted += vote.confidence * w;
      } else if (vote.bias === "BEARISH") {
        bearishWeighted += vote.confidence * w;
      }
    }

    const bullishScore = totalWeight > 0 ? bullishWeighted / totalWeight : 0;
    const bearishScore = totalWeight > 0 ? bearishWeighted / totalWeight : 0;

    const THRESHOLD = 0.6;
    let verdict: "GOOD" | "BAD" | "SKIP";
    let finalBias: string;
    let consensusScore: number;

    if (bullishScore >= THRESHOLD) {
      verdict = "GOOD";
      finalBias = "BULLISH";
      consensusScore = bullishScore;
    } else if (bearishScore >= THRESHOLD) {
      verdict = "BAD";
      finalBias = "BEARISH";
      consensusScore = bearishScore;
    } else {
      verdict = "SKIP";
      finalBias = bullishScore >= bearishScore ? "BULLISH" : "BEARISH";
      consensusScore = Math.max(bullishScore, bearishScore);
    }

    return { verdict, consensusScore, finalBias, bullishScore, bearishScore };
  }

  /**
   * Build trade history context for agent prompts.
   * Fetches recent AITradeLog from MongoDB and formats as "past performance evidence".
   */
  async buildTradeHistoryContext(userId: string): Promise<string> {
    const trades = await AITradeLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (!trades || trades.length === 0) {
      return `[RIWAYAT TRADING: User belum memiliki riwayat trading. Agent akan belajar dari interaksi pertama.]`;
    }

    const totalTrades = trades.length;
    const wins = trades.filter((t: any) => t.profit > 0).length;
    const losses = trades.filter((t: any) => t.profit < 0).length;
    const winRate = Math.round((wins / totalTrades) * 100);
    const totalProfit = trades.reduce((sum: number, t: any) => sum + (t.profit || 0), 0);
    const avgProfit = Math.round(totalProfit / totalTrades);

    // Build symbol frequency
    const symbolCount: Record<string, number> = {};
    trades.forEach((t: any) => {
      symbolCount[t.symbol] = (symbolCount[t.symbol] || 0) + 1;
    });
    const topSymbols = Object.entries(symbolCount)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 3)
      .map(([sym, cnt]) => `${sym}(${cnt}x)`)
      .join(", ");

    return `[RIWAYAT TRADING USER - EVIDENCE PERFORMANCE]:
- Total trade: ${totalTrades}
- Win rate: ${winRate}% (${wins}W / ${losses}L)
- Total profit: $${totalProfit}
- Rata-rata profit: $${avgProfit}/trade
- Symbol teratas: ${topSymbols}
- Trade terakhir: ${trades[0]?.symbol || "N/A"} ${trades[0]?.direction || ""} @ ${trades[0]?.entry?.toFixed(5) || "N/A"}`;
  }

  /**
   * Build persona-specific memory context for agent prompts.
   * Returns structured memory text tailored to each agent's role:
   * - Hawk: risk preference, past stop-outs, liquidity sensitivity
   * - Dove: opportunity patterns, winning trades, momentum signals
   * - Contrarian: past consensus failures, anomaly detection
   */
  async buildMemoryContext(userId: string, personaId: string): Promise<string> {
    const memory = await userMemoryService.getOrCreate(userId);
    const activeName = (memory.name || "").trim() || "Trader";

    // Get persona-specific facts (top 5 by recency)
    const personaMemory = memory.agentMemories?.find((m: any) => m.personaId === personaId);
    const personaFacts = personaMemory?.facts?.slice(-5) || [];

    // Get general facts (top 5)
    const generalFacts = memory.learnedFacts?.slice(-5) || [];

    // Persona-specific context instructions
    const personaInstructions: Record<string, string> = {
      hawk: `[FOKUS ANALISIS: Risiko, stop-out, dan sensitivitas likuiditas]
- Utamakan capital preservation
- Identifikasi tail risk yang mungkin terlewat
- Evaluasi dampak likuiditas terhadap posisi`,
      dove: `[FOKUS ANALISI: Peluang, momentum, dan winning patterns]
- Identifikasi peluang bullish yang belum terekspresi
- Evaluasi momentum dan trend continuation
- Cari setup risk/reward yang menguntungkan`,
      contrarian: `[FOKUS ANALISI: Skeptisisme, anomali, dan kegagalan konsensus]
- Tantang asumsi mayoritas
- Identifikasi risiko tersembunyi (tail risk)
- Cari pola anomali yang diabaikan`,
    };

    const instruction = personaInstructions[personaId] || "";

    const factsSection = [
      generalFacts.length > 0
        ? `Fakta umum user:\n${generalFacts.map((f: any) => `- ${f.fact}`).join("\n")}`
        : "",
      personaFacts.length > 0
        ? `Fakta spesifik untuk persona ${personaId}:\n${personaFacts.map((f: any) => `- [${f.category || "insight"}] ${f.fact}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return `[KONTEKS MEMORI UNTUK ${activeName.toUpperCase()}]
Persona: ${personaId}
Total interaksi: ${memory.interactionCount || 1}

${instruction}

${factsSection || "Belum ada memori tersimpan. Agent akan belajar dari interaksi pertama."}`;
  }

  private extractConviction(text: string): "TINGGI" | "SEDANG" | "RENDAH" {
    const lower = text.toLowerCase();
    if (lower.includes("conviction tinggi") || lower.includes("high conviction") || lower.includes("sangat yakin")) return "TINGGI";
    if (lower.includes("conviction rendah") || lower.includes("low conviction") || lower.includes("ragu")) return "RENDAH";
    return "SEDANG";
  }
}

export const agentConsensusService = new AgentConsensusService();
