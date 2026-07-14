import cron from "node-cron";
import axios from "axios";
import { backtestService, type BacktestResult } from "../services/backtest.service";
import { AIBacktestSkill } from "../models/AIBacktestSkill";
import { UserSettings } from "../models/UserSettings";
import { tradingPipelineService } from "../services/trading-pipeline.service";

function calculateQualificationScore(result: BacktestResult): number {
  if (result.totalTrades === 0) return 0;
  const winRateScore = Math.min(40, (result.winRate / 100) * 40);
  const pfScore = Math.min(25, (result.profitFactor || 0) * 10);
  const rfScore = result.recoveryFactor === Infinity ? 20 : Math.min(20, (result.recoveryFactor || 0) * 5);
  const ddPenalty = Math.max(0, 15 - (result.maxDrawdownPercent || 0) * 0.5);
  const tradesBonus = Math.min(10, result.totalTrades * 0.5);
  return Math.round(winRateScore + pfScore + rfScore + ddPenalty + tradesBonus);
}

// Define the shape of the config needed by runBacktestStream
const TIMEFRAMES = ["M15", "H1", "M5"];
const ACTIVE_METHODOLOGIES = ["smc", "ict", "msnr", "lit", "rsiEngulf"];

async function runOptimizationForUser(userId: string, symbols: string[]) {
  let bestSkill: any = null;
  let bestScore = -1;
  let bestConfig: any = null;

  // Max 5 iterations to find a Grade B or > 90% confidence
  for (let iteration = 0; iteration < 5; iteration++) {
    console.log(`[CRON] Auto-Backtest Iteration ${iteration + 1} for user ${userId}`);
    
    // Tweak config based on iteration
    const tf = TIMEFRAMES[iteration % TIMEFRAMES.length];
    const risk = iteration > 2 ? 0.5 : 1.0; // tighter risk later
    
    const config = {
      symbols: symbols.length ? symbols.slice(0, 1) : ["EURUSD"],
      timeframe: tf as any,
      fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days for Trial MT5 stability
      toDate: new Date(),
      initialBalance: 10000,
      entrySettings: {
        rsiOversold: 30,
        rsiOverbought: 70,
        atrMultiplierSL: 1.5,
        atrMultiplierTP: 1.5,
      },
      trailingStop: {
        enabled: true,
        activationATR: 1.0,
        trailATR: 0.5,
        breakEven: false,
      },
      maxRiskPerTrade: risk,
      maxOpenPositions: 3,
      leverage: 100,
      signalInterval: 2,
      speedMs: 0, // fast mode
      activeMethodologies: ACTIVE_METHODOLOGIES as any,
    };

    try {
      const backtestResult = await new Promise<BacktestResult>((resolve, reject) => {
        backtestService.runBacktestStream(userId, config, (event) => {
          if (event.type === "complete") {
            resolve(event.data);
          }
          if (event.type === "error") {
            reject(event.data);
          }
        }).catch(reject);
      });

      if (backtestResult) {
        const currentScore = calculateQualificationScore(backtestResult);
        const grade = currentScore >= 90 ? "A" : currentScore >= 75 ? "B" : currentScore >= 60 ? "C" : "D";

        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestSkill = { simulationResult: { ...backtestResult, grade, confidenceScore: currentScore, insights: ["AI determined best parameters for current market regime."] } };
          bestConfig = config;
        }

        if (["A", "B"].includes(grade) || currentScore >= 90) {
          console.log(`[CRON] Target reached at iteration ${iteration + 1}: Grade ${grade}, Confidence ${currentScore}%`);
          break; // Stop optimization loop
        }
      }
    } catch (error) {
      console.error(`[CRON] Error during backtest iteration ${iteration + 1}:`, error);
    }
  }

  return { bestSkill, bestConfig };
}

