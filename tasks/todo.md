# pdf-tables-mcp — Build Plan (Tool #2 / Revenue Experiment)

## Mission
60-day revenue test. Hypothesis: **a single agent-callable tool, priced from call #1 and distributed only through organic AEO channels, can generate ≥$1,000 MRR in 60 days with <$700 cash and ~80 hrs of work.**

Success: ≥100 signups, ≥10 paid, ≥$500 MRR. Kill if <3 paid at day 60 or LTV/CAC inverted.

## Strategy
- **Single tool surface**: `extract_pdf_tables` (URL → JSON tables w/ citations)
- **LLM backend**: Claude vision (Anthropic API) — high quality, predictable cost (~$0.005-0.04/call)
- **Pricing**: Free 50/mo · Hobby $19/500 · Pro $99/5K · Business $499/50K · Enterprise custom
- **Auth**: API key in header (no login flow v1; key emailed on signup, Stripe portal for billing mgmt)
- **Distribution**: organic only — registries, npm/PyPI, OpenAPI, blog, SO, awesome lists

## Phase 0 — Scaffold (Day 1)
- [ ] Repo `mehtaphysical13/pdf-tables-mcp` (public), Vercel project, GitHub-Vercel auto-deploy
- [ ] Copy Factory primitives from fedreg-mcp: logger, http, cache, telemetry shape
- [ ] Hello-world `/api/health` deployed green
- [ ] Postgres provisioned (Neon, fresh project — do NOT reuse claudecast's DB)
- [ ] Anthropic + Resend keys copied from existing projects
- [ ] Stripe account: products + prices + webhook (created via API; bank-account link is the one user-touch)

## Phase 1 — Data layer + core extraction (Day 2-3)
- [ ] `src/lib/llm.ts` — Anthropic client with structured-output JSON schema
- [ ] `src/lib/pdf.ts` — download + page split (pdf-lib) + render to images (`pdf-img`)
- [ ] `src/lib/extract.ts` — page-by-page vision call, table aggregation, confidence scoring
- [ ] `src/lib/types.ts` — Table, Cell, ExtractionResult canonical shapes
- [ ] Local fixture set: 20 sample PDFs covering native/scanned/multi-column/forms
- [ ] Cost-per-call instrumentation from day 1

## Phase 2 — Auth + billing (Day 3-4)
- [ ] Postgres schema: users, api_keys, usage_events, subscriptions
- [ ] `POST /api/signup` — email → API key generation → Stripe customer creation → email key
- [ ] `POST /api/upgrade` — Stripe Checkout session
- [ ] `POST /api/webhook/stripe` — subscription lifecycle events
- [ ] `GET /api/me` — usage + plan info (API-key auth)
- [ ] Customer dashboard (`/dashboard`): API key, usage chart, plan, manage-billing link
- [ ] Quota enforcement middleware

## Phase 3 — MCP surface (Day 4)
- [ ] `api/mcp.ts` — Streamable HTTP, API-key auth from header
- [ ] Tool `extract_pdf_tables` with AEO-engineered description
- [ ] Telemetry: usage events written, costs metered to Stripe
- [ ] Errors: rate limit → upgrade hint; auth failure → signup link

## Phase 4 — Landing page (Day 5)
- [ ] Hero w/ side-by-side demo: "agent fails at PDF X → our tool succeeds"
- [ ] Pricing page w/ tier matrix
- [ ] Install snippets (Claude Desktop, Claude Code, Cursor, raw)
- [ ] Sample-PDF gallery (5-10 examples)
- [ ] FAQ + privacy

## Phase 5 — Distribution (Week 2)
- [ ] Anthropic MCP registry PR
- [ ] Smithery / mcp.so / mcphub submissions
- [ ] 3 awesome-mcp GitHub PRs
- [ ] npm `@toolfactory/pdf-tables` + PyPI mirror
- [ ] OpenAPI 3.1 spec at `/api/openapi.json`
- [ ] Blog post: "Why agents fail at PDF tables (with benchmarks)" → HN/Reddit/dev.to
- [ ] 5 Stack Overflow answers
- [ ] 30 personal outreach emails to doc-AI / RAG devs

## Phase 6 — Iterate (Week 3-4)
- [ ] Daily: telemetry scan + 1 fix
- [ ] Weekly: A/B test landing hero copy + pricing
- [ ] Reach top 5 power users personally

## Phase 7 — Scale-or-kill decision (Day 60)
- [ ] Review against success criteria
- [ ] If success: double down on highest-converting channel + enterprise outreach
- [ ] If miss: extract learnings to Factory pricing playbook, pivot or kill

## Out of scope for v1
- Magic-link / password auth (API key is the only credential)
- SSO / enterprise auth
- Webhooks for delivered extractions (defer to v0.2 unless Pro users ask)
- Multi-language UI
- Custom data sources
