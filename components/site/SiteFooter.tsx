import Link from "next/link";
import { SignalMark } from "@/components/brand/SignalMark";
import { SITE_DESCRIPTION } from "@/lib/site-config";
import { SECTION_LINKS, REFERENCE_LINKS, isCurrentChromeLink } from "./navigation-model";
import { ChromeLinkGroup } from "./ChromeLink";
import styles from "./site-footer.module.css";

interface SiteFooterProps {
  /** Same value the header takes — see `EditorialShell`. */
  activeSection?: string;
  home?: boolean;
}

const TRUST_HREFS = new Set(["/methodology", "/corrections"]);
/** The year the desk began publishing; the range runs to the current one. */
const FOUNDED = 2024;

/**
 * The colophon: whose desk this is, Methodology and Corrections, an index of
 * the sections, and the closing line. It closes every page the same way —
 * the site opens on the signal rule and closes on it (Peak-End: the last
 * thing on every page is the signature and the nameplate, never a donation
 * banner) — rather than as a second toolbar.
 *
 * A server component with no client JavaScript: every link is in the
 * prerendered HTML, so on any reading route this remains a complete index for
 * a reader with scripting off. `scripts/ci-smoke.mjs` asserts exactly that,
 * at a desktop *and* at a phone viewport — the phone pass is not redundant,
 * because a link hidden by an ancestor's `display: none` is still in the DOM.
 *
 * Every link below is the shared `ChromeLink`, the same anchor the masthead
 * drawer and the mobile sheet draw. The group labels are headings, so a
 * screen reader can walk the colophon by section (2026-09-15).
 *
 * No newsletter capture, no social row, no "trusted by" strip.
 */
export function SiteFooter({ activeSection, home = false }: SiteFooterProps) {
  const current = (href: string) => isCurrentChromeLink(activeSection, href);
  const year = new Date().getFullYear();
  const trustLinks = REFERENCE_LINKS.filter((link) => TRUST_HREFS.has(link.href));
  const furtherLinks = REFERENCE_LINKS.filter((link) => !TRUST_HREFS.has(link.href));

  return (
    /* The footer's exposure is "the reader reached the end of the page";
       its links are `click_nav` wherever they sit. */
    <footer className={`${styles.footer}${home ? ` ${styles.home}` : ""}`} data-measure-id="footer" data-measure-nav="">
      <div className={styles.inner}>
        <div className={styles.identity}>
          <Link href="/" className={styles.brand} data-measure-id="footer-brand" data-measure-exposure="none">
            <span className={styles.brandName}>Lions of Zion</span>
            <span className={styles.brandRole}>Evidence, not narratives</span>
          </Link>
          <p className={styles.statement}>{SITE_DESCRIPTION}</p>
        </div>

        {/* Two rows, one landmark name each, so a screen reader is not given
            three anonymous "navigation" regions in one colophon. */}
        <div className={styles.reference}>
          <ChromeLinkGroup
            label="Standards"
            hiddenLabel
            links={trustLinks}
            current={current}
            size="standard"
            arrow={false}
            className={styles.trustRow}
            measureId="footer-reference"
          />
          <ChromeLinkGroup
            label="Further reference"
            hiddenLabel
            links={furtherLinks}
            current={current}
            className={styles.furtherRow}
            measureId="footer-further"
          />
        </div>
      </div>

      <ChromeLinkGroup
        label="Sections"
        heading
        links={SECTION_LINKS}
        current={current}
        /* One arrow per row, because each cell here *is* a row — the one
           place in the chrome where a compact link earns the glyph. */
        arrow
        className={styles.files}
        measureId="footer-sections"
      />

      <div className={styles.colophon}>
        {/* The closing rule: the third and last of the signal rule's three
            places on a page. */}
        <SignalMark className={styles.signal} />
        <p className={styles.copyright}>
          © {FOUNDED}–{year} Lions of Zion
        </p>
        {/* `#page-content` is the same anchor the masthead's skip link
            targets, so this works with no JavaScript and no extra markup. */}
        <a className={styles.toTop} href="#page-content" data-measure-id="footer-to-top" data-measure-exposure="none">
          Back to the top
        </a>
      </div>
    </footer>
  );
}
