// Keep the share card identical across Open Graph and X. The article-level
// file convention makes Next attach this to public article metadata without
// exposing any internal briefing fields. The cache posture follows the card's:
// five minutes, never `force-dynamic` (2026-09-16).
export { default, alt, size, contentType } from "./opengraph-image";
export const runtime = "nodejs";
export const revalidate = 300;
