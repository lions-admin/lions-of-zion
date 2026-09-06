import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { ContentCard } from "@/components/content";
import { ReportClaimForm } from "@/components/support/ReportClaimForm";
import { VolunteerInterestForm } from "@/components/support/VolunteerInterestForm";
import { ShareControls } from "@/components/support/ShareControls";
import { PayPalDonateStep } from "@/components/support/PayPalDonateStep";
import { SupportFlowSwitch, type SupportFlow } from "@/components/support/SupportFlowSwitch";
import { facebookShareUrl, xIntentUrl } from "@/lib/content/share-text";
import { SITE_URL } from "@/lib/site-config";
import flowStyles from "@/components/support/support-flows.module.css";
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

/* What the share flow carries. /support-us has no verified claim of its own to
   point at, so it shares the site's most current verified edition and says so
   — never "share this page". The intent links are composed here, on the
   server, which is what makes them work with scripting off. */
const SHARE_URL = `${SITE_URL}/geopolitical-brief`;
const SHARE_TEXT =
  "News & Analysis from Lions of Zion — reporting, war updates and the sources behind them.";
const SHARE_TITLE = "Lions of Zion — News & Analysis";

/**
 * The page asks one question and then gets out of the way.
 *
 * It used to present four asks at once — two forms, a share control and a
 * PayPal embed — so a reader who came to report one link read all four before
 * finding it. The four are now the four answers to a single question, and only
 * the chosen one is shown. `SupportFlowSwitch` carries the mechanics, including
 * what happens with scripting off (all four revealed) and where
 * `/support-us#report` lands.
 *
 * Every panel below is server-rendered and handed over as a prop, so the copy
 * is in the HTML whether or not the switch ever hydrates, and this file stays
 * a server component.
 */
const FLOWS: SupportFlow[] = [
  {
    id: "report",
    label: "Report a claim",
    emphasis: "primary",
    icon: "warning",
    summary:
      "Send a link or a description of something that needs checking. The desk reviews it.",
    panel: (
      <>
        <p className={flowStyles.flowLede}>
          Seen a claim that needs checking? Send a link or a short description —
          reports are reviewed by the desk, not published automatically. Nothing
          you submit is echoed back or shared publicly without that review, and
          giving an email is entirely optional.
        </p>
        <ReportClaimForm />
      </>
    ),
  },
  {
    id: "volunteer",
    label: "Volunteer a skill",
    icon: "actor",
    summary:
      "Investigation, languages, design and development. Tell the desk what you can do.",
    panel: (
      <>
        <p className={flowStyles.flowLede}>
          This network runs on volunteered expertise. Every volunteer works
          inside the same method: evidence first, human review before anything
          is published.
        </p>
        <div className={flowStyles.skillGrid}>
          <ContentCard eyebrow="Investigate" title="Open-source investigation">
            Geolocation, chronolocation, archive work, and network analysis of
            coordinated campaigns.
          </ContentCard>
          <ContentCard eyebrow="Translate" title="Languages">
            Reading and translating primary material across the languages of the
            region and of the networks that target it.
          </ContentCard>
          <ContentCard eyebrow="Build" title="Design and development">
            The tools that make verified material fast to check and easy to
            carry.
          </ContentCard>
        </div>
        <VolunteerInterestForm />
      </>
    ),
  },
  {
    id: "share",
    label: "Share what is verified",
    icon: "share",
    summary:
      "Carry a sourced record into the conversation where the falsehood is spreading.",
    panel: (
      <>
        <p className={flowStyles.flowLede}>
          The simplest contribution is also the most effective: share verified
          material, with its sources attached, into the conversations where the
          falsehood is spreading. A calm correction with evidence behind it
          outlasts outrage. The discipline matters as much as the reach — do not
          pass on what you have not checked, even when it favors the truth you
          already know.
        </p>
        <ShareControls
          url={SHARE_URL}
          title={SHARE_TITLE}
          text={SHARE_TEXT}
          copyVariant="primary"
          copyLabel="Copy the news desk link"
          lead="Share the news desk: reporting, updates and source context in one place."
          targets={[
            { label: "Share on X", href: xIntentUrl(SHARE_TEXT, SHARE_URL) },
            { label: "Share on Facebook", href: facebookShareUrl(SHARE_URL) },
          ]}
        />
      </>
    ),
  },
  {
    id: "donate",
    label: "Donate",
    icon: "support",
    summary: "Payment is taken by PayPal, on PayPal's own site.",
    panel: (
      <>
        <p className={flowStyles.flowLede}>
          Lions of Judah (R.A.) is an Israeli nonprofit supporting wounded IDF
          soldiers, disabled veterans, lone soldiers, and communities affected
          by October 7. Under the LIONSOFZION brand, founded by Daniel
          Hanukayeb, we provide rehabilitation support, recovery assistance,
          emergency aid, and community programs — helping Israel’s heroes
          rebuild their lives with dignity, strength, and hope. Every donation
          makes a direct difference.
        </p>
        <p className={flowStyles.flowLede}>
          Monitoring, archiving, infrastructure, and verification tooling all
          carry real costs.
        </p>
        <PayPalDonateStep />
      </>
    ),
  },
];

export default function Page() {
  return (
    <SectionPage id="support-us" surface="quiet" title="Support Us" tagline={TAGLINE}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SUPPORT_US_JSON_LD) }}
      />
      <SectionBlock heading="Choose how to help">
        <p className={styles.chooserLede}>
          Four ways to act, and one of them is enough. Pick one — the other
          three stay a single step away, and nothing you have already typed is
          lost by looking.
        </p>
        <SupportFlowSwitch flows={FLOWS} />
      </SectionBlock>
    </SectionPage>
  );
}
