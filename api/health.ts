import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    name: "pdf-tables-mcp",
    version: "0.1.0",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
