import Image from "next/image";
import Link from "next/link";
import type { EditorialMedia } from "@/server/contracts/editorial-media";
import type {
  HomeSource,
  HomepageSection,
  HomePreview,
} from "@/server/contracts/homepage";
import { previewSentences } from "@/lib/preview-sentences";
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

/** The one arrow vocabulary of the edition: a way into a record or a section. */
export function JourneyLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className={styles.link} href={href}>
      <span>{children}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M4 12h15M13 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

/**
 * Kicker and title, nothing else. The section's one destination action is
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
      <h2 id={id}>{title}</h2>
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
      <JourneyLink href={href}>{children}</JourneyLink>
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
}: {
  media: EditorialMedia;
  portrait?: boolean;
  lead?: boolean;
}) {
  const disclosure = media.role === "safe-cover"
    ? "Safe cover"
    : media.disclosure ?? ROLE_DISCLOSURE[media.role];
  const licence = media.rights.reference.startsWith("https://creativecommons.org");
  return (
    <figure className={`${styles.figure} ${portrait ? styles.portrait : ""}`} data-media-role={media.role}>
      <Image
        src={media.src}
        alt={media.alt}
        width={media.width}
        height={media.height}
        loading={lead ? "eager" : "lazy"}
        sizes={
          portrait
            ? "(max-width:819px) 38vw, 24vw"
            : "(max-width:759px) 100vw, (max-width:1099px) 50vw, 55vw"
        }
        style={{
          objectPosition: `${media.focalPoint.x}% ${media.focalPoint.y}%`,
        }}
      />
      <figcaption>
        {disclosure && <span className={styles.disclosure}>{disclosure}</span>}
        {media.role === "safe-cover" && <span className={styles.captionText}>Illustrated cover. Original material stays in the archive record.</span>}
        <details className={styles.provenance}>
          <summary>{portrait ? "Portrait credit" : "Image context & credit"}</summary>
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

export function HomeTime({
  date,
  includeTime = false,
}: {
  date: string;
  includeTime?: boolean;
}) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime()))
    return <span className={styles.meta}>{date}</span>;
  return (
    <time className={styles.meta} dateTime={parsed.toISOString()}>
      {new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Jerusalem",
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(includeTime
          ? ({ hour: "2-digit", minute: "2-digit" } as const)
          : {}),
      }).format(parsed)}
      {includeTime ? " · Israel time" : ""}
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
