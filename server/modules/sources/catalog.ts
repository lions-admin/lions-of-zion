/** Candidate source catalogue. RSS entries remain inactive until the verifier
 * has fetched and parsed them successfully in the target environment. */
export const BRIEFING_RSS_CANDIDATES = [
  /* The canonical English gov.il News channel is linked from the Government
   * RSS directory. It remains inactive until the target environment verifies
   * a live feed response, like every other candidate. */
  { slug: "gov-il-official-news", name: "Government of Israel — Official News", homepageUrl: "https://www.gov.il/en/collectors/news/", feedUrl: "https://www.gov.il/en/api/NewsApi/rss/503be068-3051-4dc0-bc61-65f0b33f0570", language: "en", country: "IL", category: "official_israeli" },
  { slug: "times-of-israel", name: "The Times of Israel", homepageUrl: "https://www.timesofisrael.com", feedUrl: "https://www.timesofisrael.com/feed/", language: "en", country: "IL", category: "israeli_media" },
  { slug: "jerusalem-post", name: "The Jerusalem Post", homepageUrl: "https://www.jpost.com", feedUrl: "https://www.jpost.com/rss/rssfeedsfrontpage.aspx", language: "en", country: "IL", category: "israeli_media" },
  { slug: "ynetnews", name: "Ynetnews", homepageUrl: "https://www.ynetnews.com", feedUrl: "https://www.ynetnews.com/Integration/StoryRss3082.xml", language: "en", country: "IL", category: "israeli_media" },
  { slug: "israel-hayom", name: "Israel Hayom", homepageUrl: "https://www.israelhayom.com", feedUrl: "https://www.israelhayom.com/feed/", language: "en", country: "IL", category: "israeli_media" },
  { slug: "haaretz", name: "Haaretz", homepageUrl: "https://www.haaretz.com", feedUrl: "https://www.haaretz.com/cmlink/1.628765", language: "en", country: "IL", category: "critical_media" },
  { slug: "bbc-middle-east", name: "BBC News — Middle East", homepageUrl: "https://www.bbc.com/news/world/middle_east", feedUrl: "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml", language: "en", country: "GB", category: "international_media" },
  { slug: "guardian-middle-east", name: "The Guardian — Middle East", homepageUrl: "https://www.theguardian.com/world/middleeast", feedUrl: "https://www.theguardian.com/world/middleeast/rss", language: "en", country: "GB", category: "international_media" },
  { slug: "france24-middle-east", name: "France 24 — Middle East", homepageUrl: "https://www.france24.com/en/middle-east/", feedUrl: "https://www.france24.com/en/middle-east/rss", language: "en", country: "FR", category: "international_media" },
  { slug: "dw-middle-east", name: "DW — World", homepageUrl: "https://www.dw.com/en/world/s-1429", feedUrl: "https://rss.dw.com/rdf/rss-en-world", language: "en", country: "DE", category: "international_media" },
  { slug: "al-jazeera", name: "Al Jazeera", homepageUrl: "https://www.aljazeera.com", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml", language: "en", country: "QA", category: "regional_critical" },
  { slug: "middle-east-eye", name: "Middle East Eye", homepageUrl: "https://www.middleeasteye.net", feedUrl: "https://www.middleeasteye.net/rss", language: "en", country: "GB", category: "regional_critical" },
  { slug: "arab-news", name: "Arab News", homepageUrl: "https://www.arabnews.com", feedUrl: "https://www.arabnews.com/rss.xml", language: "en", country: "SA", category: "regional_media" },
  { slug: "daily-sabah", name: "Daily Sabah", homepageUrl: "https://www.dailysabah.com", feedUrl: "https://www.dailysabah.com/rssFeed/12", language: "en", country: "TR", category: "regional_media" },
  { slug: "tehran-times", name: "Tehran Times", homepageUrl: "https://www.tehrantimes.com", feedUrl: "https://www.tehrantimes.com/rss", language: "en", country: "IR", category: "hostile_state_media" },
  { slug: "presstv", name: "Press TV", homepageUrl: "https://www.presstv.ir", feedUrl: "https://www.presstv.ir/rss", language: "en", country: "IR", category: "hostile_state_media" },
  { slug: "un-news-middle-east", name: "UN News — Middle East", homepageUrl: "https://news.un.org/en/news/region/middle-east", feedUrl: "https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml", language: "en", country: "US", category: "international_institution" },
  { slug: "unrwa", name: "UNRWA", homepageUrl: "https://www.unrwa.org", feedUrl: "https://www.unrwa.org/rss.xml", language: "en", country: "JO", category: "aid_institution" },
  { slug: "human-rights-watch-middle-east", name: "Human Rights Watch — Middle East", homepageUrl: "https://www.hrw.org/middle-east/north-africa", feedUrl: "https://www.hrw.org/rss/news", language: "en", country: "US", category: "critical_institution" },
  { slug: "atlantic-council-middle-east", name: "Atlantic Council — Middle East", homepageUrl: "https://www.atlanticcouncil.org/region/middle-east/", feedUrl: "https://www.atlanticcouncil.org/region/middle-east/feed/", language: "en", country: "US", category: "research" },
  { slug: "washington-institute", name: "The Washington Institute", homepageUrl: "https://www.washingtoninstitute.org", feedUrl: "https://www.washingtoninstitute.org/rss.xml", language: "en", country: "US", category: "research" },
  { slug: "bellingcat", name: "Bellingcat", homepageUrl: "https://www.bellingcat.com", feedUrl: "https://www.bellingcat.com/feed/", language: "en", country: "NL", category: "fact_checking" },
  { slug: "politifact", name: "PolitiFact", homepageUrl: "https://www.politifact.com", feedUrl: "https://www.politifact.com/rss/factchecks/", language: "en", country: "US", category: "fact_checking" },
] as const;

/** Atom uses the same safe feed connector as RSS, but remains explicit in the
 * catalogue so format coverage is visible during verification. This is the
 * same publisher family as the existing Bellingcat RSS candidate. */
export const BRIEFING_ATOM_CANDIDATES = [
  { slug: "bellingcat-atom", name: "Bellingcat — Atom", homepageUrl: "https://www.bellingcat.com", feedUrl: "https://www.bellingcat.com/feed/atom/", language: "en", country: "NL", category: "fact_checking", sourceFamilySlug: "outlet-bellingcat" },
] as const;

/** Official public data APIs are kept separate from editorial feeds. */
export const BRIEFING_OFFICIAL_API_CANDIDATES = [
  {
    slug: "data-gov-il-shelters",
    name: "Israel Government Open Data — Shelters",
    homepageUrl: "https://data.gov.il",
    feedUrl: "https://data.gov.il/api/3/action/package_search?rows=20&q=%D7%9E%D7%A7%D7%9C%D7%98%D7%99%D7%9D",
    language: "he",
    country: "IL",
    category: "official_israeli",
    config: {
      itemsPath: "result.results",
      idPath: "name",
      titlePath: "title",
      excerptPath: "notes",
      publishedAtPath: "metadata_modified",
      urlTemplate: "https://data.gov.il/dataset/{name}",
    },
  },
] as const;

/**
 * What Agent Search is sent out to find, and why.
 *
 * The mix is the editorial brief in machine-readable form, so it is weighted
 * the way the site is: four queries on the narratives the site exists to
 * refute, three on the daily regional geopolitical brief, three on the daily
 * Israel article. It used to be five on `war_update` and one on
 * `narrative_watch` — the exact inverse of the stated priority — and
 * `war_update` is no longer produced as its own article type at all, so the
 * security material now feeds the brief instead of a section of its own.
 *
 * Two things to know before editing an entry:
 *
 * `group` is written into the created source's `config` and is read by
 * nothing. It is a label recording which article a query was collected for,
 * useful in the admin audit; retagging one changes documentation, not
 * behaviour. The `query` string is the part that has an effect.
 *
 * `syncBriefingSourceCatalog` only ever *creates*. It skips an entry whose
 * slug or whose derived logical key (a hash of the query text) already
 * exists, and there is no update path for `agent_search`. So editing a query
 * in place leaves the live source running the old text while this file claims
 * the new one. **Change the query, change the slug** — the rewrite then
 * arrives as a new inactive source, and the one it replaces is retired by
 * hand. Entries below that kept their slug kept their query verbatim.
 *
 * Every query has to earn its results against `BRIEFING_PRIORITY_DOMAINS`,
 * which is the whole corpus Discovery Engine may see. A vague query inside a
 * bounded corpus does not return less; it returns the same front pages every
 * day, which is worse than nothing because it looks like collection.
 */
export const BRIEFING_DISCOVERY_QUERIES = [
  /* 1. Refuting anti-Israel narratives — the first priority, and the reason
     four of ten queries point here. Each one is aimed at a different
     accusation family so the four do not return one another's results, and
     each deliberately spans both halves of the corpus: the outlet making the
     claim and the official or fact-checking source answering it, because a
     refutation needs both and collecting only one is collecting half a file. */
  { slug: "anti-israel-narratives", name: "Anti-Israel narrative monitoring", query: "Israel IDF accusations misinformation disinformation narrative", group: "narrative_watch" },
  { slug: "idf-conduct-accusations", name: "IDF conduct accusations and rebuttals", query: "IDF accused war crime genocide starvation civilian casualty figures Gaza contested death toll fact check verified footage", group: "narrative_watch" },
  { slug: "israel-legal-delegitimization", name: "Legal and institutional delegitimization", query: "Israel ICJ ICC arrest warrant UN commission of inquiry special rapporteur apartheid allegation Amnesty Human Rights Watch report response", group: "narrative_watch" },
  { slug: "coordinated-anti-israel-campaigns", name: "Coordinated campaigns and antisemitism", query: "anti-Israel disinformation campaign fabricated image recycled footage coordinated inauthentic amplification BDS boycott campus antisemitism incident", group: "narrative_watch" },

  /* 2. The daily regional geopolitical brief. These three are the folded
     `war_update` set: operations, the Iranian axis, and the diplomacy around
     both. Security reporting keeps being collected — it now arrives as brief
     material rather than as its own article. `daily_brief` is also the one
     section the quality gate holds to `daily_brief_official_context`, so each
     query names the official Israeli vocabulary that check looks for. */
  { slug: "israel-security-operations", name: "Israel security operations", query: "IDF operation Gaza West Bank rocket fire interception hostage security incident IDF spokesperson statement Israel Defense Ministry", group: "daily_brief" },
  { slug: "iran-axis-regional-threats", name: "Iran and the regional axis", query: "Iran Hezbollah Houthi Lebanon Syria Yemen Iraq proxy strike missile drone nuclear enrichment IAEA sanctions Israel", group: "daily_brief" },
  { slug: "regional-diplomacy-statecraft", name: "Regional diplomacy and statecraft", query: "Israel Middle East diplomacy ceasefire negotiation hostage talks normalization agreement United States European Union policy statement", group: "daily_brief" },

  /* 3. The daily Israel article — innovation, history, civic achievement.
     Deliberately worded away from conflict vocabulary: inside this corpus a
     query carrying "security" or "Gaza" collapses back into the brief's
     results, which is how the old `israel-current-affairs` query behaved. */
  { slug: "israel-resilience", name: "Israel resilience and achievement", query: "Israel resilience recovery innovation civic achievement", group: "israel_update" },
  { slug: "israel-innovation-research", name: "Israeli innovation and research", query: "Israeli startup technology medical research clinical trial water desalination agriculture space science breakthrough funding", group: "israel_update" },
  { slug: "israel-heritage-society", name: "Israeli heritage and society", query: "Israel archaeology excavation discovery heritage site museum exhibition volunteering community civil society culture", group: "israel_update" },
] as const;

/** Initial bounded corpus for Agent Search. Provider setup must configure the
 * data store to this allowlist; keeping the same list in source metadata makes
 * scope drift visible in the admin audit. */
export const BRIEFING_PRIORITY_DOMAINS = [
  "gov.il", "idf.il", "knesset.gov.il", "mfa.gov.il", "mod.gov.il", "police.gov.il",
  "timesofisrael.com", "jpost.com", "ynetnews.com", "israelhayom.com", "haaretz.com",
  "kan.org.il", "n12.co.il", "i24news.tv", "reuters.com", "apnews.com", "bbc.com",
  "theguardian.com", "france24.com", "dw.com", "cnn.com", "nytimes.com", "washingtonpost.com",
  "aljazeera.com", "middleeasteye.net", "arabnews.com", "dailysabah.com", "tehrantimes.com",
  "presstv.ir", "aa.com.tr", "news.un.org", "unrwa.org", "icrc.org", "who.int", "hrw.org",
  "amnesty.org", "atlanticcouncil.org", "washingtoninstitute.org", "csis.org", "bellingcat.com",
  "politifact.com", "factcheck.org", "snopes.com",
  "state.gov", "consilium.europa.eu", "iaea.org", "ochaopt.org",
  "skynewsarabia.com", "al-monitor.com", "foreignpolicy.com",
] as const;

/**
 * Discovery results are persisted under their original publisher, not under
 * the Google discovery source. Keep the editorial category with that publisher
 * as well. Without this mapping, a Google-discovered Tehran Times result looks
 * unclassified to the briefing quality gate even though the catalog already
 * knows it is hostile-state media.
 */
const SOURCE_CATEGORY_DOMAINS = [
  ["official_israeli", ["gov.il", "idf.il", "mfa.gov.il", "mod.gov.il", "knesset.gov.il", "police.gov.il"]],
  ["israeli_media", ["timesofisrael.com", "jpost.com", "ynetnews.com", "israelhayom.com", "kan.org.il", "n12.co.il", "i24news.tv"]],
  ["critical_media", ["haaretz.com"]],
  ["international_media", ["reuters.com", "apnews.com", "bbc.com", "theguardian.com", "france24.com", "dw.com", "cnn.com", "nytimes.com", "washingtonpost.com", "foreignpolicy.com"]],
  ["regional_critical", ["aljazeera.com", "middleeasteye.net"]],
  ["hostile_state_media", ["tehrantimes.com", "presstv.ir"]],
  ["international_institution", ["news.un.org", "unrwa.org", "icrc.org", "who.int", "state.gov", "consilium.europa.eu", "iaea.org", "ochaopt.org"]],
  ["regional_media", ["arabnews.com", "dailysabah.com", "aa.com.tr", "skynewsarabia.com", "al-monitor.com"]],
  ["critical_institution", ["hrw.org", "amnesty.org"]],
  ["research", ["atlanticcouncil.org", "washingtoninstitute.org", "csis.org"]],
  ["fact_checking", ["bellingcat.com", "politifact.com", "factcheck.org", "snopes.com"]],
] as const;

export type BriefingSourceCategory = (typeof SOURCE_CATEGORY_DOMAINS)[number][0];

export function sourceCategoryForDomain(value: string | null | undefined): BriefingSourceCategory | null {
  const host = (value ?? "").toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  if (!host) return null;
  for (const [category, domains] of SOURCE_CATEGORY_DOMAINS) {
    if (domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) return category;
  }
  return null;
}
