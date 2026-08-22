require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"]);

(async () => {
  const { connectDB } = require('./src/db/mongoose');
  await connectDB();
  const { mt5McpService } = require('./src/services/mt5-mcp.service');
  const { AITradeLog } = require('./src/models/AITradeLog');
  const { MT5Connection } = require('./src/models/MT5Connection');

  const conns = await MT5Connection.find({ enabled: true }).lean();
  const userId = conns[0]?.userId;
  if (!userId) { console.log('No connection'); process.exit(0); }

  if (!mt5McpService.isConnected) {
    console.log('MT5 not connected — run sync via UI after connecting');
    process.exit(0);
  }

  const accountInfo = await mt5McpService.getAccountInfo();
  const accountId = accountInfo?.login?.toString();
  console.log(`Account: ${accountId}`);

  const query = { userId, closed: true, pnl: 0 };
  if (accountId) query.accountId = accountId;
  const trades = await AITradeLog.find(query).lean();
  console.log(`Found ${trades.length} closed trades with pnl=0`);

  if (trades.length === 0) process.exit(0);

  const deals = await mt5McpService.getHistory(0); // all history
  console.log(`Fetched ${deals.length} deals from MT5`);

  let updated = 0;
  for (const t of trades) {
    const posId = String(t.mt5Ticket);
    const deal = deals.find(d => String(d.position_id) === posId && d.entry === 1);
    if (deal) {
      const pnl = Math.round((deal.profit + deal.commission + deal.swap) * 100) / 100;
      await AITradeLog.updateOne(
        { _id: t._id },
        { $set: { pnl, closePrice: deal.price, closeReason: 'MANUAL', closedAt: new Date(deal.time * 1000) } }
      );
      updated++;
      console.log(`  Updated #${posId} (${t.signal?.symbol}): pnl=${pnl}`);
    } else {
      console.log(`  No deal found for #${posId} (${t.signal?.symbol})`);
    }
  }
  console.log(`Updated ${updated}/${trades.length} trades`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
