import { AiReview } from "../models/AiReview";
import { Trade } from "../models/Trade";
import { Playbook } from "../models/Playbook";
import { TradingAccount } from "../models/TradingAccount";
import { Notification } from "../models/Notification";
import { env } from "../config/env";
import Anthropic from "@anthropic-ai/sdk";

function parseFormattedText(text: string): any {
  const result: any = {
    score: 5,
    strengths: [],
    improvements: [],
    summary: "",
    recommendation: "",
    riskWarning: ""
  };

  console.log("Parsing formatted text...");

  // Extract Overall Score - look for "Overall Score: 8" or "Overall Score\n8"
  const scoreMatch = text.match(/Overall Score\s*[:\n\r]+\s*(\d+)/i);
  if (scoreMatch) {
    result.score = parseInt(scoreMatch[1], 10);
  }

  // Extract Summary: between "AI Analysis Report" and "Overall Score"
  const summaryMatch = text.match(/AI Analysis Report\s*[\n\r]+([\s\S]*?)(?=Overall Score|$)/i);
  if (summaryMatch) {
    result.summary = summaryMatch[1].replace(/\n+/g, ' ').trim();
  }

  // Extract Strengths - capture all lines after "Strengths:" until next section
  const strengthsMatch = text.match(/Strengths\s*[:\n\r]+([\s\S]*?)(?=Areas for Improvement|Risk Warning|Actionable Suggestions|$)/i);
  if (strengthsMatch) {
    let strengthsText = strengthsMatch[1];
    const lines = strengthsText.split('\n').filter(line => line.trim());
    const bullets: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const bulletMatch = trimmed.match(/^[✓!→•\-\*\d\.\)]\s*(.+)$/);
      if (bulletMatch) {
        bullets.push(bulletMatch[1].trim());
      } else if (trimmed.length > 0 && trimmed.length < 100) {
        bullets.push(trimmed);
      }
    }
    result.strengths = bullets;
  }

  // Extract Improvements
  const improvementsMatch = text.match(/Areas for Improvement\s*[:\n\r]+([\s\S]*?)(?=Risk Warning|Actionable Suggestions|$)/i);
  if (improvementsMatch) {
    let improvementsText = improvementsMatch[1];
    const lines = improvementsText.split('\n').filter(line => line.trim());
    const bullets: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const bulletMatch = trimmed.match(/^[✓!→•\-\*\d\.\)]\s*(.+)$/);
      if (bulletMatch) {
        bullets.push(bulletMatch[1].trim());
      } else if (trimmed.length > 0 && trimmed.length < 100) {
        bullets.push(trimmed);
      }
    }
    result.improvements = bullets;
  }

  // Extract Risk Warning
  const riskWarningMatch = text.match(/Risk Warning\s*[:\n\r]+([\s\S]*?)(?=Actionable Suggestions|$)/i);
  if (riskWarningMatch) {
    let warning = riskWarningMatch[1].trim();
    // Get only the first line or first bullet
    const firstLine = warning.split('\n')[0].trim();
    const bulletMatch = firstLine.match(/^[✓!→•\-\*\d\.\)]\s*(.+)$/);
    result.riskWarning = bulletMatch ? bulletMatch[1].trim() : firstLine;
  }

  // Extract Recommendation from Actionable Suggestions
  const recMatch = text.match(/Actionable Suggestions\s*[:\n\r]+([\s\S]*?)$/i) ||
                  text.match(/→\s*([^\n\r]+)/i);
  if (recMatch) {
    let rec = recMatch[1] || (recMatch[0] ? recMatch[0].replace(/^[→→\s]+/, '') : '');
    rec = rec.trim().split('\n')[0].trim();
    if (rec.length > 0) {
      result.recommendation = rec;
    }
  }

  console.log("Parsed AI data:", JSON.stringify(result, null, 2));

  // Clean up recommendation arrow if present
  if (result.recommendation) {
    result.recommendation = result.recommendation.replace(/^[→→\s]+/, '').trim();
  }

  return result;
}

