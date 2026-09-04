import type { Metadata } from "next";
import Link from "next/link";
import { SectionBlock, SectionPage } from "@/components/sections/SectionPage";
import {
  Card,
  CardCount,
  CardCta,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { getFakeResistanceEdition } from "@/lib/content/fake-resistance";
import { getCaseIndex } from "@/lib/content/fake-resistance-cases";
import { getPlaybook, techniqueHref } from "@/lib/content/fake-resistance-playbook";
import { getNarrativeWatchFeed } from "@/lib/content/fake-resistance-watch";
import { SITE_URL } from "@/lib/site-config";
import styles from "./page.module.css";

/* The section's root is a Dossier hub, not an essay (INV-001): a thesis, the
   most recent case file, the two investigation branches, the network entry,
   and an index of the methods — in that order, so a reader reaches a case or
   a branch before any long-form argument begins. The argument itself (the
   consciousness war, the supply chain) still lives here, below the files it
   frames. The worked exhibits live on `/fake-resistance/official-narrative`;
   the research index lives on `/fake-resistance/social-media`; the live daily
   feed — the one branch this hub does not curate by hand — lives on
   `/fake-resistance/watch`. */

const TAGLINE =
  "Inside the influence machine: how manufactured outrage is built and amplified.";
const PAGE_URL = `${SITE_URL}/fake-resistance`;

export const metadata: Metadata = {
  title: "Fake Resistance",
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: "Fake Resistance — LIONS OF ZION", description: TAGLINE },
};

