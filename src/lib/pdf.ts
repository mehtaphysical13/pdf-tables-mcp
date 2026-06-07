/**
 * PDF download + metadata. Keeps the LLM layer focused on extraction —
 * everything I/O-shaped lives here.
 */

import { PDFDocument } from "pdf-lib";
import { log } from "./logger.js";

export interface PdfFetchResult {
  buffer: Buffer;
  bytes: number;
  pageCount: number;
}

/** Hard caps. v1 keeps us safe from cost runaway and timeouts. */
export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_PAGES = 100;

export class PdfFetchError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function fetchPdf(
  url: string,
  correlationId?: string
): Promise<PdfFetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new PdfFetchError(
      "invalid_url",
      "URL is malformed. Provide an absolute http(s):// URL pointing at a PDF."
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new PdfFetchError(
      "invalid_scheme",
      "Only http and https URLs are supported."
    );
  }

  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "user-agent": "pdf-tables-mcp/0.1 (+https://pdf-tables-mcp.vercel.app)" },
      redirect: "follow",
    });
  } catch (e) {
    throw new PdfFetchError(
      "network_error",
      `Could not reach the URL: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (!res.ok) {
    throw new PdfFetchError(
      "fetch_failed",
      `Source server returned ${res.status} ${res.statusText}.`
    );
  }

  const contentLengthHeader = res.headers.get("content-length");
  if (contentLengthHeader) {
    const declared = Number(contentLengthHeader);
    if (declared > MAX_PDF_BYTES) {
      throw new PdfFetchError(
        "too_large",
        `PDF declares ${(declared / 1024 / 1024).toFixed(1)} MB. Max supported is ${MAX_PDF_BYTES / 1024 / 1024} MB.`
      );
    }
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength > MAX_PDF_BYTES) {
    throw new PdfFetchError(
      "too_large",
      `PDF is ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB. Max supported is ${MAX_PDF_BYTES / 1024 / 1024} MB.`
    );
  }

  // Cheap sniff — first 4 bytes should be %PDF.
  const magic = buffer.subarray(0, 4).toString("ascii");
  if (magic !== "%PDF") {
    throw new PdfFetchError(
      "not_a_pdf",
      `Content at URL is not a PDF (got header "${magic}"). Check the URL points to a PDF file directly.`
    );
  }

  let pageCount: number;
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    pageCount = doc.getPageCount();
  } catch (e) {
    throw new PdfFetchError(
      "parse_error",
      `Could not parse the PDF: ${e instanceof Error ? e.message : String(e)}`
    );
  }

  if (pageCount > MAX_PAGES) {
    throw new PdfFetchError(
      "too_many_pages",
      `PDF has ${pageCount} pages. v1 limit is ${MAX_PAGES} pages per call. Split the document or request a page range.`
    );
  }

  log.outbound({
    source: "pdf_fetch",
    endpoint: parsed.host,
    method: "GET",
    paramsShape: { url: "string" },
    status: res.status,
    latencyMs: Date.now() - start,
    correlationId,
  });

  return {
    buffer,
    bytes: buffer.byteLength,
    pageCount,
  };
}
