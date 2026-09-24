import { Router, type IRouter } from 'express';
import { getUncachableStripeClient, getStripePublishableKey } from '../stripeClient';
import { pool } from '@workspace/db';
import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';
import { logger } from '../lib/logger';

const router: IRouter = Router();

// ─── Config ─────────────────────────────────────────────────────────────────

router.get('/stripe/config', async (_req, res) => {
  try {
    const publishableKey = await getStripePublishableKey();
    res.json({ publishableKey });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Products ────────────────────────────────────────────────────────────────

router.get('/stripe/products', async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.description as product_description,
        p.metadata as product_metadata,
        pr.id as price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active as price_active
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY p.name, pr.unit_amount
    `);

    const productsMap = new Map<string, any>();
    for (const row of result.rows as any[]) {
      if (!productsMap.has(row.product_id)) {
        productsMap.set(row.product_id, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          metadata: row.product_metadata || {},
          prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
        });
      }
    }

    res.json({ data: Array.from(productsMap.values()) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Checkout ─────────────────────────────────────────────────────────────────

// In-process cache mapping `${planKey}:${billing}` → resolved Stripe price ID.
// Saves a round-trip to Stripe on every checkout request after the first.
const priceCache = new Map<string, string>();

const VALID_PLAN_KEYS = new Set(['installiq', 'signsalesiq', 'signtakeoffiq', 'fullsuite']);
const VALID_BILLINGS  = new Set(['monthly', 'annual']);

async function resolvePriceId(
  stripe: Awaited<ReturnType<typeof getUncachableStripeClient>>,
  planKey: string,
  billing: string,
): Promise<string> {
  const cacheKey = `${planKey}:${billing}`;
  const cached = priceCache.get(cacheKey);
  if (cached) return cached;

  const lookupKey = `${planKey}_${billing}`;
  const result = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const price = result.data[0];
  if (!price) {
    throw new Error(
      `No Stripe price with lookup_key="${lookupKey}". Run "pnpm --filter @workspace/scripts run seed-stripe" against this Stripe account to create the products and prices.`,
    );
  }
  priceCache.set(cacheKey, price.id);
  return price.id;
}

router.post('/stripe/checkout', async (req, res) => {
  try {
    const {
      priceId: clientPriceId,
      successUrl: clientSuccessUrl,
      cancelUrl: clientCancelUrl,
      userId,
      userEmail,
      planKey,
      billing,
    } = req.body;

    const stripe = await getUncachableStripeClient();

    // Prefer dynamic resolution by planKey + billing (works in any Stripe
    // account that's been seeded). Fall back to a client-supplied priceId for
    // backward compatibility, but only after confirming it exists in this
    // Stripe account so we surface a helpful error instead of a Stripe one.
    let priceId: string;
    if (planKey && billing) {
      if (!VALID_PLAN_KEYS.has(planKey)) {
        return res.status(400).json({ error: `Unknown planKey "${planKey}".` });
      }
      if (!VALID_BILLINGS.has(billing)) {
        return res.status(400).json({ error: `billing must be "monthly" or "annual".` });
      }
      // Defense in depth: never let a coming-soon plan be purchased, even via a
      // crafted request that bypasses the disabled "Coming Soon" button. The
      // Pricing page hides the button; this blocks the underlying API too.
      const planRow = await pool.query<{ coming_soon: boolean }>(
        `SELECT coming_soon FROM plans_config WHERE plan_key = $1 LIMIT 1`,
        [planKey],
      );
      if (planRow.rows[0]?.coming_soon === true) {
        return res.status(409).json({ error: 'This plan is coming soon and cannot be purchased yet.' });
      }
      priceId = await resolvePriceId(stripe, planKey, billing);
    } else if (clientPriceId) {
      priceId = clientPriceId;
    } else {
      return res.status(400).json({ error: 'planKey + billing (or priceId) is required.' });
    }

    // ── Resolve base origin ─────────────────────────────────────────────────
    const replitDomain = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DOMAINS
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : null;
    const rawOrigin = req.headers.origin as string | undefined;
    const origin = (rawOrigin && !rawOrigin.includes('localhost'))
      ? rawOrigin
      : (replitDomain ?? rawOrigin ?? 'http://localhost');

    const successUrl = clientSuccessUrl ?? `${origin}/pricing?success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl  = clientCancelUrl  ?? `${origin}/pricing?canceled=1`;

    // ── Find or create Stripe customer ───────────────────────────────────────
    let customerId: string | undefined;
    if (userEmail) {
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
        // Attach userId metadata if missing
        if (userId && !existing.data[0].metadata?.userId) {
          await stripe.customers.update(customerId, {
            metadata: { userId: String(userId) },
          });
        }
      } else if (userId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { userId: String(userId) },
        });
        customerId = customer.id;
      }
    }

    // ── Create Stripe checkout session ───────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      ...(customerId ? { customer: customerId } : {}),
      metadata: {
        ...(userId  ? { userId:  String(userId)  } : {}),
        ...(planKey ? { planKey: String(planKey) } : {}),
      },
    });

    // ── Create a pending subscription record ─────────────────────────────────
    if (userId) {
      try {
        await pool.query(
          `INSERT INTO user_subscriptions
             (user_id, stripe_customer_id, stripe_session_id, plan_key, price_id, status)
           VALUES ($1, $2, $3, $4, $5, 'pending')
           ON CONFLICT DO NOTHING`,
          [userId, customerId ?? null, session.id, planKey ?? null, priceId]
        );
      } catch (dbErr) {
        logger.warn({ dbErr }, 'Could not save pending subscription record');
      }
    }

    return res.json({ url: session.url });
  } catch (err: any) {
    logger.error({ err }, 'Checkout error');
    return res.status(500).json({ error: err.message });
  }
});

