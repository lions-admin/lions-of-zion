import Image from "next/image";
import Link from "next/link";
import type { EditorialMedia } from "@/server/contracts/editorial-media";
import type {
  HomeSource,
  HomepageSection,
  HomePreview,
} from "@/server/contracts/homepage";
import { previewSentences } from "@/lib/preview-sentences";
import { ISRAEL_TIME_SUFFIX, formatDateTime, formatDay } from "@/lib/format-date";
import styles from "./homepage-journey.module.css";

/**
 * Sentence budgets for homepage previews at every viewport.
 * Full text remains available in the linked record.
 */
export const PREVIEW_BUDGET = {
  lead: 180,
  companion: 125,
  context: 125,
} as const;

/**
 * Keep the source text intact; CSS limits the preview to whole sentences,
 * with a line clamp as a backstop for a single unusually long sentence.
 */
export function PreviewText({
  text,
  budget = PREVIEW_BUDGET.lead,
}: {
  text: string;
  budget?: number;
}) {
  const { shown, hidden } = previewSentences(text, budget);
  return (
    <>
      {shown}
      {hidden && <span className={styles.previewRest}> {hidden}</span>}
    </>
  );
}

/**
 * The edition's three link roles — and there are only three.
 *
 * Before this, `JourneyLink` was one component re-skinned six ways by ancestor
 * selector (`.sectionAction`, `.archiveSpread`, `.heroCard`, `.contextShelf`,
 * `.supportMore`, default). The same markup served as the primary reading
 * action, the "go to the hub" action and a history-chapter title, separated by
 * a pixel of font size and a transparent-versus-visible hairline. A reader
 * cannot rank what the CSS does not distinguish, which is the mechanism behind
 * "it is not clear what you click where". The role is now stated at the call
 * site and owned here:
 *
 *  - `primary` — the one action that opens this record. It is the only link
 *    role on the page that carries a control's boundary, so a card's action
 *    is never mistaken for its citation. The boundary is neutral: gold is a
 *    viewport's focal moment, not every record's.
 *  - `section` — the way out to a whole hub ("All of News & Analysis").
 *    Text and arrow, deliberately quieter than the record it sits beneath.
 *  - `quiet` — a list row that is its own title (history chapters, the
 *    "other ways to help" line). Inherits its size from the context.
 *
 * Headline links stay undecorated on purpose: an unstyled headline is the
 * convention on every news surface a reader already uses (Jakob's Law), and
 * underlining them would add noise without adding information.
 */
export type JourneyLinkVariant = "primary" | "section" | "quiet";

/* The class is named `linkPrimary`, not `primary`: `.section` is already the
   band-wrapper class in `homepage-journey.module.css`, so a role class called
   `section` would silently re-style every band on the page. */
const LINK_VARIANT_CLASS: Record<JourneyLinkVariant, string> = {
  primary: "linkPrimary",
  section: "linkSection",
  quiet: "linkQuiet",
};

