import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { aiCoachService } from "../services/ai-coach.service";
import { generateText, tool } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../config/env";
import { Trade } from "../models/Trade";
import { apiResponse } from "../utils/api-response";

const router = Router();
router.use(requireAuth);

const chatRequestSchema = z.object({
  message: z.string().min(1, "Pesan obrolan tidak boleh kosong"),
  history: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ).optional(),
});

router.post("/chat", validateRequest({ body: chatRequestSchema }), async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;
    const userId = req.user.id;

    if (!env.NINE_ROUTER_URL && !env.ANTHROPIC_AUTH_TOKEN && !env.GEMINI_API_KEY) {
      return apiResponse.error(res, "Layanan AI Asisten tidak aktif: Tidak ada API key yang terkonfigurasi.", "AI_ERROR", 503);
    }

    // 1. Gather historical data from DB
    const tradingContext = await aiCoachService.getUserTradingContext(userId);

    // 2. Define System Prompt for trading psychologist / performance coach
    const systemPrompt = `Anda adalah Hunter Trades AI Coach, asisten psikologi trading dan analis performa pribadi eksklusif.
Tugas utama Anda adalah membantu trader menganalisis jurnal mereka sendiri, mengevaluasi kedisiplinan aturan playbook, dan memberikan rekomendasi psikologi berdasarkan emosi mereka.

Gunakan data real-time akun trader berikut sebagai konteks utama diskusi Anda:
${JSON.stringify(tradingContext, null, 2)}

ATURAN PERILAKU:
1. Bersikaplah objektif, tegas, disiplin, namun suportif seperti pelatih trading profesional kelas dunia.
2. Fokus pada perbaikan psikologi (kesabaran, penanganan FOMO, overtrading, keserakahan, kepatuhan stop loss).
3. Jika ditanya tentang trade tertentu secara spesifik yang tidak ada di riwayat ringkas, gunakan tool get_trade_details.
4. Jawab dalam Bahasa Indonesia institusional yang lugas dan terstruktur.`;

    const openRouter = createOpenAI({
      baseURL: env.ANTHROPIC_BASE_URL?.includes("/v1") ? env.ANTHROPIC_BASE_URL : "https://openrouter.ai/api/v1",
      apiKey: env.ANTHROPIC_AUTH_TOKEN || "",
    });

    const google = createGoogleGenerativeAI({
      apiKey: env.GEMINI_API_KEY || "",
    });

    // Build provider candidates queue for high resilience
    const candidates = [];

    if (env.NINE_ROUTER_URL) {
      const nineRouter = createOpenAI({
        baseURL: env.NINE_ROUTER_URL,
        apiKey: env.NINE_ROUTER_API_KEY || "sk-9router-local",
      });
      candidates.push({ model: nineRouter.chat(env.NINE_ROUTER_MODEL || "free"), label: "9router-free" });
    }

    if (env.ANTHROPIC_AUTH_TOKEN) {
      candidates.push({ model: openRouter.chat(env.ANTHROPIC_MODEL || "gpt-4o"), label: "openrouter-primary" });
    }

    if (env.GEMINI_API_KEY) {
      candidates.push({ model: google(env.GEMINI_MODEL || "gemini-2.5-flash"), label: "gemini-flash" });
    }

    // Ultimate free fallback
    candidates.push({ model: openRouter.chat("openai/gpt-oss-120b:free"), label: "openrouter-free" });

    let response = null;
    let lastError: any = null;

    // 3. Try candidates sequentially until one succeeds
    for (const candidate of candidates) {
      try {
        console.log(`[AICoach] Trying model candidate: ${candidate.label}`);
        response = await generateText({
          model: candidate.model,
          system: systemPrompt,
          messages: [...history, { role: "user", content: message }],
          tools: {
            get_trade_details: tool({
              description: "Mendapatkan detail lengkap satu trade tertentu berdasarkan ID trade",
              parameters: z.object({
                tradeId: z.string().describe("ID dari trade yang ingin dicari detailnya")
              }),
              execute: async ({ tradeId }: { tradeId: string }) => {
                const trade = await Trade.findOne({ _id: tradeId, userId });
                if (!trade) return JSON.stringify({ error: "Trade tidak ditemukan atau bukan milik Anda" });
                return JSON.stringify({
                  id: trade._id.toString(),
                  pair: trade.pair,
                  direction: trade.direction,
                  entryPrice: trade.entryPrice,
                  stopLoss: trade.stopLoss,
                  takeProfit: trade.takeProfit || "Tidak ada",
                  lotSize: trade.lotSize,
                  actualPnl: trade.actualPnl,
                  result: trade.result,
                  emotionalState: trade.emotionalState || "Tidak dicatat",
                  notes: trade.notes || "Tidak ada catatan",
                  session: trade.session || "Other",
                  marketCondition: trade.marketCondition || "ALL",
                  date: trade.tradeDate.toISOString()
                });
              }
            } as any)
          } as any,
          maxSteps: 2
        } as any);
        lastError = null; // Cleared on success
        break;
      } catch (err: any) {
        console.warn(`[AICoach] Candidate ${candidate.label} failed:`, err.message || err);
        lastError = err;
      }
    }

    if (lastError || !response) {
      return apiResponse.error(
        res,
        `AI Coach gagal merespons setelah mencoba semua provider. Error terakhir: ${lastError?.message || "Unknown error"}`,
        "AI_COACH_ERROR",
        500
      );
    }

    return apiResponse.success(res, {
      reply: response.text,
      toolsUsed: response.steps?.flatMap(s => s.toolCalls.map(tc => tc.toolName)) || []
    });
  } catch (error) { next(error); }
});

export default router;