// ─── Confirm checkout (called after successful redirect) ─────────────────────

router.post('/stripe/confirm-checkout', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: [
        'subscription',
        'subscription.latest_invoice',
        'subscription.latest_invoice.payment_intent',
        'subscription.latest_invoice.payment_intent.payment_method',
      ],
    });

    const userId = session.metadata?.userId;
    const planKey = session.metadata?.planKey;
    const sub = session.subscription as any;

    if (!userId) {
      return res.status(200).json({ ok: true, message: 'No userId in session metadata' });
    }

    const billingPeriod = sub?.items?.data?.[0]?.plan?.interval === 'year' ? 'annual' : 'monthly';

    // Pull the payment-method snapshot from the expanded invoice → payment_intent.
    // Stored on the row so the Super Admin transactions page can render
    // "Visa •••• 4242" without making per-row Stripe API calls.
    const card = sub?.latest_invoice?.payment_intent?.payment_method?.card as
      | { brand?: string; last4?: string }
      | undefined;
    const receiptUrl = sub?.latest_invoice?.hosted_invoice_url ?? null;

    // Prefer the session-level amount_total (always present and correct on a
    // paid checkout session), then fall back to the subscription item's
    // recurring price. amount_subtotal/amount_total are returned in the
    // session's currency and reflect any coupons/taxes applied.
    const amountFromSession =
      typeof session.amount_total === 'number' ? session.amount_total :
      typeof session.amount_subtotal === 'number' ? session.amount_subtotal : null;
    const amountFromSub = sub?.items?.data?.[0]?.plan?.amount ?? null;
    const amountCents = amountFromSession ?? amountFromSub;

    // If Stripe says the session is paid, prefer that signal over the
    // subscription's status (which can lag a few seconds in test mode).
    const status =
      session.payment_status === 'paid' ? 'active' :
      sub?.status ?? 'active';

    await pool.query(
      `UPDATE user_subscriptions SET
         stripe_customer_id      = COALESCE($1, stripe_customer_id),
         stripe_subscription_id  = COALESCE($2, stripe_subscription_id),
         status                  = $3,
         billing_period          = $4,
         amount_cents            = COALESCE($5, amount_cents),
         currency                = $6,
         current_period_start    = COALESCE(to_timestamp($7), current_period_start),
         current_period_end      = COALESCE(to_timestamp($8), current_period_end),
         cancel_at_period_end    = $9,
         plan_key                = COALESCE(plan_key, $10),
         payment_method_brand    = COALESCE($13, payment_method_brand),
         payment_method_last4    = COALESCE($14, payment_method_last4),
         receipt_url             = COALESCE($15, receipt_url),
         updated_at              = NOW()
       WHERE user_id = $11 AND stripe_session_id = $12`,
      [
        (session.customer as string) ?? null,
        sub?.id ?? null,
        status,
        billingPeriod,
        amountCents,
        sub?.currency ?? session.currency ?? 'usd',
        sub?.current_period_start ?? null,
        sub?.current_period_end   ?? null,
        sub?.cancel_at_period_end ?? false,
        planKey ?? null,
        userId,
        sessionId,
        card?.brand ?? null,
        card?.last4 ?? null,
        receiptUrl,
      ]
    );

    // Sync active_plan_key to business_details for the admin's company
    if (planKey) {
      try {
        await pool.query(
          `UPDATE business_details SET active_plan_key = $1
           WHERE id = (SELECT company_id FROM users WHERE id = $2 LIMIT 1)`,
          [planKey, userId]
        );
      } catch (syncErr) {
        logger.warn({ syncErr }, 'Could not sync active_plan_key to business_details');
      }
    }

    return res.json({ ok: true, status: sub?.status ?? 'active' });
  } catch (err: any) {
    logger.error({ err }, 'Confirm checkout error');
    return res.status(500).json({ error: err.message });
  }
});

