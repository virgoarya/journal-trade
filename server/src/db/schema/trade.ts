import { pgTable, uuid, text, decimal, integer, timestamp, index } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { tradingAccount } from "./trading-account";
import { playbook } from "./playbook";

export const trade = pgTable("trade", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  tradingAccountId: uuid("trading_account_id").notNull().references(() => tradingAccount.id, { onDelete: "cascade" }),
  playbookId: uuid("playbook_id").references(() => playbook.id, { onDelete: "set null" }),
  
  // Trade meta
  tradeDate: timestamp("trade_date").notNull(),
  pair: text("pair").notNull(),
  direction: text("direction").notNull(),
  
  // Financials
  entryPrice: decimal("entry_price", { precision: 15, scale: 5 }).notNull(),
  stopLoss: decimal("stop_loss", { precision: 15, scale: 5 }).notNull(),
  takeProfit: decimal("take_profit", { precision: 15, scale: 5 }),
  lotSize: decimal("lot_size", { precision: 10, scale: 2 }).notNull(),
  actualPnl: decimal("actual_pnl", { precision: 15, scale: 2 }).notNull(),
  
  // Metrics
  rMultiple: decimal("r_multiple", { precision: 8, scale: 2 }),
  result: text("result").notNull(),
  
  // Psychology
  emotionalState: integer("emotional_state"),
  notes: text("notes"),
  chartLink: text("chart_link"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
}, (table) => ({
  userIdIdx: index("trade_user_id_idx").on(table.userId),
  tradeDateIdx: index("trade_date_idx").on(table.tradeDate),
  pairIdx: index("trade_pair_idx").on(table.pair),
  playbookIdx: index("trade_playbook_idx").on(table.playbookId),
  accountDateIdx: index("trade_account_date_idx").on(table.tradingAccountId, table.tradeDate),
}));
