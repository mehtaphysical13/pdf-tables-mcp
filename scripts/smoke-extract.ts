/**
 * Live smoke test of the extract pipeline. Hits a real public PDF.
 * Run with: npx tsx scripts/smoke-extract.ts
 *
 * Requires ANTHROPIC_API_KEY in the environment (pull with `vercel env pull
 * .env.local --environment production` then `source .env.local` or use a
 * .env loader).
 */

import { extractPdf } from "../src/lib/extract.js";

// Small, table-rich, reliably accessible public PDF.
// arxiv.org PDFs are CDN-served, no Akamai/auth issues, and almost
// always contain at least one table.
const TEST_URL =
  process.env.SMOKE_PDF_URL ??
  "https://arxiv.org/pdf/2406.04692v1.pdf"; // example: Mixture-of-Agents paper, ~4 small tables

async function main() {
  console.log(`Extracting tables from: ${TEST_URL}`);
  const t0 = Date.now();
  const result = await extractPdf({ url: TEST_URL });
  const t1 = Date.now();

  console.log(`\n--- summary ---`);
  console.log(`pages: ${result.page_count}`);
  console.log(`tables: ${result.tables.length}`);
  console.log(`latency: ${t1 - t0}ms`);
  console.log(`cost: $${(result.stats.cost_micro_usd / 1_000_000).toFixed(4)}`);
  console.log(`model: ${result.stats.model}`);
  if (result.warnings) {
    console.log(`warnings:`);
    for (const w of result.warnings) console.log(`  - ${w}`);
  }

  for (const t of result.tables.slice(0, 3)) {
    console.log(`\n--- ${t.id} ${t.title ? `("${t.title}") ` : ""}---`);
    console.log(`pages=${t.pages.join(",")} rows=${t.rows} cols=${t.cols} conf=${t.confidence.toFixed(2)}`);
    console.log(`headers: ${t.headers.join(" | ").slice(0, 200)}`);
    for (const row of t.cells.slice(0, 3)) {
      console.log(`  ${row.map((c) => c.value).join(" | ").slice(0, 200)}`);
    }
    if (t.notes?.length) console.log(`notes: ${t.notes.join("; ")}`);
  }

  console.log(`\n✅ Extract pipeline works.`);
}

main().catch((e) => {
  console.error("❌ Smoke failed:", e);
  process.exit(1);
});
