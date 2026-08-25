import { KnownUnknownPanel } from 'lions-of-zion';

/**
 * The honesty grid — what is not established, and what would change the
 * assessment. Adapted from the Geopolitical Brief's own two columns.
 */
export function NotEstablished() {
  return (
    <KnownUnknownPanel
      unknowns={[
        'The full funded length of the barrier beyond the 80 km confirmed in June.',
        'Whether the phased delivery schedule has been revised since the parliamentary review.',
        'Attribution of the two incidents reported along the northern segment.',
      ]}
      wouldChange={[
        'A published budget line naming the next tranche.',
        'Independent imagery of construction along the unfunded segments.',
        'An on-record statement from the ministry confirming a revised schedule.',
      ]}
    />
  );
}

/** With no `wouldChange`, the panel collapses to a single column. */
export function UnknownsOnly() {
  return (
    <KnownUnknownPanel
      unknowns={[
        'The chain of custody for the two clips recovered from the original account.',
        'Whether the amplifying accounts were coordinated or opportunistic.',
      ]}
    />
  );
}
