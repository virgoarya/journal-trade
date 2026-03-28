import { pgTable, uuid, text, decimal, integer, date, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tradingAccount } from "./trading-account";

export const dailySnapshot = pgTable("daily_snapshot", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradingAccountId: uuid("trading_account_id").notNull().references(() => tradingAccount.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  
  snapshotDate: date("snapshot_date").notNull(),
  openingEquity: decimal("opening_equity", { precision: 15, scale: 2 }).notNull(),
  closingEquity: decimal("closing_equity", { precision: 15, scale: 2 }).notNull(),
  dailyPnl: decimal("daily_pnl", { precision: 15, scale: 2 }).notNull(),
  dailyDrawdownPct: decimal("daily_drawdown_pct", { precision: 5, scale: 2 }).notNull(),
  totalDrawdownPct: decimal("total_drawdown_pct", { precision: 5, scale: 2 }).notNull(),
  tradeCount: integer("trade_count").notNull().default(0),
  winCount: integer("win_count").notNull().default(0),
  lossCount: integer("loss_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueAccountDate: unique().on(table.tradingAccountId, table.snapshotDate),
}));
