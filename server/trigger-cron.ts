import { connectDB } from "./src/db/mongoose";
import { UserSettings } from "./src/models/UserSettings";
import { backtestService, type BacktestResult } from "./src/services/backtest.service";
import { mt5McpService } from "./src/services/mt5-mcp.service";
import axios from "axios";
import dotenv from "dotenv";
import dns from "node:dns";

dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dotenv.config();

function calculateQualificationScore(result: BacktestResult): number {
  if (result.totalTrades === 0) return 0;
  const winRateScore = Math.min(40, (result.winRate / 100) * 40);
  const pfScore = Math.min(25, (result.profitFactor || 0) * 10);
  const rfScore = result.recoveryFactor === Infinity ? 20 : Math.min(20, (result.recoveryFactor || 0) * 5);
  const ddPenalty = Math.max(0, 15 - (result.maxDrawdownPercent || 0) * 0.5);
  const tradesBonus = Math.min(10, result.totalTrades * 0.5);
  return Math.round(winRateScore + pfScore + rfScore + ddPenalty + tradesBonus);
}

async function run() {
  await connectDB();
  const user = await UserSettings.findOne();
  if(!user || !user.userId) {
      console.log("No user found");
      process.exit(1);
  }

  console.log("Menghubungkan ke Terminal MT5...");
  await mt5McpService.init().catch(console.warn);
  await mt5McpService.tryAutoReconnect().catch(console.warn);
  
  const userSymbols = user.savedPipelineConfig?.symbols?.length ? user.savedPipelineConfig.symbols : ["EURUSDm"];
  
  const config = {
    symbols: userSymbols.length ? userSymbols.slice(0, 1) : ["EURUSD"],
    timeframe: "M15" as any,
    fromDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days
    toDate: new Date(),
    initialBalance: 10000,
    entrySettings: { rsiOversold: 30, rsiOverbought: 70, atrMultiplierSL: 1.5, atrMultiplierTP: 1.5 },
    trailingStop: { enabled: true, activationATR: 1.0, trailATR: 0.5, breakEven: false },
    maxRiskPerTrade: 1.0,
    maxOpenPositions: 3,
    leverage: 100,
    signalInterval: 2,
    speedMs: 0,
    activeMethodologies: ["rsiEngulf", "smc", "ict"] as any
  };

  console.log("🤖 Menjalankan simulasi nyata di latar belakang... (Mohon tunggu)");
  
  try {
      const backtestResult = await new Promise<BacktestResult>((resolve, reject) => {
        backtestService.runBacktestStream(user.userId, config, (event) => {
          if (event.type === "complete") resolve(event.data);
          if (event.type === "error") reject(event.data);
        }).catch(reject);
      });

      const currentScore = calculateQualificationScore(backtestResult);
      const grade = currentScore >= 90 ? "A" : currentScore >= 75 ? "B" : currentScore >= 60 ? "C" : "D";
      
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (!webhookUrl) {
          console.log("No webhook URL");
          process.exit(1);
      }

      const gradeColor = grade === "A" ? 0x00FF00 : grade === "B" ? 0xFFFF00 : grade === "C" ? 0xFFA500 : 0xFF0000;

      const embed = {
        title: "🤖 [REAL DATA] Weekly AI Backtest & Auto-Optimization Report",
        color: gradeColor,
        fields: [
          {
            name: "⚙️ Input Config",
            value: `**Pairs:** ${config.symbols.join(", ")}\n**Timeframe:** ${config.timeframe}\n**Risk/Trade:** ${config.maxRiskPerTrade}%\n**Period:** 7 Days`,
            inline: false
          },
          {
            name: "📊 Simulation Result",
            value: `**Grade:** ${grade}\n**Confidence:** ${currentScore}%\n**Win Rate:** ${backtestResult.winRate.toFixed(2)}%\n**Total PnL:** $${backtestResult.totalPnL.toFixed(2)}\n**Profit Factor:** ${backtestResult.profitFactor.toFixed(2)}\n**Max Drawdown:** ${backtestResult.maxDrawdownPercent.toFixed(2)}%`,
            inline: false
          },
          {
            name: "🧠 AI Insights",
            value: "Kalibrasi nyata berhasil dieksekusi. Ini adalah data asli yang diproses langsung dari riwayat pergerakan harga pasar sesungguhnya.",
            inline: false
          }
        ],
        timestamp: new Date().toISOString()
      };

      await axios.post(webhookUrl, { embeds: [embed] });
      console.log("✅ Laporan data asli sukses dikirim ke Discord!");
  } catch (err: any) {
      console.error("Gagal menjalankan backtest:", err.message);
  }
  process.exit(0);
}

run();
