import { DesignSurface, VerificationBadge, FigureRow } from 'lions-of-zion';

/**
 * The root wrapper. This system is dark-first: its ground and reading defaults
 * live on `<body>` in the application, and outside the app there is no such
 * `<body>`, so `DesignSurface` carries them.
 *
 * Wrap every screen in it. Without it, components render on whatever ground
 * the host provides — and on white, the muted ink tokens fall below usable
 * contrast.
 */
export function TheGround() {
  return (
    <DesignSurface>
      <p style={{ margin: '0 0 1rem' }}>
        Body copy in IBM Plex Sans on the scan ground, at the system’s own reading size.
      </p>
      <FigureRow
        figures={[
          { value: '500 km', label: 'planned length' },
          { value: '80 km', label: 'funded to date' },
        ]}
      />
    </DesignSurface>
  );
}

/** `measure` constrains content to the 68ch reading measure the dossiers use. */
export function ReadingMeasure() {
  return (
    <DesignSurface measure>
      <h2 style={{ fontFamily: 'var(--face-display)', fontSize: 'var(--t-h2)', margin: '0 0 0.5rem' }}>
        The strategic scope is defined
      </h2>
      <p style={{ margin: 0 }}>
        Official records describe a planned multi-layer barrier of roughly 500 kilometres. A June
        parliamentary review said that 80 kilometres had been funded at that point.{' '}
        <VerificationBadge assessment="verified" />
      </p>
    </DesignSurface>
  );
}
