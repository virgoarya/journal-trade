const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"]);

(async () => {
  await mongoose.connect('mongodb+srv://virgoarya94_db_user:eFxSx5N81QMr6vMx@cluster0.7dzhhrn.mongodb.net/journal_trade_dev?retryWrites=true&w=majority&appName=Cluster0');
  const db = mongoose.connection.db;
  const col = db.collection('ai_trade_logs');
  const total = await col.countDocuments({});
  const closed = await col.countDocuments({ closed: true });
  const open = await col.countDocuments({ closed: false });
  const withPnl = await col.countDocuments({ pnl: { $exists: true } });
  console.log(JSON.stringify({ total, closed, open, withPnl }, null, 2));
  const sample = await col.find({}).sort({ createdAt: -1 }).limit(10).toArray();
  console.log(JSON.stringify(sample.map(s => ({
    symbol: s.signal?.symbol,
    closed: s.closed,
    pnl: s.pnl,
    accountId: s.accountId,
    mt5Ticket: s.mt5Ticket,
    createdAt: s.createdAt
  })), null, 2));
  await mongoose.disconnect();
})().catch(e => {
  console.error(e);
  process.exit(1);
});
