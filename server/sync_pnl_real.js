// Load env & DB then call syncClosedPositions via actual service
require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"]);

(async () => {
  // Connect mongoose using the same connection as the real backend
  const { connectDB } = require('./src/db/mongoose');
  await connectDB();

  const { tradingPipelineService } = require('./src/services/trading-pipeline.service');
  const { MT5Connection } = require('./src/models/MT5Connection');

  const conns = await MT5Connection.find({ enabled: true }).lean();
  console.log(`Found ${conns.length} MT5 connections`);
  for (const conn of conns) {
    console.log(`Syncing closed positions for user ${conn.userId}...`);
    const result = await tradingPipelineService.syncClosedPositions(conn.userId);
    console.log(`Done: ${JSON.stringify(result)}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
