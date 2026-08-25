import { VerificationBadge } from 'lions-of-zion';

/**
 * The nine assessment values are the vocabulary of this whole system, and the
 * badge is where a reader meets them. The sweep below is the primary variant
 * axis: it is the one thing a designer needs to see all of at once, because
 * the colour families carry meaning (gold = verified, ember = the hostile
 * family, muted blue-grey = not yet established, violet = satire).
 */

export function TheNineVerdicts() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
      <VerificationBadge assessment="verified" />
      <VerificationBadge assessment="contested" />
      <VerificationBadge assessment="misleading" />
      <VerificationBadge assessment="false" />
      <VerificationBadge assessment="manipulated" />
      <VerificationBadge assessment="out_of_context" />
      <VerificationBadge assessment="unsupported" />
      <VerificationBadge assessment="unverified" />
      <VerificationBadge assessment="satire" />
    </div>
  );
}

export function WithConfidence() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
      <VerificationBadge assessment="verified" confidence="high" />
      <VerificationBadge assessment="contested" confidence="medium" />
      <VerificationBadge assessment="unverified" confidence="limited" />
    </div>
  );
}
