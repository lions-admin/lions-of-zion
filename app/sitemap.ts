import type { MetadataRoute } from "next";
import { defaultNodes } from "@/components/particle-nav/config";
import { getIndex } from "@/lib/content/archive";
import { categorySlug, DOCUMENTATION_PACKAGE } from "@/lib/content/documentation";
import { getCaseIndex } from "@/lib/content/fake-resistance-cases";
import { TESTIMONIES_PACKAGE } from "@/lib/content/testimonies";
import { SITE_URL } from "@/lib/site-config";

const DOC_PAGES = ["/methodology", "/corrections"];
const ARCHIVE_INDEXES = ["/october-7/testimonies", "/october-7/documentation"];
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
  const [testimonies, documentation, researchCases] = await Promise.all([
    getIndex(TESTIMONIES_PACKAGE),
    getIndex(DOCUMENTATION_PACKAGE),
    getCaseIndex(),
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
    ...defaultNodes.map((node) => ({
      url: `${SITE_URL}${node.href}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...ARCHIVE_INDEXES.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
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

/** The source dates vary in shape; an unparseable one is omitted, not guessed. */
function toDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
