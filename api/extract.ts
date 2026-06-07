/**
 * POST /api/extract — OpenAPI-style direct extraction endpoint.
 * Same backend as the MCP tool, exposed as plain JSON in/out for
 * coding agents that prefer OpenAPI to MCP.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { extractBearer, resolveKey } from "../src/lib/auth.js";
import { extractPdf, ExtractionError } from "../src/lib/extract.js";
import {
  getQuotaForUser,
  isQuotaExhausted,
  recordUsage,
} from "../src/lib/usage.js";
import { log } from "../src/lib/logger.js";

export const config = { runtime: "nodejs", maxDuration: 300 };

const BodySchema = z.object({
  url: z.string().url(),
  pages: z.array(z.number().int().min(1)).max(100).optional(),
  format: z.enum(["json", "markdown", "csv"]).optional(),
  model: z
    .enum(["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5"])
    .optional(),
  confidence_threshold: z.number().min(0).max(1).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader(
    "access-control-allow-headers",
    "authorization, content-type, x-api-key"
  );
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
    res.status(401).json({
      error: "missing_api_key",
      hint: "Get a free key at https://pdf-tables-mcp.vercel.app",
    });
    return;
  }
  const owner = await resolveKey(key);
  if (!owner) {
    res.status(401).json({ error: "invalid_api_key" });
    return;
  }

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "invalid_body", details: parsed.error.format() });
    return;
  }

  const quota = await getQuotaForUser(owner.user_id, owner.plan);
  if (isQuotaExhausted(quota)) {
    res.status(402).json({
      error: "quota_exhausted",
      plan: quota.plan,
      pages_used: quota.pagesUsed,
      pages_quota: quota.quotaPages,
      resets_at: quota.resetsAt,
      hint: "Upgrade at https://pdf-tables-mcp.vercel.app/pricing",
    });
    return;
  }

  const start = Date.now();
  try {
    const result = await extractPdf({
      url: parsed.data.url,
      pages: parsed.data.pages,
      model: parsed.data.model,
      confidenceThreshold: parsed.data.confidence_threshold,
    });
    await recordUsage({
      apiKeyId: owner.api_key_id,
      userId: owner.user_id,
      tool: "extract_pdf_tables",
      status: "ok",
      pagesProcessed: result.stats.pages_processed,
      costMicroUsd: result.stats.cost_micro_usd,
      latencyMs: result.stats.latency_ms,
    });
    res.status(200).json(result);
  } catch (e) {
    const code = e instanceof ExtractionError ? e.code : "internal_error";
    const message = e instanceof Error ? e.message : String(e);
    await recordUsage({
      apiKeyId: owner.api_key_id,
      userId: owner.user_id,
      tool: "extract_pdf_tables",
      status: "error",
      pagesProcessed: 0,
      costMicroUsd: 0,
      latencyMs: Date.now() - start,
      errorCode: code,
    });
    log.error("extract endpoint failed", { code, msg: message });
    res.status(code === "internal_error" ? 500 : 400).json({
      error: code,
      message,
    });
  }
}
