import type { Metadata } from "next";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { SITE_URL } from "@/lib/site-config";
import { supersededBy } from "@/lib/superseded-publications";
import { stripSourceDump } from "@/lib/source-dump";
import { formatDateTime, formatDay, formatSourceDay } from "@/lib/format-date";
import { facebookShareUrl, xIntentUrl } from "@/lib/content/share-text";
import { absoluteMediaUrl, articleHeroMedia } from "@/lib/content/homepage-media";
import {
  publicationHomepageSection,
  publicationHubCrumb,
  publicationParentCrumb,
  publicationSupportsInvestigationExplorer,
  routePublication,
  SECTIONS_BY_HOMEPAGE_SECTION,
} from "@/lib/publication-routing";
import Link from "next/link";
import { getPublicPublication, isMissingPublication, listBriefingPublications } from "@/lib/publications";
import {
  CONTINUATION_LABELS,
  continuationPool,
  continueTheRecord,
  type ContinuationReason,
} from "@/lib/continue-the-record";
import type { PublicationSection } from "@/server/contracts/enums";
import { ANALYSIS_AUTHOR, isAnalysisBasis, PUBLICATION_PROVENANCE, publicationProvenance } from "@/server/contracts/publication";
import type { PublicPublicationDetail } from "@/server/contracts/publication";
import {
  SECTION_LABELS,
  TREND_LABELS,
  VERIFICATION_STATES,
} from "@/components/live/publication-labels";
import {
  ActivationBand,
  CorrectionHistory,
  hasSubstantiveCorrections,
  KnownUnknownPanel,
  PublicationMeta,
  SourceList,
  type Source,
} from "@/components/content";
import {
  MediaBlock,
  isManufacturedMedia,
  mediaDisclosure,
} from "@/components/content/MediaBlock";
import { EditorialShell } from "@/components/site/EditorialShell";
import { Badge, type BadgeStatus, BADGE_GRAMMAR } from "@/components/ui/Badge";
import { Breadcrumb } from "@/components/site/Breadcrumb";
import { InvestigationExplorer } from "@/components/evidence/InvestigationExplorer";
import { Card, CardDescription, CardEyebrow, CardTitle } from "@/components/ui/Card";
import { measurePublicationCard, measureSection } from "@/components/measurement/attrs";
import styles from "./article.module.css";

type Props = { params: Promise<{ publicId: string }> };

/** A machine facet — `defense_policy_and_programs` — printed as words. */
function words(value: string): string {
  return value.replaceAll("_", " ");
}

/* The highest-volume route on the site, and until 2026-09-08 the only one of
   the three content routes with no `revalidate` — so it rendered dynamically,
   answered `cache-control: private, no-store`, and every reader cost a
   function invocation and a database round trip while the homepage beside it
   served from the CDN.

   300 seconds matches the `unstable_cache` TTL the same data already uses in
   `lib/publications.ts`, so the two layers expire together instead of one
   holding a value the other has dropped. Freshness does not depend on it: the
   `publication.cache-invalidate` consumer calls
   `revalidatePath("/articles/[publicId]", "page")` inside the same run that
   publishes, so an edit is live in seconds, not in five minutes. */
export const revalidate = 300;

/**
 * Empty on purpose, and the whole reason this route caches at all.
 *
 * `revalidate` alone did nothing here, which is the mistake worth recording:
 * a dynamic segment with no `generateStaticParams` is rendered on demand and
 * never cached, so the export shipped on 2026-09-08 left the route answering
 * `cache-control: private, no-store` and `x-vercel-cache: MISS` exactly as
 * before. Declaring the function — even returning nothing — opts the segment
 * into static generation, and `dynamicParams` (true by default) then renders
 * an unknown `publicId` on first request and caches the result. That is ISR.
 *
 * It returns `[]` rather than the published ids because listing them would
 * put a database read in the build: a Neon outage would stop being a
 * degraded site and start being a failed deploy. Every article is generated
 * on its first request instead, which costs one render each and nothing at
 * build time.
 */
