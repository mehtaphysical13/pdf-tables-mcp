/**
 * Stripe client + helpers. Single point for subscription state changes.
 */

import Stripe from "stripe";
import { query, queryOne } from "./db.js";
import { log } from "./logger.js";

let client: Stripe | null = null;
function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return client;
}

export type Plan = "free" | "hobby" | "pro" | "business" | "enterprise";

export function priceIdForPlan(plan: Plan): string | null {
  switch (plan) {
    case "hobby":
      return process.env.STRIPE_PRICE_HOBBY ?? null;
    case "pro":
      return process.env.STRIPE_PRICE_PRO ?? null;
    case "business":
      return process.env.STRIPE_PRICE_BUSINESS ?? null;
    default:
      return null;
  }
}

export function planFromPriceId(priceId: string): Plan {
  if (priceId === process.env.STRIPE_PRICE_HOBBY) return "hobby";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return "business";
  return "free";
}

/** Get-or-create the Stripe customer for a user, persisting the id. */
export async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  const existing = await queryOne<{ stripe_customer_id: string | null }>(
    `SELECT stripe_customer_id FROM users WHERE id = $1`,
    [userId]
  );
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await getStripe().customers.create({
    email,
    metadata: { user_id: userId, app: "pdf-tables-mcp" },
  });
  await query(`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`, [
    customer.id,
    userId,
  ]);
  return customer.id;
}

export interface CheckoutOptions {
  userId: string;
  email: string;
  plan: Plan;
  returnUrl: string;
}

export async function createCheckoutSession(opts: CheckoutOptions): Promise<string> {
  const priceId = priceIdForPlan(opts.plan);
  if (!priceId) throw new Error(`No price configured for plan ${opts.plan}`);
  const customerId = await ensureStripeCustomer(opts.userId, opts.email);
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${opts.returnUrl}?upgraded=1`,
    cancel_url: opts.returnUrl,
    allow_promotion_codes: true,
    subscription_data: { metadata: { user_id: opts.userId } },
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function createPortalSession(
  userId: string,
  email: string,
  returnUrl: string
): Promise<string> {
  const customerId = await ensureStripeCustomer(userId, email);
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

/** Verify and parse a Stripe webhook signature. */
export function verifyWebhook(
  rawBody: string,
  sigHeader: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return getStripe().webhooks.constructEvent(rawBody, sigHeader, secret);
}

export async function applySubscriptionEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) {
        log.warn("subscription missing user_id metadata", { sub: sub.id });
        return;
      }
      const priceId = sub.items.data[0]?.price.id ?? "";
      const plan = planFromPriceId(priceId);
      await query(
        `INSERT INTO subscriptions (user_id, stripe_sub_id, plan, status, current_period_end, cancel_at_period_end)
         VALUES ($1, $2, $3, $4, to_timestamp($5), $6)
         ON CONFLICT (stripe_sub_id) DO UPDATE SET
           plan = EXCLUDED.plan,
           status = EXCLUDED.status,
           current_period_end = EXCLUDED.current_period_end,
           cancel_at_period_end = EXCLUDED.cancel_at_period_end,
           updated_at = NOW()`,
        [
          userId,
          sub.id,
          plan,
          sub.status,
          sub.current_period_end,
          sub.cancel_at_period_end,
        ]
      );
      // Reflect on the user record so the rate limiter sees it.
      if (sub.status === "active" || sub.status === "trialing") {
        await query(
          `UPDATE users SET plan = $1, updated_at = NOW() WHERE id = $2`,
          [plan, userId]
        );
      }
      log.info("subscription applied", { user: userId, plan, status: sub.status });
      return;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.user_id;
      if (!userId) return;
      await query(
        `UPDATE subscriptions SET status = 'canceled', updated_at = NOW() WHERE stripe_sub_id = $1`,
        [sub.id]
      );
      await query(`UPDATE users SET plan = 'free', updated_at = NOW() WHERE id = $1`, [
        userId,
      ]);
      log.info("subscription canceled", { user: userId });
      return;
    }
    default:
      log.debug("stripe event ignored", { type: event.type });
  }
}
