import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userSubscriptionsTable = pgTable("user_subscriptions", {
  id:                     serial("id").primaryKey(),
  userId:                 integer("user_id").notNull(),
  stripeCustomerId:       text("stripe_customer_id"),
  stripeSubscriptionId:   text("stripe_subscription_id"),
  stripeSessionId:        text("stripe_session_id"),
  planKey:                text("plan_key"),
  productId:              text("product_id"),
  priceId:                text("price_id"),
  status:                 text("status").notNull().default("pending"),
  billingPeriod:          text("billing_period"),
  amountCents:            integer("amount_cents"),
  currency:               text("currency").default("usd"),
  cancelAtPeriodEnd:      boolean("cancel_at_period_end").default(false),
  currentPeriodStart:     timestamp("current_period_start"),
  currentPeriodEnd:       timestamp("current_period_end"),
  cancelledAt:            timestamp("cancelled_at"),
  paymentMethodBrand:     text("payment_method_brand"),
  paymentMethodLast4:     text("payment_method_last4"),
  receiptUrl:             text("receipt_url"),
  createdAt:              timestamp("created_at").defaultNow().notNull(),
  updatedAt:              timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserSubscription = z.infer<typeof insertUserSubscriptionSchema>;
export type UserSubscription = typeof userSubscriptionsTable.$inferSelect;
