// Keep the share card identical across Open Graph and X. The article-level
// file convention makes Next attach this to public article metadata without
// exposing any internal briefing fields.
export { default, alt, size, contentType } from "./opengraph-image";
export const runtime = "nodejs";
// The same window the Open Graph card and the article page serve on.
export const revalidate = 300;
