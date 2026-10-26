/**
 * atlas-schema.mjs — SATU sumber kebenaran untuk skema database produksi.
 *
 * Dipakai bersama oleh scripts/migrate-atlas.mjs (untuk membuat) dan
 * scripts/verify-atlas.mjs (untuk memverifikasi), supaya tidak pernah drift.
 *
 * Sumber spec:
 *   - server/src/models/*.ts (definisi index Mongoose)
 *   - dump authoritative cluster Atlas live (30 koleksi, 61 index)
 *
 * `_id_` dikecualikan — dibuat otomatis MongoDB.
 * `managedBy: "better-auth"` → index dikelola adapter better-auth sendiri.
 */

export const SPEC = {
  trades: [
    { name: "userId_1", key: { userId: 1 } },
    { name: "tradingAccountId_1", key: { tradingAccountId: 1 } },
    { name: "tradeDate_1", key: { tradeDate: 1 } },
    {
      name: "userId_1_tradingAccountId_1_isDeleted_1_tradeDate_-1",
      key: { userId: 1, tradingAccountId: 1, isDeleted: 1, tradeDate: -1 },
    },
  ],
  ai_trade_logs: [
    { name: "userId_1", key: { userId: 1 } },
    { name: "accountId_1", key: { accountId: 1 } },
    { name: "sessionId_1", key: { sessionId: 1 } },
    { name: "mt5Ticket_1", key: { mt5Ticket: 1 } },
    { name: "userId_1_createdAt_-1", key: { userId: 1, createdAt: -1 } },
    { name: "userId_1_accountId_1_closed_1", key: { userId: 1, accountId: 1, closed: 1 } },
  ],
  ai_trading_sessions: [{ name: "userId_1", key: { userId: 1 } }],
  ai_backtest_skills: [
    { name: "server_1", key: { server: 1 } },
    { name: "userId_1_server_1", key: { userId: 1, server: 1 }, unique: true },
  ],
  ai_reviews: [
    { name: "tradeId_1", key: { tradeId: 1 }, unique: true },
    { name: "userId_1", key: { userId: 1 } },
  ],
  backtest_experiences: [
    { name: "userId_1", key: { userId: 1 } },
    { name: "userId_1_createdAt_-1", key: { userId: 1, createdAt: -1 } },
    { name: "symbol_1_timeframe_1", key: { symbol: 1, timeframe: 1 } },
  ],
  chat_sessions: [
    { name: "userId_1", key: { userId: 1 } },
    { name: "agentType_1", key: { agentType: 1 } },
    { name: "userId_1_agentType_1_updatedAt_-1", key: { userId: 1, agentType: 1, updatedAt: -1 } },
  ],
  daily_snapshots: [
    { name: "userId_1", key: { userId: 1 } },
    { name: "tradingAccountId_1_snapshotDate_1", key: { tradingAccountId: 1, snapshotDate: 1 }, unique: true },
  ],
  geo_risk_snapshots: [{ name: "fetchedAt_-1", key: { fetchedAt: -1 } }],
  macro_indicators: [
    { name: "indicatorName_1_country_1", key: { indicatorName: 1, country: 1 }, unique: true },
    { name: "releaseDate_-1", key: { releaseDate: -1 } },
  ],
  mt5_connections: [{ name: "userId_1", key: { userId: 1 }, unique: true }],
  notifications: [
    { name: "userId_1", key: { userId: 1 } },
    { name: "userId_1_read_1_createdAt_-1", key: { userId: 1, read: 1, createdAt: -1 } },
  ],
  playbooks: [
    { name: "userId_1", key: { userId: 1 } },
    { name: "tradingAccountId_1", key: { tradingAccountId: 1 } },
  ],
  reflection_logs: [
    { name: "agentType_1_createdAt_-1", key: { agentType: 1, createdAt: -1 } },
    { name: "wasCorrected_1_createdAt_-1", key: { wasCorrected: 1, createdAt: -1 } },
  ],
  registrations: [
    { name: "user_id_1", key: { user_id: 1 }, unique: true },
    { name: "discord_id_1", key: { discord_id: 1 } },
  ],
  subscriptions: [{ name: "user_id_1", key: { user_id: 1 } }],
  token_balances: [{ name: "user_id_1", key: { user_id: 1 }, unique: true }],
  trade_emotions: [
    { name: "userId_1", key: { userId: 1 } },
    { name: "tradeId_1", key: { tradeId: 1 } },
    { name: "timestamp_1", key: { timestamp: 1 } },
    { name: "userId_1_timestamp_-1", key: { userId: 1, timestamp: -1 } },
    { name: "userId_1_emotionTag_1_timestamp_-1", key: { userId: 1, emotionTag: 1, timestamp: -1 } },
    { name: "userId_1_symbol_1_timestamp_-1", key: { userId: 1, symbol: 1, timestamp: -1 } },
    { name: "tradeId_1_userId_1", key: { tradeId: 1, userId: 1 }, unique: true },
  ],
  trading_accounts: [
    { name: "userId_1", key: { userId: 1 } },
    { name: "apiKey_1", key: { apiKey: 1 }, unique: true, sparse: true },
  ],
  transactions: [
    { name: "user_id_1", key: { user_id: 1 } },
    { name: "reference_id_1", key: { reference_id: 1 } },
    {
      name: "order_id_1",
      key: { order_id: 1 },
      unique: true,
      partialFilterExpression: { order_id: { $exists: true, $type: "string" } },
    },
  ],
  user_agent_memories: [{ name: "userId_1", key: { userId: 1 }, unique: true }],
  user_settings: [{ name: "userId_1", key: { userId: 1 }, unique: true }],
  vector_memories: [
    { name: "userId_1", key: { userId: 1 } },
    { name: "personaId_1", key: { personaId: 1 } },
    { name: "userId_1_personaId_1_createdAt_-1", key: { userId: 1, personaId: 1, createdAt: -1 } },
  ],
  yield_curve_snapshots: [{ name: "fetchedAt_-1", key: { fetchedAt: -1 } }],
  agentinsights: [
    { name: "personaId_1", key: { personaId: 1 } },
    { name: "insightType_1", key: { insightType: 1 } },
    { name: "personaId_1_insightType_1_createdAt_-1", key: { personaId: 1, insightType: 1, createdAt: -1 } },
    { name: "createdAt_-1", key: { createdAt: -1 }, expireAfterSeconds: 7 * 24 * 3600 },
    { name: "userId_1", key: { userId: 1 } },
    {
      name: "userId_1_personaId_1_insightType_1_createdAt_-1",
      key: { userId: 1, personaId: 1, insightType: 1, createdAt: -1 },
    },
  ],
  // better-auth: index dikelola adapter better-auth sendiri.
  user: { managedBy: "better-auth" },
  session: { managedBy: "better-auth" },
  account: { managedBy: "better-auth" },
  verification: { managedBy: "better-auth" },
};

/** Koleksi yang harus ada di database produksi. */
export const REQUIRED_COLLECTIONS = Object.keys(SPEC);

/**
 * Koleksi legacy yang TIDAK boleh dipakai lagi.
 * Ditemukan 26 Okt 2026 di cluster Atlas live: ada dua koleksi untuk konsep
 * yang sama — `tokenbalances` (legacy, 1 dokumen) dan `token_balances`
 * (dipakai model TokenBalance.ts). Jangan buat yang legacy di DB baru.
 */
export const LEGACY_COLLECTIONS = ["tokenbalances"];
