import Link from "next/link";
import { SignalMark } from "@/components/brand/SignalMark";
import { SITE_DESCRIPTION } from "@/lib/site-config";
import {
  ABOUT_LINKS,
  REPORTING_LINKS,
  SUPPORT_LINK,
  DRAWER_STANDARD_LINKS,
  isCurrentChromeLink,
} from "./navigation-model";
import { ChromeLinkGroup } from "./ChromeLink";
import styles from "./site-footer.module.css";

interface SiteFooterProps {
  /** Same value the header takes — see `EditorialShell`. */
  activeSection?: string;
  home?: boolean;
}

/**
 * The colophon: whose desk this is, a headed index of the files, and the year.
 * It is not a second toolbar repeating the bar's controls.
 *
 * A server component with no client JavaScript: every link is in the
 * prerendered HTML, so on any reading route this remains a complete index for
 * a reader with scripting off. `scripts/ci-smoke.mjs` asserts exactly that,
 * at a desktop *and* at a phone viewport — the phone pass is not redundant,
 * because a link hidden by an ancestor's `display: none` is still in the DOM.
 *
 * Every link below is the shared `ChromeLink`, the same anchor the masthead
 * drawer and the mobile sheet draw. This file used to own three more
 * treatments of its own — `.trustLink`, `.furtherLink`, `.fileLink` — each
 * with its own current-page mark, hover, focus behaviour and target floor.
 * What is left here is where the groups sit, which is the colophon's own
 * business.
 *
 * No newsletter capture, no social row, no "trusted by" strip.
 */
export function SiteFooter({ activeSection, home = false }: SiteFooterProps) {
  const current = (href: string) => isCurrentChromeLink(activeSection, href);
  const year = new Date().getFullYear();

  return (
    /* The footer's exposure is "the reader reached the end of the page";
       its links are `click_nav` wherever they sit. */
    <footer className={`${styles.footer}${home ? ` ${styles.home}` : ""}`} data-measure-id="footer" data-measure-nav="">
      <div className={styles.inner}>
        <div className={styles.identity}>
          <Link href="/" className={styles.brand} data-measure-id="footer-brand" data-measure-exposure="none">
            {/* The nameplate is the large typeset name — the audit's contrast
                was a bar wordmark at body size against this. The bar keeps the
                compact mark; the colophon states the brand at display size. */}
            <span className={styles.brandName}>Lions of Zion</span>
            <span className={styles.brandRole}>Evidence, not narratives</span>
          </Link>
          <p className={styles.statement}>{SITE_DESCRIPTION}</p>
          {/* The legal row, reserved. None of the three routes exists yet, and
              the colophon does not link to pages that would 404. The row ships
              as links the moment `/privacy`, `/terms` and `/contact` exist —
              `ChromeLink`s, one row, no other change needed. */}
          <p className={styles.legal}>
            <span>Privacy</span>
            <span aria-hidden="true"> · </span>
            <span>Terms</span>
            <span aria-hidden="true"> · </span>
            <span>Contact</span>
          </p>
        </div>
      </div>

      {/* The index: headed groups on an auto-fit grid, so no width leaves an
          orphan cell — each group fills the tracks it is given and empty
          tracks collapse. Account and the two tools stay out of it: they
          are permanent controls in the bar, and a colophon cell for a control
          one scroll away is a duplicate. Each group is its own named
          `navigation` region, so a screen reader is never given four
          anonymous ones. The index is a child of the colophon, not of the
          identity block — it is the footer's own band, as it has always
          been, so the shared block's auto-margins keep centring it as a
          block instead of sizing it to content as a grid item would. */}
      <div className={styles.files} data-measure-id="footer-sections" data-measure-exposure="none">
        <ChromeLinkGroup
          label="Reporting & evidence"
          links={REPORTING_LINKS}
          current={current}
          /* One arrow per row, because each cell here *is* a row — the one
             place in the chrome where a compact link earns the glyph. */
          arrow
          measureId="footer-reporting"
        />
        <ChromeLinkGroup
          label="People & purpose"
          links={ABOUT_LINKS}
          current={current}
          arrow
          measureId="footer-people"
        />
        <ChromeLinkGroup
          label="Standards"
          links={DRAWER_STANDARD_LINKS}
          current={current}
          arrow
          measureId="footer-standards"
        />
        <ChromeLinkGroup
          label="Support the desk"
          links={[SUPPORT_LINK]}
          current={current}
          arrow
          measureId="footer-support"
        />
      </div>

      <div className={styles.colophon}>
        {/* The signature: the signal rule closes the page. One appearance per
            page — the hub kicker carries the other, and the cover the last. */}
        <SignalMark className={styles.signalMark} />
        <p className={styles.copyright}>© 2024–{year} Lions of Zion</p>
        {/* `#page-content` is the same anchor the masthead's skip link
            targets, so this works with no JavaScript and no extra markup. */}
        <a className={styles.toTop} href="#page-content" data-measure-id="footer-to-top" data-measure-exposure="none">
          Back to the top
          <span aria-hidden="true"> ↑</span>
        </a>
      </div>
    </footer>
  );
}
