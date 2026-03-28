import { pgTable, uuid, text, decimal, jsonb, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { trade } from "./trade";

export const aiReview = pgTable("ai_review", {
  id: uuid("id").primaryKey().defaultRandom(),
  tradeId: uuid("trade_id").notNull().unique().references(() => trade.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  
  score: decimal("score", { precision: 4, scale: 1 }).notNull(),
  strengths: jsonb("strengths").$type<string[]>().notNull(),
  improvements: jsonb("improvements").$type<string[]>().notNull(),
  summary: text("summary"),
  recommendation: text("recommendation"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
