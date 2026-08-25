import { FigureRow } from 'lions-of-zion';

/**
 * The stat band from the October 7 record. These are the page's own figures —
 * a component like this must never be previewed with invented numbers, because
 * the card is browsed by humans and imitated by the design agent.
 */
export function TheRecord() {
  return (
    <FigureRow
      figures={[
        { value: '1,200+', label: 'people murdered on October 7' },
        { value: '251', label: 'people taken hostage into Gaza' },
        { value: '~40', label: 'communities attacked that morning' },
      ]}
    />
  );
}

/** Two figures balance across the row as readily as three. */
export function TwoUp() {
  return (
    <FigureRow
      figures={[
        { value: '500 km', label: 'planned length of the eastern barrier' },
        { value: '80 km', label: 'funded at the June 2026 review' },
      ]}
    />
  );
}
