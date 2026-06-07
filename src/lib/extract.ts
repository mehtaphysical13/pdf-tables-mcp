/**
 * End-to-end extraction pipeline. Composes PDF fetch, LLM call, and
 * normalization into the canonical ExtractionResult shape.
 */

import { fetchPdf, PdfFetchError } from "./pdf.js";
import { extractTablesFromPdf, type LlmRawTables } from "./llm.js";
import type { ExtractedTable, ExtractionResult } from "./types.js";
import { log } from "./logger.js";

export interface ExtractOptions {
  url: string;
  pages?: number[];
  model?: string;
  confidenceThreshold?: number;
  correlationId?: string;
}

export class ExtractionError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function extractPdf(
  opts: ExtractOptions
): Promise<ExtractionResult> {
  const start = Date.now();
  // 1. Fetch + sniff the PDF
  let pdf;
  try {
    pdf = await fetchPdf(opts.url, opts.correlationId);
  } catch (e) {
    if (e instanceof PdfFetchError) {
      throw new ExtractionError(e.code, e.message);
    }
    throw e;
  }

  // 2. Run LLM extraction
  const { data, stats } = await extractTablesFromPdf({
    pdfBuffer: pdf.buffer,
    pages: opts.pages,
    model: opts.model,
    confidenceThreshold: opts.confidenceThreshold,
  });

  // 3. Normalize to canonical shape
  // Defensive: structured-output tool may return an object without `tables`
  // when there are none. Default to []; warn if unexpected shape.
  if (!Array.isArray(data.tables)) {
    log.warn("llm returned no tables field", {
      keys: Object.keys((data ?? {}) as object),
    });
  }
  const tables = (data.tables ?? []).map((t) => normalizeTable(t));

  const warnings: string[] = [];
  const threshold = opts.confidenceThreshold ?? 0.7;
  const lowConfidence = tables.filter((t) => t.confidence < threshold);
  if (lowConfidence.length > 0) {
    warnings.push(
      `${lowConfidence.length} of ${tables.length} table(s) had confidence below ${threshold}. Consider re-running with model="claude-opus-4-5" for higher fidelity.`
    );
  }
  if (data.page_count !== pdf.pageCount) {
    warnings.push(
      `Model reported ${data.page_count} pages; PDF has ${pdf.pageCount}. Using actual page count.`
    );
  }

  // Bill the FULL page count, even when `pages` filter is set — Claude
  // still sees the whole PDF and charges us per page of vision. Until we
  // build a real page-slicing pre-step (v2), the user pays for what we
  // actually pay. Note this in the README and add a warning when the
  // filter is narrower than the document so users aren't surprised.
  const pagesBilled = pdf.pageCount;
  if (opts.pages && opts.pages.length < pdf.pageCount) {
    warnings.push(
      `pages filter requested ${opts.pages.length} page(s) but the PDF has ${pdf.pageCount} pages — your quota was charged ${pdf.pageCount} pages because the LLM sees the whole document. v2 will slice the PDF first to save cost on page-filtered calls.`
    );
  }

  const result: ExtractionResult = {
    source: opts.url,
    page_count: pdf.pageCount,
    tables,
    stats: {
      pages_processed: pagesBilled,
      latency_ms: Date.now() - start,
      cost_micro_usd: stats.costMicroUsd,
      model: stats.model,
    },
    warnings: warnings.length ? warnings : undefined,
  };

  log.info("extraction complete", {
    pages: result.stats.pages_processed,
    tables: tables.length,
    cost_micro_usd: stats.costMicroUsd,
    latency_ms: result.stats.latency_ms,
  });

  return result;
}

function normalizeTable(t: LlmRawTables["tables"][number]): ExtractedTable {
  // Bucket cells into a 2D grid by (row, col).
  const grid: ExtractedTable["cells"] = [];
  const flatCells = t.cells ?? [];
  for (const c of flatCells) {
    if (!grid[c.row]) grid[c.row] = [];
    grid[c.row][c.col] = {
      row: c.row,
      col: c.col,
      value: c.value,
      type: normalizeType(c.type),
      page: c.page,
    };
  }
  // Fill any holes with null cells so columns align.
  const cols = t.headers.length;
  for (let r = 0; r < grid.length; r++) {
    if (!grid[r]) grid[r] = [];
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c]) {
        grid[r][c] = {
          row: r,
          col: c,
          value: "",
          type: "null",
          page: t.pages[0] ?? 1,
        };
      }
    }
  }
  const headerRows = t.header_rows ?? 1;
  return {
    id: t.id,
    title: t.title,
    pages: t.pages,
    header_rows: headerRows,
    rows: grid.length + headerRows,
    cols,
    headers: t.headers,
    cells: grid,
    confidence: t.confidence,
    notes: t.notes?.length ? t.notes : undefined,
  };
}

function normalizeType(t: string): ExtractedTable["cells"][number][number]["type"] {
  switch (t) {
    case "string":
    case "number":
    case "currency":
    case "percent":
    case "date":
    case "boolean":
    case "null":
      return t;
    default:
      return "string";
  }
}
