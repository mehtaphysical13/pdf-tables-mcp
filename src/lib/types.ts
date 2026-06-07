/**
 * Canonical domain types — what agents see, decoupled from the LLM provider
 * or PDF source. Adding a different extraction backend means writing an
 * adapter to these shapes, not changing the MCP surface.
 */

export interface TableCell {
  row: number;
  col: number;
  /** Cell value as a string. Numbers come through as their textual form. */
  value: string;
  /** Best-guess type for downstream consumers. */
  type: "string" | "number" | "currency" | "percent" | "date" | "boolean" | "null";
  /** Page where this cell appears (1-indexed). */
  page: number;
}

export interface ExtractedTable {
  /** Sequential id within the response (`t1`, `t2`, …). */
  id: string;
  /** Inferred title or caption near the table, if any. */
  title?: string;
  /** Page span the table covers (e.g. multi-page table). */
  pages: number[];
  /** Number of header rows the LLM identified. */
  header_rows: number;
  /** Total rows including headers. */
  rows: number;
  /** Total columns. */
  cols: number;
  /** Column header values (first row by default). */
  headers: string[];
  /** All cells in row-major order. Excludes any header rows. */
  cells: TableCell[][];
  /** Per-table confidence 0..1. */
  confidence: number;
  /** Optional notes — e.g. "spanning header detected", "row 3 has merged cells". */
  notes?: string[];
}

export interface ExtractionResult {
  /** Source URL or file identifier echoed back for citation. */
  source: string;
  /** Total page count in the PDF. */
  page_count: number;
  /** Tables found, ordered by appearance. */
  tables: ExtractedTable[];
  /** Aggregate stats. */
  stats: {
    pages_processed: number;
    latency_ms: number;
    cost_micro_usd: number;
    model: string;
  };
  /** Warnings the agent may want to surface. */
  warnings?: string[];
}
