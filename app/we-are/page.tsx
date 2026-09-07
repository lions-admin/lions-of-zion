import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import {
  Card,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

const TAGLINE =
  "Who Lions of Zion are, why this network exists, and how it works.";
const PAGE_URL = `${SITE_URL}/we-are`;

export const metadata: Metadata = {
  title: "We Are",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: "We Are — LIONS OF ZION", description: TAGLINE },
};

/* This page is the site's own "about" page — Organization is the correct
   real schema.org type here, not Article. */
const WE_ARE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Lions of Zion",
  url: PAGE_URL,
  description:
    "A network of volunteers — researchers, analysts, translators, designers, developers — who verify claims before publishing, so the answer to organized misinformation about Israel is organized evidence.",
};

const METHOD_STEPS: { title: string; icon: IconName; body: string; gate?: boolean }[] = [
  {
    title: "Ingest",
    icon: "intake",
    body: "A source is fetched and the fetch itself is logged — every attempt, not just the successes — so the record of what was checked is as permanent as the record of what was found.",
  },
  {
    title: "Evidence",
    icon: "evidence",
    body: "A claim is linked to evidence with its own type and strength. Evidence only counts toward an assessment once it's confirmed, not the moment it's attached.",
  },
  {
    title: "Assessment",
    icon: "assessment",
    body: "Confidence is scored across ten separate dimensions — source independence, media provenance, contradiction level, and more — never collapsed into one number that hides how it was reached.",
  },
  {
    title: "Human review",
    icon: "review",
    body: "A second person who did not write the assessment must approve it before anything moves to published. That approval capability cannot be held by an automated identity — the system refuses it structurally, not by policy alone.",
    /** The one stage nothing automated can pass through — marked structurally, not decoratively. */
    gate: true,
  },
  {
    title: "Publish & search",
    icon: "publish",
    body: "Only what clears review becomes part of the public, searchable record — carrying its sources with it.",
  },
];

const ROLES = [
  {
    eyebrow: "Find",
    title: "Investigators",
    body: "Trace a claim to its origin; geolocation, chronolocation and archive work.",
  },
  {
    eyebrow: "Check",
    title: "Verification reviewers",
    body: "The second, non-author reviewer every assessment requires before it can publish.",
  },
  {
    eyebrow: "Read",
    title: "Linguists & translators",
    body: "Primary material across the languages of the region and the networks that target it.",
  },
  {
    eyebrow: "Build",
    title: "Engineers",
    body: "The tools that make verified material fast to check and easy to carry.",
  },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Does AI publish anything on its own here?",
    a: "No. Every published item passes a required, non-author human review — approving a publication is one of a small set of capabilities the system will not let an automated identity hold, at any point.",
  },
  {
    q: "What happens when something published turns out to be wrong?",
    a: (
      <>
        It&apos;s corrected in place and marked as corrected, not deleted. The full policy and the public log are on the <Link href="/corrections">Corrections page</Link>.
      </>
    ),
  },
  {
    q: "Who funds this?",
    a: (
      <>
        Funding sources aren&apos;t published in full yet. What exists today is reader donations, through PayPal and Buy Me a Coffee — both on <Link href="/support-us">Support Us</Link>.
      </>
    ),
  },
  {
    q: "Can I help?",
    a: (
      <>
        Yes — <Link href="/support-us">Support Us</Link> has a working way to report a claim for review, and skill areas the network is looking for.
      </>
    ),
  },
];

export default function Page() {
  return (
    <SectionPage id="we-are" surface="quiet" title="We Are" tagline={TAGLINE}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WE_ARE_JSON_LD) }}
      />
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
        <div className={styles.pipeline}>
          {/* The per-stage `Reveal` that used to be here is gone, and the
              reasoning that kept it does not survive contact with the rest of
              the system. `SectionBlock` is already this section's entrance,
              so every stage was blurring pixels the section had just blurred;
              and a pipeline is a process order, not a chronology — the stages
              do not *happen* as a reader scrolls, so staging their arrival
              described something untrue about them. Reveal is for section
              entrances and real chronological progression (the dated entries
              on Israel's Story). Removing it also takes the last client
              boundary off this route: the page is server-rendered whole.

              The same five stages, in the same order and with the same one
              gate, are drawn on `/methodology` — two pages describing one
              pipeline differently is how a reader learns not to trust
              either. */}
          <ol className={styles.pipelineList}>
            {METHOD_STEPS.map((step, index) => (
              <li
                key={step.title}
                className={styles.pipelineStage}
                data-gate={step.gate ? "" : undefined}
              >
                <span className={styles.pipelineNode} aria-hidden="true">
                  <Icon name={step.icon} size={18} />
                </span>
                <div className={styles.pipelineContent}>
                  <div className={styles.pipelineHead}>
                    <span className={styles.pipelineNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{step.title}</h3>
                  </div>
                  {step.gate ? (
                    <span className={styles.gateLabel}>Gate — human only</span>
                  ) : null}
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        {/* Proof, not assertion: the stages above are what happens, and the
            rules they enforce — what counts as a source, how a claim is
            labeled, what the method cannot support — are written down where a
            reader can hold this page to them. */}
        <p>
          The standard those stages enforce is published in full on the{" "}
          <Link href="/methodology">Methodology</Link> page, including the
          things it cannot yet do.
        </p>
      </SectionBlock>

      <SectionBlock heading="Roles">
        <p>
          The network runs on volunteered expertise across a few broad
          areas — not a fixed org chart, and not names published here.
        </p>
        <ul className={styles.roleRoster}>
          {ROLES.map((role) => (
            <Card as="li" key={role.title} variant="row">
              <CardHeader>
                <CardEyebrow>{role.eyebrow}</CardEyebrow>
              </CardHeader>
              <CardTitle>{role.title}</CardTitle>
              <CardDescription>{role.body}</CardDescription>
            </Card>
          ))}
        </ul>
      </SectionBlock>

      {/* One paragraph carried four separate commitments in a row, separated
          by colons, which is the shape of a list that has not been written as
          one — a reader scanning for "what do they promise about funding?"
          had to read all four to find it. Every clause below is the clause
          that was in that paragraph; only the structure changed. Each is
          named, and the two that are enforced rather than promised say which
          they are. */}
      <SectionBlock heading="Principles">
        <dl className={styles.principles}>
          <div>
            <dt>Independence</dt>
            <dd>
              No sponsor gets a say in what gets published or how it&apos;s
              assessed.
            </dd>
          </div>
          <div>
            <dt>Funding</dt>
            <dd>
              Not yet published in full — reader donations, through PayPal and
              Buy Me a Coffee, are on <Link href="/support-us">Support Us</Link>.
            </dd>
          </div>
          <div>
            <dt>Privacy</dt>
            <dd>
              A report can be submitted with no name attached, and stays that
              way unless the reporter chooses otherwise.
            </dd>
          </div>
          <div>
            <dt>Conflicts of interest</dt>
            <dd>
              A reviewer does not approve their own work — that rule is
              enforced by the system, not just asked for.
            </dd>
          </div>
        </dl>
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
