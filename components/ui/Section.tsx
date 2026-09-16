import React from "react";
import { Heading, type HeadingLevel, type HeadingSize } from "@/components/ui/Heading";
import styles from "./section.module.css";

export type SectionProps = React.HTMLAttributes<HTMLElement> & {
  /** The band's element. A `section` by default; a `div` where the caller
   *  already renders the section and needs only the head. */
  as?: "section" | "div";
  /** The words that name the block — the kicker role, one line above the head. */
  kicker?: React.ReactNode;
  /** The heading's text or nodes. Omit for a content-only band. */
  heading?: React.ReactNode;
  headingLevel?: HeadingLevel;
  headingSize?: HeadingSize;
  /** Anchor for the heading; also wires `aria-labelledby` callers. */
  headingId?: string;
  /** The one sentence under the head. `body` is the running-text step; `small`
   *  is the muted meta-lede under a section head. */
  lede?: React.ReactNode;
  ledeSize?: "body" | "small";
  /** Geometry the surface owns — margins, the top rule — on the head block. */
  headClassName?: string;
  className?: string;
  children: React.ReactNode;
};

/**
 * The band wrapper: a kicker, a heading and a lede, then the band's content.
 *
 * Server component, no client JS. It replaces the hand-rolled section head —
 * an eyebrow paragraph, an `h2` carrying four re-stated role declarations,
 * and a lede paragraph — with one element whose slots say the same three
 * things and whose type reads the system's roles. The band's own separation
 * (rules, margins, scroll offsets) stays with the surface: pass the
 * surface's band class through `className`, its head geometry through
 * `headClassName`.
 */
export function Section({
  as: Component = "section",
  kicker,
  heading,
  headingLevel = "h2",
  headingSize,
  headingId,
  lede,
  ledeSize = "body",
  headClassName = "",
  className = "",
  children,
  ...props
}: SectionProps) {
  const hasHead = kicker !== undefined || heading !== undefined || lede !== undefined;
  return (
    <Component className={className || undefined} {...props}>
      {hasHead ? (
        <div className={headClassName || undefined}>
          {kicker !== undefined ? <p className={styles.kicker}>{kicker}</p> : null}
          {heading !== undefined ? (
            <Heading
              level={headingLevel}
              size={headingSize}
              id={headingId}
            >
              {heading}
            </Heading>
          ) : null}
          {lede !== undefined ? (
            <p className={styles.lede} data-size={ledeSize}>
              {lede}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </Component>
  );
}
