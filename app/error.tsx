'use client';
/**
 * Route error boundary — the signal dropped, calmly. Composed like the 404
 * (`app/not-found.tsx`): a masthead on the black ground, no plate.
 *
 * Styles are inline/co-located so a broken shared stylesheet can never take
 * the error screen down with it. That rationale is why the block below is
 * still a `<style>` string and not a CSS Module: a Module is another chunk
 * that can fail to load, on the one route reached because something already
 * failed.
 *
 * It is not a reason to be off-system. Every value reads a V3 token from
 * `app/globals.css` — the three faces, the type steps, the surfaces and
 * hairlines, the radii and the motion tokens — with no literal fallbacks
 * beside them. It read the glass ramp too until VA-30 (2026-09-07); being
 * self-contained is a loading argument, not a licence to keep a visual
 * language the rest of the site has retired. The
 * fallbacks were dropped on 2026-09-01: globals.css is the root layout's own
 * stylesheet, so it cannot be missing on a route that rendered at all, and a
 * second copy of every value only ever drifted (the last set still named a
 * gold and a type floor from two systems ago). `app/not-found.tsx` is this
 * page's sibling and the model it matches.
 *
 * Anything added here has to be checked by reading it: this is the one place
 * the type rules cannot be enforced by inspecting stylesheets.
 */
import Link from 'next/link';
import { useEffect } from 'react';
import { SiteHeader } from '@/components/site/SiteHeader';

export default function ErrorBoundary({
  error,
  reset,
  retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  /* STATE-003 — one recovery contract across every error boundary on the site.
     Next 16.3 hands an error boundary both: `retry` re-fetches and then
     re-renders, `reset` only re-renders the tree that already failed. For the
     failure this page actually catches — a read that did not come back — the
     second one re-runs the render against the same missing data and fails
     again, so a reader gets a button that visibly does nothing. `retry` when
     the runtime offers it, `reset` when it does not.
     `app/articles/[publicId]/error.tsx` has done this since ARTICLE-003; this
     is the root boundary catching up to it rather than a new idea. */
  const recover = retry ?? reset;

  return (
    <main className="loz-error">
      <SiteHeader />
      <style>{`
        .loz-error {
          /* The document scrolls — converted with the other reading
             containers on 2026-08-27; see the lock in app/globals.css. */
          min-height: 100dvh;
          display: grid;
          align-content: center;
          padding: calc(var(--header-h) + var(--sp-7)) clamp(var(--sp-4), 5vw, var(--sp-8)) var(--sp-8);
          background-color: var(--ground);
          color: var(--ink);
          font-family: var(--face-text);
        }
        /* No plate (Signal over noise, 2026-09-22). This was a card — a
           --surface-1 fill inside a --line border, centred — and before
           VA-30 a glass one. On exact black the page is already the ground
           the words need; a box around three lines only says "dialog". The
           composition is the 404's: a stamped status, the masthead tier, one
           sentence, the two ways out, on the page's own measure with a
           hairline above the actions. */
        .loz-error-inner {
          display: grid;
          justify-items: start;
          gap: var(--sp-4);
          width: 100%;
          max-width: 64rem;
          margin: 0 auto;
        }
        .loz-error-code {
          font-family: var(--face-data);
          font-size: var(--t-data);
          font-weight: var(--t-data-weight);
          line-height: var(--t-data-lh);
          letter-spacing: var(--t-data-tracking);
          text-transform: uppercase;
          color: var(--ink-lo);
        }
        /* The masthead tier, read from its tokens rather than composed:
           \`displayXl\` is a global class, and this page does not assume the
           stylesheet that holds it survived whatever brought a reader here. */
        .loz-error-title {
          font-family: var(--face-display);
          font-optical-sizing: auto;
          font-size: var(--t-display-xl);
          font-weight: 400;
          line-height: var(--t-display-xl-lh);
          letter-spacing: var(--t-display-xl-tracking);
          color: var(--ink-hi);
          text-wrap: balance;
          max-width: 14ch;
        }
        .loz-error-lede {
          max-width: var(--measure-narrow);
          font-size: var(--t-lede);
          line-height: var(--t-lede-lh);
          text-wrap: pretty;
        }
        .loz-error-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: var(--sp-3) var(--sp-5);
          margin-top: var(--sp-3);
          padding-top: var(--sp-5);
          border-top: var(--line-w) solid var(--line);
          width: 100%;
        }
        /* The retry is a control, so it is the secondary button: Plex 600 on
           a raised token surface, 44px tall. It read "on glass" and drew one
           until VA-30; the values below are components/ui/button.module.css
           .secondary transcribed, minus its --surface-grade-strong and
           --shadow-1, because this page carries no gradient or inset either.
           Transcribed rather than imported on purpose — see the file header:
           a CSS Module is another chunk that can fail to load, on the one
           route reached because something already failed. */
        .loz-error-retry {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 2.75rem;
          padding: var(--sp-2) calc(var(--sp-4) + var(--sp-1));
          font: inherit;
          font-family: var(--face-text);
          font-size: var(--t-small);
          font-weight: 600;
          line-height: 1;
          color: var(--ink-hi);
          background-color: var(--surface-2);
          border: var(--line-w) solid var(--control-line);
          border-radius: var(--radius-2);
          cursor: pointer;
          transition:
            background-color var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out),
            transform var(--dur-fast) var(--ease-out);
        }
        .loz-error-retry:hover {
          background-color: var(--surface-3);
          border-color: var(--gold-line-strong);
          transform: translateY(-1px);
        }
        .loz-error-retry:active {
          background-color: var(--surface-1);
          color: var(--ink);
          transform: translateY(0);
        }
        .loz-error-home {
          display: inline-flex;
          align-items: center;
          min-height: 2.75rem;
          padding: var(--sp-2) 0;
          font-family: var(--face-text);
          font-size: var(--t-small);
          font-weight: 500;
          line-height: 1;
          color: var(--ink-hi);
          text-decoration: underline;
          text-decoration-color: var(--line-strong);
          text-underline-offset: 0.2em;
          transition: color var(--dur-fast) var(--ease-out), text-decoration-color var(--dur-fast) var(--ease-out);
        }
        .loz-error-home:hover {
          color: var(--gold-hi);
          text-decoration-color: var(--gold-line-strong);
        }
        /* A reference string for a support thread, not something anyone
           reads: the data step, at the floor, in the recessive ink. */
        .loz-error-digest {
          font-family: var(--face-data);
          font-size: var(--t-data);
          font-weight: var(--t-data-weight);
          line-height: var(--t-data-lh);
          letter-spacing: var(--t-data-tracking);
          font-variant-numeric: tabular-nums;
          color: var(--ink-lo);
        }
        .loz-error-retry:focus-visible,
        .loz-error-home:focus-visible {
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .loz-error-retry,
          .loz-error-home { transition: none; }
          .loz-error-retry:hover { transform: none; }
        }
      `}</style>
      <div className="loz-error-inner">
        <p className="loz-error-code">Transmission interrupted</p>
        <h1 className="loz-error-title">Signal dropped</h1>
        <p className="loz-error-lede">
          Something failed while rendering this file. Nothing is lost — the
          record is intact. Re-establish the signal, or return to the scan.
        </p>
        <div className="loz-error-actions">
          <button type="button" className="loz-error-retry" onClick={() => recover()}>
            Re-establish signal
          </button>
          <Link href="/" className="loz-error-home">
            ← Back to the scan
          </Link>
        </div>
        {error.digest ? <p className="loz-error-digest">Ref {error.digest}</p> : null}
      </div>
    </main>
  );
}
