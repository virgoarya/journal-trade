const { connectDB } = require('./src/db/mongoose');
const { initMt5NativeMcp } = require('./src/mt5-streamer');
const { mt5McpService } = require('./src/services/mt5-mcp.service');

(async () => {
  await connectDB();
  await initMt5NativeMcp();
  
  // Wait for MT5 connection
  for (let i = 0; i < 15; i++) {
    if (mt5McpService.isConnected) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  if (!mt5McpService.isConnected) {
    console.log("MT5 not connected");
    process.exit(1);
  }
  
  const deals = await mt5McpService.getHistory(0); // all
  console.log(`Total deals in MT5: ${deals.length}`);
  
  // Check for specific position IDs
  const posIds = ['4939749938', '4939951770', '4934150430', '4934122277', '4927855489', '4927818983', '4927780042'];
  for (const id of posIds) {
    const deal = deals.find(d => String(d.position_id) === id && d.entry === 1);
    if (deal) {
      console.log(`FOUND: position_id=${id} | profit=${deal.profit} | commission=${deal.commission} | swap=${deal.swap} | time=${new Date(deal.time*1000).toLocaleString()}`);
    } else {
      console.log(`NOT FOUND: position_id=${id}`);
    }
  }
  
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
