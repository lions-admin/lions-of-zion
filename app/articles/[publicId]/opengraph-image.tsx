import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getPublicPublication } from "@/lib/publications";
import { absoluteMediaUrl, articleHeroMedia } from "@/lib/content/homepage-media";
import { OG_PALETTE } from "@/lib/og-palette";
import { PUBLICATION_SECTION_LABELS } from "@/lib/publication-routing";
import { isAnalysisBasis } from "@/server/contracts/publication";

export const alt = "Lions of Zion editorial report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
/* The Node runtime, because the brand faces are read from the filesystem
   below; the Edge runtime has no `fs`. */
export const runtime = "nodejs";
/* Cached for five minutes, the same TTL the article page and the
   `unstable_cache` layer under `getPublicPublication` already share, so the
   three expire together. This was `force-dynamic` until 2026-09-16: every
   crawl re-rendered the card — a database read, a hero fetch and a satori
   pass — for a picture that changes only when the record does. Freshness does
   not depend on the TTL: the publish consumer revalidates the record's path
   in the same run that publishes, and a card five minutes behind a correction
   still names the same record. */
export const revalidate = 300;

/**
 * The brand type, read once per instance from `assets/brand/fonts/` — the
 * pattern Next's `opengraph-image` docs give. satori cannot reach the faces
 * `app/layout.tsx` loads through `next/font`, and fetching them from Google
 * Fonts at request time would need a CSP change and make the card depend on a
 * third party at render. Static instances, because satori applies no `wght`
 * axis: Schibsted Grotesk 600 for the headline (the site's heading weight),
 * 400 for the rest, and Geist Mono for the one machine value on the card —
 * the date. The register is the site's: a kicker is a word a person wrote and
 * takes the text face; mono is for machine values only.
 */
const FONT_DIR = join(process.cwd(), "assets", "brand", "fonts");
type BrandFont = { name: string; data: Buffer; style: "normal"; weight: 400 | 600 };

/* Read once per instance, on the first card rather than at module load: a
   route module that throws while it is being evaluated takes the whole route
   down, and a share with the fallback face is better than a share with no
   card. `assets/` is not traced automatically from a `join()` path, so
   `next.config.ts` has to carry an `outputFileTracingIncludes` entry for this
   route — until it does, production falls through the `catch` below and the
   card renders in satori's built-in face. */
let brandFonts: Promise<BrandFont[]> | null = null;

async function loadBrandFonts(): Promise<BrandFont[]> {
  try {
    const [regular, semiBold, mono] = await Promise.all([
      readFile(join(FONT_DIR, "SchibstedGrotesk-Regular.ttf")),
      readFile(join(FONT_DIR, "SchibstedGrotesk-SemiBold.ttf")),
      readFile(join(FONT_DIR, "GeistMono-Regular.ttf")),
    ]);
    return [
      { name: "Schibsted Grotesk", data: regular, style: "normal", weight: 400 },
      { name: "Schibsted Grotesk", data: semiBold, style: "normal", weight: 600 },
      { name: "Geist Mono", data: mono, style: "normal", weight: 400 },
    ];
  } catch {
    return [];
  }
}

const TEXT = "'Schibsted Grotesk', 'Helvetica Neue', Arial, sans-serif";
const DATA = "'Geist Mono', ui-monospace, Menlo, monospace";

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

/* The signal rule at the card's scale (2×): the five bars of the stub at
   their fixed heights on an 8px pitch, then the hairline. The same mark
   `components/brand/SignalMark.tsx` draws once on the cover, once on a
   masthead and once on the colophon — the card is the fourth place it is
   allowed, because the card is the site's face off-site. */
const STUB_HEIGHTS = [6, 14, 22, 10, 18];

function SignalRule() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 22 }}>
      {STUB_HEIGHTS.map((height, index) => (
        <div key={index} style={{ width: 3, height, background: OG_PALETTE.gold }} />
      ))}
      <div style={{ width: 128, height: 2, background: OG_PALETTE.gold, marginLeft: 3, marginBottom: 0 }} />
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  brandFonts ??= loadBrandFonts();
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
  /* The canonical section label — the same table the hub, the route and the
     homepage band read — rather than the enum with its underscores combed
     ("SCIENCE MEDICINE" until 2026-09-16). */
  const section = PUBLICATION_SECTION_LABELS[article.section] ?? article.section;
  const date = new Date(article.publishedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  });
  const longTitle = article.title.length > 90;
  const fonts = await brandFonts;

  return new ImageResponse(
    <div style={{
      position: "relative", width: "100%", height: "100%", display: "flex",
      color: OG_PALETTE.inkHi, background: OG_PALETTE.ground, fontFamily: TEXT,
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
        /* The scrim under the type when a picture is behind it: the abyss,
           heavier at the foot where the headline sits. */
        <div style={{
          position: "absolute", top: 0, left: 0, width: size.width, height: size.height, display: "flex",
          background: "linear-gradient(180deg, rgba(7,11,20,0.58) 0%, rgba(7,11,20,0.42) 40%, rgba(7,11,20,0.94) 100%)",
        }} />
      ) : null}
      <div style={{
        position: "relative", width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "64px 80px 68px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 26, fontWeight: 600, letterSpacing: 6, color: OG_PALETTE.inkHi }}>
            LIONS OF ZION
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <span style={{
              fontSize: 22, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", color: OG_PALETTE.gold,
            }}>
              {section}
            </span>
            {isAnalysis ? (
              <span style={{
                display: "flex", padding: "8px 14px", border: `1px solid ${OG_PALETTE.line}`, borderRadius: 4,
                color: OG_PALETTE.ink, fontSize: 19, fontWeight: 600, letterSpacing: 2.5, textTransform: "uppercase",
              }}>
                Analysis · no source cited
              </span>
            ) : null}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <SignalRule />
          <div style={{
            fontSize: longTitle ? 46 : 56, lineHeight: 1.08, fontWeight: 600, letterSpacing: -1.4,
            maxWidth: 1040, color: OG_PALETTE.inkHi,
          }}>
            {article.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 22, color: OG_PALETTE.inkLo }}>
            <span style={{ fontFamily: DATA, fontSize: 20, letterSpacing: 1, color: OG_PALETTE.ink }}>{date}</span>
            {hero && heroData ? (
              <span style={{ display: "flex", gap: 10 }}>
                {manufactured ? (
                  <span style={{ color: OG_PALETTE.inkHi }}>
                    {hero.role === "safe-cover" ? "Safe cover — not the original material" : "Editorial illustration — not evidence"}
                  </span>
                ) : null}
                <span>{manufactured ? `· ${hero.credit}` : hero.credit}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    { ...size, ...(fonts.length > 0 ? { fonts } : {}) },
  );
}
