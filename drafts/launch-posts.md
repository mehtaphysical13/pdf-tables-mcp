# Launch posts — ready to submit

All link back to the canonical post: https://pdf-tables-mcp.vercel.app/blog

Submit from your accounts. I left the tone authentic-first-person to match your voice; tweak as needed.

---

## 1. Hacker News (Show HN)

**URL:** https://news.ycombinator.com/submit

**Title (one of these, A/B candidates):**
- `Show HN: pdf-tables-mcp – Reliable PDF tables for AI agents`
- `Show HN: I built an MCP server that actually extracts PDF tables reliably`
- `Show HN: PDF table extraction for AI agents, as an MCP tool`

**URL field:** `https://pdf-tables-mcp.vercel.app/blog`

**Text (only if you click "no URL", otherwise leave blank):** Skip — HN prefers URL submissions for "Show HN".

**Comment to drop in the thread within 5 minutes** (HN convention):

```
Author here.

Quick context: I kept watching Claude/Cursor confidently extract "tables" from PDFs and miss half the rows or hallucinate values, so I built this. It's a remote MCP server (Streamable HTTP, in the official MCP registry) that hands the PDF to Claude Sonnet 4.5 vision directly — no pdfplumber/camelot heuristics, no PDF→image preprocessing — and returns a flat {row, col, value, type, page} schema.

On a 15-page arxiv paper that has 9 tables: pdfplumber heuristic found 4 (all partial), Claude Haiku 4.5 found 0, Claude Sonnet 4.5 found all 9 at 0.95-0.98 confidence. Real numbers and a couple of unit-economics lessons in the post.

Free tier is 50 pages/month, no card. I'm trying to figure out whether developers will actually pay for agent-callable tools — this is the first revenue experiment, so I'm happy to talk shop on pricing too.

Endpoint: https://pdf-tables-mcp.vercel.app/api/mcp
Source (MIT): https://github.com/mehtaphysical13/pdf-tables-mcp
```

---

## 2. Reddit r/programming

**URL:** https://www.reddit.com/r/programming/submit

**Title:** `Why agents fail at PDF tables — and what I built to fix it (open-source, MIT)`

**Link:** `https://pdf-tables-mcp.vercel.app/blog`

**Subreddit alternates if r/programming rejects link posts:**
- `r/LocalLLaMA` (good for MCP/agent crowd)
- `r/ClaudeAI`
- `r/AIAgents`
- `r/SideProject`

---

## 3. Reddit r/LocalLLaMA

**Title:** `[Tool] Free MCP server for reliable PDF table extraction (50 pages/mo free, Claude Sonnet 4.5 vision)`

**Body** (LocalLLaMA prefers self-posts over link posts):

```
TL;DR: built an MCP server that gives AI agents reliable PDF table extraction. Free 50 pages/month, no card. https://pdf-tables-mcp.vercel.app

The motivation: agents that try to extract tables via pdfplumber/camelot/text-extraction libraries silently drop rows, miss multi-page tables, and confidently report partial output. Vision works much better but most coding agents don't use it for PDFs.

This tool sends the PDF directly to Claude Sonnet 4.5 (no text-extract preprocessing) and returns a strict {row, col, value, type, page} schema with confidence scores. Drops into Claude Desktop / Cursor / Cline / any MCP client.

Benchmarks on a 15-page arxiv paper with 9 tables:
- pdfplumber heuristic: 4 partial
- Claude Haiku 4.5 vision: 0
- Claude Sonnet 4.5 vision: 9 at 0.95-0.98 confidence

Source (MIT): https://github.com/mehtaphysical13/pdf-tables-mcp
Full write-up: https://pdf-tables-mcp.vercel.app/blog

Happy to take feedback on the schema, the pricing, or which other "boring data" tools should exist as MCPs next.
```

---

## 4. Reddit r/ClaudeAI

**Title:** `Built an MCP server for PDF table extraction — works great in Claude Desktop`

**Body:**

```
For anyone who's tried to ask Claude to "extract tables from this PDF" and gotten partial/hallucinated rows back: I built an MCP server that fixes it.

It hands the PDF directly to Claude Sonnet 4.5 vision (via Anthropic's native PDF document support) and returns clean structured JSON with cell-level page citations and confidence scores.

Drop-in config for Claude Desktop:

{
  "mcpServers": {
    "pdf-tables": {
      "url": "https://pdf-tables-mcp.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer pdt_live_<your_key>" }
    }
  }
}

Free tier: 50 pages/month at https://pdf-tables-mcp.vercel.app. Source on GitHub (MIT).

Curious whether this is useful for your workflow or if I'm solving a problem you don't have.
```

