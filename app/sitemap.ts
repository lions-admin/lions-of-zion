import type { MetadataRoute } from "next";
import { SITE_NAVIGATION } from "@/lib/site-navigation";
import { getIndex } from "@/lib/content/archive";
import { categorySlug, DOCUMENTATION_PACKAGE } from "@/lib/content/documentation";
import { getCaseIndex } from "@/lib/content/fake-resistance-cases";
import { TESTIMONIES_PACKAGE } from "@/lib/content/testimonies";
import { SITE_URL } from "@/lib/site-config";
import { listBriefingPublications } from "@/lib/publications";
import { encodePublicPublicationCursor } from "@/server/contracts/publication";

// A sitemap must never retain a URL after an administrator archives a public
// article. The publication query remains explicitly tagged and is expired by
// the mutation handler; making this route dynamic also prevents a stale
// prerendered sitemap from surviving at the CDN layer.
export const dynamic = "force-dynamic";

/* `/search` and `/ask` are instruments rather than documents, but they are
   entry points a reader should be able to find, and neither has a query in its
   canonical URL — the results a query produces are not pages and are not
   listed. */
const DOC_PAGES = ["/methodology", "/corrections", "/information-war", "/search", "/ask"];
const ARCHIVE_INDEXES = ["/october-7/testimonies", "/october-7/documentation"];
/** The two investigation branches the Fake Resistance hub opens onto. */
const BRANCH_INDEXES = [
  "/fake-resistance/official-narrative",
  "/fake-resistance/social-media",
];
/** Reference works under Fake Resistance, alongside the eight destinations. */
const RESEARCH_INDEXES = ["/fake-resistance/playbook", "/fake-resistance/network"];

/**
 * One entry per archive *record*, not per page.
 *
 * A record with seven language versions is one thing published seven times,
 * so it gets a single entry at its default-language URL carrying `alternates`
 * for the rest. Listing all 1,177 pages as peers would ask a crawler to treat
 * translations as separate works and invite them to compete with each other.
 *
 * This route is prerendered at build time, so reading the packages here costs
 * nothing at runtime.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [testimonies, documentation, researchCases, publications] = await Promise.all([
    getIndex(TESTIMONIES_PACKAGE),
    getIndex(DOCUMENTATION_PACKAGE),
    getCaseIndex(),
    allPublishedArticles(),
  ]);

  const record = (
    basePath: string,
    languages: string[],
    defaultLanguage: string,
    date: string | null,
  ): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${basePath}`,
    lastModified: toDate(date),
    changeFrequency: "yearly",
    // Deliberately below the eight destinations: these are the evidence the
    // site rests on, not the pages it wants read first.
    priority: 0.3,
    alternates:
      languages.length > 1
        ? {
            languages: Object.fromEntries(
              languages.map((locale) => [
                locale,
                `${SITE_URL}${basePath}${locale === defaultLanguage ? "" : `/${locale}`}`,
              ]),
            ),
          }
        : undefined,
  });

  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    ...SITE_NAVIGATION.map((node) => ({
      url: `${SITE_URL}${node.href}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...ARCHIVE_INDEXES.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Above the reference works: a branch page is the hub's decision moment,
    // one step below the eight destinations themselves.
    ...BRANCH_INDEXES.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...RESEARCH_INDEXES.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...DOC_PAGES.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    // Above the archive records: a case file is a work this desk wrote, not
    // material it is hosting.
    ...researchCases.map((entry) => ({
      url: `${SITE_URL}/fake-resistance/cases/${entry.slug}`,
      lastModified: toDate(entry.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...publications.map((entry) => ({
      url: `${SITE_URL}/articles/${entry.publicId}`,
      lastModified: new Date(entry.updatedAt),
      changeFrequency: "daily" as const,
      priority: entry.section === "daily_brief" ? 0.8 : 0.7,
    })),
    ...testimonies.map((entry) =>
      record(
        `/october-7/testimonies/${entry.id}`,
        entry.languages,
        entry.defaultLanguage,
        entry.date,
      ),
    ),
    ...documentation.map((entry) =>
      record(
        `/october-7/documentation/${categorySlug(entry.category)}/${entry.id}`,
        entry.languages,
        entry.defaultLanguage,
        entry.date,
      ),
    ),
  ];
}

async function allPublishedArticles() {
  const rows = [];
  let cursor: string | undefined;
  do {
    const query = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : {}) });
    // `/articles/[publicId]` is deliberately the briefing-only public route.
    // Do not feed historical site-reference publications into this sitemap;
    // they are not addressable through that route and would become dead URLs.
    const page = await listBriefingPublications(query.toString());
    rows.push(...page);
    cursor = page.length === 100 ? encodePublicPublicationCursor(page[page.length - 1]!) : undefined;
  } while (cursor && rows.length < 5_000);
  return rows;
}

/** The source dates vary in shape; an unparseable one is omitted, not guessed. */
function toDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
