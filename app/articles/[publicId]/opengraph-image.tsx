import { ImageResponse } from "next/og";
import { getPublicPublication } from "@/lib/publications";
import { absoluteMediaUrl, articleHeroMedia } from "@/lib/content/homepage-media";
import { isAnalysisBasis } from "@/server/contracts/publication";
import { SECTION_LABELS } from "@/components/live/publication-labels";
import { OG_PALETTE } from "./og-palette";

export const alt = "Lions of Zion editorial report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// The card reads the published-publication projection at request time. It
// must never be baked from a stale build or a draft-only record.
export const runtime = "nodejs";
// The page's own 300-second ISR window, carried onto the card: a shared link
// picks up a corrected record within the same five minutes the page does,
// instead of regenerating the picture on every crawler request.
export const revalidate = 300;

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

/**
 * The brand face on the card, fetched the way the css2 API serves it.
 *
 * satori needs a TTF or WOFF — the css2 endpoint serves WOFF2 only to a
 * browser-grade user agent, and a legacy UA string gets the static TTF back.
 * The data is fetched once per process and cached in module scope: a card is
 * rendered per article, and a cold fetch per render would put a Google
 * round-trip inside every share preview. The same instanced-static-TTF
 * approach the site's root card was regenerated with in stage 4 of the
 * identity round.
 *
 * Every failure — no network, a format change, a timeout — returns `[]` and
 * the card renders with satori's bundled face, exactly as it did before this
 * loader existed. A font must never be the thing that breaks a share.
 */
const FONT_TIMEOUT_MS = 2_500;
let brandFont: Promise<ArrayBuffer | null> | null = null;

function loadBrandFont(): Promise<ArrayBuffer | null> {
  brandFont ??= (async () => {
    try {
      const css = await fetch(
        "https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@700&display=swap",
        {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1)" },
          signal: AbortSignal.timeout(FONT_TIMEOUT_MS),
        },
      );
      if (!css.ok) return null;
      const match = (await css.text()).match(/url\((https:[^)]+\.ttf)\)/);
      if (!match) return null;
      const font = await fetch(match[1]!, { signal: AbortSignal.timeout(FONT_TIMEOUT_MS) });
      if (!font.ok) return null;
      return await font.arrayBuffer();
    } catch {
      return null;
    }
  })();
  return brandFont;
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
  /* The section label is the desk's own name, from the one label map — never
     a raw enum combed with underscores ("SCIENCE MEDICINE"). */
  const sectionLabel = SECTION_LABELS[article.section];
  const font = await loadBrandFont();
  const p = OG_PALETTE;
  return new ImageResponse(
    <div style={{
      position: "relative", width: "100%", height: "100%", display: "flex",
      color: p.inkHi, backgroundColor: p.ground,
      fontFamily: font ? "Schibsted Grotesk" : undefined,
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
          background: `linear-gradient(180deg, ${p.abyss}9E 0%, ${p.abyss}6B 42%, ${p.abyss}EB 100%)`,
        }} />
      ) : null}
      <div style={{
        position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "72px 82px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, letterSpacing: 5, color: p.inkHi }}>
          <span>LIONSOFZION</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ color: p.goldDim, textTransform: "uppercase" }}>{sectionLabel}</span>
            {isAnalysis ? (
              <span style={{
                padding: "8px 16px", border: `1px solid ${p.goldDim}`, backgroundColor: p.surface1,
                color: p.inkHi, fontSize: 19, letterSpacing: 3,
              }}>ANALYSIS · NO SOURCE CITED</span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* The signal rule, at its stub width — the accent's own mark. */}
          <div style={{ width: 74, height: 4, backgroundColor: p.gold }} />
          <div style={{ fontSize: 58, lineHeight: 1.08, fontWeight: 700, maxWidth: 1030, color: p.inkHi }}>
            {article.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 24, color: p.inkLo }}>
            <span>{new Date(article.publishedAt).toLocaleDateString("en-GB", { dateStyle: "long" })}</span>
            {hero && heroData ? <span>{manufactured ? (hero.role === "safe-cover" ? "Safe cover · " : "Editorial illustration · ") : ""}{hero.credit}</span> : null}
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: font ? [{ name: "Schibsted Grotesk", data: font, weight: 700, style: "normal" }] : undefined,
    },
  );
}
