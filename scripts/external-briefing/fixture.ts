/**
 * `--fixture` support: a canned collected pool paired with a canned "model
 * output", so `assemblePackage()` and `externalBriefingPackageSchema` can be
 * exercised end to end with no network access and no AI Gateway credential.
 *
 * Every fact below is invented for this fixture and is never submitted
 * anywhere — `--fixture` never reaches `submitPackage()`.
 */

import type { DraftOutput } from "./draft";
import type { CollectedItem } from "./types";

const NOW = new Date("2026-09-03T09:00:00.000Z");

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();
}

/** Five items across four publishers and four categories — including one
 * hostile-state-media-only item that the canned draft below never cites, to
 * exercise the "collected but unused material is silently dropped" path
 * through `assemblePackage()`. */
export function fixtureCollectedItems(): CollectedItem[] {
  return [
    {
      citationKey: "jerusalem-post-0",
      publisherKey: "jerusalem-post",
      publisherName: "The Jerusalem Post",
      publisherHomepageUrl: "https://www.jpost.com",
      publisherLanguage: "en",
      publisherCountry: "IL",
      title: "Northern hospital opens pediatric wing after community fundraising drive",
      url: "https://www.jpost.com/example/pediatric-wing-opens",
      canonicalUrl: null,
      publishedAt: hoursAgo(6),
      excerpt:
        "The hospital's new pediatric wing opened this week after an eighteen-month community fundraising campaign that drew contributions from local businesses, diaspora donors abroad and a nationwide school donation drive. The expansion adds forty beds, a dedicated pediatric trauma bay, and a family respite floor built specifically for relatives of children transferred from the northern border communities.",
      language: "en",
      category: "israeli_media",
      official: false,
    },
    {
      citationKey: "jerusalem-post-1",
      publisherKey: "jerusalem-post",
      publisherName: "The Jerusalem Post",
      publisherHomepageUrl: "https://www.jpost.com",
      publisherLanguage: "en",
      publisherCountry: "IL",
      title: "Tel Aviv startup unveils desalination breakthrough cutting energy use by a third",
      url: "https://www.jpost.com/example/desalination-breakthrough",
      canonicalUrl: null,
      publishedAt: hoursAgo(10),
      excerpt:
        "Engineers at the Tel Aviv-based water-technology startup say a new membrane design cuts the energy required for reverse-osmosis desalination by roughly a third compared with the plants currently supplying the country's coastal cities. The company has signed a pilot agreement with a regional utility and expects the first retrofit to begin testing within the year, with independent verification of the energy figures still pending.",
      language: "en",
      category: "israeli_media",
      official: false,
    },
    {
      citationKey: "un-news-middle-east-0",
      publisherKey: "un-news-middle-east",
      publisherName: "UN News — Middle East",
      publisherHomepageUrl: "https://news.un.org/en/news/region/middle-east",
      publisherLanguage: "en",
      publisherCountry: "US",
      title: "UN humanitarian office publishes updated regional crossing-capacity figures",
      url: "https://news.un.org/example/crossing-capacity-figures",
      canonicalUrl: null,
      publishedAt: hoursAgo(14),
      excerpt:
        "The UN's humanitarian coordination office released updated figures on crossing throughput and aid-truck capacity for the region this week, citing improved coordination with authorities on scheduling and inspection. The office noted that capacity still varies significantly day to day and urged sustained coordination to avoid the bottlenecks recorded earlier in the reporting period.",
      language: "en",
      category: "international_institution",
      official: false,
    },
    {
      citationKey: "tehran-times-0",
      publisherKey: "tehran-times",
      publisherName: "Tehran Times",
      publisherHomepageUrl: "https://www.tehrantimes.com",
      publisherLanguage: "en",
      publisherCountry: "IR",
      title: "State media claims strike targeted civilian infrastructure without evidence",
      url: "https://www.tehrantimes.com/example/claim-civilian-infrastructure",
      canonicalUrl: null,
      publishedAt: hoursAgo(4),
      excerpt:
        "State-affiliated outlets circulated a claim this week alleging that a recent strike deliberately targeted civilian infrastructure, attributing the assessment to unnamed regional officials. No imagery, casualty figures, or independent verification accompanied the report, and no other outlet in this monitoring pool has corroborated the claim as of publication.",
      language: "en",
      category: "hostile_state_media",
      official: false,
    },
    {
      citationKey: "data-gov-il-shelters-0",
      publisherKey: "data-gov-il-shelters",
      publisherName: "Israel Government Open Data — Shelters",
      publisherHomepageUrl: "https://data.gov.il",
      publisherLanguage: "he",
      publisherCountry: "IL",
      title: "Public shelter dataset updated for the northern district",
      url: "https://data.gov.il/dataset/example-shelters-north",
      canonicalUrl: null,
      publishedAt: hoursAgo(20),
      excerpt:
        "The government's open-data portal published a refreshed public shelters dataset covering the northern district, including updated capacity figures and accessibility flags for facilities added or renovated over the past quarter. The dataset is published under the government's open-data license and is intended for use by municipal planners and the public alike.",
      language: "he",
      category: "official_israeli",
      official: true,
    },
  ];
}

