import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Social preview card. Renders text only; no GitHub calls happen server-side. */
export function ogCard({ eyebrow, title, muted, subtitle }: { eyebrow: string; title: string; muted?: string; subtitle: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(900px 500px at 15% 0%, #12304a 0%, #0b1220 60%)",
          color: "#e7edf6",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="64" height="64" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#1b2432" />
            <path d="M5 16h5l3-8 6 16 3-8h5" fill="none" stroke="#7dd3fc" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div style={{ fontSize: 30, color: "#8c99ac", letterSpacing: 4, textTransform: "uppercase" }}>{eyebrow}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: title.length > 28 ? 64 : 84, fontWeight: 700, letterSpacing: -2 }}>
            {muted && <span style={{ color: "#5f6c80" }}>{muted}</span>}
            <span>{title}</span>
          </div>
          <div style={{ fontSize: 34, color: "#c4cfdc" }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {["#10b981", "#10b981", "#f43f5e", "#10b981", "#f59e0b", "#10b981", "#10b981"].map((color, index) => (
            <div key={index} style={{ width: 120, height: 12, borderRadius: 6, background: color, opacity: 0.85 }} />
          ))}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
