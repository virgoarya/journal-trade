require("dotenv").config();
const mongoose = require("mongoose");
(async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  const col = mongoose.connection.db.collection("backtest_experiences");
  const r = await col.updateMany(
    { updatedAt: { $exists: false } },
    [{ $set: { updatedAt: "$createdAt" } }]
  );
  console.log("updated:", r.modifiedCount);
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
