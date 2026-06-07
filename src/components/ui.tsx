import { useState } from "react";

export function Pill({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 999,
        background: `${color}1a`,
        color,
        border: `1px solid ${color}33`,
      }}
    >
      {children}
    </span>
  );
}

export function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <pre
      onClick={() => {
        void navigator.clipboard.writeText(children);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      style={{
        background: "#0b1220",
        color: "#e2e8f0",
        padding: "16px 18px",
        borderRadius: 10,
        overflow: "auto",
        cursor: "pointer",
        fontSize: 13.5,
        lineHeight: 1.55,
        margin: 0,
        position: "relative",
        border: "1px solid #1e293b",
      }}
      title="Click to copy"
    >
      <span
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          fontSize: 11,
          color: copied ? "#34d399" : "#64748b",
          letterSpacing: 0.5,
        }}
      >
        {copied ? "COPIED" : "CLICK TO COPY"}
      </span>
      {children}
    </pre>
  );
}

export const sectionHeading: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 700,
  margin: "0 0 18px",
  letterSpacing: -0.3,
};

export const subHeading: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  margin: "26px 0 10px",
  color: "#0f172a",
};

export const para: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 15,
  color: "#334155",
};

export const inlineCode: React.CSSProperties = {
  fontSize: 13,
  background: "#f1f5f9",
  padding: "2px 6px",
  borderRadius: 4,
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};
