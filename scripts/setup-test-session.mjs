// Setup test session untuk integration test (better-auth mongo adapter)
// Usage: node scripts/setup-test-session.mjs
import { MongoClient } from "mongodb";
import crypto from "crypto";

const MONGODB_URI = "mongodb+srv://virgoarya94_db_user:eFxSx5N81QMr6vMx@cluster0.7dzhhrn.mongodb.net/";
const DB_NAME = "journal_trade_dev_local";

const client = new MongoClient(MONGODB_URI);
await client.connect();
const db = client.db(DB_NAME);

const USER_ID = "test_user_integration";
const existing = await db.collection("user").findOne({ id: USER_ID });
const now = new Date();

if (!existing) {
  await db.collection("user").insertOne({
    id: USER_ID,
    name: "Integration Test",
    email: "integration.test@journaltrade.local",
    emailVerified: true,
    image: null,
    createdAt: now,
    updatedAt: now,
  });
}

// Hapus session lama
await db.collection("session").deleteMany({ userId: USER_ID });

const token = crypto.randomBytes(32).toString("base64url");
const session = {
  id: crypto.randomBytes(16).toString("hex"),
  token,
  userId: USER_ID,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  ipAddress: "::1",
  userAgent: "integration-test",
  createdAt: now,
  updatedAt: now,
};
await db.collection("session").insertOne(session);

console.log(JSON.stringify({ cookieName: "better-auth.session_token", cookieValue: token }));
await client.close();