/** A Daily Brief (mandatory, fully sourced), one sourced `israel_update`
 * article, and one unsourced "our own analysis" `narrative_watch` article —
 * exercising both the normal sourcing path and the all-or-nothing exemption
 * in the same run. */
export function fixtureDraftOutput(): DraftOutput {
  return {
    dailyBrief: {
      title: "Daily Brief: Aid-crossing coordination improves as shelter data refreshes",
      summary:
        "UN humanitarian coordinators report steadier crossing throughput this week, while Israel's open-data portal refreshes public shelter capacity figures for the northern district.",
      citationKeys: ["un-news-middle-east-0", "data-gov-il-shelters-0"],
      claims: [
        {
          title: "UN reports steadier crossing coordination",
          text: "The UN's humanitarian coordination office reported improved scheduling and inspection coordination at regional crossings this week, while cautioning that daily capacity still varies.",
          layer: "source_claim",
          assessment: "verified",
          attributedTo: "UN News — Middle East",
          uncertainty: "Day-to-day capacity variation means this week's improvement may not hold without sustained coordination.",
          citationLinks: [
            {
              citationKey: "un-news-middle-east-0",
              relation: "supports",
              strength: "adequate",
              rationale: "UN News directly reports the coordination office's own updated figures and characterization.",
            },
          ],
        },
        {
          title: "Israel refreshes public shelter dataset for the north",
          text: "Israel's open-data portal published an updated public shelters dataset for the northern district, including capacity and accessibility figures for facilities added or renovated this quarter.",
          layer: "observed_fact",
          assessment: "verified",
          attributedTo: "Israel Government Open Data",
          uncertainty: null,
          citationLinks: [
            {
              citationKey: "data-gov-il-shelters-0",
              relation: "supports",
              strength: "strong",
              rationale: "The dataset is the official government publication being described; this is a first-party record.",
            },
          ],
        },
      ],
      situation: {
        label: "Situation",
        passages: [
          {
            text: "Coordination between humanitarian agencies and crossing authorities has improved over the past week, according to the UN's own reporting, though officials caution the gains are not yet consistent day to day.",
            claimIndex: 0,
            citationKeys: ["un-news-middle-east-0"],
          },
        ],
      },
      keyEvents: {
        label: "Key Events",
        passages: [
          {
            text: "Israel's government open-data portal refreshed its public shelters dataset for the northern district this week, adding capacity and accessibility details for recently renovated facilities.",
            claimIndex: 1,
            citationKeys: ["data-gov-il-shelters-0"],
          },
        ],
      },
      israeliPosition: null,
      internationalResponses: null,
      watchPoints: {
        label: "Watch Points",
        passages: [
          {
            text: "Whether this week's coordination improvement at crossings holds through the next reporting cycle remains the key open question for regional humanitarian logistics.",
            claimIndex: 0,
            citationKeys: [],
          },
        ],
      },
    },
    articles: [
      {
        section: "israel_update",
        title: "A Membrane Redesign Could Reshape the Coast's Water Economics",
        summary:
          "A Tel Aviv water-tech startup's new membrane design claims a third less energy per liter of desalinated water, with a utility pilot now scheduled.",
        citationKeys: ["jerusalem-post-1"],
        claims: [
          {
            title: "Startup claims major energy reduction in desalination",
            text: "A Tel Aviv-based water-technology startup says its new reverse-osmosis membrane design cuts energy use by roughly a third versus plants currently serving the coast, with a utility pilot now scheduled.",
            layer: "source_claim",
            assessment: "unresolved",
            attributedTo: "The Jerusalem Post",
            uncertainty: "The energy-reduction figure comes from the company itself; independent verification is still pending.",
            citationLinks: [
              {
                citationKey: "jerusalem-post-1",
                relation: "supports",
                strength: "adequate",
                rationale: "The Jerusalem Post's report is the only account of this claim currently in the pool.",
              },
            ],
          },
        ],
        passages: [
          {
            text: "If the efficiency figures hold up under independent testing, the redesign could meaningfully lower the operating cost of coastal desalination capacity that the country increasingly depends on.",
            claimIndex: 0,
            citationKeys: ["jerusalem-post-1"],
          },
          {
            text: "A pilot retrofit with a regional utility is expected to begin testing within the year, which should be the first point at which the energy claim can be checked against real operating data.",
            claimIndex: 0,
            citationKeys: [],
          },
        ],
        narrativeTitle: null,
        editorialTopic: "Innovation",
        primaryActor: "Israeli water-technology sector",
        arena: "Technology",
        featuredIsraelStory: true,
        narrativeWatch: null,
      },
      {
        section: "narrative_watch",
        title: "Unverified Claim of Deliberate Civilian Targeting Circulates Without Evidence",
        summary:
          "State-affiliated media allege a deliberate strike on civilian infrastructure; no imagery, casualty data, or independent corroboration accompanies the claim.",
        citationKeys: [],
        claims: [
          {
            title: "Circulating claim lacks corroborating evidence",
            text: "A claim alleging deliberate targeting of civilian infrastructure has circulated in state-affiliated media without accompanying imagery, casualty figures, or independent verification from any other outlet monitored in this pool.",
            layer: "editorial_conclusion",
            assessment: "unsupported",
            attributedTo: null,
            uncertainty: "This assessment is our own analysis of the claim's evidentiary basis, not a citation of counter-reporting.",
            citationLinks: [],
          },
        ],
        passages: [
          {
            text: "The absence of imagery, casualty figures, or third-party corroboration is itself the notable fact here: a specific, serious allegation is being asserted on attribution to unnamed officials alone.",
            claimIndex: 0,
            citationKeys: [],
          },
          {
            text: "Absent new evidence, this claim should be treated as unverified rather than as an established fact, regardless of how widely it is repeated across state-aligned outlets.",
            claimIndex: 0,
            citationKeys: [],
          },
        ],
        narrativeTitle: "Unverified Civilian-Targeting Claim",
        editorialTopic: "Narrative Monitoring",
        primaryActor: null,
        arena: "Information Space",
        featuredIsraelStory: false,
        narrativeWatch: {
          exactClaim:
            "State-affiliated media allege a strike deliberately targeted civilian infrastructure, without presenting imagery, casualty figures, or independent corroboration.",
          propagators: ["State-affiliated outlets"],
          arenas: ["State media", "Social media amplification"],
          trendDirection: "new",
          israeliPosition: null,
          securityContext: null,
          supportingCitationKeys: [],
          contradictingCitationKeys: [],
          verificationState: "unsupported",
          knownUnknowns: [
            "Independent confirmation of the target's civilian status has not been published by any outlet in this monitoring pool.",
          ],
        },
      },
    ],
  };
}
