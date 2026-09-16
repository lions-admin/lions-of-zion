import type { EvidenceClass, ResearchConfidence } from '@/lib/content/fake-resistance-cases';
import { Badge, BADGE_GRAMMAR, type BadgeStatus } from '@/components/ui/Badge';
import type { ExplainerItem } from '@/components/ui/Explainer';
import styles from './content.module.css';

/**
 * The research's own grades, rendered as labels.
 *
 * These are deliberately *not* `VerificationBadge`, even though both render
 * through the one `Badge` grammar (SYS-011). A verdict says what the record
 * shows about a claim; a confidence grade says how well the research knows
 * its own finding, and an evidence class says what kind of proof stands
 * behind an edge. They share a shape vocabulary — a filled square is still
 * "yes", a hollow circle still "not settled" — but they keep their own words,
 * their own explanations and the `evidence` domain, so "we are fairly sure"
 * never reads as "this is verified", which is the single most likely way for
 * this section to overstate itself.
 *
 * The explanations reach a sighted reader through the ledger's visible key
 * (`components/ui/Explainer`, built from `confidenceKey` / `evidenceClassKey`)
 * and a screen reader through the hidden sentence after each label. Neither
 * is a `title` tooltip any more (2026-09-16).
 */
const CONFIDENCE_LABEL: Record<ResearchConfidence, string> = {
  high: BADGE_GRAMMAR.high.label,
  medium: BADGE_GRAMMAR.medium.label,
  low: BADGE_GRAMMAR.low.label,
};

export const CONFIDENCE_EXPLANATION: Record<ResearchConfidence, string> = {
  high: 'High confidence: multiple independent methods or sources agree.',
  medium: 'Medium confidence: supported, with material gaps acknowledged.',
  low: 'Low confidence: a single source or an unresolved alternative explanation.',
};

const EVIDENCE_STATUS: Record<EvidenceClass, BadgeStatus> = {
  documented_relationship: 'documented',
  observed_interaction: 'observed',
  inferred_coordination: 'inferred',
};

const EVIDENCE_LABEL: Record<EvidenceClass, string> = {
  documented_relationship: BADGE_GRAMMAR.documented.label,
  observed_interaction: BADGE_GRAMMAR.observed.label,
  inferred_coordination: BADGE_GRAMMAR.inferred.label,
};

export const EVIDENCE_EXPLANATION: Record<EvidenceClass, string> = {
  documented_relationship:
    'Documented relationship: stated on the record, by the parties or by reporting.',
  observed_interaction:
    'Observed interaction: seen happening in public posts — behaviour, not a declared tie.',
  inferred_coordination:
    'Inferred coordination: a pattern consistent with coordination that was not established.',
};

/** The key for the confidence grades a ledger carries, each once, in order. */
export function confidenceKey(values: readonly ResearchConfidence[]): ExplainerItem[] {
  const seen = new Set<ResearchConfidence>();
  const items: ExplainerItem[] = [];
  for (const value of values) {
    if (seen.has(value) || !CONFIDENCE_LABEL[value]) continue;
    seen.add(value);
    items.push({ status: value, label: CONFIDENCE_LABEL[value], explanation: CONFIDENCE_EXPLANATION[value] });
  }
  return items;
}

/** The key for the evidence classes a ledger carries, each once, in order. */
export function evidenceClassKey(values: readonly EvidenceClass[]): ExplainerItem[] {
  const seen = new Set<EvidenceClass>();
  const items: ExplainerItem[] = [];
  for (const value of values) {
    if (seen.has(value) || !EVIDENCE_LABEL[value]) continue;
    seen.add(value);
    items.push({ status: EVIDENCE_STATUS[value], label: EVIDENCE_LABEL[value], explanation: EVIDENCE_EXPLANATION[value] });
  }
  return items;
}

export function ConfidenceChip({ value }: { value: ResearchConfidence }) {
  const label = CONFIDENCE_LABEL[value];
  if (!label) return null;
  return (
    <Badge status={value} domain="evidence">
      {label}
      <span className={styles.badgeNote}> — {CONFIDENCE_EXPLANATION[value]}</span>
    </Badge>
  );
}

export function EvidenceClassChip({ value }: { value: EvidenceClass }) {
  const label = EVIDENCE_LABEL[value];
  if (!label) return null;
  return (
    <Badge status={EVIDENCE_STATUS[value]} domain="evidence">
      {label}
      <span className={styles.badgeNote}> — {EVIDENCE_EXPLANATION[value]}</span>
    </Badge>
  );
}
