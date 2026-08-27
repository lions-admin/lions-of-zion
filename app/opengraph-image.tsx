import { ImageResponse } from "next/og";

export const alt = "LIONS OF ZION — Truth Has a Signal";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GOLD = "#c9a24b";
const GROUND = "#000000";

// next/og bundles exactly one font (Geist Regular) and satori cannot reach
// system fonts, so a serif family cannot resolve without shipping a font file.
// The card leans on tracking and weight-of-space instead — dependency-free.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: GROUND,
          backgroundImage:
            "radial-gradient(circle at 50% 42%, rgba(201, 162, 75, 0.14), rgba(0, 0, 0, 0) 62%)",
        }}
      >
        {/* Crown mark, matching app/icon.svg */}
        <svg width="88" height="88" viewBox="0 0 64 64">
          <path
            d="M17 40 V24 L26.5 32 L32 19.5 L37.5 32 L47 24 V40 Z"
            fill={GOLD}
          />
          <rect x="17" y="43" width="30" height="3.5" rx="1.75" fill={GOLD} />
        </svg>
        <div
          style={{
            marginTop: 34,
            fontSize: 92,
            color: "#f4ead2",
            letterSpacing: 26,
            // shift the visual centre back left of the trailing letter-space
            paddingLeft: 26,
          }}
        >
          LIONS OF ZION
        </div>
        <div
          style={{
            marginTop: 38,
            width: 160,
            height: 2,
            background: GOLD,
          }}
        />
        <div
          style={{
            marginTop: 36,
            fontSize: 30,
            color: GOLD,
            letterSpacing: 9,
            paddingLeft: 9,
          }}
        >
          TRUTH HAS A SIGNAL
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 24,
            color: "rgba(244, 234, 210, 0.62)",
            letterSpacing: 3,
            paddingLeft: 3,
          }}
        >
          Verified information. Documented sources.
        </div>
      </div>
    ),
    { ...size },
  );
}
