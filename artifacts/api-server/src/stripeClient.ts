import Stripe from 'stripe';

let connectionSettings: any;

async function getCredentials() {
  // Prefer the Replit Stripe integration (connector) when available so the
  // app stays in sync with whichever account the user configured through
  // the Connections UI. Fall back to STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY
  // env vars only if no connector is configured.
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (hostname && xReplitToken) {
    try {
      const connectorName = 'stripe';
      const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
      const targetEnvironment = isProduction ? 'production' : 'development';

      const url = new URL(`https://${hostname}/api/v2/connection`);
      url.searchParams.set('include_secrets', 'true');
      url.searchParams.set('connector_names', connectorName);
      url.searchParams.set('environment', targetEnvironment);

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'X-Replit-Token': xReplitToken,
        },
      });

      const data = (await response.json()) as { items?: Array<{ settings?: { secret?: string; publishable?: string } }> };
      connectionSettings = data.items?.[0];

      if (
        connectionSettings?.settings?.publishable &&
        connectionSettings?.settings?.secret
      ) {
        return {
          publishableKey: connectionSettings.settings.publishable,
          secretKey: connectionSettings.settings.secret,
        };
      }
    } catch {
      // fall through to env-var fallback below
    }
  }

  const envSecret = process.env.STRIPE_SECRET_KEY;
  const envPublishable = process.env.STRIPE_PUBLISHABLE_KEY;
  if (envSecret && envPublishable) {
    return { publishableKey: envPublishable, secretKey: envSecret };
  }

  throw new Error(
    'No Stripe credentials available — connect the Stripe integration or set STRIPE_SECRET_KEY/STRIPE_PUBLISHABLE_KEY.'
  );
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: '2025-08-27.basil' as any });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const { buildPoolConfig } = await import('@workspace/db');
    const secretKey = await getStripeSecretKey();

    // Use the same pool config builder as the rest of the app so we strip
    // sslmode and explicitly set ssl.rejectUnauthorized=false. Without this,
    // DigitalOcean's managed Postgres self-signed cert causes
    // "self-signed certificate in certificate chain" during stripe-replit-sync
    // init. Prefer DO_DATABASE_URL (the canonical secret in this project) and
    // fall back to DATABASE_URL.
    const dbUrl = process.env.DO_DATABASE_URL || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DO_DATABASE_URL or DATABASE_URL must be set for Stripe sync.');
    }
    const baseConfig = buildPoolConfig(dbUrl);

    stripeSync = new StripeSync({
      poolConfig: { ...baseConfig, max: 2 },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
