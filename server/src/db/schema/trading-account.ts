import { pgTable, uuid, text, decimal, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const tradingAccount = pgTable("trading_account", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  
  // Account info
  accountName: text("account_name").notNull(),
  initialBalance: decimal("initial_balance", { precision: 15, scale: 2 }).notNull(),
  currentEquity: decimal("current_equity", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("USD"),
  broker: text("broker"),
  
  // Risk parameters
  maxDailyDrawdownPct: decimal("max_daily_drawdown_pct", { precision: 5, scale: 2 }).notNull().default("5.00"),
  maxTotalDrawdownPct: decimal("max_total_drawdown_pct", { precision: 5, scale: 2 }).notNull().default("10.00"),
  maxDailyTrades: integer("max_daily_trades"),
  
  // Tracking
  highWaterMark: decimal("high_water_mark", { precision: 15, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
});
