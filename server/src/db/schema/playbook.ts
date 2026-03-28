import { pgTable, uuid, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const playbook = pgTable("playbook", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  
  name: text("name").notNull(),
  description: text("description"),
  applicablePairs: text("applicable_pairs").array(),
  session: text("session"),
  tags: text("tags").array(),
  isArchived: boolean("is_archived").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const playbookRule = pgTable("playbook_rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  playbookId: uuid("playbook_id").notNull().references(() => playbook.id, { onDelete: "cascade" }),
  
  ruleText: text("rule_text").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
