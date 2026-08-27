import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import { getFakeResistanceEdition } from "@/lib/content/fake-resistance";
import { getCaseIndex } from "@/lib/content/fake-resistance-cases";
import { getPlaybook, techniqueHref } from "@/lib/content/fake-resistance-playbook";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

/* The section's root is a hub, not a dossier: it says what Fake Resistance
   is, names the front it belongs to, and hands the reader to one of two
   investigation branches. The worked exhibits live on
   `/fake-resistance/official-narrative`; the research index lives on
   `/fake-resistance/social-media`. What stays here is the method material —
   the machine and its tells — because recognizing the technique is the one
   thing every branch needs the reader to carry in. */

const TAGLINE =
  "Inside the influence machine: how manufactured outrage is built and amplified.";
const PAGE_URL = `${SITE_URL}/fake-resistance`;

export const metadata: Metadata = {
  title: "Fake Resistance",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: "Fake Resistance — LIONS OF ZION", description: TAGLINE },
};

export default async function Page() {
  const [edition, cases] = await Promise.all([
    getFakeResistanceEdition(),
    getCaseIndex(),
  ]);
  const playbook = getPlaybook();

  // Derived, not written down: the counts on the two branch cards track the
  // content seams, so adding a case file updates the card with no edit here.
  const officialCount = edition.cases.length;
  const socialCount = cases.length + 2; // playbook + network + the case files

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Fake Resistance",
    description: TAGLINE,
    url: PAGE_URL,
    author: { "@type": "Organization", name: "Lions of Zion", url: SITE_URL },
    isPartOf: { "@type": "WebSite", name: "Lions of Zion", url: SITE_URL },
    hasPart: [
      {
        "@type": "WebPage",
        name: "Official narrative engineering",
        description:
          "Three worked cases of claims engineered to pass as war reporting — and the corrections that unmade them.",
        url: `${PAGE_URL}/official-narrative`,
      },
      {
        "@type": "WebPage",
        name: "The social-media front",
        description:
          "The influence-network research: the techniques, the cross-network synthesis, and seven documented case files.",
        url: `${PAGE_URL}/social-media`,
      },
    ],
  };

  return (
    <SectionPage
      id="fake-resistance"
      accent="ember"
      title="Fake Resistance"
      tagline={TAGLINE}
      surface="quiet"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className={styles.standfirst}>
        Manufactured outrage is built, not felt: a claim is seeded by a small
        set of accounts, moved by networks that exist to move volume, and
        finally carried by real people who believe they found it themselves.
      </p>
      <p>
        Fake Resistance is this desk&rsquo;s file on that machine. Not on the
        people who disagree — disagreement is not a finding — but on the
        apparatus that manufactures the appearance of one: the recycled
        footage, the amplifier accounts, the laundered consensus. This page
        sets out the front that machine fights on, the two investigations
        that document it from opposite ends, and the methods it runs on.
      </p>

      <SectionBlock heading="The consciousness war">
        <p>
          The fight over what happened has its own name in Hebrew:{" "}
          <span lang="he" dir="rtl">
            מלחמת התודעה
          </span>{" "}
          — the consciousness war. Its premise is that what people believe
          about a war is territory, contested with the same seriousness as
          ground — and that the decisive weapons are not arguments but
          logistics: banked material, standing networks, and rails that move a
          claim faster than any check can follow it.
        </p>
        <p>
          October 7 demonstrated how much of that war was in place before it
          had a subject. In the days immediately after the attack — while
          verification desks were still finding their footing — footage from
          Arma 3, a military simulation game released in 2013, was already
          circulating as combat video, one flagged post alone drawing more
          than three million views. The game&rsquo;s own studio had publicly asked
          people to stop doing this in November 2022, citing the same misuse
          across earlier conflicts. Nothing had to be invented; the technique
          was already routine.
        </p>
        <p>
          The networks were standing too, and this part is documented rather
          than inferred. The operation researchers call Doppelgänger was
          running from at least May 2022. Spamouflage had been active since
          2019, and the largest single takedown of it on record was announced
          five weeks before the attack. Platform enforcement, government
          designations, research-institute analysis and forensic reporting
          each register the same infrastructure independently, and all of it
          predates October 7. The event supplied the occasion; the machinery
          did not need building.
        </p>
      </SectionBlock>

      <SectionBlock heading="Two branches">
        <p>
          The investigation behind this section runs on two fronts, and they
          are different kinds of work. One follows engineered claims into the
          official record — material built to be mistaken for war reporting,
          and the corrections that unmade it. The other maps the social-media
          machine itself: the accounts, the networks between them, and the
          techniques they run. Each branch is a file of its own.
        </p>

        <nav aria-label="Investigation branches" className={styles.branches}>
          <Link
            href="/fake-resistance/official-narrative"
            className={styles.branchCard}
          >
            <span className={styles.branchKicker}>
              <span className={styles.branchTag}>Branch 01</span>
              <span className={styles.branchCount}>
                {officialCount} case files
              </span>
            </span>
            <span className={styles.branchTitle}>
              Official narrative engineering
            </span>
            <span className={styles.branchDesc}>
              Three worked exhibits — the claim as it spread, its origin, its
              amplification, and the evidence that unmade it — with the order
              in which the record caught up.
            </span>
            <span className={styles.branchCta}>
              Open the file
              <span className={styles.branchArrow} aria-hidden="true">
                →
              </span>
            </span>
          </Link>

          <Link
            href="/fake-resistance/social-media"
            className={styles.branchCard}
          >
            <span className={styles.branchKicker}>
              <span className={styles.branchTag}>Branch 02</span>
              <span className={styles.branchCount}>{socialCount} files</span>
            </span>
            <span className={styles.branchTitle}>The social-media front</span>
            <span className={styles.branchDesc}>
              The influence-network research: a {playbook.length}-technique
              playbook, the cross-network synthesis, and seven documented case
              files, graded exactly as the research graded them.
            </span>
            <span className={styles.branchCta}>
              Open the file
              <span className={styles.branchArrow} aria-hidden="true">
                →
              </span>
            </span>
          </Link>
        </nav>
      </SectionBlock>

      <SectionBlock heading="The machine">
        <p>
          The supply chain has four links. A claim is seeded by a small set of
          originating accounts; amplifier networks that exist to move volume
          pick it up; accounts that look organic launder it into traffic that
          looks like consensus; and real people carry it the rest of the way,
          believing they found it themselves. Recycled imagery — footage from
          other conflicts, other years, other continents — is the raw material
          at the top of the chain, and it is where all three exhibits in{" "}
          <Link href="/fake-resistance/official-narrative">
            the official-narrative file
          </Link>{" "}
          came apart.
        </p>
        {/* Stated rather than glossed over: the second link is the one those
            three exhibits do not document. Claiming otherwise would be the
            same move the exhibits exist to expose. */}
        <p>
          The second link is the one those case files cannot show you.
          Documenting an amplifier network takes account-level evidence
          gathered over time, which is what{" "}
          <Link href="/fake-resistance/network">the network file</Link> is for.
        </p>
      </SectionBlock>

      <SectionBlock heading="The tells">
        <p>
          A manufactured wave looks spontaneous from inside and mechanical
          from above. The recurring signatures:
        </p>
        <ul>
          <li>
            <Link href={techniqueHref("synchronized-amplification")}>
              Synchronized timing
            </Link>{" "}
            — a claim erupting everywhere at once, in near-identical phrasing,
            across accounts with no connection to each other.
          </li>
          <li>
            <Link href={techniqueHref("identity-games")}>
              Amplifier accounts created in the same narrow window
            </Link>
            , with thin histories and borrowed profile material.
          </li>
          <li>
            <Link href={techniqueHref("recycled-media")}>
              Imagery that traces to a different time and place
            </Link>{" "}
            — another war, another year, sometimes a video game.
          </li>
          <li>
            <Link href={techniqueHref("verdict-captioning")}>
              A caption that says what the footage does not
            </Link>
            , so an assertion arrives feeling like something you witnessed.
          </li>
        </ul>
        <p>
          None of these alone is proof. Together, and documented, they are a
          pattern — and patterns can be shown. All {playbook.length} techniques
          are treated in full in{" "}
          <Link href="/fake-resistance/playbook">the playbook</Link>: what each
          move is, the mental shortcut it exploits, and what you can check for
          yourself.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
