/**
 * GET /api/me — returns the authenticated user's plan + usage snapshot.
 * Auth: Bearer API key in Authorization header.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractBearer, resolveKey } from "../src/lib/auth.js";
import { getQuotaForUser } from "../src/lib/usage.js";

export const config = { runtime: "nodejs", maxDuration: 10 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "authorization, content-type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
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

  const quota = await getQuotaForUser(owner.user_id, owner.plan);
  res.status(200).json({
    user_id: owner.user_id,
    email: owner.email,
    plan: owner.plan,
    api_key_prefix: owner.prefix,
    usage: quota,
  });
}
