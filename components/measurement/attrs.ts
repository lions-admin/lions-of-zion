/**
 * `data-measure-*` attributes for a surface, built in one place so every card
 * on every hub carries the same five keys the collector reads.
 *
 * Deliberately no `"use client"`: server components call these while
 * rendering, and a client-module function cannot be called on the server.
 */

import type { PublicationSection } from "@/server/contracts/enums";
import {
  publicationHomepageSection,
  type PublicationHomepageSection,
} from "@/lib/publication-routing";

/** The measurement band, in the homepage's own spelling (`news`,
 *  `fake-resistance`, `people`). */
const BAND: Record<PublicationHomepageSection, string> = {
  news: "news",
  fakeResistance: "fake-resistance",
  people: "people",
};

/**
 * A publication's measurement section, derived from `publication.section` —
 * the only placement field — through `lib/publication-routing.ts`. Never
 * chosen per surface: the homepage, a hub card and the article's own page view
 * must agree, or the content screen splits one record into three rows.
 */
export function measureSection(section: PublicationSection): string {
  return BAND[publicationHomepageSection(section)];
}

/**
 * The content id a publication is counted under: its `publicId`, everywhere.
 * The homepage keys a live record as `publication:<publicId>`; stripping the
 * prefix is what lets a homepage exposure, a hub click and the article's page
 * view land on the same row. Static keys (the archive, the narratives) pass
 * through unchanged.
 */
export function measureContentId(key: string): string {
  return key.startsWith("publication:") ? key.slice("publication:".length) : key;
}

type MeasureAttrs = {
  "data-measure-id": string;
  "data-measure-section"?: string;
  "data-measure-content"?: string;
  "data-measure-type"?: string;
  "data-measure-placement"?: string;
  "data-measure-card"?: "";
};

/** A card: exposure once per visit, clicks recorded as `click_card`. */
export function measureCard(input: {
  id: string;
  section: string;
  content: string;
  type?: string;
  placement?: string;
}): MeasureAttrs {
  return {
    "data-measure-id": input.id,
    "data-measure-section": input.section,
    "data-measure-content": input.content,
    "data-measure-type": input.type ?? "publication",
    ...(input.placement ? { "data-measure-placement": input.placement } : {}),
    "data-measure-card": "",
  };
}

/**
 * A publication card on a named surface. The id is `<surface>-<publicId>`, so
 * it is stable across renders and unique per record — exposure de-dupes per
 * component id, and a shared id would count only the first card of a list.
 */
export function measurePublicationCard(
  surface: string,
  item: { publicId: string; section: PublicationSection },
  placement?: string,
): MeasureAttrs {
  return measureCard({
    id: `${surface}-${item.publicId}`,
    section: measureSection(item.section),
    content: item.publicId,
    placement,
  });
}
