import type { AssessmentValue, ConfidenceSummary } from '@/server/contracts/enums';
import { Badge, BADGE_GRAMMAR } from '@/components/ui/Badge';
import badgeStyles from '@/components/ui/badge.module.css';

export type VerificationBadgeProps = {
  assessment: AssessmentValue;
  confidence?: ConfidenceSummary;
};

/** Exhaustive by construction: adding a tenth assessment value fails the
 *  typecheck here before it silently renders unstyled. Each entry carries the
 *  shared status key — whose mark is a function of verdict polarity — and the
 *  sentence that states what the verdict means. */
const ASSESSMENT_STATUS: Record<AssessmentValue, keyof typeof BADGE_GRAMMAR> = {
  verified: 'verified',
  false: 'false',
  misleading: 'misleading',
  manipulated: 'manipulated',
  out_of_context: 'out_of_context',
  contested: 'contested',
  unsupported: 'unsupported',
  unverified: 'unverified',
  satire: 'satire',
};

const ASSESSMENT_EXPLANATION: Record<AssessmentValue, string> = {
  verified: 'Verified: supported by the evidence on record.',
  false: 'Assessed as false: the claim is contradicted by the evidence.',
  misleading:
    'Assessed as misleading: built on real elements arranged to create a false impression.',
  manipulated: 'Assessed as manipulated: the underlying media or record has been altered.',
  out_of_context:
    'Assessed as out of context: genuine material presented outside its real time, place, or meaning.',
  contested: 'Contested: credible sources disagree and the record does not yet settle it.',
  unsupported: 'Unsupported: we searched and found no evidence for the claim.',
  unverified: 'Unverified: not yet assessed against the evidence.',
  satire: 'Satire: not a factual claim — presented as satire or parody.',
};

const CONFIDENCE_LABELS: Record<ConfidenceSummary, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  limited: 'Limited confidence',
};

/**
 * The verdict badge renders the shared `Badge` — one grammar, one mark
 * vocabulary whose shape encodes verdict polarity, so "Verified" and "False"
 * still differ when the colour is gone.
 *
 * `role="img"` makes the badge one image-like object in the accessibility
 * tree: a mark and a stamp that name the verdict. The full explanation rides
 * behind the visible label as screen-reader text — the old pattern put it on
 * an `aria-label` over a `<span>`, which announced a string a reader could
 * never see, select or translate.
 */
export function VerificationBadge({ assessment, confidence }: VerificationBadgeProps) {
  const status = ASSESSMENT_STATUS[assessment];
  const grammar = BADGE_GRAMMAR[status];
  const explanation = confidence
    ? `${ASSESSMENT_EXPLANATION[assessment]} ${CONFIDENCE_LABELS[confidence]}.`
    : ASSESSMENT_EXPLANATION[assessment];

  return (
    <Badge
      status={status}
      role="img"
      aria-label={explanation}
      title={explanation}
    >
      {grammar.label}
      {confidence ? (
        <span className={badgeStyles.confidence}> · {CONFIDENCE_LABELS[confidence]}</span>
      ) : null}
    </Badge>
  );
}