// ─── Backfill amount_cents / payment-method for legacy rows ──────────────────
//
// The old success flow only called /admin/activate-plan, which never asked
// Stripe what was paid. Rows from before /confirm-checkout was always called
// (or rows where the webhook never fired in test mode) end up with NULL
// amount_cents and NULL payment-method fields, so the Super Admin "Payments"
// page renders an em-dash instead of a price.
//
// This endpoint walks every user_subscriptions row that has a stripe_session_id
// but is missing amount_cents OR payment_method_brand, fetches the session
// from Stripe (with the invoice + payment_intent expanded), and fills in the
// missing fields. Idempotent — already-populated rows are left alone.

router.post('/admin/transactions/backfill-amounts', async (req: any, res) => {
  // Inline auth: super_admin only. We don't import requireAdmin here to keep
  // this route self-contained inside the stripe router.
  const userIdHeader = req.headers['x-user-id'];
  if (!userIdHeader) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const userRes = await pool.query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1 LIMIT 1`,
      [Number(userIdHeader)]
    );
    if (!userRes.rows.length || userRes.rows[0].role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } catch (err) {
    logger.error({ err }, 'backfill-amounts auth error');
    return res.status(500).json({ error: 'Server error' });
  }

  try {
    const stripe = await getUncachableStripeClient();

    const rows = await pool.query<{
      id: number;
      stripe_session_id: string;
    }>(
      `SELECT id, stripe_session_id
         FROM user_subscriptions
        WHERE stripe_session_id IS NOT NULL
          AND (amount_cents IS NULL OR payment_method_brand IS NULL)
        ORDER BY id DESC
        LIMIT 200`
    );

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows.rows) {
      try {
        const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id, {
          expand: [
            'subscription',
            'subscription.latest_invoice',
            'subscription.latest_invoice.payment_intent',
            'subscription.latest_invoice.payment_intent.payment_method',
            'payment_intent',
            'payment_intent.payment_method',
          ],
        });

        const sub = session.subscription as any;

        // Try card brand/last4 from either the subscription invoice or, for
        // one-time payments, the session-level payment_intent.
        const subCard = sub?.latest_invoice?.payment_intent?.payment_method?.card as
          | { brand?: string; last4?: string } | undefined;
        const sessCard = (session.payment_intent as any)?.payment_method?.card as
          | { brand?: string; last4?: string } | undefined;
        const card = subCard ?? sessCard;
        const receiptUrl = sub?.latest_invoice?.hosted_invoice_url ?? null;

        const amountFromSession =
          typeof session.amount_total === 'number' ? session.amount_total :
          typeof session.amount_subtotal === 'number' ? session.amount_subtotal : null;
        const amountFromSub = sub?.items?.data?.[0]?.plan?.amount ?? null;
        const amountCents = amountFromSession ?? amountFromSub;

        const status =
          session.payment_status === 'paid' ? 'active' :
          sub?.status ?? null;

        if (amountCents == null && !card?.brand) {
          skipped++;
          continue;
        }

        await pool.query(
          `UPDATE user_subscriptions SET
             amount_cents          = COALESCE($1, amount_cents),
             currency              = COALESCE($2, currency),
             payment_method_brand  = COALESCE($3, payment_method_brand),
             payment_method_last4  = COALESCE($4, payment_method_last4),
             receipt_url           = COALESCE($5, receipt_url),
             status                = COALESCE($6, status),
             stripe_subscription_id = COALESCE($7, stripe_subscription_id),
             stripe_customer_id    = COALESCE($8, stripe_customer_id),
             updated_at            = NOW()
           WHERE id = $9`,
          [
            amountCents,
            sub?.currency ?? session.currency ?? null,
            card?.brand ?? null,
            card?.last4 ?? null,
            receiptUrl,
            status,
            sub?.id ?? null,
            (session.customer as string) ?? null,
            row.id,
          ]
        );
        updated++;
      } catch (rowErr: any) {
        failed++;
        logger.warn({ rowErr: rowErr?.message, sessionId: row.stripe_session_id }, 'backfill row failed');
      }
    }

    return res.json({ ok: true, scanned: rows.rows.length, updated, skipped, failed });
  } catch (err: any) {
    logger.error({ err }, 'backfill-amounts error');
    return res.status(500).json({ error: err.message });
  }
});

// ─── Query subscriptions for a user ──────────────────────────────────────────

router.get('/stripe/subscriptions/:userId', async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const result = await pool.query(
      `SELECT * FROM user_subscriptions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.json({ data: result.rows });
  } catch (err: any) {
    logger.error({ err }, 'Fetch subscriptions error');
    return res.status(500).json({ error: err.message });
  }
});

export default router;
