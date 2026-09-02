import Link from "next/link";
import { SITE_DESCRIPTION } from "@/lib/site-config";
import { FILE_LINKS, REFERENCE_LINKS, isCurrentChromeLink } from "./navigation-model";
import styles from "./site-footer.module.css";

interface SiteFooterProps {
  /** Same value the header takes — see `EditorialShell`. */
  activeSection?: string;
}

/**
 * The colophon.
 *
 * Built 2026-09-02 on an owner ruling that reverses the 2026-08-25 decision
 * "no global footer in `app/layout.tsx`". That decision was right about its own
 * mechanism and wrong about the need: a footer mounted in the root layout would
 * land on `/`, `/admin` and `/particle-demo` as well, and the home scene owns
 * exactly one viewport. So this is mounted by `EditorialShell` — every reading
 * route, the whole archive, and nothing else — which is precisely the
 * "conditional on not being the home route" shape the old entry asked for if
 * one were ever built. See `.ai/DECISIONS.md`.
 *
 * A server component with no client JavaScript: every link is in the
 * prerendered HTML, so on any reading route this is a second, complete index of
 * the site for a reader with scripting off.
 *
 * Restraint is the register. No newsletter capture, no social row, no "trusted
 * by" strip — a verification desk's footer is an index and an address, and the
 * things a reader checks it for are Methodology and Corrections.
 */
export function SiteFooter({ activeSection }: SiteFooterProps) {
  const current = (href: string) => isCurrentChromeLink(activeSection, href);
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.masthead}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandName}>Lions of Zion</span>
            <span className={styles.brandRole}>Evidence desk</span>
          </Link>
          <p className={styles.statement}>{SITE_DESCRIPTION}</p>
        </div>

        <nav className={styles.filesGroup} aria-label="Sections">
          <p className={styles.groupLabel}>The eight files</p>
          <ul className={styles.fileList}>
            {FILE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={styles.fileRow}
                  aria-current={current(link.href) ? "page" : undefined}
                >
                  <span className={styles.fileIndex}>{link.index}</span>
                  <span className={styles.fileName}>{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav className={styles.referenceGroup} aria-label="Reference">
          <p className={styles.groupLabel}>Reference</p>
          <ul className={styles.referenceList}>
            {REFERENCE_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={styles.referenceRow}
                  aria-current={current(link.href) ? "page" : undefined}
                >
                  <span className={styles.referenceName}>{link.label}</span>
                  <span className={styles.referenceDescription}>{link.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className={styles.colophon}>
        <p className={styles.copyright}>© {year} Lions of Zion</p>
        {/* `#page-content` is the same anchor `EditorialShell`'s skip link
            targets, so this works with no JavaScript and no extra markup. */}
        <a className={styles.toTop} href="#page-content">
          Back to the top of this file
          <span aria-hidden="true"> ↑</span>
        </a>
      </div>
    </footer>
  );
}
