import "dotenv/config";
import dns from "dns";
dns.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"]);

import { connectDB } from "./src/db/mongoose";
import { initMt5NativeMcp } from "./src/mt5-streamer";
import { AITradeLog } from "./src/models/AITradeLog";
import { MT5Connection } from "./src/models/MT5Connection";

async function main() {
  await connectDB();
  await initMt5NativeMcp();
  
  const { mt5McpService } = await import("./src/services/mt5-mcp.service");
  
  // Wait for MT5 connection
  for (let i = 0; i < 20; i++) {
    if (mt5McpService.isConnected) break;
    await new Promise(r => setTimeout(r, 1000));
    process.stdout.write(".");
  }
  console.log("");
  
  if (!mt5McpService.isConnected) {
    console.log("MT5 not connected after 20s, aborting");
    process.exit(1);
  }
  
  const accountInfo = await mt5McpService.getAccountInfo();
  const accountId = accountInfo?.login?.toString();
  console.log(`Account: ${accountId}, Balance: ${accountInfo?.balance}`);
  
  const userId = "6a26146a9cad211ba0631027";
  
  // Find all trades with pnl=0
  const query: any = { userId, closed: true, pnl: 0 };
  if (accountId) query.accountId = accountId;
  const trades = await AITradeLog.find(query).lean();
  console.log(`Found ${trades.length} closed trades with pnl=0`);
  
  if (trades.length === 0) { process.exit(0); }
  
  // Fetch all deal history from MT5
  const deals = await mt5McpService.getHistory(0);
  console.log(`Fetched ${deals.length} deals from MT5`);
  
  let updated = 0;
  for (const t of trades) {
    const posId = String(t.mt5Ticket);
    const deal = deals.find((d: any) => String(d.position_id) === posId && d.entry === 1);
    if (deal) {
      const pnl = Math.round((deal.profit + deal.commission + deal.swap) * 100) / 100;
      const closeReason = (deal.comment || "").toLowerCase().includes("take profit") ? "TP_HIT"
        : (deal.comment || "").toLowerCase().includes("stop loss") ? "SL_HIT" : "MANUAL";
      await AITradeLog.updateOne(
        { _id: t._id },
        { $set: { pnl, closePrice: deal.price, closeReason, closedAt: new Date(deal.time * 1000) } }
      );
      updated++;
      console.log(`  #${posId} (${t.signal?.symbol}): pnl=$${pnl}`);
    } else {
      console.log(`  #${posId} (${t.signal?.symbol}): NO DEAL FOUND`);
    }
  }
  console.log(`\nUpdated ${updated}/${trades.length} trades`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
