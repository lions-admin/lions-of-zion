import type { Metadata } from "next";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { ContentCard } from "@/components/content";
import styles from "./page.module.css";

const TAGLINE =
  "Who Lions of Zion are, why this network exists, and how it works.";

export const metadata: Metadata = {
  title: "We Are",
  description: TAGLINE,
  openGraph: { title: "We Are — LIONS OF ZION", description: TAGLINE },
};

const METHOD_STEPS = [
  {
    title: "Ingest",
    body: "A source is fetched and the fetch itself is logged — every attempt, not just the successes — so the record of what was checked is as permanent as the record of what was found.",
  },
  {
    title: "Evidence",
    body: "A claim is linked to evidence with its own type and strength. Evidence only counts toward an assessment once it's confirmed, not the moment it's attached.",
  },
  {
    title: "Assessment",
    body: "Confidence is scored across ten separate dimensions — source independence, media provenance, contradiction level, and more — never collapsed into one number that hides how it was reached.",
  },
  {
    title: "Human review",
    body: "A second person who did not write the assessment must approve it before anything moves to published. That approval capability cannot be held by an automated identity — the system refuses it structurally, not by policy alone.",
    /** The one stage nothing automated can pass through — marked structurally, not decoratively. */
    gate: true,
  },
  {
    title: "Publish & search",
    body: "Only what clears review becomes part of the public, searchable record — carrying its sources with it.",
  },
];

const FAQ = [
  {
    q: "Does AI publish anything on its own here?",
    a: "No. Every published item passes a required, non-author human review — approving a publication is one of a small set of capabilities the system will not let an automated identity hold, at any point.",
  },
  {
    q: "What happens when something published turns out to be wrong?",
    a: "It's corrected in place and marked as corrected, not deleted. The full policy and the public log are on the Corrections page.",
  },
  {
    q: "Who funds this?",
    a: "Funding sources aren't public yet. See Support Us for how sustaining channels will be published as they open.",
  },
  {
    q: "Can I help?",
    a: "Yes — Support Us has a working way to report a claim for review, and skill areas the network is looking for.",
  },
];

export default function Page() {
  return (
    <SectionPage id="we-are" surface="quiet" title="We Are" tagline={TAGLINE}>
      <SectionBlock heading="Who we are">
        <p>
          Lions of Zion is a network of volunteers — researchers, analysts,
          translators, designers, developers — who share one discipline:
          verify before you publish. The network exists because the
          information war against Israel is organized, funded, and fast,
          and because the answer to organized falsehood is not louder
          anger. It is organized evidence.
        </p>
      </SectionBlock>

      <SectionBlock heading="The method">
        <p>
          Everything published here moves through the same real pipeline —
          not a description of an intention, but the actual path a claim
          takes before it reaches this site. One stage is a gate, not a
          step: nothing automated can pass it.
        </p>
        <div
          className={styles.pipeline}
          style={{ ["--step-count" as string]: METHOD_STEPS.length }}
        >
          <div className={styles.pipelineTrack} aria-hidden="true" />
          <ol className={styles.pipelineList}>
            {METHOD_STEPS.map((step) => (
              <li
                key={step.title}
                className={styles.pipelineStage}
                data-gate={step.gate ? "" : undefined}
              >
                <span className={styles.pipelineNode} aria-hidden="true" />
                <div className={styles.pipelineContent}>
                  <h3>{step.title}</h3>
                  {step.gate ? (
                    <span className={styles.gateLabel}>Gate — human only</span>
                  ) : null}
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </SectionBlock>

      <SectionBlock heading="Roles">
        <p>
          The network runs on volunteered expertise across a few broad
          areas — not a fixed org chart, and not names published here.
        </p>
        <div className={styles.roleGrid}>
          <ContentCard eyebrow="Find" title="Investigators">
            Trace a claim to its origin; geolocation, chronolocation and
            archive work.
          </ContentCard>
          <ContentCard eyebrow="Check" title="Verification reviewers">
            The second, non-author reviewer every assessment requires
            before it can publish.
          </ContentCard>
          <ContentCard eyebrow="Read" title="Linguists & translators">
            Primary material across the languages of the region and the
            networks that target it.
          </ContentCard>
          <ContentCard eyebrow="Build" title="Engineers">
            The tools that make verified material fast to check and easy
            to carry.
          </ContentCard>
        </div>
      </SectionBlock>

      <SectionBlock heading="Principles">
        <p>
          Independence: no sponsor gets a say in what gets published or how
          it’s assessed. Funding: not yet public — see Support Us for what
          exists today. Privacy: a report can be submitted with no name
          attached, and stays that way unless the reporter chooses
          otherwise. Conflicts of interest: a reviewer does not approve
          their own work — that rule is enforced by the system, not just
          asked for.
        </p>
      </SectionBlock>

      <SectionBlock heading="FAQ">
        <dl className={styles.faq}>
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </SectionBlock>
    </SectionPage>
  );
}
