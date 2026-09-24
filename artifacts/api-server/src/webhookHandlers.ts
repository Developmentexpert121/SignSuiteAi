import { getStripeSync } from './stripeClient';
import { pool } from '@workspace/db';
import { logger } from './lib/logger';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function upsertSubscription(params: {
  userId: number;
  customerId: string | null;
  subscriptionId: string | null;
  sessionId?: string | null;
  status: string;
  planKey?: string | null;
  priceId?: string | null;
  productId?: string | null;
  billingPeriod?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  periodStart?: number | null;
  periodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: number | null;
}) {
  const existing = await pool.query(
    `SELECT id FROM user_subscriptions
     WHERE user_id = $1
       AND (stripe_subscription_id = $2 OR stripe_session_id = $3)
     LIMIT 1`,
    [params.userId, params.subscriptionId, params.sessionId ?? null]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE user_subscriptions SET
         stripe_customer_id      = COALESCE($1, stripe_customer_id),
         stripe_subscription_id  = COALESCE($2, stripe_subscription_id),
         status                  = $3,
         plan_key                = COALESCE($4, plan_key),
         price_id                = COALESCE($5, price_id),
         product_id              = COALESCE($6, product_id),
         billing_period          = COALESCE($7, billing_period),
         amount_cents            = COALESCE($8, amount_cents),
         currency                = COALESCE($9, currency),
         current_period_start    = COALESCE(to_timestamp($10), current_period_start),
         current_period_end      = COALESCE(to_timestamp($11), current_period_end),
         cancel_at_period_end    = $12,
         cancelled_at            = to_timestamp($13),
         updated_at              = NOW()
       WHERE id = $14`,
      [
        params.customerId,
        params.subscriptionId,
        params.status,
        params.planKey ?? null,
        params.priceId ?? null,
        params.productId ?? null,
        params.billingPeriod ?? null,
        params.amountCents ?? null,
        params.currency ?? null,
        params.periodStart ?? null,
        params.periodEnd ?? null,
        params.cancelAtPeriodEnd ?? false,
        params.cancelledAt ?? null,
        existing.rows[0].id,
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO user_subscriptions
         (user_id, stripe_customer_id, stripe_subscription_id, stripe_session_id,
          status, plan_key, price_id, product_id, billing_period,
          amount_cents, currency, current_period_start, current_period_end,
          cancel_at_period_end, cancelled_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,to_timestamp($12),to_timestamp($13),$14,to_timestamp($15))`,
      [
        params.userId,
        params.customerId,
        params.subscriptionId,
        params.sessionId ?? null,
        params.status,
        params.planKey ?? null,
        params.priceId ?? null,
        params.productId ?? null,
        params.billingPeriod ?? null,
        params.amountCents ?? null,
        params.currency ?? 'usd',
        params.periodStart ?? null,
        params.periodEnd ?? null,
        params.cancelAtPeriodEnd ?? false,
        params.cancelledAt ?? null,
      ]
    );
  }
}

async function userIdFromCustomer(customerId: string): Promise<number | null> {
  // Try user_subscriptions first
  const sub = await pool.query(
    `SELECT user_id FROM user_subscriptions WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId]
  );
  if (sub.rows.length > 0) return sub.rows[0].user_id as number;
  return null;
}

// ─── Event handler ────────────────────────────────────────────────────────────

async function handleStripeEvent(event: any) {
  const obj = event.data?.object as any;

  switch (event.type) {

    case 'checkout.session.completed': {
      const userId = obj.metadata?.userId ? parseInt(obj.metadata.userId, 10) : null;
      if (!userId) break;

      const sub = obj.subscription;
      const billingPeriod = obj.subscription_data?.trial_period_days ? 'trial' : 'monthly';

      await upsertSubscription({
        userId,
        customerId: obj.customer ?? null,
        subscriptionId: typeof sub === 'string' ? sub : sub?.id ?? null,
        sessionId: obj.id,
        status: obj.payment_status === 'paid' ? 'active' : 'pending',
        planKey: obj.metadata?.planKey ?? null,
        currency: obj.currency ?? 'usd',
        amountCents: obj.amount_total ?? null,
        billingPeriod,
      });
      logger.info({ userId, sessionId: obj.id }, 'Subscription record created from checkout');
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      const userId = await userIdFromCustomer(customerId);
      if (!userId) break;

      const item = obj.items?.data?.[0];
      const interval = item?.plan?.interval;
      const billingPeriod = interval === 'year' ? 'annual' : interval === 'month' ? 'monthly' : null;

      await upsertSubscription({
        userId,
        customerId,
        subscriptionId: obj.id,
        status: obj.status,
        priceId: item?.price?.id ?? null,
        productId: item?.price?.product ?? null,
        amountCents: item?.plan?.amount ?? null,
        currency: obj.currency ?? 'usd',
        billingPeriod,
        periodStart: obj.current_period_start ?? null,
        periodEnd: obj.current_period_end ?? null,
        cancelAtPeriodEnd: obj.cancel_at_period_end ?? false,
      });
      logger.info({ userId, subscriptionId: obj.id, status: obj.status }, 'Subscription updated');
      break;
    }

    case 'customer.subscription.deleted': {
      const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      await pool.query(
        `UPDATE user_subscriptions
         SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
         WHERE stripe_subscription_id = $1`,
        [obj.id]
      );
      logger.info({ customerId, subscriptionId: obj.id }, 'Subscription cancelled');
      break;
    }

    case 'invoice.payment_failed': {
      const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      await pool.query(
        `UPDATE user_subscriptions
         SET status = 'past_due', updated_at = NOW()
         WHERE stripe_customer_id = $1 AND status != 'cancelled'`,
        [customerId]
      );
      logger.warn({ customerId }, 'Invoice payment failed — subscription marked past_due');
      break;
    }

    case 'invoice.payment_succeeded': {
      const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      await pool.query(
        `UPDATE user_subscriptions
         SET status = 'active', updated_at = NOW()
         WHERE stripe_customer_id = $1 AND status = 'past_due'`,
        [customerId]
      );
      break;
    }
  }
}

// ─── Main webhook processor ───────────────────────────────────────────────────

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    // Let StripeSync handle signature verification + its own processing
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Also handle the event for our user_subscriptions table.
    // Signature already verified above — safe to parse raw JSON.
    try {
      const event = JSON.parse(payload.toString('utf8'));
      await handleStripeEvent(event);
    } catch (err) {
      logger.warn({ err }, 'Custom webhook handler error (non-fatal)');
    }
  }
}