export function JourneyLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: JourneyLinkVariant;
}) {
  return (
    <Link
      className={`${styles.link} ${styles[LINK_VARIANT_CLASS[variant]]}`}
      href={href}
      data-link-role={variant}
    >
      <span>{children}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M4 12h15M13 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/**
 * Kicker and title, nothing else. There is no folio: the `01`-`06` that stood
 * beside the kicker until 2026-09-22 numbered bands that are not a sequence a
 * reader follows, so the band's name carries its place on its own. The section's one destination action is
 * `SectionAction`, a sibling the section grid places beside the title on a
 * wide viewport and after the records on a phone — the way out of a section
 * should not sit between the reader and its first story.
 */
export function SectionHeading({
  id,
  kicker,
  title,
}: {
  id: string;
  kicker: string;
  title: string;
}) {
  return (
    <header className={styles.sectionHead}>
      <p className={styles.kicker}>{kicker}</p>
      {/* `--chars` lets the stylesheet size the title to fit one line when it is
          not sliding (no scroll-timeline support, or reduced motion). */}
      <h2 id={id} style={{ "--chars": title.length } as React.CSSProperties}>{title}</h2>
    </header>
  );
}

export function SectionAction({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <p className={styles.sectionAction}>
      <JourneyLink href={href} variant="section">{children}</JourneyLink>
    </p>
  );
}

/**
 * What a manufactured image is not, when its registry entry does not say.
 * Archival photographs and portraits describe themselves in the caption and
 * carry a disclosure only when one is needed for that picture; an illustration
 * or a safe cover must always say so before anything else is read.
 */
const ROLE_DISCLOSURE: Partial<Record<EditorialMedia["role"], string>> = {
  "editorial-illustration": "Editorial illustration — not evidence",
  "safe-cover": "Safe cover — not the original material",
};

/**
 * Figure and caption. The caption is three things in a fixed order — the
 * disclosure, the description, the credit and licence — so the warning is the
 * first line under every image and the metadata never competes with the
 * headline beneath it. `lead` marks the edition's first picture, which is
 * decoded eagerly because it is the largest thing on the first screen after
 * the cover.
 */
export function HomeMedia({
  media,
  portrait = false,
  lead = false,
  overlay,
}: {
  media: EditorialMedia | null;
  portrait?: boolean;
  lead?: boolean;
  /** A band's lead may set its headline over the picture's lower scrim. It
      comes first in the frame, so the reading order stays headline → picture,
      and the caption — disclosure first — stays under the plate, uncovered. */
  overlay?: React.ReactNode;
}) {
  /* A record without a picture keeps its place on the page; the card is
     text-led rather than empty-framed. */
  if (!media) return null;
  const disclosure = media.role === "safe-cover"
    ? "Safe cover"
    : media.disclosure ?? ROLE_DISCLOSURE[media.role];
  const licence = media.rights.reference.startsWith("https://creativecommons.org");
  return (
    <figure className={`${styles.figure} ${portrait ? styles.portrait : ""}`} data-media-role={media.role} data-overlay={overlay ? "true" : undefined}>
      {/* UX-12. The frame is what shows while a lazy tile is still on its
          way: a tonal ground and the disclosure, under the picture. The media
          contract carries no LQIP, so there is no `blurDataURL` to hand
          `placeholder="blur"`; the label is honest in a way a blur is not,
          and it costs no bytes. The image covers it when it lands. */}
      <div className={styles.frame}>
        {overlay && <div className={styles.frameOverlay}>{overlay}</div>}
        {disclosure && (
          <span className={styles.framePlaceholder} aria-hidden="true">{disclosure}</span>
        )}
        <Image
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          priority={lead}
          fetchPriority={lead ? "high" : "auto"}
          loading={lead ? "eager" : "lazy"}
          sizes={
overlay
              ? "(max-width:759px) 100vw, (max-width:1700px) 92vw, 1460px"
              : portrait
              ? "(max-width:819px) 38vw, 24vw"
              : "(max-width:759px) 100vw, (max-width:1099px) 50vw, 55vw"
          }
          style={{
            objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%`,
          }}
        />
      </div>
      <figcaption>
        {disclosure && <span className={styles.disclosure}>{disclosure}</span>}
        {media.role === "safe-cover" && <span className={styles.captionText}>Illustrated cover. Original material stays in the archive record.</span>}
        {/* One short word, seven times a page. It read "Image context & credit"
           and "Portrait credit", which made the longest string in most
           captions a control nobody opens — chrome ahead of the record it
           belongs to. The figure it sits in already says which picture is
           meant, so the label only has to name what is behind the toggle. */}
        <details className={styles.provenance}>
          <summary>Credit</summary>
          {media.caption && <span className={styles.captionText}>{media.caption}</span>}
          <span className={styles.credit}>
          {media.credit}
          {media.sourceUrl && (
            <>
              {" "}
              · <a href={media.sourceUrl}>Image source</a>
            </>
          )}
          {licence && (
            <>
              {" "}
              · <a href={media.rights.reference}>{media.rights.basis}</a>
            </>
          )}
          </span>
        </details>
      </figcaption>
    </figure>
  );
}

export function HomeSources({ sources }: { sources: HomeSource[] }) {
  if (!sources.length) return null;
  return (
    <p className={styles.sources}>
      Source: <a href={sources[0].url}>{sources[0].label}</a>
      {sources.length > 1 ? " · Further sources in the full record" : ""}
    </p>
  );
}

/**
 * The card's date, revision-aware. A developing story revised at 17:07 is
 * dated by that revision, said as "Updated …", so the card does not read as
 * this morning's; a record never revised is dated by its publication. The
 * `<time>` carries the instant the words describe. Static kinds pass no
 * `updatedAt` on purpose: an archive record's revision stamp is an ingestion
 * date, and printing it would mislead.
 */
export function HomeTime({
  date,
  updatedAt,
  includeTime = false,
}: {
  date: string;
  updatedAt?: string;
  includeTime?: boolean;
}) {
  const published = new Date(date);
  if (Number.isNaN(published.getTime()))
    return <span className={styles.meta}>{date}</span>;
  const revised = updatedAt ? new Date(updatedAt) : null;
  const shown =
    revised && !Number.isNaN(revised.getTime()) && revised.getTime() !== published.getTime()
      ? revised
      : null;
  const at = (shown ?? published).toISOString();
  return (
    <time className={styles.meta} dateTime={at}>
      {shown ? "Updated " : ""}
      {includeTime ? formatDateTime(at) : formatDay(at)}
      {includeTime ? ISRAEL_TIME_SUFFIX : ""}
    </time>
  );
}

/** The first record is the lead; the second is its more compact companion. */
export function rankOf(index: number): "lead" | "companion" {
  return index === 0 ? "lead" : "companion";
}

export function SectionState({
  section,
}: {
  section: HomepageSection<HomePreview>;
}) {
  if (section.items.length)
    return section.state === "partial" ? (
      <p className={styles.availability}>
        One selected record is available in this edition.
      </p>
    ) : null;
  return (
    <p className={styles.availability}>
      {section.state === "unavailable"
        ? "This selection is temporarily unavailable. You can still explore the full section."
        : "No records are selected for this edition. Explore the full section above."}
    </p>
  );
}
