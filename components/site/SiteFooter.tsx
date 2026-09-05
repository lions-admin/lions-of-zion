import Link from "next/link";
import { SITE_DESCRIPTION } from "@/lib/site-config";
import { SECTION_LINKS, REFERENCE_LINKS, isCurrentChromeLink } from "./navigation-model";
import styles from "./site-footer.module.css";

interface SiteFooterProps {
  /** Same value the header takes — see `EditorialShell`. */
  activeSection?: string;
}

const TRUST_HREFS = new Set(["/methodology", "/corrections"]);

/**
 * Compact colophon: whose desk this is, Methodology and Corrections, a dense
 * index of the eight files, and the year. It is not a second wall of the same
 * destinations the header already offered on a long archive page.
 *
 * A server component with no client JavaScript: every link is in the
 * prerendered HTML, so on any reading route this remains a complete index for
 * a reader with scripting off.
 *
 * No newsletter capture, no social row, no "trusted by" strip.
 */
export function SiteFooter({ activeSection }: SiteFooterProps) {
  const current = (href: string) => isCurrentChromeLink(activeSection, href);
  const year = new Date().getFullYear();
  const trustLinks = REFERENCE_LINKS.filter((link) => TRUST_HREFS.has(link.href));
  const furtherLinks = REFERENCE_LINKS.filter((link) => !TRUST_HREFS.has(link.href));

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.identity}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandName}>Lions of Zion</span>
            <span className={styles.brandRole}>Evidence desk</span>
          </Link>
          <p className={styles.statement}>{SITE_DESCRIPTION}</p>
        </div>

        <nav className={styles.reference} aria-label="Reference">
          <ul className={styles.trustList}>
            {trustLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={styles.trustLink}
                  aria-current={current(link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <ul className={styles.furtherList}>
            {furtherLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={styles.furtherLink}
                  aria-current={current(link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <nav className={styles.files} aria-label="Sections">
        <p className={styles.filesLabel}>Explore</p>
        <ul className={styles.fileList}>
          {SECTION_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={styles.fileLink}
                aria-current={current(link.href) ? "page" : undefined}
              >
                <span className={styles.fileName}>{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className={styles.colophon}>
        <p className={styles.copyright}>© {year} Lions of Zion</p>
        {/* `#page-content` is the same anchor `EditorialShell`'s skip link
            targets, so this works with no JavaScript and no extra markup. */}
        <a className={styles.toTop} href="#page-content">
          Back to the top
          <span aria-hidden="true"> ↑</span>
        </a>
      </div>
    </footer>
  );
}
