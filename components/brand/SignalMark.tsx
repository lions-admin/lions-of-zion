/**
 * The signal rule — the site's signature mark.
 *
 * One 1px horizontal line whose head is a short spectrum stub: five 1.5px
 * vertical bars on a 4px pitch at heights 3/7/11/5/9. It is the lion's
 * dispersing particles held as a line — the desk's signal entering a surface
 * and running on as the rule that closes it.
 *
 * A server component with zero client JavaScript: everything is geometry in
 * the server HTML. Every measure reads a token from `app/globals.css` —
 * `--signal-rule-w` for the whole rule, `--signal-stub-w` for the spectrum
 * head, `--signal-rule-color` for the ink — so the geometry never drifts from
 * the token contract and no host stylesheet has to reach into it. October 7
 * re-points the colour (never the geometry) through `main[data-memorial]`'s
 * `--signal-rule-color` when that surface lands.
 *
 * It is rationed to at most three appearances per page, and a host adopts it
 * deliberately: the colophon's closing rule in `SiteFooter`, the hub kicker's
 * rule in `HubMasthead`, and (in the next stage) the cover. It is not a
 * decoration to scatter.
 *
 * Geometry, in the 64×12 viewBox the 4rem token resolves to at its design
 * size: the rule sits at y=11 and runs the full width; the five bars stand on
 * it, tops at y = 11 − height. `crispEdges` keeps the 1px rule and the 1.5px
 * bars from antialiasing into grey.
 */
const BAR_HEIGHTS = [3, 7, 11, 5, 9] as const;
const BAR_PITCH = 4;
const BAR_WIDTH = 1.5;

export function SignalMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 12"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      shapeRendering="crispEdges"
      style={{
        inlineSize: "var(--signal-rule-w)",
        blockSize: "auto",
        color: "var(--signal-rule-color)",
      }}
    >
      <rect x={0} y={11} width={64} height={1} fill="currentColor" />
      {BAR_HEIGHTS.map((height, index) => (
        <rect
          key={index}
          x={index * BAR_PITCH}
          y={11 - height}
          width={BAR_WIDTH}
          height={height}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
