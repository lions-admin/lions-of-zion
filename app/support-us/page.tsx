import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { ContentCard } from "@/components/content";
import { ReportClaimForm } from "@/components/support/ReportClaimForm";
import { VolunteerInterestForm } from "@/components/support/VolunteerInterestForm";
import { ShareVerifiedButton } from "@/components/support/ShareVerifiedButton";
import { PayPalDonateButton } from "@/components/support/PayPalDonateButton";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

const TAGLINE =
  "Ways to join the effort: amplify verified truth, contribute skills, sustain the work.";
const PAGE_URL = `${SITE_URL}/support-us`;

export const metadata: Metadata = {
  title: "Support Us",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: "Support Us — LIONS OF ZION", description: TAGLINE },
};

/* An action page, not an article — WebPage is the correct real schema.org
   type here. */
const SUPPORT_US_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Support Us",
  url: PAGE_URL,
  description: TAGLINE,
  isPartOf: { "@type": "WebSite", name: "Lions of Zion", url: SITE_URL },
};

export default function Page() {
  return (
    <SectionPage id="support-us" surface="quiet" title="Support Us" tagline={TAGLINE}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SUPPORT_US_JSON_LD) }}
      />
      <SectionBlock heading="Two ways to act right now">
        <p>
          Everything else on this page is how to help these two work better.
          Pick one.
        </p>

        <div className={styles.toolkit}>
          {/* Anchored: /corrections sends a reader who has found an error
              straight to this module rather than to the top of the page. */}
          <article className={styles.module} id="report">
            <header className={styles.moduleHeader}>
              <span className={styles.moduleLabel}>Module · Report</span>
              <h3 className={styles.moduleTitle}>Report a claim</h3>
            </header>
            <p className={styles.moduleLede}>
              Seen a claim that needs checking? Send a link or a short
              description — reports are reviewed by the desk, not published
              automatically. Nothing you submit is echoed back or shared
              publicly without that review, and giving an email is entirely
              optional.
            </p>
            <ReportClaimForm />
          </article>

          <article className={styles.module}>
            <header className={styles.moduleHeader}>
              <span className={styles.moduleLabel}>Module · Volunteer</span>
              <h3 className={styles.moduleTitle}>Put a skill to work</h3>
            </header>
            <p className={styles.moduleLede}>
              This network runs on volunteered expertise. Every volunteer
              works inside the same method: evidence first, human review
              before anything is published.
            </p>
            <div className={styles.skillGrid}>
              <ContentCard eyebrow="Investigate" title="Open-source investigation">
                Geolocation, chronolocation, archive work, and network
                analysis of coordinated campaigns.
              </ContentCard>
              <ContentCard eyebrow="Translate" title="Languages">
                Reading and translating primary material across the
                languages of the region and of the networks that target it.
              </ContentCard>
              <ContentCard eyebrow="Build" title="Design and development">
                The tools that make verified material fast to check and easy
                to carry.
              </ContentCard>
            </div>
            <VolunteerInterestForm />
          </article>
        </div>
      </SectionBlock>

      <SectionBlock heading="While you're here">
        <div className={styles.practiceGrid}>
          <div className={styles.practice}>
            <span className={styles.practiceLabel}>Standing practice</span>
            <h3>Amplify</h3>
            <p>
              The simplest contribution is also the most effective: share
              verified material, with its sources attached, into the
              conversations where the falsehood is spreading. A calm
              correction with evidence behind it outlasts outrage. The
              discipline matters as much as the reach — do not pass on what
              you have not checked, even when it favors the truth you
              already know. Everything published here is built to be shared
              intact, sources and all.
            </p>
            <ShareVerifiedButton />
          </div>
          <div className={styles.practice}>
            <span className={styles.practiceLabel}>Secure donation</span>
            <h3>Sustain</h3>
            <p>
              Lions of Judah (R.A.) is an Israeli nonprofit supporting wounded
              IDF soldiers, disabled veterans, lone soldiers, and communities
              affected by October 7. Under the LIONSOFZION brand, founded by
              Daniel Hanukayeb, we provide rehabilitation support, recovery
              assistance, emergency aid, and community programs — helping
              Israel’s heroes rebuild their lives with dignity, strength, and
              hope. Every donation makes a direct difference.
            </p>
            <p>
              Monitoring, archiving, infrastructure, and verification tooling
              all carry real costs. Choose your amount and continue securely
              with PayPal.
            </p>
            <div className={styles.paypalButton}>
              <PayPalDonateButton />
              <noscript>
                <a
                  className={styles.donateLink}
                  href="https://www.paypal.com/ncp/payment/PZPE4USUV3W7E"
                  target="_blank"
                  rel="noreferrer"
                >
                  Donate securely with PayPal →
                </a>
              </noscript>
            </div>
          </div>
        </div>
      </SectionBlock>
    </SectionPage>
  );
}
