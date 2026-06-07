/**
 * API key generation, hashing, and validation.
 *
 * Format: `pdt_live_<32 url-safe random chars>` (Stripe-style prefix).
 * Storage: only the SHA-256 hash is persisted; the raw key is shown to the
 * user once on signup and never recoverable.
 */

import { createHash, randomBytes } from "node:crypto";
import { query, queryOne } from "./db.js";
import { log } from "./logger.js";

const KEY_PREFIX = "pdt_live_";
const KEY_BODY_LEN = 32;

/**
 * Generate a fresh API key. Returns the raw key (show once) and the
 * persisted-record fields (prefix + hash).
 */
export function generateKey(): { raw: string; prefix: string; hash: string } {
  // url-safe random — strip + and / from base64, take 32 chars.
  const raw =
    KEY_PREFIX +
    randomBytes(48)
      .toString("base64")
      .replace(/[+/=]/g, "")
      .slice(0, KEY_BODY_LEN);
  const prefix = raw.slice(0, KEY_PREFIX.length + 4); // pdt_live_xxxx
  const hash = hashKey(raw);
  return { raw, prefix, hash };
}

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface ApiKeyOwner {
  api_key_id: string;
  user_id: string;
  email: string;
  plan: string;
  prefix: string;
  revoked_at: string | null;
}

/**
 * Look up the owning user for a raw key. Returns null on miss or revoked.
 * Updates `last_used_at` on hit (best-effort, fire-and-forget).
 */
export async function resolveKey(raw: string): Promise<ApiKeyOwner | null> {
  if (!raw.startsWith(KEY_PREFIX)) return null;
  const hash = hashKey(raw);
  const row = await queryOne<ApiKeyOwner>(
    `SELECT k.id AS api_key_id, k.user_id, u.email, u.plan, k.prefix, k.revoked_at
       FROM api_keys k
       JOIN users u ON u.id = k.user_id
      WHERE k.key_hash = $1`,
    [hash]
  );
  if (!row) return null;
  if (row.revoked_at) return null;
  // best-effort touch
  void query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [
    row.api_key_id,
  ]).catch((e) =>
    log.warn("api_key touch failed", {
      msg: e instanceof Error ? e.message : String(e),
    })
  );
  return row;
}

/** Pull the bearer token from an Authorization header (or `x-api-key`). */
export function extractBearer(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (trimmed.startsWith("Bearer ")) return trimmed.slice(7).trim();
  if (trimmed.startsWith("bearer ")) return trimmed.slice(7).trim();
  return trimmed; // tolerate raw key with no Bearer prefix
}
