/**
 * The X wordmark, inline (AUTH-002).
 *
 * Inline rather than an `<img>` because the site's CSP `img-src` does not
 * include X's servers — and because a sign-in button that fetches its own logo
 * from the provider announces every visitor to that provider before they have
 * chosen anything.
 *
 * It lives here rather than in `components/ui/Icon.tsx` on purpose. Every mark
 * in that file is a 24×24 stroke path drawn at `strokeWidth` 1.5, and they are
 * the site's own vocabulary — sized, weighted and recoloured as a set. This is
 * a filled brand glyph with fixed proportions that belongs to someone else and
 * may not be redrawn to match. Putting it in the icon set would have meant
 * either breaking that set's rules or breaking X's.
 *
 * `currentColor` is deliberate and is the one thing about it that may vary:
 * X's brand guidance allows the mark in black or in white, so the button
 * chooses which by setting a text colour, and the mark follows.
 */
export function XMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1200 1227"
      fill="currentColor"
      focusable="false"
      aria-hidden="true"
    >
      <path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z" />
    </svg>
  );
}
