const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"]);

const MONGODB_URI = 'mongodb+srv://virgoarya94_db_user:eFxSx5N81QMr6vMx@cluster0.7dzhhrn.mongodb.net/journal_trade_dev?retryWrites=true&w=majority&appName=Cluster0';

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const col = db.collection('ai_trade_logs');
  
  // Find all closed trades with pnl=0
  const trades = await col.find({ closed: true, pnl: 0 }).toArray();
  console.log(`Found ${trades.length} closed trades with pnl=0`);
  
  if (trades.length === 0) {
    console.log("No trades need update");
    await mongoose.disconnect();
    return;
  }
  
  // We can't fetch MT5 history here, so just log them
  for (const t of trades) {
    console.log(`Trade: ${t.signal?.symbol}, ticket: ${t.mt5Ticket}, entry: ${t.executionPrice || t.signal?.entry}, closedAt: ${t.closedAt}`);
  }
  
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
