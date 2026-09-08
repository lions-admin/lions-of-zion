import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./hub-masthead.module.css";

export type HubJumpLink = { href: string; label: string };

interface HubMastheadProps {
  /** Short label above the title: "What is happening", "Who Israel is". */
  kicker?: string;
  title: ReactNode;
  /** One sentence under the title. */
  standfirst?: ReactNode;
  /**
   * One sentence at the masthead's foot carrying the fact a reader can act on —
   * when this hub last changed. Usually `<HubUpdated at={…} />`.
   */
  status?: ReactNode;
  /** In-page destinations along the masthead's foot. */
  jumps?: HubJumpLink[];
  className?: string;
}

/**
 * The masthead of a hub route — News & Analysis, Fake Resistance, The People
 * of Israel.
 *
 * Both hubs used to open with a 28px title on one line and a grey sentence on
 * the other, which is the register of a settings page. A hub is a front: it
 * carries the site's display face at display size, a kicker that says what the
 * reader does here, and the in-page destinations a reader would otherwise have
 * to scroll to discover.
 *
 * UX-15 — the `facts` rail is gone. It was a `<dl>` of small integers in mono
 * caps ("STORIES ON FILE 23 · ANTISEMITISM RECORDS 1"): a dashboard convention
 * that, at those values, advertised thinness, and a count the reader cannot
 * act on encodes nothing. What survives is one sentence in the lede's voice
 * with the useful fact — when the hub last changed — and any count that
 * matters moved into the section head it belongs to.
 *
 * Server component. The root carries `id="page-content"` so the shell's skip
 * link and the footer's "Back to the top" both land here.
 */
export function HubMasthead({ kicker, title, standfirst, status, jumps, className }: HubMastheadProps) {
  return (
    <header
      className={[styles.masthead, className].filter(Boolean).join(" ")}
      id="page-content"
      tabIndex={-1}
    >
      <div className={styles.headline}>
        {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
        <h1 className={styles.title}>{title}</h1>
        {standfirst ? <p className={styles.standfirst}>{standfirst}</p> : null}
      </div>

      {status ? <p className={styles.status}>{status}</p> : null}

      {jumps?.length ? (
        <nav className={styles.jumps} aria-label="Jump to">
          {jumps.map((jump) => (
            <Link key={jump.href} href={jump.href} className={styles.jump}>
              {jump.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

const JERUSALEM = "Asia/Jerusalem";

/** The Jerusalem calendar date of an instant, as `YYYY-MM-DD`. */
function jerusalemDay(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: JERUSALEM, dateStyle: "short" }).format(at);
}

/** The Jerusalem hour of an instant, 0–23. */
function jerusalemHour(at: Date): number {
  return Number(new Intl.DateTimeFormat("en", { timeZone: JERUSALEM, hour: "numeric", hour12: false }).format(at));
}

/**
 * "Updated 4:18 this morning · Jerusalem time" — the one fact a reader on a hub
 * can act on, said the way a person would say it.
 *
 * Today reads as a time of day, yesterday as "yesterday", and anything older
 * as a date: the sentence is about recency, and a reader who sees "on 2
 * September" has been told the desk has been quiet without a count to prove
 * it. The clock is returned apart from the words around it so that only the
 * machine value takes the data face. Returns `null` for an unparseable
 * instant rather than a sentence with a hole in it.
 */
export function hubUpdatedParts(at: string, now: Date = new Date()): { before: string; clock: string; after: string } | null {
  const instant = new Date(at);
  if (!Number.isFinite(instant.getTime())) return null;
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: JERUSALEM, hour: "numeric", minute: "2-digit" }).format(instant);
  const day = jerusalemDay(instant);
  const today = jerusalemDay(now);
  if (day === today) {
    const hour = jerusalemHour(instant);
    const part = hour < 12 ? "this morning" : hour < 18 ? "this afternoon" : "this evening";
    return { before: "Updated", clock, after: part };
  }
  const yesterday = jerusalemDay(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (day === yesterday) return { before: "Updated yesterday at", clock, after: "" };
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: JERUSALEM, day: "numeric", month: "long" }).format(instant);
  return { before: `Updated ${date} at`, clock, after: "" };
}

/** The sentence as one string — for a test, or a place with no markup. */
export function hubUpdatedSentence(at: string, now: Date = new Date()): string {
  const parts = hubUpdatedParts(at, now);
  return parts ? [parts.before, parts.clock, parts.after].filter(Boolean).join(" ") : "";
}

/**
 * The status sentence with its instant machine-readable: the words in the
 * text face, the clock alone inside `<time>`. Exported for the news desk,
 * which renders it inside its edition rather than through the masthead — the
 * desk shell is deliberately synchronous and cannot know the read's result.
 */
export function HubUpdated({ at }: { at: string }) {
  const parts = hubUpdatedParts(at);
  if (!parts) return null;
  return (
    <>
      {parts.before} <time dateTime={at}>{parts.clock}</time>{parts.after ? ` ${parts.after}` : ""} · Jerusalem time
    </>
  );
}
