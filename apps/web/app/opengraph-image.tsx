import { ImageResponse } from "next/og";

export const alt = "Excel Guru — Learn Excel by typing real formulas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "center", padding: 80, background: "#107c41", color: "white",
        }}
      >
        <div style={{ fontSize: 40, opacity: 0.85 }}>Excel Guru</div>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, marginTop: 16 }}>
          Learn Excel by typing real formulas.
        </div>
        <div style={{ fontSize: 34, marginTop: 28, opacity: 0.85, fontFamily: "monospace" }}>
          =SUMIF(A2:A4,&quot;East&quot;,B2:B4)
        </div>
      </div>
    ),
    size,
  );
}
