import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { ContentCard } from "@/components/content";
import { ReportClaimForm } from "@/components/support/ReportClaimForm";
import { VolunteerInterestForm } from "@/components/support/VolunteerInterestForm";
import styles from "./page.module.css";

const TAGLINE =
  "Ways to join the effort: amplify verified truth, contribute skills, sustain the work.";

export const metadata: Metadata = {
  title: "Support Us",
  description: TAGLINE,
  openGraph: { title: "Support Us — LIONS OF ZION", description: TAGLINE },
};

export default function Page() {
  return (
    <SectionPage id="support-us" surface="quiet" title="Support Us" tagline={TAGLINE}>
      <SectionBlock heading="Amplify">
        <p>
          The simplest contribution is also the most effective: share verified
          material, with its sources attached, into the conversations where the
          falsehood is spreading. A calm correction with evidence behind it
          outlasts outrage. The discipline matters as much as the reach — do
          not pass on what you have not checked, even when it favors the truth
          you already know. Everything published here is built to be shared
          intact, sources and all.
        </p>
      </SectionBlock>

      <SectionBlock heading="Report a claim for review">
        <p>
          Seen a claim that needs checking? Send a link or a short description
          — reports are reviewed by the desk, not published automatically.
          Nothing you submit is echoed back or shared publicly without that
          review, and giving an email is entirely optional.
        </p>
        <ReportClaimForm />
      </SectionBlock>

      <SectionBlock heading="Contribute skills">
        <p>
          This network runs on volunteered expertise. Every volunteer works
          inside the same method: evidence first, human review before
          anything is published.
        </p>
        <div className={styles.skillGrid}>
          <ContentCard eyebrow="Investigate" title="Open-source investigation">
            Geolocation, chronolocation, archive work, and network analysis of
            coordinated campaigns.
          </ContentCard>
          <ContentCard eyebrow="Translate" title="Languages">
            Reading and translating primary material across the languages of
            the region and of the networks that target it.
          </ContentCard>
          <ContentCard eyebrow="Build" title="Design and development">
            The tools that make verified material fast to check and easy to
            carry.
          </ContentCard>
        </div>
        <VolunteerInterestForm />
      </SectionBlock>

      <SectionBlock heading="Sustain">
        <p>
          Monitoring runs around the clock, and archiving, infrastructure, and
          verification tooling all carry real costs. Sustaining support is what
          keeps the work independent — answerable to the evidence rather than
          to any sponsor. This page describes the avenues; the channels for
          each will be published here as they open.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
