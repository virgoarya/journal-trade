import mongoose from "mongoose";
import { env } from "../config/env";
import { MongoClient } from "mongodb";

// Separate MongoClient for Better Auth (not shared with Mongoose)
export const authMongoClient = new MongoClient(env.DATABASE_URL, {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
});

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

async function connectWithRetry(attempt = 1): Promise<void> {
  try {
    await authMongoClient.connect();
    console.log("🚀 Auth MongoDB Client Connected.");
    await authMongoClient.db(env.DATABASE_NAME).command({ ping: 1 });
    console.log(`✅ Auth MongoDB ping successful (${env.DATABASE_NAME})`);
  } catch (err: any) {
    if (err.message?.includes("already connected")) return;

    if (attempt < MAX_RETRIES) {
      console.warn(
        `⚠️ MongoDB attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}`
      );
      console.warn(`   Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return connectWithRetry(attempt + 1);
    }
    throw err;
  }
}

// Mongoose for application logic
export const connectDB = async () => {
  try {
    // 1. Connect Auth MongoClient with retry
    await connectWithRetry();

    // 2. Connect Mongoose
    if (mongoose.connection.readyState < 1) {
      await mongoose.connect(env.DATABASE_URL, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log("🚀 Mongoose Connected.");
    }

    // 3. Drop legacy single-field index that conflicts with per-broker compound index
    try {
      const db = mongoose.connection.db;
      if (db) {
        const indexes = await db.collection("ai_backtest_skills").indexes();
        const legacyIdx = indexes.find((i: any) => i.name === "userId_1");
        if (legacyIdx) {
          await db.collection("ai_backtest_skills").dropIndex("userId_1");
          console.log("✅ Dropped legacy userId_1 index on ai_backtest_skills");
        }
      }
    } catch (idxErr: any) {
      console.warn(`⚠️ Index cleanup skipped: ${idxErr.message}`);
    }
  } catch (error) {
    console.error("🔥 Error connecting to MongoDB:", error);
    process.exit(1);
  }
};
