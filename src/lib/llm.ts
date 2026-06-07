/**
 * Anthropic Claude client wrapper.
 *
 * We use Claude's native PDF document support: send the PDF base64 directly
 * in the messages API, skip the PDF→image pipeline entirely. Claude handles
 * page rendering internally.
 *
 * Model choice rationale:
 *  - Sonnet 4.5: best vision-table extraction quality, ~$3/M input.
 *  - Haiku 4.5: faster/cheaper but more misses on complex tables.
 * Default to Sonnet; expose `model` arg if power users want to override.
 */

import Anthropic from "@anthropic-ai/sdk";
import { log } from "./logger.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  client = new Anthropic({ apiKey });
  return client;
}

/**
 * Default model. Sonnet 4.5 is the quality floor — Haiku 4.5 missed
 * 9 of 9 tables in our smoke test on a typical arxiv PDF. Sonnet costs
 * ~$0.015/page; pricing is per-page to keep margin positive.
 * Future: hybrid pipeline that tries Haiku first, escalates to Sonnet if
 * tables=[] or confidence < 0.7. Defer to Phase 6 iteration.
 */
export const DEFAULT_MODEL = "claude-sonnet-4-5";
export const FAST_MODEL = "claude-haiku-4-5";

export interface PdfExtractInput {
  /** Raw PDF bytes. */
  pdfBuffer: Buffer;
  /** Restrict extraction to these pages (1-indexed). Undefined = all pages. */
  pages?: number[];
  /** Model override. */
  model?: string;
  /** Lower bound on confidence; cells below this get a warning. */
  confidenceThreshold?: number;
}

export interface LlmResponseStats {
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costMicroUsd: number;
  model: string;
}

const STRUCTURED_OUTPUT_TOOL = {
  name: "report_extracted_tables",
  description:
    "Report all tables found in the provided PDF. Skip non-tabular content (paragraphs, headings, figures). Return an empty list if no tables exist.",
  input_schema: {
    type: "object" as const,
    properties: {
      page_count: {
        type: "integer",
        description:
          "Total number of pages in the source PDF (regardless of pages_filter).",
      },
      tables: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description:
                'Sequential id like "t1", "t2", "t3", in order of first appearance.',
            },
            title: {
              type: "string",
              description:
                "Caption or heading immediately above/below the table, if any.",
            },
            pages: {
              type: "array",
              items: { type: "integer" },
              description:
                "Page numbers the table appears on (1-indexed). Multi-page tables list each page.",
            },
            header_rows: {
              type: "integer",
              description:
                "Number of rows that are headers. Most tables have 1; complex tables can have 2+.",
            },
            headers: {
              type: "array",
              items: { type: "string" },
              description:
                "Column headers as a flat list. For multi-row headers, concatenate with ' / '.",
            },
            cells: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  row: {
                    type: "integer",
                    description:
                      "Row index (0-based, excluding header rows).",
                  },
                  col: {
                    type: "integer",
                    description: "Column index (0-based).",
                  },
                  value: { type: "string" },
                  type: {
                    type: "string",
                    enum: [
                      "string",
                      "number",
                      "currency",
                      "percent",
                      "date",
                      "boolean",
                      "null",
                    ],
                  },
                  page: { type: "integer" },
                },
                required: ["row", "col", "value", "type", "page"],
                additionalProperties: false,
              },
              description:
                "All data cells (excluding header cells). Flat list keyed by (row, col).",
            },
            row_count: {
              type: "integer",
              description:
                "Total number of data rows (excluding headers).",
            },
            confidence: {
              type: "number",
              description:
                "0..1 confidence that the table is accurately represented.",
            },
            notes: {
              type: "array",
              items: { type: "string" },
              description:
                "Optional caveats: merged cells, spanning headers, low-confidence rows, etc.",
            },
          },
          required: [
            "id",
            "pages",
            "header_rows",
            "headers",
            "cells",
            "row_count",
            "confidence",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["page_count", "tables"],
    additionalProperties: false,
  },
};

const SYSTEM_PROMPT = `You are a precise PDF table extraction engine. Your job: identify every tabular structure in the PDF the user uploads and report it via the report_extracted_tables tool. Do not narrate. Do not explain. Just call the tool.

Rules:
- Tables are 2D grids of related data. Lists, key-value blocks, and form fields are NOT tables (skip them).
- Preserve original cell values exactly. Don't round numbers, don't normalize units, don't translate.
- For currency cells, include the symbol (e.g. "$1,234.56", "€500"). Mark type as "currency".
- For percentages, include the % sign. Mark type as "percent".
- For dates, preserve the original format. Mark type as "date".
- Empty cells: value="", type="null".
- If a single table spans multiple pages, report it ONCE with all pages listed in 'pages'.
- Confidence: 1.0 = perfectly clean rendering, 0.9 = minor uncertainty, 0.7 = some cells ambiguous, <0.5 = major reconstruction guesswork. Be honest.`;

// Pricing reference for cost estimation. Update when Anthropic changes rates.
// Numbers in dollars per million tokens.
const PRICING_USD_PER_M: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
  "claude-opus-4-5": { input: 15, output: 75 },
};

function microUsdFromTokens(model: string, input: number, output: number): number {
  const rates = PRICING_USD_PER_M[model] ?? PRICING_USD_PER_M["claude-sonnet-4-5"];
  const dollars = (input / 1_000_000) * rates.input + (output / 1_000_000) * rates.output;
  return Math.round(dollars * 1_000_000); // micro-USD
}

export interface LlmRawTables {
  page_count: number;
  tables: Array<{
    id: string;
    title?: string;
    pages: number[];
    header_rows: number;
    headers: string[];
    cells: Array<{
      row: number;
      col: number;
      value: string;
      type: string;
      page: number;
    }>;
    row_count: number;
    confidence: number;
    notes?: string[];
  }>;
}

export async function extractTablesFromPdf(
  input: PdfExtractInput
): Promise<{ data: LlmRawTables; stats: LlmResponseStats }> {
  const model = input.model ?? DEFAULT_MODEL;
  const start = Date.now();

  const userText = input.pages
    ? `Extract tables from this PDF. Only consider pages: ${input.pages.join(", ")}. Ignore content on other pages but still report the total page_count.`
    : `Extract every table from this PDF. Report total page_count.`;

  try {
    const res = await getClient().messages.create({
      model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [STRUCTURED_OUTPUT_TOOL],
      tool_choice: { type: "tool", name: STRUCTURED_OUTPUT_TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: input.pdfBuffer.toString("base64"),
              },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    });

    const toolUse = res.content.find(
      (c): c is Extract<typeof c, { type: "tool_use" }> => c.type === "tool_use"
    );
    if (!toolUse) {
      throw new Error(
        "LLM returned no tool_use block — extraction format violation"
      );
    }

    const inputTokens = res.usage.input_tokens;
    const outputTokens = res.usage.output_tokens;
    const costMicroUsd = microUsdFromTokens(model, inputTokens, outputTokens);
    const latencyMs = Date.now() - start;

    log.outbound({
      source: "anthropic",
      endpoint: "/v1/messages",
      method: "POST",
      paramsShape: { model: "string", pdf_bytes: "number" },
      status: 200,
      latencyMs,
    });

    return {
      data: toolUse.input as LlmRawTables,
      stats: {
        latencyMs,
        inputTokens,
        outputTokens,
        costMicroUsd,
        model,
      },
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    log.outbound({
      source: "anthropic",
      endpoint: "/v1/messages",
      method: "POST",
      paramsShape: { model: "string", pdf_bytes: "number" },
      latencyMs,
      error: msg,
    });
    throw err;
  }
}
