'use client';
/**
 * Route error boundary — the signal dropped, calmly.
 *
 * Styles are inline/co-located so a broken shared stylesheet can never take
 * the error screen down with it. That rationale is why the block below is
 * still a `<style>` string and not a CSS Module: a Module is another chunk
 * that can fail to load, on the one route reached because something already
 * failed.
 *
 * It is not a reason to be off-system. Every value reads a V3 token from
 * `app/globals.css` — the three faces, the type steps, the glass ramp, the
 * radii and the motion tokens — with no literal fallbacks beside them. The
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
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="loz-error">
      <SiteHeader />
      <style>{`
        .loz-error {
          /* The document scrolls — converted with the other reading
             containers on 2026-08-27; see the lock in app/globals.css. */
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: var(--sp-5);
          /* The real ground and its texture, not a flat panel over them. */
          background-color: var(--ground);
          background-image: var(--scan-ground);
          color: var(--ink);
          font-family: var(--face-text);
          text-align: center;
        }
        .loz-error-inner {
          display: grid;
          justify-items: center;
          gap: var(--sp-4);
          max-width: 34rem;
          padding: clamp(var(--sp-5), 5vw, var(--sp-7));
          border: 1px solid var(--glass-edge);
          border-radius: var(--radius-3);
          background: linear-gradient(180deg, var(--glass-top), var(--glass-middle), var(--glass-bottom));
          box-shadow: inset 0 1px 0 var(--glass-inner), var(--shadow-3);
          -webkit-backdrop-filter: blur(16px) saturate(.72);
          backdrop-filter: blur(16px) saturate(.72);
        }
        /* Two words, so uppercase is allowed: the one gold on the page. */
        .loz-error-code {
          font-family: var(--face-data);
          font-size: var(--t-data);
          font-weight: var(--t-data-weight);
          line-height: var(--t-data-lh);
          letter-spacing: var(--t-data-tracking);
          text-transform: uppercase;
          color: var(--gold);
        }
        .loz-error-title {
          font-family: var(--face-display);
          font-optical-sizing: auto;
          font-size: var(--t-display);
          font-weight: var(--t-display-weight);
          line-height: var(--t-display-lh);
          letter-spacing: var(--t-display-tracking);
          color: var(--ink-hi);
          text-wrap: balance;
        }
        .loz-error-lede {
          font-size: var(--t-body);
          line-height: var(--t-body-lh);
          text-wrap: pretty;
        }
        .loz-error-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          gap: var(--sp-3);
          margin-top: var(--sp-2);
        }
        /* The retry is a control, so it is the secondary button: Plex 600
           on glass, 44px tall. */
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
          background: linear-gradient(180deg, var(--glass-raised-top), var(--glass-raised-bottom));
          border: 1px solid var(--glass-edge);
          border-radius: var(--radius-2);
          cursor: pointer;
          transition:
            background-color var(--dur-fast) var(--ease-out),
            border-color var(--dur-fast) var(--ease-out),
            transform var(--dur-fast) var(--ease-out);
        }
        .loz-error-retry:hover {
          background: linear-gradient(180deg, var(--glass-top), var(--glass-middle));
          border-color: color-mix(in oklab, var(--ink-hi) 45%, transparent);
          transform: translateY(-1px);
        }
        .loz-error-retry:active {
          transform: translateY(0);
        }
        .loz-error-home {
          display: inline-flex;
          align-items: center;
          min-height: 2.75rem;
          padding: var(--sp-2) var(--sp-2);
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
          <button type="button" className="loz-error-retry" onClick={() => reset()}>
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
