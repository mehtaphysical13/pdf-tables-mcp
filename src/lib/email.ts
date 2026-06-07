/**
 * Resend transactional email client.
 * Single sender identity, low-volume v1 — Resend's free tier (3K/mo) handles
 * the entire revenue experiment.
 */

import { Resend } from "resend";
import { log } from "./logger.js";

let client: Resend | null = null;
function getClient(): Resend {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  client = new Resend(key);
  return client;
}

function fromAddress(): string {
  return process.env.RESEND_FROM ?? "team@pdftables.dev";
}

const WELCOME_HTML = (apiKey: string) => `
<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a;line-height:1.55;max-width:580px;margin:0 auto;padding:24px;">
  <h2 style="margin:0 0 12px;font-size:22px;">Welcome to pdf-tables-mcp</h2>
  <p>Your API key (shown once — store it now):</p>
  <pre style="background:#0f172a;color:#e2e8f0;padding:14px 16px;border-radius:8px;overflow:auto;font-size:13px;">${apiKey}</pre>
  <p>You're on the <strong>Free</strong> plan: 50 pages/month, no charge.</p>
  <h3 style="margin-top:28px;font-size:16px;">Use it from Claude Desktop:</h3>
  <pre style="background:#f1f5f9;color:#0f172a;padding:14px 16px;border-radius:8px;overflow:auto;font-size:13px;">{
  "mcpServers": {
    "pdf-tables": {
      "url": "https://pdf-tables-mcp.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer ${apiKey}"
      }
    }
  }
}</pre>
  <p style="margin-top:24px;font-size:14px;color:#475569;">
    Need more pages? <a href="https://pdf-tables-mcp.vercel.app/pricing">See plans</a> →
  </p>
  <p style="margin-top:36px;font-size:12px;color:#94a3b8;">— Tool Factory · MIT licensed</p>
</div>`;

export async function sendWelcomeEmail(recipient: string, apiKey: string) {
  try {
    const res = await getClient().emails.send({
      from: fromAddress(),
      to: recipient,
      subject: "Your pdf-tables API key",
      html: WELCOME_HTML(apiKey),
    });
    log.info("welcome email sent", { id: res.data?.id });
    return res;
  } catch (e) {
    log.error("welcome email failed", {
      msg: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
