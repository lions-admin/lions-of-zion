import type { EvidenceClass, ResearchConfidence } from '@/lib/content/fake-resistance-cases';
import { Badge, BADGE_GRAMMAR } from '@/components/ui/Badge';

/**
 * The research's own grades, rendered as labels.
 *
 * These are deliberately *not* `VerificationBadge`. A verdict says what the
 * record shows about a claim; a confidence grade says how well the research
 * knows its own finding, and an evidence class says what kind of proof stands
 * behind an edge. Rendering either through the verdict badge would let "we are
 * fairly sure" read as "this is verified", which is the single most likely way
 * for this section to overstate itself.
 *
 * Both render the shared `Badge` since 2026-09-16 — the grade chip's private
 * ramp is the badge grammar's job now — with the explanation on `title`, as
 * before.
 */
const CONFIDENCE_LABEL: Record<ResearchConfidence, string> = {
  high: BADGE_GRAMMAR.high.label,
  medium: BADGE_GRAMMAR.medium.label,
  low: BADGE_GRAMMAR.low.label,
};

const CONFIDENCE_EXPLANATION: Record<ResearchConfidence, string> = {
  high: 'High confidence: multiple independent methods or sources agree.',
  medium: 'Medium confidence: supported, with material gaps acknowledged.',
  low: 'Low confidence: a single source or an unresolved alternative explanation.',
};

const EVIDENCE_LABEL: Record<EvidenceClass, string> = {
  documented_relationship: BADGE_GRAMMAR.documented.label,
  observed_interaction: BADGE_GRAMMAR.observed.label,
  inferred_coordination: BADGE_GRAMMAR.inferred.label,
};

const EVIDENCE_STATUS: Record<EvidenceClass, keyof typeof BADGE_GRAMMAR> = {
  documented_relationship: 'documented',
  observed_interaction: 'observed',
  inferred_coordination: 'inferred',
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
    <Badge status={value} title={CONFIDENCE_EXPLANATION[value]}>
      {label}
    </Badge>
  );
}

export function EvidenceClassChip({ value }: { value: EvidenceClass }) {
  const label = EVIDENCE_LABEL[value];
  if (!label) return null;
  return (
    <Badge status={EVIDENCE_STATUS[value]} title={EVIDENCE_EXPLANATION[value]}>
      {label}
    </Badge>
  );
}
