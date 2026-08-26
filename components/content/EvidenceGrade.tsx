import type { EvidenceClass, ResearchConfidence } from '@/lib/content/fake-resistance-cases';
import styles from './content.module.css';

/**
 * The research's own grades, rendered as labels.
 *
 * These are deliberately *not* `VerificationBadge`. A verdict says what the
 * record shows about a claim; a confidence grade says how well the research
 * knows its own finding, and an evidence class says what kind of proof stands
 * behind an edge. Rendering either through the verdict badge would let "we are
 * fairly sure" read as "this is verified", which is the single most likely way
 * for this section to overstate itself.
 */
const CONFIDENCE_LABEL: Record<ResearchConfidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

const CONFIDENCE_EXPLANATION: Record<ResearchConfidence, string> = {
  high: 'High confidence: multiple independent methods or sources agree.',
  medium: 'Medium confidence: supported, with material gaps acknowledged.',
  low: 'Low confidence: a single source or an unresolved alternative explanation.',
};

const EVIDENCE_LABEL: Record<EvidenceClass, string> = {
  documented_relationship: 'Documented',
  observed_interaction: 'Observed',
  inferred_coordination: 'Inferred',
};

const EVIDENCE_EXPLANATION: Record<EvidenceClass, string> = {
  documented_relationship:
    'Documented relationship: stated on the record, by the parties or by reporting.',
  observed_interaction:
    'Observed interaction: seen happening in public posts — behaviour, not a declared tie.',
  inferred_coordination:
    'Inferred coordination: a pattern consistent with coordination that was not established.',
};

export function ConfidenceChip({ value }: { value: ResearchConfidence }) {
  const label = CONFIDENCE_LABEL[value];
  if (!label) return null;
  return (
    <span
      className={styles.gradeChip}
      data-confidence={value}
      title={CONFIDENCE_EXPLANATION[value]}
    >
      {label}
    </span>
  );
}

export function EvidenceClassChip({ value }: { value: EvidenceClass }) {
  const label = EVIDENCE_LABEL[value];
  if (!label) return null;
  return (
    <span className={styles.gradeChip} data-evidence={value} title={EVIDENCE_EXPLANATION[value]}>
      {label}
    </span>
  );
}
