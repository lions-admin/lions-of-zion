import type { ReactNode } from 'react';
import styles from './archive.module.css';

/** One count and what it counts — "335" / "records". */
export type ArchiveFact = {
  value: string;
  label: string;
};

export type ArchiveIntroProps = {
  facts: ArchiveFact[];
  /** Where the holding came from and how it is kept, in one sentence. */
  provenance: ReactNode;
  /** The advisory or the note, whichever this archive carries. */
  children?: ReactNode;
};

/**
 * What stands between an archive's headline and its first record.
 *
 * **The defect this replaces.** Both indexes opened with two paragraphs of
 * body prose — counts, provenance, filing policy and, on documentation, the
 * content warning — set at full reading size and weighted exactly like the
 * records below them. Measured on a 390×844 phone, the first archive record
 * sat at 1,271px: one and a half screens below the fold on a page whose entire
 * purpose is the list. The copy was never the problem. Its *register* was: an
 * apparatus that arrives as an essay is an apparatus a reader scrolls past
 * without reading, and it took the archive with it.
 *
 * So the apparatus is split by what each part actually is.
 *
 *  - **Counts and provenance are data.** They go to the data face at the data
 *    step, as a row of value/label pairs over one muted line of provenance.
 *    A reader takes "335 records · 209 films · 126 photographs" in one glance
 *    and never reads it as a sentence, which is what it cost as prose.
 *
 *  - **An advisory is not data and must not be styled as though it were.** It
 *    keeps its own box — see `ArchiveAdvisory` below, which is the same
 *    treatment the record pages already use, so the warning a reader meets on
 *    the index is the warning they meet again on the record.
 *
 * Nothing was deleted to buy the space: every fact the two paragraphs carried
 * is still on the page, in the slot that matches what it is.
 */
export function ArchiveIntro({ facts, provenance, children }: ArchiveIntroProps) {
  return (
    <div className={styles.intro}>
      <div className={styles.introSummary}>
        <p className={styles.introFacts}>
          {facts.map((fact) => (
            <span key={fact.label} className={styles.introFact}>
              <span className={styles.introFactValue}>{fact.value}</span>{' '}
              <span className={styles.introFactLabel}>{fact.label}</span>
            </span>
          ))}
        </p>
        <p className={styles.introProvenance}>{provenance}</p>
      </div>
      {children}
    </div>
  );
}

export type ArchiveAdvisoryProps = {
  /** Unique per page — the `<aside>` is named by its own label. */
  labelId: string;
  children: ReactNode;
};

/**
 * The content advisory, in one voice everywhere it appears.
 *
 * A hairline, an ember mark and a label — not a fill. A panel that shouts is a
 * panel readers learn to skip, and this one has to be read; a panel set as
 * body prose is one they never see as a warning at all. Ember is spent here
 * and in the media gate and nowhere else on these surfaces, because it means
 * danger rather than emphasis.
 *
 * It was written twice, byte for byte — once inside `ArchiveRecord` and again
 * on the documentation index — before this component existed. Two copies of a
 * warning is how one of them quietly stops matching the other.
 */
export function ArchiveAdvisory({ labelId, children }: ArchiveAdvisoryProps) {
  return (
    <aside className={styles.advisory} aria-labelledby={labelId}>
      <p className={styles.advisoryLabel} id={labelId}>
        <span className={styles.advisoryMark} aria-hidden="true" />
        Content advisory
      </p>
      <p className={styles.advisoryText}>{children}</p>
    </aside>
  );
}

export type ArchiveNoteProps = {
  labelId: string;
  /** Names what the note is about — "How this archive is held". */
  label: string;
  children: ReactNode;
};

/**
 * A standing note about the holding, in the advisory's shape without its
 * ember.
 *
 * The testimonies index carries one — that these are people describing what
 * happened to them, and that the accounts are held rather than linked to. That
 * is neither a count nor a danger warning, and giving it the advisory's ember
 * would spend the ramp's one reserved meaning on something that is not
 * dangerous, which is exactly how a real warning stops being believed.
 */
export function ArchiveNote({ labelId, label, children }: ArchiveNoteProps) {
  return (
    <aside className={styles.note} aria-labelledby={labelId}>
      <p className={styles.noteLabel} id={labelId}>
        {label}
      </p>
      <p className={styles.noteText}>{children}</p>
    </aside>
  );
}
