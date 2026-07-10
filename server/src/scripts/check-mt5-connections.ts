import { MT5Connection } from "../models/MT5Connection";
import { connectDB } from "../db/mongoose";

async function checkMT5Connections() {
  try {
    await connectDB();
    console.log("Connected to MongoDB");

    const connections = await MT5Connection.find({ enabled: true });
    console.log(`Found ${connections.length} enabled MT5 connections`);

    for (const conn of connections) {
      console.log(`\nConnection for user ${conn.userId}:`);
      console.log(`Server: ${conn.server}`);
      console.log(`Login: ${conn.login}`);
      console.log(`Password: ${conn.getPassword()}`);
      console.log(`Enabled: ${conn.enabled}`);
    }
  } catch (error) {
    console.error("Error checking MT5 connections:", error);
  } finally {
    process.exit(0);
  }
}

checkMT5Connections();