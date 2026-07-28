import mongoose from "mongoose";
import { env } from "./src/config/env.js";
import { AIBacktestSkill } from "./src/models/AIBacktestSkill.js";
import { AiReview } from "./src/models/AiReview.js";

async function clear() {
  try {
    await mongoose.connect(env.DATABASE_URL);
    const result = await AIBacktestSkill.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} AI Backtest Skills.`);
    const result2 = await AiReview.deleteMany({});
    console.log(`✅ Deleted ${result2.deletedCount} AI Reviews.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

clear();
