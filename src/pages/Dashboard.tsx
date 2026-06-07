import { useEffect, useState } from "react";
import { Pill, Code, sectionHeading, para, inlineCode } from "../components/ui";

interface MeResponse {
  user_id: string;
  email: string;
  plan: string;
  api_key_prefix: string;
  usage: {
    plan: string;
    quotaPages: number;
    pagesUsed: number;
    pagesRemaining: number;
    resetsAt: string;
  };
}

const PLANS = ["hobby", "pro", "business"] as const;
const PLAN_PRICES: Record<(typeof PLANS)[number], string> = {
  hobby: "$19/mo",
  pro: "$99/mo",
  business: "$499/mo",
};
const PLAN_QUOTAS: Record<(typeof PLANS)[number], string> = {
  hobby: "250 pages",
  pro: "2,000 pages",
  business: "15,000 pages",
};

const MCP_URL = "https://pdf-tables-mcp.vercel.app/api/mcp";

export default function Dashboard({
  initialApiKey,
}: {
  initialApiKey: string | null;
}) {
  const [apiKey, setApiKey] = useState<string | null>(initialApiKey);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");

  useEffect(() => {
    if (!apiKey) return;
    setError(null);
    fetch("/api/me", {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "auth failed");
        setMe(j);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [apiKey]);

  async function startCheckout(plan: (typeof PLANS)[number]) {
    if (!apiKey) return;
    setBusy(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ plan }),
      });
      const j = await res.json();
      if (!res.ok || !j.url) throw new Error(j.error ?? "checkout failed");
      window.location.href = j.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function openBillingPortal() {
    if (!apiKey) return;
    setBusy("portal");
    try {
      const res = await fetch("/api/billing-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const j = await res.json();
      if (!res.ok || !j.url) throw new Error(j.error ?? "portal failed");
      window.location.href = j.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!apiKey) {
    return (
      <Layout>
        <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>Dashboard</h1>
        <p style={para}>Paste your API key to view your usage.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!keyInput.trim()) return;
            window.location.hash = keyInput.trim();
            setApiKey(keyInput.trim());
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input
            type="text"
            placeholder="pdt_live_…"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            style={{
              flex: "1 1 320px",
              padding: "11px 14px",
              fontSize: 14,
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          />
          <button
            style={{
              padding: "11px 20px",
              background: "#0f172a",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
            type="submit"
          >
            Sign in
          </button>
        </form>
        <p style={{ ...para, marginTop: 16, fontSize: 13 }}>
          Don't have one? <a href="/">Get a free API key →</a>
        </p>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>Dashboard</h1>
        <p style={{ color: "#dc2626" }}>Error: {error}</p>
        <p style={para}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.location.hash = "";
              setApiKey(null);
            }}
          >
            Use a different key
          </a>
        </p>
      </Layout>
    );
  }

  if (!me) {
    return (
      <Layout>
        <p style={para}>Loading…</p>
      </Layout>
    );
  }

  const pct = Math.min(100, (me.usage.pagesUsed / me.usage.quotaPages) * 100);
  const planLabel = me.plan.charAt(0).toUpperCase() + me.plan.slice(1);

  return (
    <Layout>
      <header style={{ marginBottom: 32 }}>
        <Pill color="#2563eb">{planLabel} plan</Pill>
        <h1 style={{ fontSize: 32, margin: "12px 0 4px" }}>Dashboard</h1>
        <p style={{ color: "#64748b", margin: 0 }}>{me.email}</p>
      </header>

      <section style={{ marginBottom: 40 }}>
        <h2 style={sectionHeading}>Usage</h2>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 10,
              fontSize: 14,
            }}
          >
            <span>
              <strong>{me.usage.pagesUsed}</strong> / {me.usage.quotaPages} pages
            </span>
            <span style={{ color: "#64748b" }}>
              resets {me.usage.resetsAt.slice(0, 10)}
            </span>
          </div>
          <div
            style={{
              background: "#f1f5f9",
              height: 8,
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: pct > 80 ? "#dc2626" : "#0f172a",
                height: "100%",
                width: `${pct}%`,
                transition: "width 0.3s",
              }}
            />
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={sectionHeading}>API key</h2>
        <p style={para}>
          Use this in your agent's MCP config under the{" "}
          <code style={inlineCode}>Authorization</code> header.
        </p>
        <div style={{ position: "relative" }}>
          <pre
            style={{
              background: "#0b1220",
              color: "#e2e8f0",
              padding: "16px 18px",
              borderRadius: 10,
              overflow: "auto",
              fontSize: 13,
              margin: 0,
              border: "1px solid #1e293b",
            }}
          >
            {revealKey
              ? apiKey
              : `${me.api_key_prefix}${"•".repeat(28)}`}
          </pre>
          <button
            onClick={() => setRevealKey((v) => !v)}
            style={{
              position: "absolute",
              top: 10,
              right: 12,
              background: "transparent",
              border: "1px solid #475569",
              color: "#cbd5e1",
              fontSize: 11,
              borderRadius: 6,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            {revealKey ? "HIDE" : "REVEAL"}
          </button>
        </div>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={sectionHeading}>Claude Desktop config</h2>
        <Code>{`{
  "mcpServers": {
    "pdf-tables": {
      "url": "${MCP_URL}",
      "headers": {
        "Authorization": "Bearer ${revealKey ? apiKey : me.api_key_prefix + "…"}"
      }
    }
  }
}`}</Code>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={sectionHeading}>Plans</h2>
        {me.plan !== "free" && (
          <p style={para}>
            You're on the <strong>{planLabel}</strong> plan.{" "}
            <button
              onClick={openBillingPortal}
              disabled={busy === "portal"}
              style={{
                background: "transparent",
                border: 0,
                color: "#2563eb",
                cursor: "pointer",
                padding: 0,
                font: "inherit",
                textDecoration: "underline",
              }}
            >
              {busy === "portal" ? "Opening…" : "Manage subscription →"}
            </button>
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {PLANS.map((p) => (
            <div
              key={p}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 16,
              }}
            >
              <h4 style={{ margin: "0 0 4px", fontSize: 16 }}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </h4>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                {PLAN_PRICES[p]}
              </p>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: 13,
                  color: "#64748b",
                }}
              >
                {PLAN_QUOTAS[p]}/mo
              </p>
              {me.plan === p ? (
                <button
                  disabled
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    background: "#f1f5f9",
                    color: "#64748b",
                    borderRadius: 6,
                    fontSize: 13,
                    cursor: "default",
                  }}
                >
                  Current plan
                </button>
              ) : (
                <button
                  disabled={busy === p}
                  onClick={() => startCheckout(p)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: 0,
                    background: "#0f172a",
                    color: "#fff",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: busy === p ? "wait" : "pointer",
                  }}
                >
                  {busy === p ? "Loading…" : "Upgrade"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer
        style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: "1px solid #e2e8f0",
          color: "#94a3b8",
          fontSize: 13,
        }}
      >
        <a href="/" style={{ color: "#64748b" }}>
          ← Back to landing
        </a>
      </footer>
    </Layout>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        minHeight: "100vh",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#0f172a",
        lineHeight: 1.55,
      }}
    >
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 24px 64px",
        }}
      >
        {children}
      </main>
    </div>
  );
}
