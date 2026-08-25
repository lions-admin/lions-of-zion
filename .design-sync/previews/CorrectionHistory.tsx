import { CorrectionHistory } from 'lions-of-zion';

/** A log with entries — date, optional version stamp, and what changed. */
export function WithCorrections() {
  return (
    <CorrectionHistory
      corrections={[
        {
          date: '25 Aug 2026',
          version: 'v1.2',
          note: 'Replaced a case file after verification found it touched a live dispute rather than a settled one.',
        },
        {
          date: '24 Aug 2026',
          version: 'v1.1',
          note: 'Corrected the funded length of the eastern barrier from 100 km to the 80 km named in the June review.',
        },
      ]}
    />
  );
}

/**
 * The empty state is deliberate and load-bearing: an empty array renders
 * "None recorded" rather than nothing. Hiding the component to imply a clean
 * record is exactly what it exists to prevent.
 */
export function NoneRecorded() {
  return <CorrectionHistory corrections={[]} />;
}
