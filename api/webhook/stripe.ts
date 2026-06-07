/**
 * POST /api/webhook/stripe — Stripe webhook endpoint.
 * Verifies signature, applies subscription lifecycle to our DB.
 *
 * Vercel quirk: we MUST disable body parsing to get the raw bytes for
 * signature verification.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyWebhook, applySubscriptionEvent } from "../../src/lib/billing.js";
import { log } from "../../src/lib/logger.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 15,
  api: { bodyParser: false },
};

async function readRawBody(req: VercelRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) {
    res.status(400).json({ error: "missing_signature" });
    return;
  }
  let raw: string;
  try {
    raw = await readRawBody(req);
  } catch (e) {
    log.error("read raw body failed", {
      msg: e instanceof Error ? e.message : String(e),
    });
    res.status(400).json({ error: "read_failed" });
    return;
  }

  let event;
  try {
    event = verifyWebhook(raw, sig);
  } catch (e) {
    log.warn("webhook signature invalid", {
      msg: e instanceof Error ? e.message : String(e),
    });
    res.status(400).json({ error: "invalid_signature" });
    return;
  }

  try {
    await applySubscriptionEvent(event);
    res.status(200).json({ received: true });
  } catch (e) {
    log.error("webhook handler failed", {
      type: event.type,
      msg: e instanceof Error ? e.message : String(e),
    });
    // Return 200 so Stripe doesn't retry forever for our internal bugs;
    // we still see the error in logs.
    res.status(200).json({ received: true, handler_error: true });
  }
}
