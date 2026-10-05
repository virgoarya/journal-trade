import { HawkAgent, DoveAgent, ContrarianAgent } from "../agents/specific.agents";
import { AgentInsight } from "../models/AgentInsight";
import { silentLogger } from "../utils/silent-logger";
import axios from "axios";
import { env, selfApiUrl } from "../config/env";

/**
 * Proactive Alert Service
 * 
 * Agent analysis berkala tanpa diminta user.
 * Fetch macro data → jalankan setiap agent → simpan insight → broadcast via WebSocket.
 * Interval default: 30 menit (bisa diubah via env).
 */
class ProactiveAlertService {
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private wsBroadcast: ((event: string, data: any) => void) | null = null;

  constructor() {
    this.intervalMs = parseInt(process.env.AGENT_PROACTIVE_INTERVAL_MS || "1800000", 10); // 30 menit
  }

  /**
   * Set WebSocket broadcast function (dipanggil dari index.ts setelah ws ready)
   */
  setWsBroadcast(broadcast: (event: string, data: any) => void) {
    this.wsBroadcast = broadcast;
  }

  /**
   * Mulai timer proactive analysis
   */
  start() {
    if (this.timer) return;
    silentLogger.info(`[ProactiveAlert] Starting with interval ${this.intervalMs / 1000}s`);
    
    // Run pertama kali setelah 60 detik (biar server stabil dulu)
    setTimeout(() => {
      this.runCycle().catch(e => silentLogger.warn("[ProactiveAlert] Initial cycle failed:", e.message));
    }, 60000);

    this.timer = setInterval(() => {
      this.runCycle().catch(e => silentLogger.warn("[ProactiveAlert] Cycle failed:", e.message));
    }, this.intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      silentLogger.info("[ProactiveAlert] Stopped");
    }
  }

