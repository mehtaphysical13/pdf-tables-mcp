import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const POST_SLUG = "why-agents-fail-at-pdf-tables";

export default function Blog() {
  const [md, setMd] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/blog/${POST_SLUG}.md`)
      .then((r) => (r.ok ? r.text() : Promise.reject(r.statusText)))
      .then(setMd)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div
      style={{
        background: "#fff",
        minHeight: "100vh",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
        color: "#0f172a",
        lineHeight: 1.7,
      }}
    >
      <header
        style={{
          background: "#0f172a",
          color: "#fff",
          padding: "14px 24px",
        }}
      >
        <a
          href="/"
          style={{
            color: "#fff",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          pdf-tables-mcp
        </a>
        <span style={{ color: "#94a3b8", marginLeft: 12 }}>· blog</span>
      </header>
      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "48px 24px 96px",
          fontSize: 17,
        }}
      >
        {err && <p style={{ color: "#dc2626" }}>Could not load post: {err}</p>}
        {!md && !err && <p>Loading…</p>}
        {md && (
          <article style={postStyles}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
          </article>
        )}
        <footer
          style={{
            marginTop: 56,
            paddingTop: 28,
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            color: "#94a3b8",
            fontSize: 13,
          }}
        >
          <a href="/" style={{ color: "#64748b" }}>
            ← Back to home
          </a>
          <a
            href="https://github.com/mehtaphysical13/pdf-tables-mcp"
            style={{ color: "#64748b" }}
          >
            View source
          </a>
        </footer>
      </main>
    </div>
  );
}

const postStyles: React.CSSProperties = {
  // typography for markdown content
  // (h1/h2/h3 + p + ul + table + code styled inline below)
};
