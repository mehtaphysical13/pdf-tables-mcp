import { useState } from "react";
import { Pill, Code, sectionHeading, subHeading, para, inlineCode } from "../components/ui";

const MCP_URL = "https://pdf-tables-mcp.vercel.app/api/mcp";

const CLAUDE_CONFIG = (k: string) => `{
  "mcpServers": {
    "pdf-tables": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${k}"
      }
    }
  }
}`;

const CURSOR_CONFIG = (k: string) => CLAUDE_CONFIG(k);

const TIERS = [
  {
    name: "Free",
    price: "$0",
    pages: "50",
    features: [
      "All output formats",
      "JSON + Markdown + CSV",
      "Best-effort SLA",
      "Community support",
    ],
    cta: "Start free",
    emphasize: false,
  },
  {
    name: "Hobby",
    price: "$19/mo",
    pages: "250",
    features: [
      "Everything in Free",
      "Higher rate limit",
      "Email support",
      "99% uptime",
    ],
    cta: "Upgrade",
    emphasize: false,
  },
  {
    name: "Pro",
    price: "$99/mo",
    pages: "2,000",
    features: [
      "Everything in Hobby",
      "Sonnet + Opus models",
      "Priority Slack support",
      "99.5% uptime",
    ],
    cta: "Upgrade",
    emphasize: true,
  },
  {
    name: "Business",
    price: "$499/mo",
    pages: "15,000",
    features: [
      "Everything in Pro",
      "99.9% uptime SLA",
      "Dedicated support channel",
      "Audit log export",
    ],
    cta: "Upgrade",
    emphasize: false,
  },
];

const EXAMPLE_PROMPTS = [
  "Extract every table from this 10-K filing and give me the financials in CSV.",
  "Pull the line items from this AWS invoice PDF.",
  "Get all tables from arxiv.org/pdf/<paper-id>.pdf for my RAG index.",
  "Read the rate schedule out of this insurance policy PDF.",
];

function SignupForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; apiKey: string; dashboardUrl: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatus({
          kind: "error",
          message: json.detail ?? json.error ?? "Signup failed",
        });
        return;
      }
      setStatus({
        kind: "success",
        apiKey: json.api_key,
        dashboardUrl: json.dashboard_url,
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (status.kind === "success") {
    return (
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 10,
          padding: 20,
        }}
      >
        <p style={{ margin: "0 0 8px", fontWeight: 600, color: "#15803d" }}>
          ✅ Your API key (we also emailed it — store it now):
        </p>
        <Code>{status.apiKey}</Code>
        <p style={{ ...para, marginTop: 14 }}>
          <a
            href={status.dashboardUrl}
            style={{ fontWeight: 600 }}
          >
            Open dashboard →
          </a>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
    >
      <input
        type="email"
        required
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          flex: "1 1 240px",
          padding: "11px 14px",
          fontSize: 15,
          border: "1px solid #cbd5e1",
          borderRadius: 8,
        }}
      />
      <button
        type="submit"
        disabled={status.kind === "loading"}
        style={{
          padding: "11px 20px",
          background: "#0f172a",
          color: "#fff",
          border: 0,
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 15,
          cursor: status.kind === "loading" ? "wait" : "pointer",
        }}
      >
        {status.kind === "loading" ? "Generating…" : "Get free API key"}
      </button>
      {status.kind === "error" && (
        <p
          style={{
            margin: 0,
            color: "#dc2626",
            fontSize: 13,
            width: "100%",
          }}
        >
          {status.message}
        </p>
      )}
    </form>
  );
}