  /**
   * Jalankan satu siklus proactive analysis
   */
  async runCycle() {
    if (this.isRunning) {
      silentLogger.info("[ProactiveAlert] Previous cycle still running, skipping");
      return;
    }
    this.isRunning = true;
    const startTime = Date.now();

    try {
      // 1. Fetch live macro data
      const macroData = await this.fetchMacroData();
      if (!macroData) {
        silentLogger.warn("[ProactiveAlert] No macro data available, skipping cycle");
        return;
      }

      const context = {
        currentRegime: macroData.regime || "Unknown",
        liquidityStatus: macroData.liquidityDrain || "Unknown",
        assets: macroData.assets || [],
        macroData,
      };

      // ─── Ambil daftar user aktif ───
      // Insight harus PER-USER supaya tiap user dipanggil dengan namanya sendiri,
      // bukan nama user lain (dulu hardcode "Bang Vir" untuk semua).
      const activeUserIds = await this.getActiveUserIds();
      if (activeUserIds.length === 0) {
        silentLogger.info("[ProactiveAlert] Tidak ada user aktif, skip cycle");
        return;
      }

      // 2. Run semua agent secara parallel — per user
      const hawk = new HawkAgent();
      const dove = new DoveAgent();
      const contrarian = new ContrarianAgent();

      const prompt = `Analisis kondisi pasar TERKINI dan berikan 1-2 insight proactive yang paling penting untuk trader hari ini.

DATA LIVE:
- Regime: ${macroData.regime || "N/A"}
- CPI YoY: ${macroData.cpi || "N/A"}%
- Fed Funds: ${macroData.fedRate || "N/A"}%
- VIX: ${macroData.vix || "N/A"}
- LiquidityDrain: ${macroData.liquidityDrain || "N/A"}
- PMI: ${macroData.pmi || "N/A"}
- Top News: ${macroData.topNews || "N/A"}

Berikan insight singkat (maksimal 3 paragraf) dengan format:
1. [KONDISI] - Apa yang terjadi
2. [IMPLIKASI] - Apa artinya untuk pasar
3. [AKSI] - Yang perlu diperhatikan trader`;

      const allInsights: Array<Record<string, any>> = [];

      for (const userId of activeUserIds) {
        const userContext = { ...context, userId };

        const [hawkRes, doveRes, contrarianRes] = await Promise.all([
          hawk.think(prompt, userContext),
          dove.think(prompt, userContext),
          contrarian.think(prompt, userContext),
        ]);

        for (const [personaId, res] of [
          ["hawk", hawkRes],
          ["dove", doveRes],
          ["contrarian", contrarianRes],
        ] as const) {
          // Lewati insight yang gagal (LLM tidak merespons) — jangan simpan
          // pesan error sebagai analisis.
          if (res.failed || !res.reply || !res.reply.trim()) {
            silentLogger.warn(
              `[ProactiveAlert] ${personaId} gagal untuk ${userId} — insight dilewati.`
            );
            continue;
          }

          allInsights.push({
            userId,
            personaId,
            insightType: "proactive" as const,
            content: res.reply,
            conviction: this.extractConviction(res.reply),
            regime: macroData.regime,
            triggers: ["proactive_cycle"],
            assets: ["XAUUSD", "NASDAQ", "SPX500"],
            metadata: {
              macroSnapshot: {
                cpi: macroData.cpi,
                fedRate: macroData.fedRate,
                vix: macroData.vix,
                liquidityDrain: macroData.liquidityDrain,
              },
            },
          });
        }
      }

      // Kalau semua agent gagal, jangan simpan apa pun
      if (allInsights.length === 0) {
        silentLogger.warn("[ProactiveAlert] Tidak ada insight valid — cycle dilewati.");
        return;
      }

      // 3. Simpan insights ke MongoDB
      const savedDocs = await AgentInsight.insertMany(allInsights);

      // 4. Broadcast via WebSocket jika ada client
      if (this.wsBroadcast) {
        this.wsBroadcast("agent:proactive", {
          timestamp: new Date().toISOString(),
          insights: savedDocs.map((doc) => ({
            userId: (doc as any).userId,
            personaId: doc.personaId,
            content: doc.content,
            conviction: doc.conviction,
            regime: doc.regime,
          })),
        });
      }

      const elapsed = Date.now() - startTime;
      silentLogger.info(
        `[ProactiveAlert] Cycle completed in ${elapsed}ms. ${savedDocs.length} insights saved untuk ${activeUserIds.length} user.`
      );
    } catch (err: any) {
      silentLogger.error("[ProactiveAlert] Cycle error:", err.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Ambil daftar userId yang punya memory agent.
   *
   * Insight proactive dibuat PER-USER supaya setiap user mendapat analisis
   * dengan identitasnya sendiri. Kalau tidak ada user (instalasi baru),
   * fallback ke ["global"] agar sistem tetap menghasilkan insight.
   */
  private async getActiveUserIds(): Promise<string[]> {
    try {
      const { UserAgentMemory } = await import("../models/UserAgentMemory");
      const memories = await UserAgentMemory.find({})
        .select("userId")
        .limit(200)
        .lean();
      const ids = memories
        .map((m: any) => m.userId)
        .filter((id: any): id is string => typeof id === "string" && id.length > 0);

      if (ids.length === 0) {
        silentLogger.info("[ProactiveAlert] Belum ada user memory — pakai scope global");
        return ["global"];
      }
      return Array.from(new Set(ids));
    } catch (err: any) {
      silentLogger.warn("[ProactiveAlert] getActiveUserIds gagal:", err.message);
      return ["global"];
    }
  }

  /**
   * Fetch macro data dari internal API
   */
  private async fetchMacroData() {
    try {
      const [geoResp, regimeResp, newsResp] = await Promise.all([
        axios.get(`${selfApiUrl}/api/v1/geo-risk`, { timeout: 5000 }).catch(() => null),
        axios.get(`${selfApiUrl}/api/v1/macro-regime/snapshot`, { timeout: 5000 }).catch(() => null),
        axios.get(`${selfApiUrl}/api/v1/market-data/news`, { timeout: 5000 }).catch(() => null),
      ]);

      const geoRaw = geoResp?.data?.data?.raw || {};
      const regimeData = regimeResp?.data?.data || {};
      const newsItems = newsResp?.data?.data || newsResp?.data || [];

      return {
        cpi: regimeData?.cpiYoY ?? geoRaw?.cpi_yoy ?? null,
        fedRate: geoRaw?.fedfunds_rate ?? null,
        vix: geoRaw?.vix ?? null,
        pmi: geoRaw?.globalPmi ?? null,
        liquidityDrain: geoResp?.data?.data?.scores?.liquidityDrain ?? null,
        regime: regimeData?.quadrant || null,
        topNews: Array.isArray(newsItems) && newsItems.length > 0
          ? newsItems.slice(0, 3).map((n: any) => n.headline || n.title).join("; ")
          : null,
        assets: [],
      };
    } catch (err: any) {
      silentLogger.warn("[ProactiveAlert] fetchMacroData failed:", err.message);
      return null;
    }
  }

  /**
   * Extract conviction level dari text agent
   */
  private extractConviction(text: string): "TINGGI" | "SEDANG" | "RENDAH" {
    const lower = text.toLowerCase();
    if (lower.includes("conviction tinggi") || lower.includes("sangat yakin") || lower.includes("high conviction")) {
      return "TINGGI";
    }
    if (lower.includes("conviction rendah") || lower.includes("ragu") || lower.includes("low conviction")) {
      return "RENDAH";
    }
    return "SEDANG";
  }

  /**
   * Get latest proactive insights untuk user tertentu.
   *
   * PENTING: filter by userId supaya user hanya melihat insight miliknya
   * (yang menyebut namanya sendiri), bukan insight user lain.
   */
  async getLatestInsights(limit = 10, userId?: string) {
    const filter: Record<string, any> = { insightType: "proactive" };
    if (userId) filter.userId = userId;

    return AgentInsight.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get latest insights per agent untuk user tertentu.
   */
  async getLatestPerAgent(userId?: string) {
    const personas = ["hawk", "dove", "contrarian"] as const;
    const results: Record<string, any> = {};

    for (const p of personas) {
      const filter: Record<string, any> = { personaId: p, insightType: "proactive" };
      if (userId) filter.userId = userId;

      results[p] = await AgentInsight.findOne(filter)
        .sort({ createdAt: -1 })
        .lean();
    }

    return results;
  }
}

export const proactiveAlertService = new ProactiveAlertService();
