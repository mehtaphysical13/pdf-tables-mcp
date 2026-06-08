# Installing pdf-tables-mcp

This document tells an AI agent how to install pdf-tables-mcp into the calling host (Claude Desktop, Cline, Cursor, etc.).

## Step 1 — Get a free API key

Hit the public signup endpoint with the user's email:

```bash
curl -s -X POST https://pdf-tables-mcp.vercel.app/api/signup \
  -H "content-type: application/json" \
  -d '{"email": "<USER_EMAIL>"}'
```

Response shape:

```json
{
  "ok": true,
  "api_key": "pdt_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "plan": "free",
  "dashboard_url": "https://pdf-tables-mcp.vercel.app/dashboard#pdt_live_..."
}
```

The user's `api_key` is in the response. The same key is also emailed to them.

Plan defaults to **Free** (50 pages/month, no card required). Upgrade tiers Hobby $19 / Pro $99 / Business $499 are available from the dashboard.

## Step 2 — Register the MCP server in the host

It's an HTTP-transport (Streamable HTTP) remote MCP server. Use the host's standard "remote MCP" registration. Endpoint and auth:

- **URL:** `https://pdf-tables-mcp.vercel.app/api/mcp`
- **Auth:** `Authorization: Bearer pdt_live_<the api_key from step 1>`

### Claude Desktop / Claude Code (`claude_desktop_config.json`)

```jsonc
{
  "mcpServers": {
    "pdf-tables": {
      "url": "https://pdf-tables-mcp.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer pdt_live_<api_key>"
      }
    }
  }
}
```

### Claude Code (one-shot CLI)

```bash
claude mcp add --transport http pdf-tables \
  https://pdf-tables-mcp.vercel.app/api/mcp \
  --header "Authorization: Bearer pdt_live_<api_key>"
```

### Cursor (`~/.cursor/mcp.json`)

```jsonc
{
  "mcpServers": {
    "pdf-tables": {
      "url": "https://pdf-tables-mcp.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer pdt_live_<api_key>"
      }
    }
  }
}
```

### Cline (auto-install via this file)

Cline reads this `llms-install.md` and performs the registration automatically when the user requests "install pdf-tables-mcp." The config block to write is the same JSON shown above (Cline's `cline_mcp_settings.json` format).

## Step 3 — Verify

Ask the agent to call `tools/list`. It should report a single tool:

- `extract_pdf_tables(url, pages?, format?, model?, confidence_threshold?)`

Smoke test (works on the Free plan, ~$0 of quota):

> "Use pdf-tables to extract the tables from https://arxiv.org/pdf/2406.04692v1.pdf — page 5 only."

Expected: 1-2 tables returned with cells, headers, page citations.

## Tool surface

| Field | Description |
|---|---|
| `url` (required) | Absolute http(s) URL to a PDF, ≤25 MB, ≤100 pages. |
| `pages` | Optional 1-indexed page numbers to focus on. (Note: LLM still sees full PDF in v1; cost is per actual PDF page.) |
| `format` | `"json"` (default), `"markdown"`, or `"csv"`. |
| `model` | `"claude-sonnet-4-5"` (default — recommended), `"claude-haiku-4-5"` (4× cheaper but loses table-detection accuracy), `"claude-opus-4-5"` (highest fidelity). |
| `confidence_threshold` | 0..1, default 0.7. Tables below threshold get a warning. |

## Quota and errors

Free tier: 50 pages/month. Resets the 1st of each month UTC. Going over returns an explicit `Quota exhausted` error with a hint to upgrade — the agent can surface that to the user directly.

Errors come back with structured codes:
- `invalid_url`, `not_a_pdf`, `too_large`, `too_many_pages`, `parse_error`, `quota_exhausted`, `internal_error`.

## Source / support

- Source: https://github.com/mehtaphysical13/pdf-tables-mcp
- Dashboard: https://pdf-tables-mcp.vercel.app/dashboard
- License: MIT
