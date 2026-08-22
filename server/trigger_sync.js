const { tradingPipelineService } = require('./src/services/trading-pipeline.service');
const userId = '6a26146a9cad211ba0631027'; // User ID dari monitoring report

(async () => {
  console.log(`Manual sync starting for ${userId}`);
  await tradingPipelineService.syncClosedPositions(userId);
  console.log('Sync finished');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