export const aiReviewService = {

  async getFeed(userId: string, limit = 10, offset = 0, filter: any = {}) {
    const query = { userId, ...filter };
    return await AiReview.find(query)
      .populate("tradeId", "tradeDate pair result actualPnl emotionalState notes")
      .sort("-createdAt")
      .skip(offset)
      .limit(limit);
  },

  async generateReview(tradeId: string, userId: string) {
    console.log("generateReview called: tradeId=", tradeId, "userId=", userId);
    console.log("ANTHROPIC_AUTH_TOKEN present:", !!env.ANTHROPIC_AUTH_TOKEN);
    console.log("ANTHROPIC_BASE_URL:", env.ANTHROPIC_BASE_URL);
    console.log("ANTHROPIC_MODEL:", env.ANTHROPIC_MODEL);
    if (!env.ANTHROPIC_AUTH_TOKEN) throw new Error("Fitur AI dinonaktifkan: ANTHROPIC_AUTH_TOKEN tidak ditemukan");

    // Check for existing review
    console.log("Checking existing review...");
    let existing = await AiReview.findOne({ tradeId, userId });
    console.log("Existing review found:", !!existing);
    if (existing) return existing;

    // Fetch trade with playbook context
    console.log("Fetching trade...");
    const trade = await Trade.findOne({ _id: tradeId, userId }).populate("playbookId");
    console.log("Trade fetched:", trade ? trade.pair : "NOT FOUND");
    if (!trade) throw new Error("Data trade tidak ditemukan");

    // Fetch trading account for risk tier context
    const account = await TradingAccount.findOne({ userId, isActive: true });
    const riskTier = account?.riskTier || "MODERATE";
    const maxDailyTrades = account?.maxDailyTrades || 3;

    // Count trades on the same day as this trade for overtrade detection
    const tradeDate = trade.tradeDate;
    const dayStart = new Date(tradeDate);
    dayStart.setHours(0, 0, 0, 0);
    const nextDay = new Date(dayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const sameDayTradeCount = await Trade.countDocuments({
      userId,
      tradeDate: { $gte: dayStart, $lt: nextDay }
    });

    const playbook = trade.playbookId as any;

    // Initialize Anthropic (OpenRouter) with required headers
    const anthropic = new Anthropic({
      apiKey: env.ANTHROPIC_AUTH_TOKEN,
      baseURL: env.ANTHROPIC_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer': env.FRONTEND_URL || 'http://localhost:3000',
        'X-Title': 'Journal Trade AI Review'
      }
    });

    const model = env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
    console.log("Using Anthropic model:", model);

    const prompt = `
You are a professional trading coach AI. Analyze this trade and respond with ONLY structured report.

TRADE DATA:
Pair: ${trade.pair}
Direction: ${trade.direction}
Result: ${trade.result}
Pnl: ${trade.actualPnl}
Risk %: ${trade.riskPercent ? trade.riskPercent + '%' : 'N/A'}
R: ${trade.rMultiple || "N/A"}
Emotional State (1-5): ${trade.emotionalState || "N/A"}
${playbook ? `Strategy: ${playbook.name}, Category: ${playbook.category}` : ""}

RISK MANAGEMENT CONTEXT:
- Your configured Risk Tier: ${riskTier}
- Your personal Risk Limit (per trade): ${account?.defaultRiskPercent || 1}%
- Trades executed on same day: ${sameDayTradeCount}
- ${maxDailyTrades ? `Daily trade limit set: ${maxDailyTrades}` : 'No daily trade limit configured'}

EMOTIONAL STATE SCALE (reference):
1 = Very Poor (gambling, impulsive, violating SOP)
2 = Poor (fear, hesitation, FOMO)
3 = Average (neutral, fair execution)
4 = Good (disciplined, following plan)
5 = Excellent (emotionless, precise, type-A setup)

ANALYSIS FOCUS:
1. RISK COMPLIANCE: Compare risk % used vs your configured limit (${account?.defaultRiskPercent || 1}%). If exceeded, comment on why this might be problematic.
2. OVERTRADING: If today's trades >= ${maxDailyTrades || '3'} (or approaching limit), flag potential overtrade pattern.
3. R-MULTIPLE vs RISK: Did the R-target justify the risk taken?
4. DISCIPLINE: Based on emotional state and risk adherence.

REQUIRED FORMAT (exactly this structure):

AI Analysis Report
[2-3 sentence summary in Indonesian]

Overall Score: [1-10]
[Excellent|Good|Needs Work|Poor]

Strengths:
✓ [first strength]
✓ [second strength]
✓ [third strength]

Areas for Improvement:
! [first improvement]
! [second improvement]
! [third improvement]

Risk Warning:
! [if risk % exceeds tier recommendation OR overtrade pattern detected, state the issue clearly. If none, write "No risk protocol violations detected."]

Actionable Suggestions:
→ [single recommendation sentence]

CRITICAL RULES:
- Use ✓ for strengths, ! for improvements/warnings, → for recommendation
- Each bullet max 80 characters
- Language: Indonesian (professional)
- NO markdown, NO JSON, NO explanations
- Consider emotional state: 5 is EXCELLENT (not overconfident), 1 is VERY POOR
- Always include "Risk Warning:" section
`;

    try {
      const msg = await anthropic.messages.create({
        model: model,
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      });

      console.log("Full Anthropic response:", JSON.stringify(msg, null, 2));
      console.log("Content array length:", msg.content.length);
      console.log("Content types:", msg.content.map(c => c.type));

      // Extract text from response - handle different content block types
      const textBlock = msg.content.find(block => block.type === 'text');
      let text: string;

      if (!textBlock || !('text' in textBlock)) {
        // Try to extract text from any block that has text property
        const anyTextBlock = msg.content.find(block => 'text' in block);
        if (anyTextBlock) {
          text = anyTextBlock.text;
          console.log("Using text from non-text block type:", anyTextBlock.type);
        } else {
          throw new Error("Invalid response from Anthropic: no text content found in any block");
        }
      } else {
        text = textBlock.text;
      }

      console.log("Anthropic response text (length:", text.length, "):", text);

      let aiData: any = parseFormattedText(text);

      // Upsert: update if exists, create if not (handles duplicate key error)
      const review = await AiReview.findOneAndUpdate(
        { tradeId },
        {
          $set: {
            userId,
            score: aiData.score || 5,
            strengths: aiData.strengths || [],
            improvements: aiData.improvements || [],
            summary: aiData.summary || "Analisis selesai.",
            recommendation: aiData.recommendation || "Lanjutkan disiplin trading Anda.",
            riskWarning: aiData.riskWarning
          }
        },
        { upsert: true, returnDocument: 'after', runValidators: true }
      );

      // Create notification for AI review completion
      await Notification.create({
        userId,
        type: "AI_REVIEW_READY",
        title: "AI Review Ready",
        message: `Analysis for ${trade.pair} (${trade.direction}) is complete. Overall score: ${review.score}/10`,
        link: `/log-trade`,
        metadata: {
          tradeId: tradeId,
          score: review.score,
          pair: trade.pair
        }
      });

      // Create separate risk warning notification if exists
      if (aiData.riskWarning && aiData.riskWarning !== "No risk protocol violations detected.") {
        await Notification.create({
          userId,
          type: "RISK_WARNING",
          title: "Risk Protocol Alert",
          message: aiData.riskWarning,
          link: `/log-trade`,
          metadata: {
            tradeId,
            pair: trade.pair,
            riskPercent: trade.riskPercent
          }
        });
      }

      return review;
    } catch (error) {
      console.error("Anthropic API Error:", error);
      throw new Error("Gagal menghasilkan review AI. Silakan coba lagi nanti.");
    }
  },

  async deleteReview(id: string, userId: string) {
    const result = await AiReview.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  }
}