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
 * It is not a reason to be off-system, though, and this was the last surface
 * still speaking V1 — Cinzel, uppercase, +0.18em on the H1, and a 0.66rem
 * digest below the type floor — because a `<style>` string in a `.tsx` is
 * invisible to every grep that audits `*.css`. Every value now reads a V2
 * token from `app/globals.css` (`.ai/DESIGN-V2.md`) with a literal fallback
 * beside it, so if globals.css *is* the thing that broke, the page degrades
 * to these hard values rather than to unstyled text. `app/not-found.tsx` is
 * this page's sibling and the model it now matches.
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
          padding: 24px;
          /* The real ground and its texture, not a flat panel over them —
             the opaque paint here used to hide body's --scan-ground. */
          background-color: var(--color-cosmic-void, #000);
          background-image: var(--scan-ground);
          color: var(--ink, #cbc7bd);
          text-align: center;
        }
        .loz-error-inner {
          display: grid;
          justify-items: center;
          gap: 18px;
          max-width: 34rem;
          padding: clamp(1.5rem, 5vw, 3rem);
          border: 1px solid var(--glass-edge, rgba(246,243,235,.28));
          border-radius: 1.2rem;
          background: linear-gradient(180deg, var(--glass-top, rgba(150,147,140,.22)), var(--glass-middle, rgba(45,44,42,.29)), var(--glass-bottom, rgba(8,8,8,.64)));
          box-shadow: inset 0 1px var(--glass-inner, rgba(255,255,255,.25)), 0 2rem 5rem var(--glass-shadow, rgba(0,0,0,.58));
          -webkit-backdrop-filter: blur(16px) saturate(.72);
          backdrop-filter: blur(16px) saturate(.72);
        }
        /* Two words, so uppercase is allowed — but at the tracking cap.
           0.32em was the widest value in the repo. */
        .loz-error-code {
          font-family: var(--font-mono, ui-monospace, 'SF Mono', Menlo, monospace);
          font-size: var(--t-data, 0.72rem);
          line-height: var(--t-data-lh, 1.45);
          letter-spacing: var(--t-data-tracking, 0.08em);
          text-transform: uppercase;
          color: var(--gold, #c6a15b);
        }
        .loz-error-title {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-weight: 400;
          font-size: var(--t-display, 2.1rem);
          line-height: var(--t-display-lh, 1.15);
          color: var(--ink-hi, #f6f3eb);
        }
        .loz-error-lede {
          font-size: var(--t-body, 1.0625rem);
          line-height: var(--t-body-lh, 1.7);
        }
        .loz-error-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 14px;
          margin-top: 6px;
        }
        /* "Re-establish signal" is two words: the one control here that is
           still a label rather than a sentence. */
        .loz-error-retry {
          font: inherit;
          font-family: var(--face-data, ui-monospace, 'SF Mono', Menlo, monospace);
          font-size: var(--t-data, 0.72rem);
          line-height: var(--t-data-lh, 1.45);
          letter-spacing: var(--t-data-tracking, 0.08em);
          text-transform: uppercase;
          color: var(--ink-hi, #f6f3eb);
          background: linear-gradient(180deg, var(--glass-raised-top, rgba(115,112,105,.28)), var(--glass-raised-bottom, rgba(4,4,4,.88)));
          border: 1px solid var(--glass-edge, rgba(246,243,235,.28));
          border-radius: .7rem;
          padding: 0.7rem 1.3rem;
          cursor: pointer;
        }
        .loz-error-retry:hover {
          background: rgba(255,255,255,.11);
          border-color: var(--gold, #c6a15b);
        }
        .loz-error-home {
          font-family: var(--face-data, ui-monospace, 'SF Mono', Menlo, monospace);
          font-size: var(--t-data, 0.72rem);
          line-height: var(--t-data-lh, 1.45);
          letter-spacing: var(--t-data-tracking, 0.08em);
          text-decoration: none;
          color: var(--gold-hi, #efd79a);
          padding: 0.7rem 0.4rem;
        }
        .loz-error-home:hover { color: var(--gold, #c9a24b); }
        /* Was 0.66rem — 10.56px, the only sub-floor declaration outside the
           particle scene and the chat. --data-blue-dim is 4.81:1 on true
           black, so it clears AA at the floor; it stays the dimmest thing
           here because it is a reference string for a support thread rather
           than something anyone reads. */
        .loz-error-digest {
          font-family: var(--face-data, ui-monospace, 'SF Mono', Menlo, monospace);
          font-size: var(--t-data, 0.72rem);
          line-height: var(--t-data-lh, 1.45);
          letter-spacing: var(--t-data-tracking, 0.08em);
          color: var(--ink-lo, #88837b);
        }
        .loz-error a:focus-visible,
        .loz-error button:focus-visible {
          outline: 2px solid var(--gold-hi, #efd79a);
          outline-offset: 3px;
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
