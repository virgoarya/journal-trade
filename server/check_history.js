const dns = require('dns');
dns.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"]);
require('dotenv').config({ path: './.env' });

(async () => {
  const { connectDB } = require('./src/db/mongoose');
  await connectDB();
  const { mt5McpService } = require('./src/services/mt5-mcp.service');
  const { AITradeLog } = require('./src/models/AITradeLog');
  
  await require('./src/mt5-streamer').initMt5NativeMcp();
  
  for (let i = 0; i < 15; i++) {
    if (mt5McpService.isConnected) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  if (!mt5McpService.isConnected) {
    console.log("MT5 not connected");
    process.exit(1);
  }
  
  // Ambil history deals terbaru
  const deals = await mt5McpService.getHistory(0);
  console.log(`Deals count: ${deals.length}`);
  
  // Print beberapa deal terakhir
  if (deals.length > 0) {
    console.log("Sample deals (OUT):");
    const outDeals = deals.filter(d => d.entry === 1).slice(-5);
    for (const d of outDeals) {
      console.log(`  pos_id=${d.position_id}, symbol=${d.symbol}, profit=${d.profit}, comm=${d.commission}, time=${new Date(d.time*1000).toISOString()}`);
    }
  }
  
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
