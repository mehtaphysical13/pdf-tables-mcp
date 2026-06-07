# Lessons learned — pdf-tables-mcp

Captured per the user's global instructions — patterns to prevent repeating mistakes.

## Day 1-2 findings

### Vercel marketplace auto-provisions Neon without user touch
- `vercel integration add neon` provisioned a fresh Postgres in 2s with all env vars pre-wired.
- No need to manually create Neon project / paste DATABASE_URL.
- Same flow works for Upstash, Sanity, etc. — keep in mind for future tools.

### Don't reuse another project's database
- Per global rule. Each project gets a fresh Neon project even though we could technically point at claudecast's DB.
- Vercel marketplace makes the fresh-project path trivial.

### Structured-output schemas need to be cross-model-portable
- Same schema worked perfectly with Sonnet 4.5, returned malformed shape on Haiku 4.5 (treated nested `rows: array<array<cell>>` as flat).
- **Lesson: flat lists with explicit (row, col) indices > nested 2D arrays.** More mechanical → more reliably honored across providers.
- The flat-cell schema (`cells: array<{row, col, value, type, page}>`) is the right default for any tabular-data structured output.

### Haiku 4.5 is too weak for vision tables
- Haiku 4.5: 41s latency, $0.065 for a 15-page arxiv PDF, **0 tables found** (paper has 9 tables).
- Sonnet 4.5: 88s latency, $0.22 for the same PDF, **9 tables found** at 0.95-0.98 confidence.
- Cost-vs-quality tradeoff is real — Haiku is 4× cheaper but useless for our use case.
- Future: hybrid pipeline (Haiku → Sonnet escalation on `tables=[] || confidence<0.7`). Defer to Phase 6.

### Per-call pricing inverts unit economics on Sonnet rates
- Sonnet costs ~$0.015/page → typical 3-page PDF = $0.045 cost.
- At $0.10/call retail (planned overage): 55% margin on a 3-page PDF; NEGATIVE margin on 7+ page PDFs.
- **Lesson: when LLM cost dominates, price per-page not per-call.**
- Updated PLAN_QUOTA from {hobby: 500 calls} to {hobby: 250 pages} → keeps margin positive at ~70-80%.

### Vercel timeout will matter
- 88s extraction latency on Sonnet for a 15-page PDF exceeds Vercel Hobby free limit (10-60s).
- Need Vercel Pro ($20/mo) for 300s timeouts, OR implement async extraction (job queue, polling).
- For v1: Vercel Pro is cheaper than building async infrastructure.
- Page cap (MAX_PAGES = 100) is generous; consider lowering to 30 to stay safer on cost + latency.