async function sendToDiscordWebhook(skill: any, config: any) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const result = skill.simulationResult;
  const gradeColor = result.grade === "A" ? 0x00FF00 : result.grade === "B" ? 0xFFFF00 : result.grade === "C" ? 0xFFA500 : 0xFF0000;

  const embed = {
    title: "🤖 Weekly AI Backtest & Auto-Optimization Report",
    color: gradeColor,
    fields: [
      {
        name: "⚙️ Input Config",
        value: `**Pairs:** ${config.symbols.join(", ")}\n**Timeframe:** ${config.timeframe}\n**Risk/Trade:** ${config.maxRiskPerTrade}%\n**Period:** 7 Days`,
        inline: false
      },
      {
        name: "📊 Simulation Result",
        value: `**Grade:** ${result.grade}\n**Confidence:** ${result.confidenceScore}%\n**Win Rate:** ${result.winRate}%\n**Total PnL:** $${result.totalPnL.toFixed(2)}\n**Profit Factor:** ${result.profitFactor}\n**Max Drawdown:** ${result.maxDrawdown}%`,
        inline: false
      },
      {
        name: "🧠 AI Insights (Applied to Live)",
        value: result.insights?.slice(0, 3).map((i: any) => `- ${i}`).join("\n") || "No insights",
        inline: false
      }
    ],
    timestamp: new Date().toISOString()
  };

  try {
    await axios.post(webhookUrl, { embeds: [embed] });
  } catch (error) {
    console.error("[CRON] Failed to send Discord webhook", error);
  }
}

export function initAutoBacktestCron() {
  console.log("⏰ Weekly Auto-Backtest Cron initialized (running every Sunday 00:00).");
  
  // Runs every Sunday at midnight
  cron.schedule("0 0 * * 0", async () => {
    console.log("[CRON] Triggering weekly Auto-Backtest & Optimization...");
    
    try {
      const users = await UserSettings.find({});
      for (const userSettings of users) {
        if (!userSettings.userId) continue;

        console.log(`[CRON] Starting Auto-Backtest for user: ${userSettings.userId}`);
        
        // Use user's symbols or fallback
        const userSymbols = userSettings.savedPipelineConfig?.symbols || ["EURUSD"];
        const { bestSkill, bestConfig } = await runOptimizationForUser(userSettings.userId, userSymbols);
        
        if (bestSkill) {
          // Fetch the saved skill from DB to get the methodology & symbol rankings for the Live Pipeline
          const skillDoc = await AIBacktestSkill.findOne({ userId: userSettings.userId });
          
          // Save the config to apply to Live Pipeline
          userSettings.savedPipelineConfig = {
            ...bestConfig,
            activeMethodologies: (skillDoc?.methodologyRankings || [])
              .filter((m: any) => m.verdict !== "DISABLE")
              .map((m: any) => m.methodology),
            symbols: (skillDoc?.symbolRankings || [])
              .slice(0, 5)
              .map((s: any) => s.symbol),
            llmConsensus: { enabled: true, minProviders: 2, threshold: 0.7, providerTimeoutMs: 15000 }
          };
          userSettings.lastAutoBacktestAt = new Date();
          await userSettings.save();

          // Send Webhook
          await sendToDiscordWebhook(bestSkill, bestConfig);

          // Check if pipeline is currently active. If so, restart it to apply new settings.
          const currentStatus = await tradingPipelineService.getPipelineStatus(userSettings.userId);
          if (currentStatus.state === "RUNNING") {
            console.log(`[CRON] Restarting Live Pipeline for user ${userSettings.userId} to apply new config...`);
            await tradingPipelineService.stopPipeline(userSettings.userId);
            // Wait a brief moment to ensure ports/processes are freed
            await new Promise(res => setTimeout(res, 2000));
            await tradingPipelineService.startPipeline(userSettings.userId, userSettings.savedPipelineConfig);
          }
        }
      }
      console.log("[CRON] Auto-Backtest complete for all users.");
    } catch (error) {
      console.error("[CRON] Critical error in Auto-Backtest job:", error);
    }
  });
}