export function generateStaticParams(): { publicId: string }[] {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { publicId } = await params;
  try {
    const article = await getPublicPublication(publicId);
    const articleMedia = articleHeroMedia(article);
    const articleImage = articleMedia ? absoluteMediaUrl(articleMedia.src) : undefined;
    const canonical = SITE_URL + "/articles/" + article.publicId;
    /* T-12. A record with no hero used to emit no `og:image` while still
       declaring `twitter:card = summary_large_image`, so 57 of 73 articles
       previewed as a bare title stub — and `opengraph-image.tsx` in this very
       segment was rendering a real per-article card the whole time, deployed
       and returning 200, referenced by nothing. Next only applies that file
       convention when the page does not define `openGraph` itself, and this
       function does. Naming the route explicitly is what connects them.

       Preferring the generated card over the site card here is deliberate: it
       carries this article's own headline, so a shared link says which record
       it opens rather than only which site. */
    const social = articleImage
      ? [{ url: articleImage, width: articleMedia!.width, height: articleMedia!.height, alt: articleMedia!.alt }]
      : [{ url: `${canonical}/opengraph-image`, width: 1200, height: 630, alt: article.title }];
    /* T-12.c. The tab reads "<headline> — LIONS OF ZION" because the layout's
       title template appends it, but the card carried the bare headline, so a
       shared article named a different thing from the page it opened — on 73
       pages. `lib/page-metadata.ts` states this rule for every hub route; the
       article route predates the helper and never got it. */
    const socialTitle = `${article.title} — LIONS OF ZION`;
    return {
      title: article.title,
      description: article.summary ?? article.title,
      alternates: { canonical },
      openGraph: {
        type: "article",
        title: socialTitle,
        description: article.summary ?? article.title,
        /* T-12.b: articles were the one route family omitting og:url, so a
           scraper had to infer the address from the link it followed. */
        url: canonical,
        publishedTime: article.publishedAt,
        modifiedTime: article.updatedAt,
        images: social,
      },
      twitter: {
        card: "summary_large_image",
        title: socialTitle,
        description: article.summary ?? article.title,
        images: [social[0]!.url],
      },
    };
  } catch (cause) {
    if (isMissingPublication(cause)) return { title: "Article not found" };
    throw cause;
  }
}

