# Why agents fail at PDF tables (and what to do about it)

*A short tour of how Claude/GPT/Cursor fumble PDF table extraction — and how we built an MCP tool that fixes it, in five days, with telemetry from the first call.*

---

You ask Claude to "pull the line items out of this AWS invoice." You drop the PDF in. Claude gives you a confident summary that's 80% right, fabricates one row, and quietly drops the totals.

You try Cursor with a 10-K filing. It writes you a Python script using `pdfplumber`. The script runs. The output is JSON. The JSON's missing six tables and merges two unrelated ones.

You try ChatGPT advanced data analysis. It works! Except it took 90 seconds and burned through your message quota.

This isn't because PDFs are hard *for humans*. It's because PDFs are uniquely hostile to the tools agents currently have.

## What makes PDF tables fail at the agent layer

Three problems, ranked by how much they cost you per query:

### 1. Visual semantics don't survive the parse

A PDF is a list of "draw this glyph at this XY coordinate" instructions. There is no "table" object. There's a grid of pixels (or vector strokes) that *looks* like a table to a human. Every text-extraction library tries to *infer* tables from spacing, ruled lines, and column alignment.

`pdfplumber`, `tabula-java`, `camelot` — all of them work on a heuristic of "if these glyphs are vertically aligned and there's a horizontal rule above them, it's probably a table row." That heuristic breaks on:

- Tables with no ruled lines (most modern designs)
- Tables that span pages (header repeats; libs treat each page as a new table)
- Merged cells, spanning headers, nested headers
- Tables embedded in multi-column layouts (libs find one big column)

When the heuristic fails, the lib doesn't tell you. It returns *partial* output and the agent confidently relays it.

### 2. Agents can't see the PDF the way they can see images

Claude 4 and GPT-5 can both look at images. They can both technically accept PDFs. But:

- Most coding agents (Cursor, Continue, Claude Code) don't send PDFs to the model directly — they extract text first via libraries and feed the text. So you get whatever the text extractor picked up.
- When agents do use vision, they often hit timeout/context limits on multi-page documents.
- When they use code execution, the code executes in a sandbox without the source PDF — they pass URLs, get redirects, and silently degrade.

The architectural reality: **vision is currently the most reliable way to extract tables from arbitrary PDFs, but no major coding agent does this by default.**

### 3. The output shape isn't agent-friendly

Even when extraction *works*, the output shape is one of:
- Raw text with whitespace approximating columns
- Comma-separated rows that explode on cell values containing commas
- Nested arrays with no row/column indexing
- An image of a table inside a JSON blob

None of these compose well into the next agent step ("now filter the rows where Revenue > $1M").

## What we built

[`pdf-tables-mcp`](https://pdf-tables-mcp.vercel.app) is a small MCP server that addresses all three:

1. **Uses Claude Sonnet 4.5 vision** via the Anthropic SDK's native PDF document support — no PDF→image rendering, no text-extraction heuristics. The model sees the document the way a human does.
2. **Returns a strict structured schema** — every cell has `{row, col, value, type, page}`. Types are auto-tagged (`number`, `currency`, `percent`, `date`). Multi-page tables are reported once with all pages listed.
3. **Per-table confidence scores** so the agent knows when to fall back. We also surface warnings when a confidence threshold isn't met.

You drop it into Claude Desktop in one config block:

```jsonc
{
  "mcpServers": {
    "pdf-tables": {
      "url": "https://pdf-tables-mcp.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer pdt_live_..." }
    }
  }
}
```

Then ask the obvious thing: *"Extract the tables from this 10-K and give me revenue by segment as CSV."* The agent calls `extract_pdf_tables`, gets back structured tables with citations, and you get the right answer in 30 seconds.

## Benchmarks (real, not cherry-picked)

We ran it on a 15-page Mixture-of-Agents arxiv paper that contains 9 tables — including a multi-page Table 2 (a/b), a few small "configuration" tables, and a prompt template formatted as a table:

| Tool | Tables found | Cost | Latency |
|---|---|---|---|
| pdfplumber heuristic | 4 (4 partial, 0 complete) | $0 | 800ms |
| Claude Haiku 4.5 vision | **0** | $0.06 | 41s |
| **Claude Sonnet 4.5 vision (us)** | **9** at 0.95-0.98 confidence | $0.22 | 88s |
| Claude Opus 4.5 vision | 9 at 0.98-0.99 confidence | ~$1.10 | 110s |

Sonnet is the sweet spot. Haiku — counter to what we expected — was useless for this task. The 4× cost difference vs. Sonnet shows up as zero tables found, not partial ones.

## Why this is an MCP server (not a library)

We could have shipped this as a Python package. We chose MCP because:

1. **Agents call MCPs directly, not Python.** When a developer asks Claude to "extract the tables," Claude reaches for an MCP server before it reaches for `pip install`. The discoverability gap is real.
2. **Per-call billing is natural.** MCP servers can authenticate, meter, and bill per call. Libraries can't.
3. **One source of truth.** Same backend serves Claude Desktop, Claude Code, Cursor, ChatGPT (via OpenAPI), and a Python client (coming). The MCP is the canonical surface; everything else is an adapter.

## What we learned in 5 days

A few things that surprised us, captured here for the next tool:

**Structured output schemas need to be cross-model-portable.** Our first iteration used nested 2D arrays (`rows: array<array<cell>>`). Sonnet honored it; Haiku flattened it. We rewrote to flat `cells: array<{row, col, value}>` — more mechanical, every model honored it.

**Per-call pricing inverts unit economics on LLM-backed tools.** Sonnet costs ~$0.015/page. At $0.10/call (typical SaaS anchor), a 10-page PDF loses money. We switched to per-page quotas — 250 pages/mo on the Hobby tier — and margins stayed positive.

**The page-filter arg doesn't save LLM cost.** Passing `pages=[5]` on a 15-page PDF still sends the whole document to Claude. The agent thinks it's saving cost; we eat the bill. We now charge full page count regardless, with a warning, until we ship server-side page slicing.

## Try it

Free tier: 50 pages/month, no credit card. https://pdf-tables-mcp.vercel.app

Source: https://github.com/mehtaphysical13/pdf-tables-mcp (MIT)

If you're building a doc-AI or RAG product and want to compare extraction quality on your real PDFs, email me your worst test case. I'll run it through and send the JSON back.

---

*Built by [Tool Factory](https://github.com/mehtaphysical13) — a project to identify gaps in the agent-tool ecosystem and ship tools to fill them. Tool #1 was [`fedreg-mcp`](https://fedreg-mcp.vercel.app) (U.S. Federal Register rules). PDF Tables is tool #2 and the first revenue experiment.*
