import mongoose from "mongoose";
import { AiReview } from "./src/models/AiReview.js";
import { env } from "./src/config/env.js";

async function clearAllAiReviews() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(env.DATABASE_URL);

    console.log("Deleting all AI reviews...");
    const result = await AiReview.deleteMany({});

    console.log(`✅ Successfully deleted ${result.deletedCount} AI reviews`);
    console.log("All AI reviews have been cleared.");

    await mongoose.disconnect();
    console.log("Disconnected from database");
  } catch (error) {
    console.error("❌ Error clearing AI reviews:", error);
    process.exit(1);
  }
}

clearAllAiReviews();
