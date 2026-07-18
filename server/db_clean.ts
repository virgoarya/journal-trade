import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";

// Force use Google DNS to resolve MongoDB Atlas SRV records (fix for Windows ECONNREFUSED)
dns.setServers(["8.8.8.8", "8.8.4.4"]);

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL!;
const DATABASE_NAME = process.env.DATABASE_NAME || "journal_trade_dev_local";

async function clean() {
  if (!DATABASE_URL) {
    console.error("DATABASE_URL is not defined in .env");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(DATABASE_URL, {
      dbName: DATABASE_NAME,
      serverSelectionTimeoutMS: 15000,
    });
    console.log("Connected to MongoDB:", DATABASE_NAME);

    const db = mongoose.connection;

    // 1. Update UserSettings
    console.log("\n[1/3] Cleaning user_settings...");
    const userSettingsRes = await db.collection("user_settings").updateMany(
      {},
      {
        $unset: {
          "aiTrading.methodologyWeights.quarterly": "",
          "aiTrading.methodologyWeights.lit": "",
          "aiTrading.methodologyWeights.rsiEngulf": "",
        },
        $pull: {
          "aiTrading.activeMethodologies": { $in: ["quarterly", "lit", "rsiEngulf"] },
        } as any,
      }
    );
    console.log(`   ✓ Updated ${userSettingsRes.modifiedCount} user_settings documents.`);

    // 2. Update AITradingSession
    console.log("\n[2/3] Cleaning ai_trading_sessions...");
    const sessionsRes = await db.collection("ai_trading_sessions").updateMany(
      {},
      {
        $unset: {
          "pipelineConfig.methodologyWeights.quarterly": "",
          "pipelineConfig.methodologyWeights.lit": "",
          "pipelineConfig.methodologyWeights.rsiEngulf": "",
        },
        $pull: {
          "pipelineConfig.activeMethodologies": { $in: ["quarterly", "lit", "rsiEngulf"] },
        } as any,
      }
    );
    console.log(`   ✓ Updated ${sessionsRes.modifiedCount} ai_trading_sessions documents.`);

    // 3. Update AIBacktestSkill (methodology rankings)
    console.log("\n[3/3] Cleaning ai_backtest_skills...");
    const skillsRes = await db.collection("ai_backtest_skills").updateMany(
      {},
      {
        $pull: {
          methodologyRankings: { methodology: { $in: ["quarterly", "lit", "rsiEngulf"] } },
        } as any,
      }
    );
    console.log(`   ✓ Updated ${skillsRes.modifiedCount} ai_backtest_skills documents.`);

    console.log("\n✅ Database cleanup selesai! Methodology quarterly, lit, dan rsiEngulf sudah dihapus.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during database cleanup:", error);
    process.exit(1);
  }
}

clean();
