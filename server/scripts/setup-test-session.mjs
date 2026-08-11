import { MongoClient } from "mongodb";
import crypto from "crypto";

const DB_NAME = "journal_trade_dev_local";
const USER_ID = "test_user_integration";
const USER = "virgoarya94_db_user";
const PASS = encodeURIComponent("eFxSx5N81QMr6vMx");

async function tryUri(label, uri) {
  try {
    const c = new MongoClient(uri, { serverSelectionTimeoutMS: 20000, connectTimeoutMS: 15000 });
    await c.connect();
    const db = c.db(DB_NAME);
    const now = new Date();
    const existing = await db.collection("user").findOne({ id: USER_ID });
    if (!existing) {
      await db.collection("user").insertOne({
        id: USER_ID, name: "Integration Test",
        email: "integration.test@journaltrade.local", emailVerified: true,
        image: null, createdAt: now, updatedAt: now,
      });
    }
    await db.collection("session").deleteMany({ userId: USER_ID });
    const token = crypto.randomBytes(32).toString("base64url");
    await db.collection("session").insertOne({
      id: crypto.randomBytes(16).toString("hex"), token, userId: USER_ID,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: "::1", userAgent: "integration-test",
      createdAt: now, updatedAt: now,
    });
    console.log("OK " + label + " " + JSON.stringify({ cookieName: "better-auth.session_token", cookieValue: token }));
    await c.close();
    process.exit(0);
  } catch (e) {
    console.log("failed " + label + ": " + e.message.slice(0, 100));
  }
}

const base = `mongodb://${USER}:${PASS}@`;
const hosts = [
  "159.143.58.37:27017,159.143.58.49:27017,159.143.58.69:27017",
];
for (const h of hosts) {
  await tryUri("srv-ip", `${base}${h}/?replicaSet=atlas-xxxxxxxx&tls=true&authSource=admin&directConnection=false`);
  await tryUri("direct", `${base}159.143.58.37:27017/?tls=true&authSource=admin&directConnection=true`);
  await tryUri("direct-http", `${base}159.143.58.37:27017/?authSource=admin&directConnection=true`);
  await tryUri("repl", `${base}${h}/?replicaSet=atlas-7dzhhrn-shard-0&tls=true&authSource=admin`);
}
process.exit(1);