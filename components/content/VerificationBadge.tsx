import type { AssessmentValue, ConfidenceSummary } from '@/server/contracts/enums';
import { BADGE_GRAMMAR } from '@/components/ui/Badge';
import styles from './content.module.css';

export type VerificationBadgeProps = {
  assessment: AssessmentValue;
  confidence?: ConfidenceSummary;
};

/** Exhaustive by construction: adding a tenth assessment value fails the
 *  typecheck here before it silently renders unstyled. */
const ASSESSMENT_PRESENTATION: Record<AssessmentValue, { label: string; explanation: string }> = {
  verified: {
    label: BADGE_GRAMMAR.verified.label,
    explanation: 'Verified: supported by the evidence on record.',
  },
  false: {
    label: BADGE_GRAMMAR.false.label,
    explanation: 'Assessed as false: the claim is contradicted by the evidence.',
  },
  misleading: {
    label: BADGE_GRAMMAR.misleading.label,
    explanation:
      'Assessed as misleading: built on real elements arranged to create a false impression.',
  },
  manipulated: {
    label: BADGE_GRAMMAR.manipulated.label,
    explanation: 'Assessed as manipulated: the underlying media or record has been altered.',
  },
  out_of_context: {
    label: BADGE_GRAMMAR.out_of_context.label,
    explanation:
      'Assessed as out of context: genuine material presented outside its real time, place, or meaning.',
  },
  contested: {
    label: BADGE_GRAMMAR.contested.label,
    explanation: 'Contested: credible sources disagree and the record does not yet settle it.',
  },
  unsupported: {
    label: BADGE_GRAMMAR.unsupported.label,
    explanation: 'Unsupported: we searched and found no evidence for the claim.',
  },
  unverified: {
    label: BADGE_GRAMMAR.unverified.label,
    explanation: 'Unverified: not yet assessed against the evidence.',
  },
  satire: {
    label: BADGE_GRAMMAR.satire.label,
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
