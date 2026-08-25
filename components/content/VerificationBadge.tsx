import type { AssessmentValue, ConfidenceSummary } from '@/server/contracts/enums';
import styles from './content.module.css';

export type VerificationBadgeProps = {
  assessment: AssessmentValue;
  confidence?: ConfidenceSummary;
};

/** Exhaustive by construction: adding a tenth assessment value fails the
 *  typecheck here before it silently renders unstyled. */
const ASSESSMENT_PRESENTATION: Record<AssessmentValue, { label: string; explanation: string }> = {
  verified: {
    label: 'Verified',
    explanation: 'Verified: supported by the evidence on record.',
  },
  false: {
    label: 'False',
    explanation: 'Assessed as false: the claim is contradicted by the evidence.',
  },
  misleading: {
    label: 'Misleading',
    explanation:
      'Assessed as misleading: built on real elements arranged to create a false impression.',
  },
  manipulated: {
    label: 'Manipulated',
    explanation: 'Assessed as manipulated: the underlying media or record has been altered.',
  },
  out_of_context: {
    label: 'Out of context',
    explanation:
      'Assessed as out of context: genuine material presented outside its real time, place, or meaning.',
  },
  contested: {
    label: 'Contested',
    explanation: 'Contested: credible sources disagree and the record does not yet settle it.',
  },
  unsupported: {
    label: 'Unsupported',
    explanation: 'Unsupported: we searched and found no evidence for the claim.',
  },
  unverified: {
    label: 'Unverified',
    explanation: 'Unverified: not yet assessed against the evidence.',
  },
  satire: {
    label: 'Satire',
    explanation: 'Satire: not a factual claim — presented as satire or parody.',
  },
};

const CONFIDENCE_LABELS: Record<ConfidenceSummary, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  limited: 'Limited confidence',
};

export function VerificationBadge({ assessment, confidence }: VerificationBadgeProps) {
  const presentation = ASSESSMENT_PRESENTATION[assessment];
  const explanation = confidence
    ? `${presentation.explanation} ${CONFIDENCE_LABELS[confidence]}.`
    : presentation.explanation;

  return (
    <span
      className={styles.badge}
      data-assessment={assessment}
      title={explanation}
      aria-label={explanation}
    >
      <i aria-hidden="true" />
      {presentation.label}
      {confidence ? (
        <span className={styles.badgeConfidence} aria-hidden="true">
          · {CONFIDENCE_LABELS[confidence]}
        </span>
      ) : null}
    </span>
  );
}
