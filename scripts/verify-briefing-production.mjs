// npm/pnpm conventionally retains `--` before script arguments. Accept both
// `npm run briefing:smoke:production -- https://…` (the documented form) and
// direct Node execution without making the operator remember a special case.
const suppliedBase = process.argv[2] === "--" ? process.argv[3] : process.argv[2];
const base = new URL(suppliedBase || "https://lionsofzion.io");
const failures = [];

async function check(path, inspect) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  if (!response.ok) failures.push(`${path}: HTTP ${response.status}`);
  if (inspect) await inspect(response);
  return response;
}

function requireSecurityHeaders(response, label) {
  const csp = response.headers.get("content-security-policy") ?? "";
  if (!response.headers.get("x-content-type-options")) failures.push(`${label}: missing X-Content-Type-Options.`);
  if (response.headers.get("x-frame-options")?.toUpperCase() !== "DENY") failures.push(`${label}: missing X-Frame-Options DENY.`);
  if (!/frame-ancestors 'none'/.test(csp)) failures.push(`${label}: CSP does not forbid framing.`);
  if (!response.headers.get("strict-transport-security")) failures.push(`${label}: missing HSTS.`);
}

await check("/api/internal/health", async (response) => {
  requireSecurityHeaders(response, "/api/internal/health");
  const body = await response.json();
  if (Object.keys(body).some((key) => /provider|database|blob|queue|environment/i.test(key))) {
    failures.push("Public health exposes internal integration detail.");
  }
});
const list = await check("/api/v1/published-publications?limit=1", async (response) => {
  requireSecurityHeaders(response, "/api/v1/published-publications");
});
const payload = await list.json();
const first = payload.publications?.[0];
if (first?.publicId) {
  await check(`/api/v1/published-publications/${encodeURIComponent(first.publicId)}`, async (response) => {
    requireSecurityHeaders(response, "/api/v1/published-publications/[publicId]");
    const detail = await response.json();
    if (!Array.isArray(detail.sources) || detail.sources.some((source) => !source.url || /google\./i.test(source.url))) {
      failures.push("Public article detail contains a missing or Google-referral source URL.");
    }
  });
  await check(`/articles/${encodeURIComponent(first.publicId)}`, async (response) => {
    requireSecurityHeaders(response, "/articles/[publicId]");
    const html = await response.text();
    const canonical = new URL(`/articles/${encodeURIComponent(first.publicId)}`, base).toString();
    if (!html.includes(`rel=\"canonical\" href=\"${canonical}\"`)) failures.push("Article canonical URL is absent or incorrect.");
    if (!/property=\"og:type\" content=\"article\"/.test(html)) failures.push("Article Open Graph type is missing.");
  });
}
await check("/geopolitical-brief", async (response) => requireSecurityHeaders(response, "/geopolitical-brief"));
await check("/admin/login", async (response) => requireSecurityHeaders(response, "/admin/login"));
await check("/sitemap.xml", async (response) => {
  requireSecurityHeaders(response, "/sitemap.xml");
  const xml = await response.text();
  if (first?.publicId && !xml.includes(`/articles/${first.publicId}`)) failures.push("Newest live article is absent from sitemap.");
});

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Briefing production smoke passed.");