export default function Landing() {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #f8fafc 0%, #fff 280px, #fff 100%)",
        minHeight: "100vh",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#0f172a",
        lineHeight: 1.55,
      }}
    >
      <main
        style={{
          maxWidth: 880,
          margin: "0 auto",
          padding: "56px 24px 96px",
        }}
      >
        {/* Hero */}
        <header style={{ marginBottom: 48 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            <Pill color="#2563eb">MCP server</Pill>
            <Pill color="#059669">Live</Pill>
            <Pill color="#ea580c">From $0.10/page</Pill>
            <Pill color="#7c3aed">No PDF upload</Pill>
          </div>
          <h1
            style={{
              fontSize: 52,
              fontWeight: 700,
              margin: "0 0 14px",
              letterSpacing: -1,
              lineHeight: 1.05,
            }}
          >
            pdf-tables-mcp
          </h1>
          <p
            style={{
              fontSize: 20,
              color: "#475569",
              margin: 0,
              maxWidth: 680,
            }}
          >
            Reliable PDF table extraction as an MCP tool. Pass a URL — get back
            structured JSON, Markdown, or CSV with cell-level page citations.
            Drop into Claude, Cursor, or any MCP-compatible agent.
          </p>
          <div
            style={{
              marginTop: 28,
              padding: 20,
              border: "1px solid #e2e8f0",
              background: "#fff",
              borderRadius: 12,
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600 }}>
              Get started in 30 seconds:
            </h3>
            <SignupForm />
            <p style={{ ...para, fontSize: 13, color: "#64748b", marginTop: 12, marginBottom: 0 }}>
              50 pages/month free · No credit card · Cancel anytime · MIT licensed
            </p>
          </div>
        </header>

        {/* What you can ask */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={sectionHeading}>What you can ask your agent</h2>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "grid",
              gap: 10,
            }}
          >
            {EXAMPLE_PROMPTS.map((p) => (
              <li
                key={p}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "14px 18px",
                  fontSize: 15,
                  color: "#1e293b",
                }}
              >
                <span style={{ color: "#94a3b8", marginRight: 8 }}>"</span>
                {p}
                <span style={{ color: "#94a3b8", marginLeft: 4 }}>"</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Install */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={sectionHeading}>Install</h2>
          <h3 style={subHeading}>Claude Desktop / Claude Code</h3>
          <p style={para}>
            Add to your <code style={inlineCode}>claude_desktop_config.json</code> (or run via Claude Code CLI):
          </p>
          <Code>{CLAUDE_CONFIG("pdt_live_YOURKEY")}</Code>
          <h3 style={subHeading}>Cursor</h3>
          <p style={para}>
            Add to <code style={inlineCode}>~/.cursor/mcp.json</code>:
          </p>
          <Code>{CURSOR_CONFIG("pdt_live_YOURKEY")}</Code>
          <h3 style={subHeading}>Raw MCP endpoint</h3>
          <p style={para}>
            Streamable HTTP, API-key authenticated. Point any MCP client at:
          </p>
          <Code>{MCP_URL}</Code>
          <h3 style={subHeading}>Not using MCP?</h3>
          <p style={para}>
            REST + OpenAPI 3.1 spec available for any HTTP-tool-calling agent
            (Continue, custom workflows, etc.):
          </p>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              fontSize: 14,
              color: "#475569",
            }}
          >
            <li style={{ marginBottom: 6 }}>
              <code style={inlineCode}>POST /api/extract</code> — same backend as the MCP tool
            </li>
            <li style={{ marginBottom: 6 }}>
              <code style={inlineCode}>GET /api/openapi.json</code> — OpenAPI 3.1 spec
            </li>
          </ul>
        </section>

        {/* Pricing */}
        <section id="pricing" style={{ marginBottom: 56 }}>
          <h2 style={sectionHeading}>Pricing</h2>
          <p style={para}>
            Pages, not calls. A 3-page PDF counts as 3 pages — keeps pricing
            fair across PDF sizes.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              marginTop: 18,
            }}
          >
            {TIERS.map((t) => (
              <div
                key={t.name}
                style={{
                  background: t.emphasize ? "#0f172a" : "#fff",
                  color: t.emphasize ? "#fff" : "#0f172a",
                  border: t.emphasize
                    ? "2px solid #0f172a"
                    : "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: "20px 18px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <h4
                  style={{
                    margin: "0 0 4px",
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  {t.name}
                </h4>
                <p
                  style={{
                    margin: "0 0 12px",
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  {t.price}
                </p>
                <p
                  style={{
                    margin: "0 0 14px",
                    fontSize: 13,
                    color: t.emphasize ? "#cbd5e1" : "#64748b",
                  }}
                >
                  {t.pages} pages / mo
                </p>
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    fontSize: 13,
                    color: t.emphasize ? "#e2e8f0" : "#334155",
                    flexGrow: 1,
                  }}
                >
                  {t.features.map((f) => (
                    <li
                      key={f}
                      style={{ marginBottom: 6, display: "flex", gap: 6 }}
                    >
                      <span style={{ color: t.emphasize ? "#34d399" : "#059669" }}>
                        ✓
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p style={{ ...para, marginTop: 18, fontSize: 13, color: "#64748b" }}>
            Need more? Enterprise plans include VPC deployment, SOC 2 path,
            and custom data sources. <a href="mailto:team@pdftables.dev">Talk to us</a>.
          </p>
        </section>

        {/* About */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={sectionHeading}>How it works</h2>
          <p style={para}>
            Your agent calls <code style={inlineCode}>extract_pdf_tables</code> with a
            PDF URL. We fetch it, run Claude Sonnet 4.5 vision over the document,
            and return normalized table rows with cell-level page citations. No
            file upload — the URL stays in your network's request log.
          </p>
          <p style={para}>
            Logs only structured tool-call shapes (<code style={inlineCode}>{`{ tool, args_shape, latency_ms, status }`}</code>) —
            never raw URLs, never PDF contents. We learn what's slow or broken,
            not what you're reading.
          </p>
        </section>

        <footer
          style={{
            marginTop: 64,
            paddingTop: 28,
            borderTop: "1px solid #e2e8f0",
            color: "#94a3b8",
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <span>MIT licensed · Built by Tool Factory</span>
          <span>
            <a
              href="https://github.com/mehtaphysical13/pdf-tables-mcp"
              style={{ color: "#64748b", textDecoration: "none" }}
            >
              github.com/mehtaphysical13/pdf-tables-mcp
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}