---

## 5. dev.to

**URL:** https://dev.to/new

**Title:** `Why AI agents fail at PDF tables (and the MCP I built to fix it)`

**Tags:** `ai`, `mcp`, `claude`, `pdf`, `agents`, `webdev`

**Canonical URL:** `https://pdf-tables-mcp.vercel.app/blog`

**Body:** Paste the markdown of the blog post directly. Set "Canonical URL" to the blog URL so SEO favors our domain. Toggle "Show on Listing" → on.

Or — even simpler — just publish a teaser:

```
Wrote up the reasoning + benchmarks for an MCP server I built to give AI agents reliable PDF table extraction.

Quick benchmarks on a 15-page arxiv paper (9 tables):
- pdfplumber heuristic: 4 partial
- Claude Haiku 4.5 vision: 0
- Claude Sonnet 4.5 vision: 9 at 0.95-0.98 confidence

Full write-up + free tier at https://pdf-tables-mcp.vercel.app/blog

Source (MIT): https://github.com/mehtaphysical13/pdf-tables-mcp
```

---

## 6. Lobsters (smaller, but devs trust it)

**URL:** https://lobste.rs/stories/new

**Title:** `pdf-tables-mcp — Reliable PDF table extraction for AI agents`

**URL:** `https://pdf-tables-mcp.vercel.app/blog`

**Tags:** `programming`, `ai`, `release` (or `show` if you have submission credit)

---

## 7. Twitter / X (single thread)

```
1/ Why AI agents fail at extracting tables from PDFs:

PDFs have no "table" object — just glyphs at coordinates. pdfplumber/camelot/tabula infer tables from spacing. They're wrong silently.

Built a fix: pdf-tables-mcp. Free 50 pages/mo.

https://pdf-tables-mcp.vercel.app

2/ Real benchmark on a 15-page arxiv paper that has 9 tables:

- pdfplumber: 4 partial
- Claude Haiku 4.5 vision: 0
- Claude Sonnet 4.5 vision: 9 at 0.95-0.98 confidence

The cheap-LLM-vision intuition is wrong. Haiku is useless here.

3/ Architecture: it's an MCP server. Drop it in Claude Desktop / Cursor / Cline:

{
  "mcpServers": {
    "pdf-tables": {
      "url": "https://pdf-tables-mcp.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer pdt_live_..." }
    }
  }
}

Listed in the official MCP registry.

4/ Five days of building, captured a few lessons:

- Structured-output schemas need to be portable across LLMs (Haiku/Sonnet handled nested arrays differently)
- Per-call pricing inverts unit economics on LLM tools — switched to per-page
- The page-filter arg doesn't save LLM cost without server-side slicing

5/ Source: https://github.com/mehtaphysical13/pdf-tables-mcp
Write-up: https://pdf-tables-mcp.vercel.app/blog

Trying to figure out whether agent-callable tools can sustain revenue at all. This is the first experiment.
```

---

## 8. LinkedIn (B2B audience)

Shorter, professional tone:

```
Wrote about a problem I kept hitting with AI agents and PDFs:

When you ask Claude or Cursor to "extract the tables from this filing," they confidently return partial data and sometimes hallucinate rows. The root cause: most coding agents process PDFs through text-extraction libraries (pdfplumber, tabula, camelot) that infer tables from glyph positions — a heuristic that breaks on multi-page tables, merged cells, and modern layouts.

Built pdf-tables-mcp to fix it: a Model Context Protocol server that hands the PDF directly to Claude Sonnet 4.5 vision and returns a strict structured JSON schema with cell-level page citations.

Benchmark on a 15-page arxiv paper with 9 tables:
- pdfplumber: 4 partial
- Claude Sonnet 4.5: 9 at 0.95-0.98 confidence

Free tier (50 pages/month), MIT licensed, drops into Claude Desktop / Cursor / any MCP client.

https://pdf-tables-mcp.vercel.app
```

---

## Suggested submission order (day 1)

1. dev.to first (lowest controversy, indexable, gives backlink)
2. r/LocalLLaMA (~20 min after, your warmest audience)
3. r/ClaudeAI (same)
4. HN (peak hours: weekday 8-10am PT for largest US audience)
5. Twitter thread (after HN gains some traction or independently if HN doesn't land)
6. r/programming (only if other Reddits land — r/programming hates self-promotion)
7. LinkedIn (any time)
8. Lobsters (if you have invite credit)

Pace submissions across a 24-hour window. If HN/Reddit lands, the traffic spike gets cached by Vercel automatically (Hobby plan or Pro both fine for static landing/blog).
