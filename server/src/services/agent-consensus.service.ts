import { HawkAgent, DoveAgent, ContrarianAgent } from "../agents/specific.agents";
import { AgentInsight } from "../models/AgentInsight";
import { silentLogger } from "../utils/silent-logger";

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

  private extractConviction(text: string): "TINGGI" | "SEDANG" | "RENDAH" {
    const lower = text.toLowerCase();
    if (lower.includes("conviction tinggi") || lower.includes("high conviction") || lower.includes("sangat yakin")) return "TINGGI";
    if (lower.includes("conviction rendah") || lower.includes("low conviction") || lower.includes("ragu")) return "RENDAH";
    return "SEDANG";
  }
}

export const agentConsensusService = new AgentConsensusService();
