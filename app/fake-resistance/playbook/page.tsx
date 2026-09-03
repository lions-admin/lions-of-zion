import type { Metadata } from 'next';
import Link from 'next/link';
import { SectionBlock, SectionPage } from '@/components/sections/SectionPage';
import { ConfidenceChip, VerificationBadge } from '@/components/content';
import { getTechniqueExamples } from '@/lib/content/fake-resistance-cases';
import { getPlaybook } from '@/lib/content/fake-resistance-playbook';
import { SITE_URL } from '@/lib/site-config';
import styles from './page.module.css';

const TAGLINE =
  'Nine techniques that make manufactured outrage feel like something you found yourself.';
const PAGE_URL = `${SITE_URL}/fake-resistance/playbook`;

export const metadata: Metadata = {
  title: 'The playbook',
  description: TAGLINE,
  alternates: { canonical: PAGE_URL },
  openGraph: { title: 'The playbook — LIONS OF ZION', description: TAGLINE },
};

export default async function Page() {
  const chapters = getPlaybook();
  // Asked for, not stored: a chapter shows the findings that actually carry
  // its tag and are actually published. See `getTechniqueExamples`.
  const examples = await getTechniqueExamples();

  /* A reference work about a set of techniques, not a report of an event —
     so the real schema.org type is an article that teaches, and each chapter
     is a named section of it. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'The playbook',
    description: TAGLINE,
    url: PAGE_URL,
    author: { '@type': 'Organization', name: 'Lions of Zion', url: SITE_URL },
    isPartOf: { '@type': 'WebSite', name: 'Lions of Zion', url: SITE_URL },
    hasPart: chapters.map((chapter) => ({
      '@type': 'WebPageElement',
      name: chapter.title,
      description: chapter.summary,
      url: `${PAGE_URL}#${chapter.id}`,
    })),
  };

  return (
    <SectionPage
      id="fake-resistance"
      accent="ember"
      surface="quiet"
      breadcrumb={[{ href: '/fake-resistance', label: 'Fake Resistance' }]}
      title="The playbook"
      tagline={TAGLINE}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* The manual's contents (INV-004): every chapter as one indexed row —
          number, name, one-line summary, and how much of it this site has
          documented — before any chapter begins. The counts differentiate
          the rows: a reader can tell a technique with published exhibits
          from one still awaiting its first, without opening either. */}
      <SectionBlock heading="Contents">
        <ol className={styles.contents}>
          {chapters.map((chapter) => {
            const documentedCount =
              chapter.documented.length + (examples.get(chapter.id) ?? []).length;
            return (
              <li key={chapter.id}>
                <a href={`#${chapter.id}`} className={styles.contentsRow}>
                  <span className={styles.contentsTitle}>{chapter.title}</span>
                  <span className={styles.contentsSummary}>{chapter.summary}</span>
                  <span className={styles.contentsMeta}>
                    {documentedCount === 0
                      ? 'No documented exhibit yet'
                      : documentedCount === 1
                        ? '1 documented exhibit'
                        : `${documentedCount} documented exhibits`}
                  </span>
                </a>
              </li>
            );
          })}
        </ol>
      </SectionBlock>

      <SectionBlock heading="Why this page exists">
        <p>
          Manufactured outrage is not mainly a problem of false facts. It is a
          problem of method: a small set of moves, reused across unrelated
          claims, that make an assertion feel like something the reader
          witnessed rather than something they were told. The claims change
          weekly. The moves barely change at all.
        </p>
        <p>
          That is the useful thing about them. A reader who has seen a
          technique named once can recognize it the next time under different
          content — which is protection that outlives any particular
          correction. Each chapter below covers one move: what it is, the
          mental shortcut it exploits, where this site has documented it, and
          what you can check for yourself.
        </p>
        <p>
          These chapters describe techniques, not people. The{' '}
          <Link href="/fake-resistance">case files</Link> are where specific
          accounts and campaigns are documented, with their sources.
        </p>
      </SectionBlock>

      {chapters.map((chapter) => {
        const found = examples.get(chapter.id) ?? [];
        return (
        <SectionBlock key={chapter.id} id={chapter.id} heading={chapter.title}>
          <p className={styles.summary}>{chapter.summary}</p>

          <div className={styles.part}>
            <h3 className={styles.partHeading}>The move</h3>
            {chapter.move.map((para) => (
              <p key={para.slice(0, 40)}>{para}</p>
            ))}
          </div>

          <div className={styles.part}>
            <h3 className={styles.partHeading}>Why it works on you</h3>
            {chapter.psychology.map((para) => (
              <p key={para.slice(0, 40)}>{para}</p>
            ))}
          </div>

          <div className={styles.part}>
            <h3 className={styles.partHeading}>Documented on this site</h3>
            {chapter.documented.length > 0 || found.length > 0 ? (
              <>
                {chapter.documented.length > 0 ? (
                  <ul className={styles.examples}>
                    {chapter.documented.map((example) => (
                      <li key={example.href}>
                        <Link href={example.href}>{example.label}</Link>
                        <span>{example.note}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {found.length > 0 ? (
                  <ul className={styles.findings}>
                    {found.map((example) => (
                      <li key={example.href}>
                        <p>{example.statement}</p>
                        <div className={styles.findingMeta}>
                          <VerificationBadge assessment={example.verdict} />
                          {example.confidence ? (
                            <ConfidenceChip value={example.confidence} />
                          ) : null}
                          <Link href={example.href}>{example.caseTitle}</Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : (
              /* Said plainly rather than filled with a plausible-sounding
                 example. A page about manufactured evidence does not get to
                 manufacture its own. */
              <p className={styles.pending}>
                No exhibit on this site documents this technique yet. When one
                is published, it will be listed here.
              </p>
            )}
          </div>

          <div className={styles.part}>
            <h3 className={styles.partHeading}>How to catch it</h3>
            <ul className={styles.cues}>
              {chapter.cues.map((cue) => (
                <li key={cue.slice(0, 40)}>{cue}</li>
              ))}
            </ul>
          </div>
        </SectionBlock>
        );
      })}

      <SectionBlock heading="The limit of a playbook">
        <p>
          None of these moves is proof on its own. Real events are chaotic,
          real footage is often unattributed, and honest accounts share things
          in a hurry and get them wrong. A single tell is a reason to check,
          not a verdict.
        </p>
        <p>
          What makes a pattern is several of them together, documented — which
          is what the case files are for, and why every claim on them carries
          its sources. How this site grades and corrects what it publishes is
          set out in the <Link href="/methodology">methodology</Link>.
        </p>
      </SectionBlock>
    </SectionPage>
  );
}
