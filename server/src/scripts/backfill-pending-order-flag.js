require("dotenv").config();
const mongoose = require("mongoose");
(async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  const col = mongoose.connection.db.collection("ai_trade_logs");
  const r = await col.updateMany(
    { closed: true, closeReason: { $in: ["TIMEOUT", "TP_ALREADY_HIT"] } },
    { $set: { isPendingOrder: true } }
  );
  console.log("flagged pending-cancelled:", r.modifiedCount);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
