# Outreach email drafts — staged for review-before-send

Goal: 30 cold emails to developers building doc-AI / RAG / agent products who'd be natural early users. **Send from `team@pdftables.dev` via Resend.**

Sender identity: Tool Factory (with your name in the signature). Recipients haven't opted in — keep emails short, lead with relevance, single CTA, easy unsubscribe.

## Target list — how to source

Three sources, in order of conversion likelihood:

1. **GitHub authors of doc-AI / RAG projects** with ≥50 stars in the last 6 months. Search: `topic:pdf-extraction created:>2025-12-01`, `topic:rag created:>2025-12-01 stars:>50`, `topic:document-ai created:>2025-12-01`. Pull author email from their GitHub profile or their repo's `package.json`/`pyproject.toml` author field.

2. **LinkedIn search** for "doc AI engineer", "RAG engineer", "AI engineer + PDF" in companies <500 people. Their email is usually `first@company.com` or findable on Apollo/Hunter.

3. **HN/Reddit/Twitter** authors who've recently posted about PDF extraction pain points. Search HN Algolia for `pdf table extraction`, sort by date.

I'll generate the target list in `/admin/outreach` once you give me a yes on the template. For now, here are the email variants — copy ready, A/B-able.

---

## Variant A — Direct "I built this for you" cold open

**Subject:** PDF table extraction that doesn't drop rows

**Body:**

```
Hi {first_name},

I noticed {project_name} relies on PDF extraction (saw your README mentions tables / saw your tweet about pdfplumber). I built an MCP server / REST endpoint that solves the "tables in PDFs come out wrong" problem by handing the doc to Claude Sonnet 4.5 vision instead of using heuristic libraries.

Real numbers on a 15-page arxiv paper with 9 tables:
- pdfplumber: 4 partial
- Claude Sonnet 4.5 vision: 9 at 0.95-0.98 confidence

Free tier is 50 pages/month — happy to send a key directly if you'd rather skip the signup.

https://pdf-tables-mcp.vercel.app

Send me your worst PDF; I'll run it through and email the JSON back.

— Nick (Tool Factory)
{unsubscribe_link}
```

---

## Variant B — Question-first opener (higher reply rate)

**Subject:** How are you handling PDF tables in {project_name}?

**Body:**

```
Hi {first_name},

Curious — how are you handling PDF table extraction in {project_name} today? I've been digging into this and the state of pdfplumber/camelot is bleak: silent row drops on multi-page tables, brittle column inference, no path for scanned docs.

I built an MCP server / REST endpoint that does vision-based extraction (Claude Sonnet 4.5) with a strict `{row, col, value, type, page}` schema and per-table confidence scores. Wrote up benchmarks here: https://pdf-tables-mcp.vercel.app/blog

If it's relevant, free tier is 50 pages/month. If it's not, I'd be interested to hear how you're solving it — I'm building the next few "boring data" MCPs and want to know where the gaps are.

— Nick (Tool Factory)
{unsubscribe_link}
```

---

## Variant C — Authority-anchor opener (for senior eng / staff+)

**Subject:** A note on PDF table extraction (and a 5-line install if you want it)

**Body:**

```
Hi {first_name},

Came across {project_name} — nice work. One quick note since you're shipping doc-AI tooling: if you ever hit the "tables come out wrong" failure mode, the answer is almost always vision over a text-extraction library. The trick is the schema — flat `{row, col, value}` cells, not nested 2D arrays, and per-table confidence scores so the agent knows when to fall back.

I shipped an MCP server / REST endpoint that does this end-to-end, MIT licensed: https://pdf-tables-mcp.vercel.app. Five-line install for Claude Desktop. Free tier 50 pages/month.

Reply with a PDF and I'll run it through, send you the JSON. No pitch — just want to know whether the output schema is something you'd actually plug into RAG.

— Nick (Tool Factory)
{unsubscribe_link}
```

---

## Compliance / hygiene

- Resend sender: `team@pdftables.dev`. Reply-to: `nick@<your-domain>` so replies route to you, not back into Resend.
- Always include `{unsubscribe_link}` — required by CAN-SPAM. Resend auto-injects if you set the `List-Unsubscribe` header. I'll wire that in the send script.
- One email per recipient. No follow-ups in this experiment — too noisy as a learning signal.
- Send pace: 10/day max, spread across 3 days. Resend free tier is 100/day, but bulk-sending spikes spam filters.

## What I'd build to automate this

A simple `/admin/outreach` page in our dashboard:
- Paste a CSV: `email, first_name, project_name, variant`
- Preview rendered email per row
- "Send" button that hits Resend, logs send time + status in our DB
- Reply tracking via Resend's webhooks → `outreach_replies` table

~3 hours of work; can do in a follow-up if you want it.

## What I won't do without your okay

- Actually send the emails (need your sign-off on the target list + the variant choice)
- Scrape contact info (need consent for the methodology)
- Anything that violates CAN-SPAM (clear sender, unsubscribe, no deception)
