/**
 * POST /api/signup — { email } → generates an API key, emails it, returns a
 * one-time view of the key + a magic-token-like dashboard URL.
 *
 * v1: no email verification, no password. The API key IS the credential.
 * Email is captured for billing/marketing; we trust it as identity for v1.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { query, queryOne } from "../src/lib/db.js";
import { generateKey } from "../src/lib/auth.js";
import { sendWelcomeEmail } from "../src/lib/email.js";
import { ensureStripeCustomer } from "../src/lib/billing.js";
import { log } from "../src/lib/logger.js";

export const config = { runtime: "nodejs", maxDuration: 20 };

const BodySchema = z.object({
  email: z.string().email().max(254),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.format() });
    return;
  }
  const email = parsed.data.email.toLowerCase().trim();

  try {
    // Upsert user.
    let user = await queryOne<{ id: string }>(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );
    if (!user) {
      user = await queryOne<{ id: string }>(
        `INSERT INTO users (email) VALUES ($1) RETURNING id`,
        [email]
      );
    }
    if (!user) throw new Error("could not create user");

    // Always issue a fresh key on signup (the v1 dashboard doesn't yet expose
    // key rotation; this simplifies "I lost my key" by letting users re-signup
    // with the same email).
    const { raw, prefix, hash } = generateKey();
    await query(
      `INSERT INTO api_keys (user_id, key_hash, prefix, label) VALUES ($1, $2, $3, $4)`,
      [user.id, hash, prefix, "default"]
    );

    // Provision Stripe customer (idempotent).
    await ensureStripeCustomer(user.id, email).catch((e) =>
      log.warn("stripe customer creation deferred", {
        msg: e instanceof Error ? e.message : String(e),
      })
    );

    // Send welcome (best-effort — don't fail signup if email service hiccups).
    await sendWelcomeEmail(email, raw).catch((e) =>
      log.warn("welcome email deferred", {
        msg: e instanceof Error ? e.message : String(e),
      })
    );

    res.status(200).json({
      ok: true,
      user_id: user.id,
      api_key: raw, // shown once, not retrievable later
      prefix,
      plan: "free",
      dashboard_url: `https://pdf-tables-mcp.vercel.app/dashboard#${raw}`,
    });
  } catch (e) {
    log.error("signup failed", {
      msg: e instanceof Error ? e.message : String(e),
    });
    res.status(500).json({ error: "signup_failed" });
  }
}
