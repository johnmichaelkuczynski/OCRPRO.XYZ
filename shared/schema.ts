import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  googleId: text("google_id").unique(),
  email: text("email").unique(),
  displayName: text("display_name"),
});

export const visits = pgTable("visits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  email: text("email"),
  visitedAt: timestamp("visited_at").notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Visit = typeof visits.$inferSelect;
