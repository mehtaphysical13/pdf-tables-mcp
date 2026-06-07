/**
 * POST /api/checkout — start a Stripe Checkout session for a plan upgrade.
 * Body: { plan: "hobby" | "pro" | "business" }
 * Auth: Bearer API key
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { extractBearer, resolveKey } from "../src/lib/auth.js";
import { createCheckoutSession } from "../src/lib/billing.js";
import { log } from "../src/lib/logger.js";

export const config = { runtime: "nodejs", maxDuration: 15 };

const BodySchema = z.object({
  plan: z.enum(["hobby", "pro", "business"]),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "authorization, content-type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const key = extractBearer(
    (req.headers.authorization as string) ?? (req.headers["x-api-key"] as string)
  );
  if (!key) {
    res.status(401).json({ error: "missing_api_key" });
    return;
  }
  const owner = await resolveKey(key);
  if (!owner) {
    res.status(401).json({ error: "invalid_api_key" });
    return;
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_body", details: parsed.error.format() });
    return;
  }

  try {
    const url = await createCheckoutSession({
      userId: owner.user_id,
      email: owner.email,
      plan: parsed.data.plan,
      returnUrl: `https://pdf-tables-mcp.vercel.app/dashboard#${key}`,
    });
    res.status(200).json({ url });
  } catch (e) {
    log.error("checkout failed", {
      msg: e instanceof Error ? e.message : String(e),
    });
    res.status(500).json({ error: "checkout_failed" });
  }
}
