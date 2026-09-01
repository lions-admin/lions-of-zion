import { ImageResponse } from "next/og";
import { getPublicPublication } from "@/lib/publications";
import { isAnalysisBasis } from "@/server/contracts/publication";

export const alt = "Lions of Zion editorial report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// The card reads the published-publication projection at request time. It
// must never be baked from a stale build or a draft-only record.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const article = await getPublicPublication(publicId);
  /* The card outlives the page it came from: it is reposted, screenshotted and
     quoted with none of the article's disclosure attached. An unsourced
     assertion leaving here unmarked is the one failure this change exists to
     prevent, so the basis is printed on the card itself. */
  const isAnalysis = isAnalysisBasis(article.narrativeWatchDetails);
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "space-between", padding: "72px 82px", color: "#f4efe5",
      background: "linear-gradient(135deg, #050505 0%, #11100d 64%, #33270f 100%)",
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, letterSpacing: 5 }}>
        <span>LIONSOFZION</span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#d2a94f" }}>{article.section.replaceAll("_", " ").toUpperCase()}</span>
          {isAnalysis ? (
            <span style={{
              padding: "8px 16px", border: "1px solid rgba(210, 169, 79, 0.55)",
              color: "#e8dfcd", fontSize: 19, letterSpacing: 3,
            }}>ANALYSIS · NO SOURCE CITED</span>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ width: 74, height: 4, background: "#d2a94f" }} />
        <div style={{ fontSize: 58, lineHeight: 1.08, fontWeight: 700, maxWidth: 1030 }}>{article.title}</div>
        <div style={{ fontSize: 24, color: "#c9c3b8" }}>{new Date(article.publishedAt).toLocaleDateString("en-GB", { dateStyle: "long" })}</div>
      </div>
    </div>,
    size,
  );
}
