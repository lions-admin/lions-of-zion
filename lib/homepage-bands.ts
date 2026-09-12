import { publicationHubCrumb } from "@/lib/publication-routing";
import { SITE_NAVIGATION, type SiteSectionId } from "@/lib/site-navigation";
import { SYSTEM_LINK } from "@/components/site/navigation-model";

/**
 * The homepage's bands, in the order the page lays them out.
 *
 * One map, read by the edition's contents line and by every band's "All of …"
 * action, so the anchor a reader taps at the top, the section it lands on and
 * the hub it leaves for cannot disagree. Until 2026-09-12 the contents nav was
 * six hand-written anchors and each section carried its own hub href as a
 * string literal.
 *
 * The three publication bands take their hub from `publicationHubCrumb()`,
 * the same derivation the breadcrumb and the article page use, so a hub
 * rename is one edit in `lib/publication-routing.ts`. October 7 and Support
 * take theirs from `SITE_NAVIGATION`; Behind the desk takes its from
 * `SYSTEM_LINK`, the chrome's own control for `/information-war`.
 *
 * `label` is the contents-line word for the band and is pinned byte-for-byte
 * by `tests/destination-naming.test.ts` and `tests/support-surface.test.ts`.
 * `hubLabel` is the text of the band's one way out; the four content bands
 * spell it `All of {label}` in their own source because
 * `tests/destination-naming.test.ts` pins the verb there, and the noun is
 * this map's. `menuOwner` names the
 * chrome menu group the destination lives in (`components/site/
 * navigation-model.ts`): reporting, about, or support.
 */
export type HomepageBandId =
  | "news"
  | "fakeResistance"
  | "october7"
  | "people"
  | "system"
  | "support";

export interface HomepageBand {
  id: HomepageBandId;
  /** The in-page anchor, `#` included, matching the section's `id`. */
  anchor: `#${string}`;
  /** The contents-line label. */
  label: string;
  /** Where "All of …" goes. */
  hubHref: string;
  /** What the band's one way out says. */
  hubLabel: string;
  menuOwner: "reporting" | "about" | "support";
}

function destination(id: SiteSectionId) {
  const item = SITE_NAVIGATION.find((entry) => entry.id === id);
  if (!item) throw new Error(`Homepage bands: no navigation entry for "${id}"`);
  return item;
}

const news = publicationHubCrumb("news");
const fakeResistance = publicationHubCrumb("fakeResistance");
const people = publicationHubCrumb("people");
const october7 = destination("october-7");
const support = destination("support-us");

export const HOMEPAGE_BANDS: readonly HomepageBand[] = [
  { id: "news", anchor: "#home-news", label: news.label, hubHref: news.href, hubLabel: `All of ${news.label}`, menuOwner: "reporting" },
  { id: "fakeResistance", anchor: "#home-narratives", label: fakeResistance.label, hubHref: fakeResistance.href, hubLabel: `All of ${fakeResistance.label}`, menuOwner: "reporting" },
  { id: "october7", anchor: "#home-archive", label: october7.displayName, hubHref: october7.href, hubLabel: `All of ${october7.displayName}`, menuOwner: "reporting" },
  { id: "people", anchor: "#home-people", label: people.label, hubHref: people.href, hubLabel: `All of ${people.label}`, menuOwner: "about" },
  { id: "system", anchor: "#home-system", label: "Behind the desk", hubHref: SYSTEM_LINK.href, hubLabel: SYSTEM_LINK.label, menuOwner: "about" },
  { id: "support", anchor: "#home-support", label: "Support the work", hubHref: support.href, hubLabel: "Other ways to help: report a claim, volunteer a skill, share what is verified", menuOwner: "support" },
];

export function homepageBand(id: HomepageBandId): HomepageBand {
  const band = HOMEPAGE_BANDS.find((candidate) => candidate.id === id);
  if (!band) throw new Error(`Homepage bands: no band "${id}"`);
  return band;
}
