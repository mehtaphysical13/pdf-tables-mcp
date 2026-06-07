/**
 * GET /api/openapi.json — OpenAPI 3.1 spec for non-MCP coding agents that
 * use OpenAPI-driven tool calling (Continue, custom workflows, etc.).
 *
 * Keeping the spec hand-authored rather than generated so we control the
 * agent-facing language (descriptions, examples) the way we engineered
 * them on the MCP side.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = { runtime: "nodejs", maxDuration: 10 };

const SPEC = {
  openapi: "3.1.0",
  info: {
    title: "pdf-tables-mcp",
    summary: "Reliable PDF table extraction for AI agents",
    description:
      "Extract every table from a PDF URL with cell-level page citations, type tagging, and per-table confidence scores. Built for agents — flat schema, clear errors, structured output formats.",
    version: "0.1.0",
    license: { name: "MIT" },
    contact: {
      name: "Tool Factory",
      url: "https://github.com/mehtaphysical13/pdf-tables-mcp",
    },
  },
  servers: [
    {
      url: "https://pdf-tables-mcp.vercel.app",
      description: "Production",
    },
  ],
  security: [{ apiKey: [] }, { bearer: [] }],
  paths: {
    "/api/mcp": {
      post: {
        summary: "MCP Streamable HTTP endpoint",
        description:
          "Speak the Model Context Protocol over HTTP. For OpenAPI-style direct calls, see /api/extract.",
        responses: {
          "200": { description: "JSON-RPC envelope" },
          "401": { description: "Missing or invalid API key" },
        },
      },
    },
    "/api/extract": {
      post: {
        summary: "Extract tables from a PDF URL",
        operationId: "extractPdfTables",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["url"],
                properties: {
                  url: {
                    type: "string",
                    format: "uri",
                    description:
                      "Absolute http(s) URL pointing directly at a PDF file.",
                  },
                  pages: {
                    type: "array",
                    items: { type: "integer", minimum: 1 },
                    description:
                      "Optional 1-indexed page numbers. Omit for all pages.",
                  },
                  format: {
                    type: "string",
                    enum: ["json", "markdown", "csv"],
                    default: "json",
                  },
                  model: {
                    type: "string",
                    enum: [
                      "claude-sonnet-4-5",
                      "claude-haiku-4-5",
                      "claude-opus-4-5",
                    ],
                    default: "claude-sonnet-4-5",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Successful extraction",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ExtractionResult" },
              },
            },
          },
          "401": { description: "Missing or invalid API key" },
          "402": { description: "Quota exhausted" },
          "400": { description: "Invalid request (bad URL, malformed PDF)" },
          "500": { description: "Internal error" },
        },
      },
    },
    "/api/signup": {
      post: {
        summary: "Get a free API key",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "API key created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    api_key: { type: "string" },
                    plan: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/me": {
      get: {
        summary: "Get the authenticated user's plan and usage",
        security: [{ bearer: [] }],
        responses: {
          "200": {
            description: "User snapshot",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user_id: { type: "string" },
                    email: { type: "string" },
                    plan: { type: "string" },
                    usage: {
                      type: "object",
                      properties: {
                        quotaPages: { type: "integer" },
                        pagesUsed: { type: "integer" },
                        pagesRemaining: { type: "integer" },
                        resetsAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/health": {
      get: {
        summary: "Health check",
        responses: {
          "200": {
            description: "Service up",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    version: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearer: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "pdt_live_...",
      },
      apiKey: {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
      },
    },
    schemas: {
      ExtractionResult: {
        type: "object",
        properties: {
          source: { type: "string" },
          page_count: { type: "integer" },
          tables: {
            type: "array",
            items: { $ref: "#/components/schemas/ExtractedTable" },
          },
          stats: {
            type: "object",
            properties: {
              pages_processed: { type: "integer" },
              latency_ms: { type: "integer" },
              cost_micro_usd: { type: "integer" },
              model: { type: "string" },
            },
          },
          warnings: { type: "array", items: { type: "string" } },
        },
      },
      ExtractedTable: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          pages: { type: "array", items: { type: "integer" } },
          headers: { type: "array", items: { type: "string" } },
          cells: {
            type: "array",
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/TableCell" },
            },
          },
          confidence: { type: "number" },
          notes: { type: "array", items: { type: "string" } },
        },
      },
      TableCell: {
        type: "object",
        properties: {
          row: { type: "integer" },
          col: { type: "integer" },
          value: { type: "string" },
          type: {
            type: "string",
            enum: ["string", "number", "currency", "percent", "date", "boolean", "null"],
          },
          page: { type: "integer" },
        },
      },
    },
  },
} as const;

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("cache-control", "public, max-age=300");
  res.status(200).json(SPEC);
}