/** A date the reader can read, from the ISO stamp the research recorded. */
function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function Page() {
  const [edition, cases] = await Promise.all([
    getFakeResistanceEdition(),
    getCaseIndex(),
  ]);
  const playbook = getPlaybook();

  /* Same reasoning as app/page.tsx's own `featuredPublications()` call: an
     unreadable projection must not 500 an otherwise fully static hub over a
     cache hiccup. The branch card below just shows no live count. */
  let watchCount = 0;
  try {
    watchCount = (await getNarrativeWatchFeed()).length;
  } catch (cause) {
    console.error(
      "[fake-resistance] public projection unavailable",
      cause instanceof Error ? cause.message : cause,
    );
  }

  // Derived, not written down: the counts on the two branch cards track the
  // content seams, so adding a case file updates the card with no edit here.
  const officialCount = edition.cases.length;
  const socialCount = cases.length + 2; // playbook + network + the case files

  // The hub's featured file is simply the newest — the research's own
  // `updatedAt`, not an editorial pick that would need maintaining here.
  const featured = [...cases].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )[0];

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
      {
        "@type": "WebPage",
        name: "The network",
        description:
          "What the seven case files add up to — the cross-network synthesis.",
        url: `${PAGE_URL}/network`,
      },
      {
        "@type": "WebPage",
        name: "The daily watch",
        description:
          "Narratives flagged and answered in the last 24 hours, straight from source monitoring.",
        url: `${PAGE_URL}/watch`,
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
        footage, the amplifier accounts, the laundered consensus. The files
        come first; the framing they sit in follows below them.
      </p>

      {/* ── The decision moment, before any essay (INV-001) ─────────────── */}
      <SectionBlock heading="Open a file">
        {featured ? (
          <Card
            variant="dossier"
            accent="ember"
            href={`/fake-resistance/cases/${featured.slug}`}
            className={styles.featured}
          >
            <CardHeader>
              <CardEyebrow>Latest case file</CardEyebrow>
              <CardCount>
                <time dateTime={featured.updatedAt}>
                  {dateLabel(featured.updatedAt)}
                </time>
              </CardCount>
            </CardHeader>
            <CardTitle>{featured.title.split(":")[0].trim()}</CardTitle>
            <CardDescription>{featured.question}</CardDescription>
            <p className={styles.featuredEvidence}>
              <span>Evidence basis</span>
              {featured.counts.exhibits} graded findings ·{" "}
              {featured.counts.sources} sources on record
            </p>
            <CardCta>Open the case file</CardCta>
          </Card>
        ) : null}

        {/* The hub's fork. The cards used to carry their own staggered Reveal
            wrappers; the motion contract reserves entrance motion for section
            arrivals, and this section already arrives as one (`SectionBlock`
            is the Reveal). The cards are simply here — hover, focus and
            semantics are the Card primitive's own. */}
        <nav aria-label="Investigation branches" className={styles.branches}>
          <div className={styles.branchSlot}>
            <Card
              variant="dossier"
              accent="ember"
              href="/fake-resistance/official-narrative"
            >
              <CardHeader>
                <CardEyebrow>Branch 01</CardEyebrow>
                <CardCount>{officialCount} case files</CardCount>
              </CardHeader>
              <CardTitle>Official narrative engineering</CardTitle>
              <CardDescription>
                Three worked exhibits — the claim as it spread, its origin, its
                amplification, and the evidence that unmade it — with the order
                in which the record caught up.
              </CardDescription>
              <CardCta>Open the file</CardCta>
            </Card>
          </div>

          <div className={styles.branchSlot}>
            <Card
              variant="dossier"
              accent="ember"
              href="/fake-resistance/social-media"
            >
              <CardHeader>
                <CardEyebrow>Branch 02</CardEyebrow>
                <CardCount>{socialCount} files</CardCount>
              </CardHeader>
              <CardTitle>The social-media front</CardTitle>
              <CardDescription>
                The influence-network research: a {playbook.length}-technique
                playbook, the cross-network synthesis, and seven documented case
                files, graded exactly as the research graded them.
              </CardDescription>
              <CardCta>Open the file</CardCta>
            </Card>
          </div>

          {/* Branch 03 is deliberately unlike the first two: same-day
              findings, machine quality-gated only, no human review yet.
              It gets its own card rather than folding into the archive it
              feeds so a reader never mistakes a provisional record for a
              reviewed case file. */}
          <div className={styles.branchSlot}>
            <Card
              variant="dossier"
              accent="ember"
              href="/fake-resistance/watch"
            >
              <CardHeader>
                <CardEyebrow>Branch 03 — live</CardEyebrow>
                <CardCount>{watchCount} tracked now</CardCount>
              </CardHeader>
              <CardTitle>The daily watch</CardTitle>
              <CardDescription>
                Narratives flagged and answered in the last 24 hours, direct
                from source monitoring — provisional until a case file is
                written, not one yet.
              </CardDescription>
              <CardCta>Open the file</CardCta>
            </Card>
          </div>
        </nav>

        {/* The network entry: the synthesis over the case files, reachable
            from the hub without walking through a branch first. */}
        <ul className={styles.networkEntry}>
          <li>
            <Card variant="row" href="/fake-resistance/network">
              <CardHeader>
                <CardEyebrow>Synthesis</CardEyebrow>
                <CardCount>{cases.length} case files, mapped</CardCount>
              </CardHeader>
              <CardTitle>The influence network</CardTitle>
              <CardDescription>
                What the case files add up to: seven communities, the
                documented bridges between them, and the findings that survived
                every attempt to break them.
              </CardDescription>
              <CardCta>Open the network file</CardCta>
            </Card>
          </li>
        </ul>
      </SectionBlock>

      {/* ── The methods index (INV-001) ─────────────────────────────────── */}
      <SectionBlock heading="The methods">
        <p>
          Every file above documents some combination of the same{" "}
          {playbook.length} moves. None of them alone is proof — together, and
          documented, they are a pattern. Each entry below opens that
          technique&rsquo;s chapter in{" "}
          <Link href="/fake-resistance/playbook">the playbook</Link>: what the
          move is, the mental shortcut it exploits, and what you can check for
          yourself.
        </p>
        <ol className={styles.methodsIndex}>
          {playbook.map((chapter) => (
            <li key={chapter.id}>
              <Link href={techniqueHref(chapter.id)} className={styles.methodRow}>
                <span className={styles.methodTitle}>{chapter.title}</span>
                <span className={styles.methodSummary}>{chapter.summary}</span>
              </Link>
            </li>
          ))}
        </ol>
      </SectionBlock>

      {/* ── The framing, below the files it frames ──────────────────────── */}
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
    </SectionPage>
  );
}
