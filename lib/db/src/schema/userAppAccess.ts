import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const userAppAccessTable = pgTable("user_app_access", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull(),
  appKey:    text("app_key").notNull(),
  grantedBy: integer("granted_by"),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  isActive:  boolean("is_active").default(true).notNull(),
});

export type UserAppAccess = typeof userAppAccessTable.$inferSelect;
