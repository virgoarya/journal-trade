import mongoose from "mongoose";
import { env } from "../config/env";
import { MongoClient } from "mongodb";

// Native MongoClient specifically for Better Auth adapter
export const mongoClient = new MongoClient(env.DATABASE_URL);

// Mongoose for our application logic
export const connectDB = async () => {
  try {
    if (mongoose.connection.readyState >= 1) {
      return;
    }
    
    // Connect Mongoose
    await mongoose.connect(env.DATABASE_URL, {
      serverSelectionTimeoutMS: 10000, // 10 detik timeout
    });
    console.log("🚀 Mongoose Connected.");
    
    // Connect Native Client for Auth
    await mongoClient.connect();
    console.log("🚀 MongoDB Native Client Connected for Better Auth.");

  } catch (error) {
    console.error("🔥 Error connecting to MongoDB:", error);
    process.exit(1);
  }
};
