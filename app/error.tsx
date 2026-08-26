'use client';
/**
 * Route error boundary — the signal dropped, calmly.
 *
 * Same palette locks as everywhere else: gold #C9A24B on #070B14, focus ring
 * 2px #EFD79A at 3px offset. Styles are inline/co-located so a broken shared
 * stylesheet can never take the error screen down with it.
 */
import Link from 'next/link';
import { useEffect } from 'react';

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
      <style>{`
        .loz-error {
          height: 100dvh;
          overflow-y: auto;
          display: grid;
          place-items: center;
          padding: 24px;
          background: #000000;
          color: #9fb3c8;
          text-align: center;
        }
        .loz-error-inner {
          display: grid;
          justify-items: center;
          gap: 18px;
          max-width: 34rem;
        }
        .loz-error-code {
          font-family: var(--font-geist-mono), ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.72rem;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: #57a7d9;
        }
        .loz-error-title {
          font-family: var(--font-cinzel), Georgia, 'Times New Roman', serif;
          font-weight: 400;
          font-size: clamp(1.6rem, 5vw, 2.6rem);
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #c9a24b;
        }
        .loz-error-lede {
          font-size: 0.96rem;
          line-height: 1.7;
        }
        .loz-error-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 14px;
          margin-top: 6px;
        }
        .loz-error-retry {
          font: inherit;
          font-family: var(--font-geist-mono), ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.8rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #070b14;
          background: #c9a24b;
          border: 1px solid #c9a24b;
          border-radius: 3px;
          padding: 0.7rem 1.3rem;
          cursor: pointer;
        }
        .loz-error-retry:hover { background: #efd79a; border-color: #efd79a; }
        .loz-error-home {
          font-family: var(--font-geist-mono), ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.8rem;
          letter-spacing: 0.14em;
          text-decoration: none;
          color: #efd79a;
          padding: 0.7rem 0.4rem;
        }
        .loz-error-home:hover { color: #c9a24b; }
        .loz-error-digest {
          font-family: var(--font-geist-mono), ui-monospace, 'SF Mono', Menlo, monospace;
          font-size: 0.66rem;
          letter-spacing: 0.12em;
          color: #3e7fa8;
        }
        .loz-error a:focus-visible,
        .loz-error button:focus-visible {
          outline: 2px solid #efd79a;
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
