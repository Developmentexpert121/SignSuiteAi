import { getUncachableStripeClient } from "./stripeClient";

// `planKey` MUST match the keys the frontend sends in /api/stripe/checkout
// requests (installiq, signsalesiq, signtakeoffiq, fullsuite). It's used both
// as Stripe product metadata and as the `lookup_key` prefix on each price so
// the backend can resolve the right price by planKey + billing without ever
// hardcoding price IDs in the apps.
const PLANS = [
  {
    planKey: "installiq",
    name: "InstalliQ.ai",
    description:
      "AI-powered field proof and installation management for sign crews.",
    metadata: { app: "installiq", category: "field_proof" },
    monthly: 12900,
    annual: 128400,
  },
  {
    planKey: "signsalesiq",
    name: "SignSalesIQ",
    description:
      "AI mockups, proposals, and local sign code — close deals without your designer.",
    metadata: { app: "signsalesiq", category: "sales" },
    monthly: 12900,
    annual: 128400,
  },
  {
    planKey: "signtakeoffiq",
    name: "SignTakeoffIQ",
    description:
      "Automated plan reading, ADA compliance checks, and sign schedule generation.",
    metadata: { app: "signtakeoffiq", category: "estimating" },
    monthly: 12900,
    annual: 128400,
  },
  {
    planKey: "fullsuite",
    name: "Full Suite",
    description:
      "All three apps — InstalliQ.ai, SignSalesIQ, and SignTakeoffIQ — with priority 24/7 support and custom onboarding.",
    metadata: { app: "fullsuite", category: "command_center" },
    monthly: 29900,
    annual: 298800,
  },
];

async function seedProducts() {
  const stripe = await getUncachableStripeClient();
  console.log("Seeding SignSuiteIQ products in Stripe...\n");

  for (const plan of PLANS) {
    const existing = await stripe.products.search({
      query: `name:'${plan.name}' AND active:'true'`,
    });

    let product: any;
    if (existing.data.length > 0) {
      product = existing.data[0];
      console.log(`✓ ${plan.name} already exists (${product.id})`);
    } else {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: plan.metadata,
      });
      console.log(`+ Created product: ${plan.name} (${product.id})`);
    }

    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
    });
    const existingMonthly = existingPrices.data.find(
      (p) => p.recurring?.interval === "month",
    );
    const existingAnnual = existingPrices.data.find(
      (p) => p.recurring?.interval === "year",
    );
    const hasMonthly = !!existingMonthly;
    const hasAnnual = !!existingAnnual;

    const monthlyKey = `${plan.planKey}_monthly`;
    const annualKey = `${plan.planKey}_annual`;

    // Backfill lookup_key on prices created by older versions of this script
    // (which didn't set them). Idempotent — Stripe accepts the same value.
    if (existingMonthly && existingMonthly.lookup_key !== monthlyKey) {
      await stripe.prices.update(existingMonthly.id, {
        lookup_key: monthlyKey,
        transfer_lookup_key: true,
      });
      console.log(
        `  ↻ Backfilled monthly lookup_key=${monthlyKey} on ${existingMonthly.id}`,
      );
    }
    if (existingAnnual && existingAnnual.lookup_key !== annualKey) {
      await stripe.prices.update(existingAnnual.id, {
        lookup_key: annualKey,
        transfer_lookup_key: true,
      });
      console.log(
        `  ↻ Backfilled annual lookup_key=${annualKey} on ${existingAnnual.id}`,
      );
    }

    if (!hasMonthly) {
      const mp = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthly,
        currency: "usd",
        recurring: { interval: "month" },
        lookup_key: monthlyKey,
        transfer_lookup_key: true,
        metadata: { billing: "monthly", planKey: plan.planKey },
      });
      console.log(
        `  + Monthly price: $${plan.monthly / 100}/mo (${mp.id}, lookup_key=${monthlyKey})`,
      );
    } else {
      console.log(`  ✓ Monthly price already exists`);
    }

    if (!hasAnnual) {
      const ap = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.annual,
        currency: "usd",
        recurring: { interval: "year" },
        lookup_key: annualKey,
        transfer_lookup_key: true,
        metadata: { billing: "annual", planKey: plan.planKey },
      });
      console.log(
        `  + Annual price: $${plan.annual / 100}/yr (${ap.id}, lookup_key=${annualKey})`,
      );
    } else {
      console.log(`  ✓ Annual price already exists`);
    }

    console.log("");
  }

  //test user

  console.log(
    "✅ Done! Webhooks will sync products to the database automatically.",
  );
}

seedProducts().catch((err) => {
  console.error("Seed error:", err.message);
  process.exit(1);
});
