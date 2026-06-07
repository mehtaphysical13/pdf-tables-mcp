# pdf-tables-mcp

**Reliable PDF table extraction as an MCP tool.** Drop into Claude, Cursor, or any MCP-compatible agent and get clean structured JSON tables back from any PDF — with per-cell citations to the source page.

Built by [Tool Factory](https://github.com/mehtaphysical13) — Tool #2.

🚧 **v0.1 scaffold** — tools coming online over the next few days.

## What it does

Agents drop a PDF URL, get back clean structured JSON tables with confidence scores and cell-level citations back to the source page.

Use cases:
- RAG preprocessing: split tables from text-heavy docs
- Agentic data extraction from financial filings, scientific papers, gov reports
- Form-field reading in compliance workflows
- Receipt/invoice line-item parsing

## Pricing

| Tier | Price | Quota (pages/mo) |
|---|---|---|
| Free | $0 | 50 pages |
| Hobby | $19/mo | 250 pages |
| Pro | $99/mo | 2,000 pages |
| Business | $499/mo | 15,000 pages, 99.9% SLA |
| Enterprise | Custom | Unlimited, VPC, SOC 2 path |

Quotas measure pages processed (not calls) — a 3-page PDF counts as 3 against your monthly quota. Keeps pricing fair for users running small and large PDFs alike.

## Install (coming soon)

```jsonc
{
  "mcpServers": {
    "pdf-tables": {
      "url": "https://pdf-tables-mcp.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer pdt_live_YOURKEY"
      }
    }
  }
}
```

## License

MIT
