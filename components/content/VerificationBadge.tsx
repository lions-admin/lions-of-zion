import type { AssessmentValue, ConfidenceSummary } from '@/server/contracts/enums';
import { Badge, BADGE_GRAMMAR } from '@/components/ui/Badge';
import type { ExplainerItem } from '@/components/ui/Explainer';
import styles from './content.module.css';

export type VerificationBadgeProps = {
  assessment: AssessmentValue;
  confidence?: ConfidenceSummary;
};

/** Exhaustive by construction: adding a tenth assessment value fails the
 *  typecheck here before it silently renders unstyled. */
export const ASSESSMENT_PRESENTATION: Record<AssessmentValue, { label: string; explanation: string }> = {
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

/**
 * The key a ledger prints for the verdicts it actually carries — in the
 * order given, each once — for `components/ui/Explainer`. The words are the
 * ones above, so the key and the badge cannot disagree.
 */
export function assessmentKey(values: readonly AssessmentValue[]): ExplainerItem[] {
  const seen = new Set<AssessmentValue>();
  const items: ExplainerItem[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    items.push({ status: value, label: ASSESSMENT_PRESENTATION[value].label, explanation: ASSESSMENT_PRESENTATION[value].explanation });
  }
  return items;
}

/**
 * The verdict on an information item, rendered through the one badge grammar
 * (SYS-011). This file owns the words — the label the reader sees and the
 * sentence that explains it — and `Badge` owns the shape, the ramp and the
 * mark, so "Verified" and "False" differ by shape as well as by colour.
 *
 * The badge carries visible text, so it needs no `role` and no `aria-label`.
 * The explanation reaches a screen reader as a visually hidden sentence after
 * the label; a sighted reader gets it from the ledger's visible key
 * (`Explainer`, built from `assessmentKey`) rather than from a `title`
 * tooltip, which a touch screen and a keyboard never saw (2026-09-16).
 */
export function VerificationBadge({ assessment, confidence }: VerificationBadgeProps) {
  const presentation = ASSESSMENT_PRESENTATION[assessment];

  return (
    <Badge status={assessment} domain="verification">
      {presentation.label}
      {confidence ? (
        <span className={styles.badgeConfidence}> · {CONFIDENCE_LABELS[confidence]}</span>
      ) : null}
      <span className={styles.badgeNote}> — {presentation.explanation}</span>
    </Badge>
  );
}
