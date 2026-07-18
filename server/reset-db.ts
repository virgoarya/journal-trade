import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function reset() {
  try {
    await mongoose.connect(process.env.DATABASE_URL!);
    console.log("Connected to DB. Dropping collections...");
    
    try { await mongoose.connection.db?.dropCollection("playbooks"); console.log("Dropped playbooks"); } catch (e) { console.log("playbooks not found or error"); }
    try { await mongoose.connection.db?.dropCollection("backtest_experiences"); console.log("Dropped backtest_experiences"); } catch (e) { console.log("backtest_experiences not found or error"); }
    try { await mongoose.connection.db?.dropCollection("ai_backtest_skills"); console.log("Dropped ai_backtest_skills"); } catch (e) { console.log("ai_backtest_skills not found or error"); }
    
    console.log("Reset complete.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

reset();
