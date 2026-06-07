/**
 * DB connectivity smoke. Run with creds sourced:
 *   set -a && source .env.local && set +a && npx tsx scripts/smoke-db.ts
 */

import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log("connecting...");
  const r = await pool.query("SELECT current_database() AS db, version() AS v");
  console.log("connected:", r.rows[0].db, "|", r.rows[0].v.slice(0, 60));

  try {
    const u = await pool.query("SELECT gen_random_uuid() AS u");
    console.log("gen_random_uuid:", u.rows[0].u);
  } catch (e) {
    console.log("gen_random_uuid err:", e instanceof Error ? e.message : e);
  }

  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS _smoke (id UUID PRIMARY KEY DEFAULT gen_random_uuid())`
    );
    console.log("CREATE TABLE ok");
    await pool.query(`DROP TABLE _smoke`);
    console.log("DROP TABLE ok");
  } catch (e) {
    console.log("schema err:", e instanceof Error ? e.message : e);
  }

  await pool.end();
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
