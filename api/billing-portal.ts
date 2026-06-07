/**
 * POST /api/billing-portal — returns a Stripe Customer Portal URL.
 * Auth: Bearer API key
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractBearer, resolveKey } from "../src/lib/auth.js";
import { createPortalSession } from "../src/lib/billing.js";
import { log } from "../src/lib/logger.js";

export const config = { runtime: "nodejs", maxDuration: 15 };

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

  try {
    const url = await createPortalSession(
      owner.user_id,
      owner.email,
      `https://pdf-tables-mcp.vercel.app/dashboard#${key}`
    );
    res.status(200).json({ url });
  } catch (e) {
    log.error("billing-portal failed", {
      msg: e instanceof Error ? e.message : String(e),
    });
    res.status(500).json({ error: "portal_failed" });
  }
}
