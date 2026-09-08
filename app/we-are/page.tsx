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
import { pageMetadata } from "@/lib/page-metadata";

const TAGLINE =
  "Israeli-built technology for the information battlefield — AI-powered, evidence-led and human-governed.";
const PAGE_URL = `${SITE_URL}/we-are`;

export const metadata: Metadata = pageMetadata({
  title: "We Are",
  description: TAGLINE,
  path: "/we-are",
});

const WE_ARE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Lions of Zion",
  url: PAGE_URL,
  description:
    "An independent Israeli-built editorial and public-information platform combining AI-scale research, OSINT, evidence organization and human editorial governance.",
};

const SYSTEM_STEPS: { title: string; icon: IconName; body: string }[] = [
  {
    title: "Observe",
    icon: "intake",
    body: "AI systems help scan large public information environments, monitor developing stories and surface claims, sources and narrative shifts that deserve attention.",
  },
  {
    title: "Research",
    icon: "evidence",
    body: "The system compares sources, traces context and source lineage, organizes evidence and keeps uncertainty visible instead of turning repetition into corroboration.",
  },
  {
    title: "Assess",
    icon: "assessment",
    body: "Claims, evidence, attributed statements, inference and editorial assessment remain different things. Machines can assist analysis; they do not become evidence by producing an answer.",
  },
  {
    title: "Govern",
    icon: "review",
    body: "People define the mission, source standards, publishing permissions, provenance rules, escalation paths, corrections policy and safety boundaries. Sensitive work can be escalated for human editorial review.",
  },
  {
    title: "Publish & correct",
    icon: "publish",
    body: "Authorized editorial workflows can create or update canonical publications, attach sources and illustrations, and publish through the controlled production path. The public record remains versioned and correctable.",
  },
];

