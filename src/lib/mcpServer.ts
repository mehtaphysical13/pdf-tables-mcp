/**
 * MCP server with a single tool: extract_pdf_tables.
 * Auth happens in the API route (api/mcp.ts); by the time the tool runs,
 * we have a resolved ApiKeyOwner.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { extractPdf, ExtractionError } from "./extract.js";
import { recordUsage, getQuotaForUser, isQuotaExhausted } from "./usage.js";
import { log, shapeOf } from "./logger.js";
import type { ApiKeyOwner } from "./auth.js";

const EXTRACT_TOOL_DESC = `Extract every table from a PDF URL. Returns clean structured JSON tables with cell-level page citations, type tagging (string/number/currency/percent/date), and per-table confidence scores.

Use this when the user wants to:
- "Get the tables out of this filing/report/paper" → url=<their pdf>
- "Pull the line items from this invoice/receipt PDF" → url=<their pdf>
- Pre-process documents for downstream RAG/analysis

Don't use this when:
- The user wants the PDF's body text, not its tables (use a generic text-extraction tool)
- The document is not a PDF (HTML, DOCX, XLSX — different tooling)

Pitfalls: 25 MB / 100-page hard limit per call. Cost scales with page count (~$0.015/page on Sonnet 4.5). Pass 'pages' to extract only a range when you know it. Encrypted PDFs are auto-ignored where possible; if extraction fails you'll get a structured error_code.`;

const EXTRACT_INPUT_SCHEMA = {
  url: z
    .string()
    .url()
    .describe("Absolute http(s) URL pointing directly at a PDF file."),
  pages: z
    .array(z.number().int().min(1))
    .max(100)
    .optional()
    .describe(
      "Optional 1-indexed page numbers to restrict extraction to. Omit for all pages."
    ),
  format: z
    .enum(["json", "markdown", "csv"])
    .optional()
    .describe(
      'Output format. "json" (default) returns the structured ExtractionResult; "markdown" returns rendered tables; "csv" returns one csv blob per table.'
    ),
  model: z
    .enum(["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5"])
    .optional()
    .describe(
      'LLM model. Default "claude-sonnet-4-5" is the quality floor. Use "claude-opus-4-5" for the hardest cases (~5× cost).'
    ),
  confidence_threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe(
      "Tables below this confidence get a warning in `warnings[]`. Default 0.7."
    ),
};

export function buildMcpServer(owner: ApiKeyOwner): McpServer {
  const server = new McpServer({
    name: "pdf-tables-mcp",
    version: "0.1.0",
  });

  server.registerTool(
    "extract_pdf_tables",
    {
      title: "Extract tables from a PDF URL",
      description: EXTRACT_TOOL_DESC,
      inputSchema: EXTRACT_INPUT_SCHEMA,
    },
    (async (args: {
      url: string;
      pages?: number[];
      format?: "json" | "markdown" | "csv";
      model?: string;
      confidence_threshold?: number;
    }) => {
      const correlationId = `extract-${Math.random().toString(36).slice(2, 10)}`;
      const start = Date.now();

      // Quota preflight.
      const quota = await getQuotaForUser(owner.user_id, owner.plan);
      if (isQuotaExhausted(quota)) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Quota exhausted: ${quota.pagesUsed}/${quota.quotaPages} pages used on the ${quota.plan} plan. Resets ${quota.resetsAt.slice(0, 10)}.\n\nHint: upgrade at https://pdf-tables-mcp.vercel.app/pricing or wait until next month.`,
            },
          ],
        };
      }

      try {
        const result = await extractPdf({
          url: args.url,
          pages: args.pages,
          model: args.model,
          confidenceThreshold: args.confidence_threshold,
          correlationId,
        });

        const pagesProcessed = result.stats.pages_processed;
        // Soft cap: if this call alone would exceed remaining quota, still
        // return data (since LLM was already called) but warn.
        const overrun = pagesProcessed - quota.pagesRemaining;
        if (overrun > 0) {
          result.warnings = [
            ...(result.warnings ?? []),
            `This call used ${pagesProcessed} pages but you had ${quota.pagesRemaining} remaining. ${overrun} pages of overrun this cycle; consider upgrading.`,
          ];
        }

        await recordUsage({
          apiKeyId: owner.api_key_id,
          userId: owner.user_id,
          tool: "extract_pdf_tables",
          status: "ok",
          pagesProcessed,
          costMicroUsd: result.stats.cost_micro_usd,
          latencyMs: result.stats.latency_ms,
        });
        log.toolCall({
          tool: "extract_pdf_tables",
          argsShape: shapeOf(args),
          status: "ok",
          latencyMs: Date.now() - start,
          correlationId,
        });

        const formatted = formatResult(result, args.format ?? "json");
        return {
          content: [{ type: "text" as const, text: formatted }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (e) {
        const code =
          e instanceof ExtractionError ? e.code : "internal_error";
        const message = e instanceof Error ? e.message : String(e);
        await recordUsage({
          apiKeyId: owner.api_key_id,
          userId: owner.user_id,
          tool: "extract_pdf_tables",
          status: "error",
          pagesProcessed: 0,
          costMicroUsd: 0,
          latencyMs: Date.now() - start,
          errorCode: code,
        });
        log.toolCall({
          tool: "extract_pdf_tables",
          argsShape: shapeOf(args),
          status: "error",
          latencyMs: Date.now() - start,
          error: message,
          correlationId,
        });
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Extraction failed (${code}): ${message}`,
            },
          ],
        };
      }
    }) as never
  );

  return server;
}

function formatResult(
  result: import("./types.js").ExtractionResult,
  format: "json" | "markdown" | "csv"
): string {
  if (format === "json") return JSON.stringify(result, null, 2);
  if (format === "csv") {
    return result.tables
      .map((t) => {
        const rows = [
          t.headers.join(","),
          ...t.cells.map((row) =>
            row.map((c) => csvEscape(c.value)).join(",")
          ),
        ];
        return `# ${t.id}${t.title ? ` — ${t.title}` : ""}\n${rows.join("\n")}`;
      })
      .join("\n\n");
  }
  // markdown
  return result.tables
    .map((t) => {
      const head = `| ${t.headers.join(" | ")} |`;
      const sep = `| ${t.headers.map(() => "---").join(" | ")} |`;
      const body = t.cells
        .map((row) => `| ${row.map((c) => c.value.replace(/\|/g, "\\|")).join(" | ")} |`)
        .join("\n");
      return `### ${t.id}${t.title ? ` — ${t.title}` : ""}\n\n${head}\n${sep}\n${body}\n`;
    })
    .join("\n");
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}
