/**
 * MCP Streamable HTTP endpoint, API-key authenticated.
 * Each request: extract Bearer → resolve owner → build MCP server scoped
 * to that owner → handle the request.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Readable } from "node:stream";
import { extractBearer, resolveKey } from "../src/lib/auth.js";
import { buildMcpServer } from "../src/lib/mcpServer.js";
import { log } from "../src/lib/logger.js";

export const config = {
  runtime: "nodejs",
  // Sonnet 4.5 on a 15-page PDF was 88s in smoke. Vercel Pro allows 300s.
  maxDuration: 300,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader(
    "access-control-allow-headers",
    "authorization, content-type, mcp-session-id, mcp-protocol-version, x-api-key"
  );
  res.setHeader(
    "access-control-allow-methods",
    "POST, GET, DELETE, OPTIONS"
  );
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // Auth gate.
  const key = extractBearer(
    (req.headers.authorization as string) ?? (req.headers["x-api-key"] as string)
  );
  if (!key) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message:
          "Missing API key. Sign up at https://pdf-tables-mcp.vercel.app to get one, then pass it as `Authorization: Bearer pdt_live_…`.",
      },
      id: null,
    });
    return;
  }
  const owner = await resolveKey(key);
  if (!owner) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32001,
        message:
          "Invalid or revoked API key. Get a new one at https://pdf-tables-mcp.vercel.app.",
      },
      id: null,
    });
    return;
  }

  try {
    const webReq = vercelReqToWebRequest(req);
    const transport = new WebStandardStreamableHTTPServerTransport({});
    const server = buildMcpServer(owner);
    await server.connect(transport);
    const webRes = await transport.handleRequest(webReq);

    res.status(webRes.status);
    webRes.headers.forEach((v, k) => res.setHeader(k, v));
    if (webRes.body) {
      Readable.fromWeb(
        webRes.body as unknown as import("node:stream/web").ReadableStream
      ).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    log.error("mcp handler failed", {
      msg: err instanceof Error ? err.message : String(err),
      user: owner.user_id,
    });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    } else {
      res.end();
    }
  }
}

function vercelReqToWebRequest(req: VercelRequest): Request {
  const host = req.headers.host ?? "localhost";
  const proto =
    (req.headers["x-forwarded-proto"] as string | undefined) ?? "https";
  const url = new URL(req.url ?? "/", `${proto}://${host}`);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) headers.append(k, item);
    else headers.set(k, v);
  }
  let body: string | null = null;
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    if (req.body !== undefined) {
      body =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    }
  }
  return new Request(url, {
    method: req.method ?? "GET",
    headers,
    body,
  });
}