const AI_USES = [
  {
    eyebrow: "Scale",
    title: "Discovery & monitoring",
    body: "Scan broad, multilingual information environments and identify developments, claims and evidence gaps worth investigating.",
  },
  {
    eyebrow: "Compare",
    title: "Source & context analysis",
    body: "Compare reporting, primary material and historical context; identify contradictions and avoid treating copies of one source as independent confirmation.",
  },
  {
    eyebrow: "Trace",
    title: "Narrative investigation",
    body: "Follow how unsupported claims, propaganda, manipulated framing and potentially coordinated amplification evolve across the information environment.",
  },
  {
    eyebrow: "Produce",
    title: "Editorial operations",
    body: "Assist drafting, canonical-story updates, source organization, homepage composition and clearly disclosed editorial illustrations inside authorized workflows.",
  },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Can AI publish on Lions of Zion?",
    a: "Yes. Authorized machine-authored editorial runs can research, write, update and publish through the Lions of Zion production pipeline. Those records carry machine provenance and server-enforced publishing rules. This is different from saying that AI is evidence, or that it operates without human-defined policy and accountability.",
  },
  {
    q: "Does a person manually approve every publication before it goes live?",
    a: "No. That is not the operating model. Human-written assessed claims have their own non-author review gate, while machine-authored editorial publications follow a separate disclosed path. Human responsibility sits around the system: standards, permissions, escalation, corrections, supervision and the design of the rules themselves.",
  },
  {
    q: "Does hosting or processing a source mean Lions verified it independently?",
    a: "No. A source is evidence material, not an automatic finding. Imported and archive records retain their own provenance. Multiple copies of one original source remain one source family, and machine processing does not upgrade a claim into verified fact.",
  },
  {
    q: "Is Lions of Zion affiliated with the Israeli government, military or an intelligence agency?",
    a: "No. Lions of Zion is an independent Israeli-built technology and editorial platform. It does not claim state affiliation, classified access or intelligence-agency authority.",
  },
  {
    q: "What happens when something published turns out to be wrong?",
    a: (
      <>
        The record is corrected rather than quietly erased. Significant changes
        should be visible, and uncertainty should change when the evidence
        changes. Read the full <Link href="/corrections">Corrections policy</Link>.
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

      <SectionBlock heading="Technology for the information battlefield">
        <p>
          Lions of Zion is an independent Israeli-built editorial and
          public-information platform for a world in which narratives,
          algorithms, synthetic media and information operations increasingly
          shape what people believe. We combine journalism, OSINT, evidence
          organization and AI-scale research to investigate claims, expose
          manipulation and publish material readers can inspect for themselves.
        </p>
        <p>
          The goal is not to make an algorithm decide truth. It is to make the
          information environment easier to examine: where a claim came from,
          what the source actually shows, what supports it, what contradicts
          it, how it spread and what remains unknown.
        </p>
      </SectionBlock>

      <SectionBlock heading="Why this exists">
        <p>
          Modern conflicts are fought in physical space and in the information
          layer around it. Viral media, selective framing, propaganda,
          synthetic content and repetition can turn uncertainty into apparent
          certainty before careful reporting catches up. Israel is one of the
          clearest arenas in which that problem is visible, but the method
          applies anywhere information manipulation matters.
        </p>
        <p>
          Lions of Zion applies an Israeli culture of technological
          problem-solving to the integrity of public information: move quickly,
          inspect deeply, preserve provenance and build systems that can operate
          at a scale no small newsroom could reach manually.
        </p>
      </SectionBlock>

      <SectionBlock heading="AI-powered. Human-governed.">
        <p>
          AI is a core capability here, not a decorative assistant and not a
          secret. It increases speed, breadth, multilingual reach, comparison,
          monitoring, pattern detection, evidence organization and update
          frequency. But capability is not authority. People define the rules
          under which the systems operate and remain accountable for the
          platform that publishes the result.
        </p>
        <div className={styles.pipeline}>
          <ol className={styles.pipelineList}>
            {SYSTEM_STEPS.map((step, index) => (
              <li key={step.title} className={styles.pipelineStage}>
                <span className={styles.pipelineNode} aria-hidden="true">
                  <Icon name={step.icon} size={18} />
                </span>
                <div className={styles.pipelineContent}>
                  <div className={styles.pipelineHead}>
                    <span className={styles.pipelineNumber}>{String(index + 1).padStart(2, "0")}</span>
                    <h3>{step.title}</h3>
                  </div>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p>
          The publication routes and their exact provenance rules are described
          on <Link href="/methodology">Methodology</Link>. The live system map
          is on <Link href="/information-war">How it works</Link>.
        </p>
      </SectionBlock>

      <SectionBlock heading="What the AI is used for">
        <ul className={styles.roleRoster}>
          {AI_USES.map((role) => (
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

      <SectionBlock heading="The boundaries people set">
        <dl className={styles.principles}>
          <div>
            <dt>Editorial policy</dt>
            <dd>
              Standards decide what deserves publication. The system can move
              quickly; it is not entitled to publish every claim it finds.
            </dd>
          </div>
          <div>
            <dt>Evidence discipline</dt>
            <dd>
              Source, claim, evidence, assessment and uncertainty remain
              separate. Similarity or simultaneous posting is not proof of
              coordination, and AI output is never documentary evidence.
            </dd>
          </div>
          <div>
            <dt>Permissions & provenance</dt>
            <dd>
              Publishing capabilities are controlled, machine-authored work is
              identified as such, and generated illustrations are disclosed as
              illustrations rather than photographs or evidence.
            </dd>
          </div>
          <div>
            <dt>Corrections & escalation</dt>
            <dd>
              Errors can be corrected, significant uncertainty can be updated,
              and consequential work can be escalated when human editorial
              judgment is required.
            </dd>
          </div>
        </dl>
      </SectionBlock>

      <SectionBlock heading="Independent by design">
        <p>
          Lions of Zion is built in Israel, but it is not a government,
          military or intelligence-agency project. It claims no classified
          access and no institutional authority. Its credibility has to come
          from transparent sourcing, inspectable reasoning, clear provenance
          and a record that can be corrected.
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
