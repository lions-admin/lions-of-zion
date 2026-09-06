import { ImageResponse } from "next/og";
import { getPublicPublication } from "@/lib/publications";
import { absoluteMediaUrl, articleHeroMedia } from "@/lib/content/homepage-media";
import { isAnalysisBasis } from "@/server/contracts/publication";

export const alt = "Lions of Zion editorial report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// The card reads the published-publication projection at request time. It
// must never be baked from a stale build or a draft-only record.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Why the picture is inlined rather than linked.
 *
 * `generateMetadata` in `page.tsx` sets `openGraph.images` from the article's
 * hero, and it never reaches a crawler: file-based metadata has the higher
 * priority and overrides the `metadata` object and `generateMetadata`
 * (`next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`).
 * This file *is* the card, so the hero has to arrive here or not at all.
 *
 * Fetched into a data URI rather than handed to satori as a URL, because a
 * URL it cannot load fails the whole render: an unreachable Blob object would
 * turn a card that always worked into a 500, and a share with no card at all
 * is worse than a share with the typographic one. Every failure path below
 * returns `null` and the card falls back to exactly what it drew before.
 */
const HERO_FETCH_TIMEOUT_MS = 3_000;
const MAX_HERO_BYTES = 8 * 1024 * 1024;

async function inlineHero(src: string): Promise<string | null> {
  try {
    const url = new URL(absoluteMediaUrl(src));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const response = await fetch(url, { signal: AbortSignal.timeout(HERO_FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    /* satori decodes PNG and JPEG; AVIF and WebP are not decodable there, so
       an article whose hero is one of those keeps the typographic card. */
    if (contentType !== "image/png" && contentType !== "image/jpeg") return null;
    const body = await response.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_HERO_BYTES) return null;
    return `data:${contentType};base64,${Buffer.from(body).toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const article = await getPublicPublication(publicId);
  const hero = articleHeroMedia(article);
  const heroData = hero ? await inlineHero(hero.src) : null;
  /* The card outlives the page it came from: it is reposted, screenshotted and
     quoted with none of the article's disclosure attached. An unsourced
     assertion leaving here unmarked is the one failure this change exists to
     prevent, so the basis is printed on the card itself. */
  const isAnalysis = isAnalysisBasis(article.narrativeWatchDetails);
  /* A manufactured picture says so on the card too, for the same reason: the
     disclosure has to travel with the image, not with the article page. The
     two manufactured roles are named rather than everything-but-documentation,
     so a role added later is not silently disclosed as an illustration. */
  const manufactured = hero?.role === "editorial-illustration" || hero?.role === "safe-cover";
  return new ImageResponse(
    <div style={{
      position: "relative", width: "100%", height: "100%", display: "flex",
      color: "#f4efe5", background: "linear-gradient(135deg, #050505 0%, #11100d 64%, #33270f 100%)",
      fontFamily: "Arial, sans-serif",
    }}>
      {heroData ? (
        <img
          src={heroData}
          alt=""
          width={size.width}
          height={size.height}
          style={{ position: "absolute", top: 0, left: 0, width: size.width, height: size.height, objectFit: "cover" }}
        />
      ) : null}
      {heroData ? (
        <div style={{
          position: "absolute", top: 0, left: 0, width: size.width, height: size.height, display: "flex",
          background: "linear-gradient(180deg, rgba(5,5,5,0.62) 0%, rgba(5,5,5,0.42) 42%, rgba(5,5,5,0.92) 100%)",
        }} />
      ) : null}
      <div style={{
        position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "72px 82px",
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
          <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 24, color: "#c9c3b8" }}>
            <span>{new Date(article.publishedAt).toLocaleDateString("en-GB", { dateStyle: "long" })}</span>
            {hero && heroData ? <span>{manufactured ? (hero.role === "safe-cover" ? "Safe cover · " : "Editorial illustration · ") : ""}{hero.credit}</span> : null}
          </div>
        </div>
      </div>
    </div>,
    size,
  );
}
