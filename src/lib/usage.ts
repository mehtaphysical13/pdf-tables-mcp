/**
 * Usage recording + quota enforcement.
 */

import { query, queryOne, PLAN_QUOTA } from "./db.js";

export interface UsageRecord {
  apiKeyId: string;
  userId: string;
  tool: string;
  status: "ok" | "error";
  pagesProcessed: number;
  costMicroUsd: number;
  latencyMs: number;
  errorCode?: string;
}

export async function recordUsage(r: UsageRecord): Promise<void> {
  await query(
    `INSERT INTO usage_events
       (api_key_id, user_id, tool, status, pages_processed, cost_micro_usd, latency_ms, error_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      r.apiKeyId,
      r.userId,
      r.tool,
      r.status,
      r.pagesProcessed,
      r.costMicroUsd,
      r.latencyMs,
      r.errorCode ?? null,
    ]
  );
}

export interface QuotaSnapshot {
  plan: string;
  quotaPages: number;
  pagesUsed: number;
  pagesRemaining: number;
  resetsAt: string; // ISO
}

export async function getQuotaForUser(
  userId: string,
  plan: string
): Promise<QuotaSnapshot> {
  const quotaPages = PLAN_QUOTA[plan] ?? PLAN_QUOTA.free;
  const used = await queryOne<{ sum: string | null }>(
    `SELECT COALESCE(SUM(pages_processed), 0)::text AS sum
       FROM usage_events
      WHERE user_id = $1
        AND status = 'ok'
        AND ts >= date_trunc('month', NOW())`,
    [userId]
  );
  const pagesUsed = Number(used?.sum ?? 0);
  const resetsAt = new Date();
  resetsAt.setUTCMonth(resetsAt.getUTCMonth() + 1, 1);
  resetsAt.setUTCHours(0, 0, 0, 0);
  return {
    plan,
    quotaPages,
    pagesUsed,
    pagesRemaining: Math.max(0, quotaPages - pagesUsed),
    resetsAt: resetsAt.toISOString(),
  };
}

/** Cheap preflight — we don't know exact pages until we fetch, but we can
 * reject if the user is already at zero remaining. */
export function isQuotaExhausted(snap: QuotaSnapshot): boolean {
  return snap.pagesRemaining <= 0;
}
