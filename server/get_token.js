require('dotenv').config({ path: './.env' });
const dns = require('dns');
dns.setServers(["1.1.1.1", "8.8.8.8", "1.0.0.1", "8.8.4.4"]);
(async () => {
  const mongoose = require('mongoose');
  await mongoose.connect('mongodb+srv://virgoarya94_db_user:eFxSx5N81QMr6vMx@cluster0.7dzhhrn.mongodb.net/journal_trade_dev_local?retryWrites=true&w=majority&appName=Cluster0');
  const db = mongoose.connection.db;
  const userId = '6a26146a9cad211ba0631027';
  // Find or create session for user
  let sess = await db.collection('session').findOne({ userId });
  if (!sess) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('base64url');
    await db.collection('session').insertOne({
      id: crypto.randomBytes(16).toString('hex'),
      token,
      userId,
      expiresAt: new Date(Date.now() + 7*24*60*60*1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    sess = { token };
  }
  console.log(JSON.stringify({ cookieName: 'better-auth.session_token', cookieValue: sess.token }));
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
