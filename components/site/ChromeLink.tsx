/**
 * One destination, rendered the same way wherever the chrome puts it.
 *
 * Before this existed the site drew a link to `/october-7` four times, in four
 * sets of class names, from three files: `.barLink` in the masthead,
 * `.primaryMenuLink`/`.secondaryMenuLink` in the drawer and the mobile sheet,
 * and `.trustLink`/`.furtherLink`/`.fileLink` in the colophon. Each carried
 * its own current-page mark, its own hover, its own focus treatment and its
 * own idea of a tap target, so fixing one of those never fixed the others —
 * and the arrow convention (→ for this site, ↗ for off it) had to be
 * remembered separately in each.
 *
 * This is the one anchor. It owns, for every surface:
 *
 *   - the `aria-current="page"` attribute **and** a visible rule under the
 *     link, so "you are here" is never carried by colour alone;
 *   - a 44px minimum target, floored on the box rather than on the text;
 *   - a `:focus-visible` ring with its own geometry — an outline at an
 *     offset, not a recolour;
 *   - the → glyph, which means "on this site"; a link that leaves it does not
 *     belong in the chrome and this component cannot draw ↗.
 *
 * Two axes, and they are orthogonal:
 *
 *   `density` — `detail` prints the destination's one-sentence description
 *     under its name; `compact` prints the name alone.
 *   `size` — `feature`, `standard`, `compact`. Type scale only; it changes
 *     nothing about the contract above.
 *
 * Four combinations are in use, and they are declared in one table in
 * `SiteHeader` and `SiteFooter` rather than guessed at each call site.
 *
 * The bar's own destination links (`.barLink`) are deliberately *not* this
 * component: a fixed row of names under the brand is a different control from
 * a list of destinations, and pretending otherwise would mean one class
 * carrying two layouts through modifiers. They share the model
 * (`navigation-model.ts`) and the `aria-current` rule, which is what has to
 * agree.
 */
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import type { ChromeLink as ChromeLinkModel } from "./navigation-model";
import styles from "./chrome-link.module.css";

export type ChromeLinkDensity = "detail" | "compact";
export type ChromeLinkSize = "feature" | "standard" | "compact";

export interface ChromeLinkProps {
  link: ChromeLinkModel;
  /** True when the reader is on this destination. Drives the rule and `aria-current`. */
  current?: boolean;
  density?: ChromeLinkDensity;
  size?: ChromeLinkSize;
  /**
   * Whether to draw the → glyph. On by default at `detail`, off at `compact`
   * — a dense index of eleven names is a list, and eleven arrows in it are
   * noise rather than direction. The footer's section index turns it back on
   * because each of its cells is a row of its own.
   */
  arrow?: boolean;
  /** Close the panel this link lives in. Absent on the server-rendered footer. */
  onNavigate?: () => void;
}

const SIZE_CLASS: Record<ChromeLinkSize, string> = {
  feature: styles.feature,
  standard: styles.standard,
  compact: styles.compact,
};

export function ChromeLink({
  link,
  current = false,
  density = "compact",
  size = "compact",
  arrow,
  onNavigate,
}: ChromeLinkProps) {
  const withArrow = arrow ?? density === "detail";

  return (
    <Link
      href={link.href}
      className={`${styles.link} ${SIZE_CLASS[size]}`}
      /* The attribute a screen reader reads, and the hook the rule below is
         drawn from — one source, so the two can never disagree. */
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
    >
      <span className={styles.name}>{link.label}</span>
      {withArrow ? (
        /* → and never ↗. ↗ is the glyph readers know as "leaves the site",
           and the colophon's PayPal and coffee links use it that way; it was
           on every internal link too until 2026-09-08 (UX-09). */
        <span className={styles.arrow} aria-hidden="true">
          <Icon name="arrow-right" size={16} strokeWidth={1.5} />
        </span>
      ) : null}
      {density === "detail" ? (
        <span className={styles.description}>{link.description}</span>
      ) : null}
    </Link>
  );
}

/**
 * A labelled group of destinations — the unit both menu panels and the
 * colophon are built from.
 *
 * `<nav>` with an accessible name, because a page that carries four of these
 * gives a screen reader four identical "navigation" landmarks otherwise.
 */
export function ChromeLinkGroup({
  label,
  hiddenLabel = false,
  heading = false,
  links,
  current,
  density = "compact",
  size = "compact",
  arrow,
  onNavigate,
  className,
  measureId,
}: {
  label: string;
  /** Keep the landmark's name without printing it — the colophon's own rows. */
  hiddenLabel?: boolean;
  /** Print the label as a heading (the colophon's index), not a paragraph. */
  heading?: boolean;
  links: readonly ChromeLinkModel[];
  current: (href: string) => boolean;
  density?: ChromeLinkDensity;
  size?: ChromeLinkSize;
  arrow?: boolean;
  onNavigate?: () => void;
  /** Layout only. The surface owns how its group is arranged; never the link. */
  className?: string;
  measureId?: string;
}) {
  return (
    <nav
      aria-label={label}
      className={className}
      data-measure-id={measureId}
      data-measure-exposure={measureId ? "none" : undefined}
    >
      {hiddenLabel ? null : heading ? (
        <h2 className={styles.groupLabel}>{label}</h2>
      ) : (
        <p className={styles.groupLabel}>{label}</p>
      )}
      <ul className={styles.list}>
        {links.map((link) => (
          <li key={link.href}>
            <ChromeLink
              link={link}
              current={current(link.href)}
              density={density}
              size={size}
              arrow={arrow}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
