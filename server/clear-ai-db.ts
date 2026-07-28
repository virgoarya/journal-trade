import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL!;

async function clear() {
  try {
    await mongoose.connect(url);
    const db = mongoose.connection;
    
    console.log("Connected. Clearing AI Backtest Skills...");
    const res1 = await db.collection("ai_backtest_skills").deleteMany({});
    console.log(`Deleted ${res1.deletedCount} ai_backtest_skills.`);

    console.log("Clearing AI Reviews...");
    const res2 = await db.collection("ai_reviews").deleteMany({});
    console.log(`Deleted ${res2.deletedCount} ai_reviews.`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

clear();
