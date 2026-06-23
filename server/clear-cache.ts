import mongoose from "mongoose";
import { env } from "./src/config/env";
import { YieldCurveSnapshot } from "./src/models/YieldCurveSnapshot";

async function clearCache() {
  try {
    const uri = env.DATABASE_URL;
    if (!uri) throw new Error("No DATABASE_URL provided in env");
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
    const res = await YieldCurveSnapshot.updateMany({}, { $set: { aiExplainer: null } });
    console.log("Cache cleared:", res.modifiedCount, "documents modified");
  } catch (err) {
    console.error("Error clearing cache:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

clearCache();
