import React from "react";

/**
 * The shared line-icon family for chrome, records, provenance, and process
 * states. Icons are deliberately quiet: colour and text carry meaning, while
 * the mark provides a consistent visual anchor at any density.
 */
export type IconName =
  | "search"
  | "ask"
  | "menu"
  | "close"
  | "arrow-right"
  | "chevron-down"
  | "external-link"
  | "filter"
  | "calendar"
  | "archive"
  | "document"
  | "film"
  | "photo"
  | "source"
  | "actor"
  | "location"
  | "verified"
  | "warning"
  | "account"
  | "support"
  | "share"
  | "intake"
  | "evidence"
  | "assessment"
  | "review"
  | "publish"
  | "correction";

export type IconProps = Omit<React.SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  size?: number | string;
};

const ICONS: Record<IconName, React.ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="5.8" /><path d="m15 15 4.5 4.5" /></>,
  /* The Lion Eye — this desk's own mark for the assistant, replacing Lucide's
     `sparkles`, which is the generic "AI" glyph on every product that has one.

     Drawn from the approved gold artwork, reduced to what survives at 16px: a
     lidded almond eye, an iris and a pupil, one broken ring, and four spikes
     that pass through the ring's gaps at the cardinals — which is the
     reference's structural idea, not a simplification of it. The second ring
     and the iris rays are gone; at icon size they were texture, not shape.

     Ring arcs are r=9 about (12,12), each spanning 15° to 75° of its quadrant
     so the gaps sit exactly where the spikes cross. `currentColor` stroke like
     every other glyph here, so the button's hover, focus, disabled and busy
     states carry through unchanged. */
  ask: (
    <>
      {/* one ring, broken at the cardinals */}
      <path d="M14.3 3.3a9 9 0 0 1 6.4 6.4" />
      <path d="M20.7 14.3a9 9 0 0 1-6.4 6.4" />
      <path d="M9.7 20.7a9 9 0 0 1-6.4-6.4" />
      <path d="M3.3 9.7a9 9 0 0 1 6.4-6.4" />
      {/* four spikes, through the gaps */}
      <path d="M12 1v3.5" />
      <path d="M12 19.5V23" />
      <path d="M1 12h3.5" />
      <path d="M19.5 12H23" />
      {/* the eye */}
      <path d="M5 12q7-7 14 0q-7 7-14 0z" />
      <circle cx="12" cy="12" r="2.6" />
      <circle cx="12" cy="12" r="0.9" />
    </>
  ),
  menu: <><path d="M3 7h18" /><path d="M3 12h18" /><path d="M3 17h18" /></>,
  close: <><path d="m5 5 14 14" /><path d="m19 5-14 14" /></>,
  "arrow-right": <><path d="M4 12h15" /><path d="m13 6 6 6-6 6" /></>,
  "chevron-down": <path d="m4 8 8 8 8-8" />,
  "external-link": <><path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" /></>,
  filter: <><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="1.5" /><path d="M7 3.5v3M17 3.5v3M3.5 9h17" /></>,
  archive: <><path d="M4 7.5h16v12H4z" /><path d="M3 4.5h18v3H3zM9 12h6" /></>,
  document: <><path d="M6 3.5h8l4 4v13H6z" /><path d="M14 3.5v4h4M9 12h6M9 16h6" /></>,
  film: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4" /></>,
  photo: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><circle cx="8" cy="9" r="1.4" /><path d="m4 18 5-5 3.5 3 2.5-2.5 5 4.5" /></>,
  source: <><circle cx="12" cy="12" r="8.5" /><path d="M8 12h8M12 8v8" /></>,
  actor: <><circle cx="12" cy="8" r="3" /><path d="M5.5 20c.8-3.5 3-5.2 6.5-5.2s5.7 1.7 6.5 5.2" /></>,
  location: <><path d="M20 10.5c0 5-8 10-8 10s-8-5-8-10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10.5" r="2.5" /></>,
  verified: <><path d="m4.5 12 4.5 4.5L19.5 6" /><circle cx="12" cy="12" r="9" /></>,
  warning: <><path d="m12 3 9 17H3z" /><path d="M12 9v5M12 17.5v.1" /></>,
  account: <><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c.8-3.7 3.3-5.5 7.5-5.5s6.7 1.8 7.5 5.5" /></>,
  support: <><path d="M12 8 9 5a2.2 2.2 0 0 1 3-3 2.2 2.2 0 0 1 3 3z" /><path d="M3 13h3l3-2h4a2 2 0 0 1 0 4h-3M6 19h9l6-6a2 2 0 0 0-3-2l-4 4M3 12v8h3v-8z" /></>,
  share: <><circle cx="6" cy="12" r="2.5" /><circle cx="17.5" cy="5.5" r="2.5" /><circle cx="17.5" cy="18.5" r="2.5" /><path d="m8.2 10.8 6.1-3.7M8.2 13.2l6.1 3.7" /></>,
  intake: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 20h16" /></>,
  evidence: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  assessment: <><path d="M4 18h16" /><path d="M6 15V9M10 15V5M14 15v-3M18 15V7" /></>,
  review: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5M8 10.5l1.8 1.8 3.7-3.7" /></>,
  publish: <><path d="M4 20 20 4" /><path d="M12 4h8v8" /><path d="M4 12v8h8" /></>,
  correction: <><path d="M4 7h16M4 12h11M4 17h16" /><path d="m17 11 3 3-3 3" /></>,
};

export function Icon({ name, size = 20, strokeWidth = 1.6, ...props }: IconProps) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden={props["aria-label"] ? undefined : props["aria-hidden"] ?? true}
    >
      {ICONS[name]}
    </svg>
  );
}