export default async function ArticlePage({ params }: Props) {
  const { publicId } = await params;
  let article: PublicPublicationDetail;
  try {
    article = await getPublicPublication(publicId);
  } catch (cause) {
    if (isMissingPublication(cause)) {
      /* VA-48.6. A record archived as a duplicate leaves the public corpus,
         which is what takes it out of search — but its URL may still be in a
         reader's history or a search index, and 404 is the wrong answer when
         the story itself is still published at the canonical address. The
         lookup runs only after the record was genuinely not found, so a stale
         map entry can never shadow a live publication. */
      const canonical = supersededBy(publicId);
      if (canonical) permanentRedirect(`/articles/${canonical}`);
      notFound();
    }
    throw cause;
  }

  /* VA-50. The pool is this record's own desk, which is where a continuation
     for it can plausibly live; `continueTheRecord` then requires a shared
     field, so a wide pool cannot turn into filler. A failure here must never
     take the article down with it — the page falls back to the hub link, which
     is the same thing an empty result produces. */
  const deskSections = SECTIONS_BY_HOMEPAGE_SECTION[publicationHomepageSection(article.section)];
  const continuations = continueTheRecord(
    article,
    await continuationPool(deskSections, (section) =>
      listBriefingPublications(`section=${section}&limit=25`)),
  );
  const desk = publicationHubCrumb(publicationHomepageSection(article.section));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.summary,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    mainEntityOfPage: SITE_URL + "/articles/" + article.publicId,
    author: { "@type": "Organization", name: "Lions of Zion" },
    publisher: { "@type": "Organization", name: "Lions of Zion" },
  };
  const visiblePassages = collapsePublicPassages(article.passages);
  const articleMedia = articleHeroMedia(article);
  /* Read `=== "analysis"` and never the negation: a record whose basis is
     absent or unrecognised must be treated as a sourced one, which is the
     reading that keeps its citations required. */
  const isAnalysis = isAnalysisBasis(article.narrativeWatchDetails);
  const parent = publicationParentCrumb(article.section);
  const details = article.narrativeWatchDetails;
  /* VA-56. Some bodies still end with the composer's own "Sources:" block,
     which the structured stack below the prose already presents properly.
     `stripSourceDump` removes it only when every address in it is in that
     stack, so `publicSourceState` can never flip from `pending` to
     `unsourced` as a result — see `lib/source-dump.ts`. */
  const stackUrls = article.sources.map((source) => source.url).filter((url): url is string => Boolean(url));
  const readableBody = stripSourceDump(article.body, stackUrls);
  /* A record with structured passages never reaches the body fallback, and the
     dump usually sits in the last passage — so it has to be stripped there too,
     and a passage that was nothing but the dump is dropped entirely. */
  const readablePassages = visiblePassages
    .map((passage) => ({ ...passage, text: stripSourceDump(passage.text, stackUrls, { allowEmpty: true }) }))
    .filter((passage) => passage.text.trim().length > 0);
  const passages = readablePassages.length
    ? readablePassages
    : readableBody.split(/\r?\n\r?\n+/).map((text, index) => ({
        position: index + 1,
        text,
        claim: null,
        sources: [],
      }));
  const articleUrl = `${SITE_URL}/articles/${article.publicId}`;
  const shareText = article.summary ?? article.title;
  /* Day precision: the version number tells two same-day entries apart, and
     the copy table's line is "Illustration attached · {date}", not a clock. */
  const correctionEntries = article.corrections.map((correction) => ({
    date: formatDay(correction.changedAt),
    note: correction.summary,
    version: `v${correction.version}`,
  }));
  const substantiveCorrections = hasSubstantiveCorrections(correctionEntries);
  const kickerFacets = [article.arena, article.primaryActor]
    .filter((facet): facet is string => Boolean(facet))
    .map(words);
  /* Whether this record may be staged as an investigation is derived from its
     section in `lib/publication-routing.ts` — the same place hub, route,
     homepage band and label come from. There is deliberately no section list
     in this file. Having content to show is still required, but it is no
     longer sufficient. */
  const showsInvestigationExplorer =
    publicationSupportsInvestigationExplorer(article.section) &&
    Boolean(details || article.sources.length || article.passages.length);
  const sourceState = publicSourceState({
    sourceCount: article.sources.length,
    isAnalysis,
    body: article.body,
    passages: visiblePassages,
  });
  /* VA-13. A picture we *made* must not be the first thing a reader of a
     contested claim interprets, so on a claim page it waits until the status
     and the claim have been stated. Both halves are derived, neither is
     hand-written here: the desk comes from `publicationSupportsInvestigation-
     Explorer` in `lib/publication-routing.ts` — the same map the hub, route,
     homepage band and label come from — and "made rather than taken" comes
     from the media contract's own `role`. A photograph keeps its place; an
     illustration moves. */
  const deferHeroMedia =
    articleMedia !== null &&
    publicationSupportsInvestigationExplorer(article.section) &&
    isManufacturedMedia(articleMedia.role);
  const heroMedia = articleMedia ? (
    <MediaBlock
      layout="reading"
      aspectRatio="8 / 5"
      measureId="article-media"
      /* The lead picture runs the masthead's width; a deferred illustration
         sits in the reading column like any other figure. */
      className={deferHeroMedia ? styles.figure : styles.leadFigure}
      /* The line that says what this image is not stays outside the control
         below it, at every width and with any credit string. */
      disclosure={mediaDisclosure(articleMedia)}
      caption={articleMedia.caption}
      credit={
        <>
          {articleMedia.credit}
          {articleMedia.sourceUrl ? (
            <>
              {" · "}
              <a href={articleMedia.sourceUrl} target="_blank" rel="noreferrer">
                Image source <span aria-hidden="true">↗︎</span>
              </a>
            </>
          ) : null}
        </>
      }
      provenance={`Rights ${articleMedia.rights.status} · ${articleMedia.rights.basis}`}
      provenanceLabel="Image credit and provenance"
    >
      <Image
        src={articleMedia.src}
        width={articleMedia.width}
        height={articleMedia.height}
        alt={articleMedia.alt}
        priority={!deferHeroMedia}
        sizes={deferHeroMedia ? "(min-width: 1220px) 700px, calc(100vw - 40px)" : "(min-width: 1220px) 960px, calc(100vw - 40px)"}
        style={{ objectPosition: `${articleMedia.focalPoint.x}% ${articleMedia.focalPoint.y}%` }}
      />
    </MediaBlock>
  ) : null;

  /* The margin contents: every section this record actually renders, in page
     order. It is a list of places, not a sequence, so it carries no numbers. */
  const contents: { href: string; label: string }[] = [
    ...(details ? [{ href: "#claim-record", label: isAnalysis ? "Analysis record" : "Claim record" }] : []),
    ...(showsInvestigationExplorer ? [{ href: "#evidence-explorer-title", label: "From claim to record" }] : []),
    { href: "#article-body", label: "The report" },
    { href: "#sources", label: sourceState === "analysis" ? "Why no source" : "Public sources" },
    ...(details ? [{ href: "#unknowns", label: "Known unknowns" }] : []),
    ...(article.corrections.length ? [{ href: "#corrections", label: substantiveCorrections ? "Corrections" : "Version history" }] : []),
    { href: "#keep-reading", label: "Keep reading" },
  ];

  return (
    <EditorialShell
      routeId="articles"
      className={styles.page}
      progressTrackClassName={styles.progressTrack}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* `data-measure-page` names what this page is about, so its page view,
          its share sheet and its source clicks are all counted against this
          record. The section is derived from `publication.section`. */}
      <article
        className={styles.article}
        id="page-content"
        data-measure-page=""
        data-measure-content={article.publicId}
        data-measure-type="publication"
        data-measure-section={measureSection(article.section)}
      >
        {/* The masthead: trail, kicker, the page's one headline at the
            masthead tier, the standfirst, and the byline row on its hairline.
            It runs the width of the reading column and its margin. */}
        <header className={styles.masthead}>
          <Breadcrumb
            className={styles.breadcrumb}
            trail={[parent]}
            current={article.title}
          />
          <p className={styles.kicker}>
            <span className={styles.kickerSection}>{SECTION_LABELS[article.section]}</span>
            {/* UX-21. Arena and actor read as the story's dateline — "West
                Bank · Benjamin Netanyahu" — beside the section. The editorial
                topic is a machine facet and is dropped from the reader's view. */}
            {kickerFacets.length ? (
              <span className={styles.kickerFacets}>{kickerFacets.join(" · ")}</span>
            ) : null}
          </p>
          {isAnalysis || article.featuredIsraelStory ? (
            <p className={styles.kickerNotes}>
              {isAnalysis ? (
                <Badge variant="neutral">Organisation analysis · no documentary source</Badge>
              ) : null}
              {article.featuredIsraelStory ? (
                <Badge variant="gold">Featured Israel story</Badge>
              ) : null}
            </p>
          ) : null}
          <h1 className={styles.headline} data-length={headlineLength(article.title)}>
            {article.title}
          </h1>
          {article.summary ? <p className={styles.dek}>{article.summary}</p> : null}
          <div className={styles.byline}>
            <PublicationMeta
              publishedAt={formatDateTime(article.publishedAt)}
              updatedAt={article.updatedAt !== article.publishedAt ? formatDateTime(article.updatedAt) : undefined}
              authorship={PUBLICATION_PROVENANCE[publicationProvenance(article)].label}
              sourceCount={sourceState === "listed" || sourceState === "unsourced" ? article.sources.length : undefined}
            />
          </div>
        </header>

        {deferHeroMedia ? null : heroMedia}

        <div className={styles.reading}>
          <nav className={styles.contents} aria-label="On this page">
            <p className={styles.contentsLabel} aria-hidden="true">On this page</p>
            <ul>
              {contents.map((entry) => (
                <li key={entry.href}>
                  <a href={entry.href}>{entry.label}</a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.column}>
            {details ? (
              <section className={styles.claimRecord} aria-labelledby="claim-record">
                <p className={styles.sectionKicker}>Narrative Watch</p>
                <h2 id="claim-record">{isAnalysis ? "Analysis record" : "Claim record"}</h2>
                {/* Deliberately a paragraph above the record rather than a row
                    inside it. Metadata rows are skimmed; this one is the whole
                    promise the record rests on and has to be read. */}
                {isAnalysis ? (
                  <p className={styles.analysisNote}>
                    This record answers a circulating narrative rather than reporting one. The assessment
                    is our own and cites no documentary source — read it as Lions of Zion&rsquo;s analysis,
                    not as documented fact. The claim it answers is stated in full below.
                  </p>
                ) : null}
                {/* Status first, then the claim as noise — somebody else's
                    sentence, in circulation — then the desk's finding as
                    signal. The status word is never carried by colour alone. */}
                <div className={styles.claimPair}>
                  <div className={styles.claim} data-measure-id="article-claim" data-measure-exposure="claim_exposure">
                    <p className={styles.claimStatus}>
                      <Badge status={details.verificationState}>
                        {VERIFICATION_STATES[details.verificationState].label}
                      </Badge>
                      <span className={styles.claimLabel}>The claim</span>
                    </p>
                    <blockquote className={styles.claimText}>
                      <p>{details.exactClaim}</p>
                    </blockquote>
                  </div>
                  {/* Seen for a second at half height: the reader reached the verdict. */}
                  <div className={styles.finding} data-measure-id="article-verdict" data-measure-exposure="verdict_reached">
                    <p className={styles.claimLabel}>The finding</p>
                    <p className={styles.findingText}>
                      {VERIFICATION_STATES[details.verificationState].meaning}
                    </p>
                  </div>
                </div>
                <dl className={styles.recordFacts}>
                  <div>
                    <dt>Evidence basis</dt>
                    <dd>{isAnalysis ? ANALYSIS_AUTHOR : "Cited public sources"}</dd>
                  </div>
                  <div>
                    <dt>Trend</dt>
                    <dd>{TREND_LABELS[details.trendDirection]}</dd>
                  </div>
                  <div>
                    <dt>Observed propagators</dt>
                    <dd>{details.propagators.join(", ") || "No attributable propagator is recorded."}</dd>
                  </div>
                  <div>
                    <dt>Arenas</dt>
                    <dd>{details.arenas.map(words).join(", ")}</dd>
                  </div>
                  {details.israeliPosition ? (
                    <div data-wide="">
                      <dt>Israeli position</dt>
                      <dd>{details.israeliPosition}</dd>
                    </div>
                  ) : null}
                  {details.securityContext ? (
                    <div data-wide="">
                      <dt>Security context</dt>
                      <dd>{details.securityContext}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}

            {/* The made picture's place on a claim page: after the verdict and the
                exact claim, not above them. */}
            {deferHeroMedia ? heroMedia : null}

            {showsInvestigationExplorer ? <InvestigationExplorer record={article} /> : null}

            <div className={styles.body} id="article-body" data-measure-id="article-body">
              {passages.map((passage) => (
                <section className={styles.passage} key={passage.position}>
                  <div className={styles.passageMain}>
                    <p className={styles.paragraph}>{passage.text}</p>
                    {passage.claim ? (
                      <p className={styles.claimRef}>
                        <span>
                          Claim record: {passage.claim.title}
                        </span>
                        {passage.claim.assessment ? (
                          <Badge status={badgeStatus(passage.claim.assessment)}>
                            {passage.claim.assessment.replaceAll("_", " ")}
                          </Badge>
                        ) : null}
                      </p>
                    ) : null}
                  </div>
                  {passage.sources.length ? (
                    <div className={styles.passageSources}>
                      <SourceList sources={asSourceList(passage.sources)} />
                    </div>
                  ) : null}
                </section>
              ))}
            </div>

            {/* The apparatus, set as endnotes: smaller, ruled, and after the
                report rather than inside it.

                An analysis record has nothing to list here, and a bare "no
                sources" line reads as a malfunction. State the position
                instead: the absence is the disclosure, not a gap in the page.
                If such a record ever does carry sources, they are shown
                normally rather than denied. */}
            {sourceState === "analysis" ? (
              <section className={styles.endnotes} id="sources" data-measure-id="article-sources">
                <h2>Why this record cites no source</h2>
                <p>
                  This is Lions of Zion&rsquo;s own assessment, published deliberately without a
                  documentary source to cite. Nothing is being withheld: the claim it answers, and what
                  remains unknown about it, are set out in the analysis record above.
                </p>
              </section>
            ) : (
              <section className={styles.endnotes} id="sources" data-measure-id="article-sources">
                <h2>Public sources</h2>
                {sourceState === "listed" ? (
                  <ol className={styles.sourceStack}>
                    {article.sources.map((source, index) => (
                      <li key={source.url ?? source.title + index}>
                        {source.url ? (
                          <a href={source.url} target="_blank" rel="noreferrer" data-measure-event="evidence_open">
                            {source.title} <span aria-hidden="true">↗︎</span>
                          </a>
                        ) : (
                          <span className={styles.sourceTitle}>{source.title}</span>
                        )}
                        <span className={styles.sourceMeta}>
                          {source.publisher}
                          {source.publishedAt ? ` · ${formatSourceDay(source.publishedAt)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : sourceState === "pending" ? (
                  /* The text of this record cites material the source stack does
                     not yet carry. Say that, rather than printing "0 sources"
                     above a paragraph with a link in it — the reader can see the
                     citation, and a denial next to it reads as a malfunction or a
                     lie. Nothing is refused or hidden: the record stands, its
                     citations stay in the body, and the stack is stated as
                     incomplete until it is repaired. */
                  <p>
                    Sources for this record are pending verification. Its text cites published material
                    that has not yet been attached to this list; the citations remain visible in the
                    article above while that is completed.
                  </p>
                ) : (
                  <p>No public sources are listed for this article.</p>
                )}
              </section>
            )}

            {details ? (
              <section className={styles.endnotes} id="unknowns" data-measure-id="article-unknowns">
                <h2>Known unknowns</h2>
                {details.knownUnknowns.length ? (
                  <KnownUnknownPanel unknowns={details.knownUnknowns} />
                ) : (
                  <p>No further unknowns are recorded.</p>
                )}
              </section>
            ) : null}

            {/* UX-06 / UX-20. The ending, in order: the proof above, then what to
                do with it, then what changed, then where to read next. An
                analysis record has no source list to trace, so the band opens
                with sharing instead. */}
            <ActivationBand
              className={styles.activation}
              sourcesHref={sourceState === "listed" ? "#sources" : undefined}
              share={{
                url: articleUrl,
                title: article.title,
                text: shareText,
                targets: [
                  { label: "Share on X", href: xIntentUrl(shareText, articleUrl) },
                  { label: "Facebook", href: facebookShareUrl(articleUrl) },
                ],
              }}
            />

            {article.corrections.length ? (
              /* UX-04. A substantive correction gets the heading; a history that
                 is only attachments is one quiet line each, with every note
                 kept verbatim behind the disclosure. The classification is
                 `classifyCorrection`'s. */
              <section
                className={styles.corrections}
                id="corrections"
                aria-label={substantiveCorrections ? undefined : "Version history"}
              >
                {substantiveCorrections ? <h2>Corrections and updates</h2> : null}
                <CorrectionHistory
                  variant="record"
                  corrections={correctionEntries}
                />
              </section>
            ) : null}

            {/* VA-50. Every row here shares an actual field with this record,
                and says which one; when nothing does, the reader is sent to
                the desk rather than shown filler. */}
            <section className={styles.related} id="keep-reading" aria-labelledby="keep-reading-title">
              <h2 id="keep-reading-title">Keep reading</h2>
              {continuations.length ? (
                <ul className={styles.relatedList}>
                  {continuations.map((next, index) => (
                    <li key={next.publicId}>
                      <Card href={`/articles/${next.publicId}`} variant="row"
                        {...measurePublicationCard("article-next", next, `next:${index + 1}`)}>
                        <CardEyebrow>{continuationEyebrow(next.section, next.reason, desk.label)}</CardEyebrow>
                        <CardTitle as="h3">{next.title}</CardTitle>
                        {next.summary ? <CardDescription>{next.summary}</CardDescription> : null}
                      </Card>
                    </li>
                  ))}
                </ul>
              ) : null}
              {/* UX-05 / UX-11. The verb table's hub link, on a target that
                  clears 44px. */}
              <p className={styles.relatedSubhead}>
                <Link className={styles.deskLink} href={desk.href} data-measure-id="article-desk-link">
                  All of {desk.label} <span aria-hidden="true">→</span>
                </Link>
              </p>
            </section>
          </div>
        </div>
      </article>
    </EditorialShell>
  );
}

/**
 * How long a headline is, for the masthead's size step.
 *
 * The masthead tier is sized for a title of a few words; a wire headline of a
 * hundred characters set at that size is a wall of seven lines above the
 * standfirst. The step comes down with the length rather than the headline
 * being cut, so every title stays the largest type on its page.
 */
export function headlineLength(title: string): "short" | "medium" | "long" {
  if (title.length > 90) return "long";
  if (title.length > 52) return "medium";
  return "short";
}

/**
 * An absolute `http(s)://` address in prose, and nothing looser.
 *
 * A bare domain — "reported by haaretz.com" — is a mention, not a citation,
 * and matching it would make every article with a publisher's name in it
 * "pending". A false positive here suppresses a truthful source count, so the
 * matcher stays strict: scheme, `//`, and at least one non-space character.
 */
export function citesAbsoluteUrl(text: string): boolean {
  return /https?:\/\/\S/i.test(text);
}

/**
 * What the "Public sources" section is honestly able to say.
 *
 * - `analysis` — the record cites nothing *by design*. `evidenceBasis` is
 *   derived and all-or-nothing, so the absence is itself the disclosure. This
 *   branch is read as `=== "analysis"`, never as its negation, and takes
 *   precedence over everything below it.
 * - `listed` — sources are stored; show them.
 * - `pending` — no stored sources, but the record's own text carries an
 *   absolute URL. The count and the denial are both suppressed: a page cannot
 *   print a citation and deny having one.
 * - `unsourced` — nothing stored and nothing cited. The plain statement is
 *   accurate, so it stands.
 */
export type PublicSourceState = "analysis" | "listed" | "pending" | "unsourced";

export function publicSourceState(input: {
  sourceCount: number;
  isAnalysis: boolean;
  body: string;
  passages?: readonly { text: string }[];
}): PublicSourceState {
  if (input.isAnalysis && input.sourceCount === 0) return "analysis";
  if (input.sourceCount > 0) return "listed";
  const cited =
    citesAbsoluteUrl(input.body) ||
    (input.passages ?? []).some((passage) => citesAbsoluteUrl(passage.text));
  return cited ? "pending" : "unsourced";
}

export function collapsePublicPassages<T extends PublicPublicationDetail["passages"][number]>(passages: T[]): T[] {
  const visible: T[] = [];
  for (const passage of passages) {
    const duplicate = visible.some((existing) => {
      if (!existing.claim || !passage.claim || existing.claim.publicId !== passage.claim.publicId) return false;
      const existingPublishers = new Set(existing.sources.map((source) => source.publisher));
      if (passage.sources.length && !passage.sources.some((source) => existingPublishers.has(source.publisher))) return false;
      return wordSimilarity(existing.text, passage.text) >= 0.58;
    });
    if (!duplicate) visible.push(passage);
  }
  return visible;
}

/**
 * The eyebrow on a "Continue the record" row.
 *
 * The reason comes from `continueTheRecord` — what this destination actually
 * shares with the record being read. The desk is prepended only when the
 * destination sits on a *different* one, which is the rule the previous
 * `relatedLabel` existed for and which VA-50 would otherwise have dropped: a
 * claim assessment sitting under a news article has to say it comes from
 * somewhere else before it is read as more reporting. Both halves derive from
 * `routePublication`, so a section that moves desk moves this label with it,
 * and a same-desk row is not made to carry a redundant prefix.
 */
export function continuationEyebrow(
  section: PublicationSection,
  reason: ContinuationReason,
  currentHub: string,
): string {
  const hub = routePublication(section).hub;
  const reason_ = CONTINUATION_LABELS[reason];
  return hub === currentHub ? reason_ : `${hub} · ${reason_}`;
}

function asSourceList(
  sources: { title: string; publisher: string; url: string | null }[],
): Source[] {
  return sources.map((source, index) => ({
    id: source.url ?? `${source.title}:${source.publisher}:${index}`,
    label: source.title,
    kind: source.publisher,
    url: source.url ?? undefined,
  }));
}

function badgeStatus(value: string): BadgeStatus {
  return Object.hasOwn(BADGE_GRAMMAR, value) ? (value as BadgeStatus) : "neutral";
}

function wordSimilarity(first: string, second: string): number {
  const words = (value: string) => new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
  const a = words(first);
  const b = words(second);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / (a.size + b.size - intersection);
}

