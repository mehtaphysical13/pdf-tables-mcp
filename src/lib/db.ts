/**
 * Postgres connection + schema.
 *
 * Single shared pool per warm Vercel invocation. Schema is idempotent; the
 * `ensureSchema()` call at module load runs the migrations the first time a
 * cold function boots, so we never need a separate migration step.
 */

import { Pool, type PoolConfig } from "pg";
import { log } from "./logger.js";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const config: PoolConfig = {
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    // Neon requires SSL — the connection string usually includes sslmode=require
  };
  pool = new Pool(config);
  pool.on("error", (err) =>
    log.error("pg pool error", { msg: err.message })
  );
  return pool;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  await ensureSchema();
  const res = await getPool().query(text, params as never);
  return res.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Idempotent schema bootstrap. Safe to call concurrently — `CREATE … IF NOT
 * EXISTS` is no-op when objects already exist.
 */
export function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const p = getPool();
    await p.query(`
      CREATE TABLE IF NOT EXISTS users (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email           TEXT NOT NULL UNIQUE,
        stripe_customer_id TEXT,
        plan            TEXT NOT NULL DEFAULT 'free',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key_hash        TEXT NOT NULL UNIQUE,
        prefix          TEXT NOT NULL,
        label           TEXT,
        last_used_at    TIMESTAMPTZ,
        revoked_at      TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys(user_id);

      CREATE TABLE IF NOT EXISTS usage_events (
        id              BIGSERIAL PRIMARY KEY,
        api_key_id      UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tool            TEXT NOT NULL,
        status          TEXT NOT NULL,
        pages_processed INTEGER NOT NULL DEFAULT 0,
        cost_micro_usd  INTEGER NOT NULL DEFAULT 0,
        latency_ms      INTEGER NOT NULL DEFAULT 0,
        error_code      TEXT,
        ts              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS usage_events_user_ts_idx
        ON usage_events(user_id, ts DESC);
      CREATE INDEX IF NOT EXISTS usage_events_month_idx
        ON usage_events(user_id, date_trunc('month', ts));

      CREATE TABLE IF NOT EXISTS subscriptions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        stripe_sub_id   TEXT NOT NULL UNIQUE,
        plan            TEXT NOT NULL,
        status          TEXT NOT NULL,
        current_period_end TIMESTAMPTZ,
        cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions(user_id);

      CREATE TABLE IF NOT EXISTS email_outbox (
        id              BIGSERIAL PRIMARY KEY,
        recipient       TEXT NOT NULL,
        kind            TEXT NOT NULL,
        payload         JSONB NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending',
        sent_at         TIMESTAMPTZ,
        error           TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    log.info("schema ready");
  })();
  return schemaReady;
}

/**
 * Quota by plan, MEASURED IN PAGES (not calls). Smoke testing showed
 * Sonnet 4.5 costs ~$0.015/page; per-call pricing inverted unit economics.
 * Per-page keeps margin positive across PDF sizes.
 *
 * Hobby   $19/mo  /  250 pages  = $0.076/page revenue  (80% margin)
 * Pro     $99/mo  /  2000 pages = $0.050/page revenue  (70% margin)
 * Bus    $499/mo  / 15000 pages = $0.033/page revenue  (55% margin)
 */
export const PLAN_QUOTA: Record<string, number> = {
  free: 50,
  hobby: 250,
  pro: 2_000,
  business: 15_000,
  enterprise: 200_000,
};

