import Stripe from 'stripe';

// Mirrors artifacts/api-server/src/stripeClient.ts so that running
// `pnpm --filter @workspace/scripts run seed-stripe` always targets the same
// Stripe account the api-server will use at runtime — even when seeding from
// a deployed environment (e.g. DigitalOcean shell with REPLIT_DEPLOYMENT=1
// or with STRIPE_SECRET_KEY set as a plain env var).
async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (hostname && xReplitToken) {
    try {
      const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
      const targetEnvironment = isProduction ? 'production' : 'development';

      const url = new URL(`https://${hostname}/api/v2/connection`);
      url.searchParams.set('include_secrets', 'true');
      url.searchParams.set('connector_names', 'stripe');
      url.searchParams.set('environment', targetEnvironment);

      const response = await fetch(url.toString(), {
        headers: { 'Accept': 'application/json', 'X-Replit-Token': xReplitToken },
      });

      const data = (await response.json()) as { items?: Array<{ settings?: { secret?: string; publishable?: string } }> };
      const conn = data.items?.[0];
      if (conn?.settings?.secret && conn?.settings?.publishable) {
        return { publishableKey: conn.settings.publishable, secretKey: conn.settings.secret };
      }
    } catch {
      // fall through to env-var fallback
    }
  }

  const envSecret = process.env.STRIPE_SECRET_KEY;
  const envPublishable = process.env.STRIPE_PUBLISHABLE_KEY;
  if (envSecret && envPublishable) {
    return { publishableKey: envPublishable, secretKey: envSecret };
  }

  throw new Error(
    'No Stripe credentials available — connect the Stripe integration or set STRIPE_SECRET_KEY/STRIPE_PUBLISHABLE_KEY.',
  );
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: '2025-08-27.basil' as any });
}
