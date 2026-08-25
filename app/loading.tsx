/**
 * Route-transition fallback: hold the ground color so navigation never
 * flashes unstyled content, with one quiet scan line breathing at center.
 * Static under prefers-reduced-motion.
 */
export default function Loading() {
  return (
    <div className="loz-loading" role="status" aria-label="Loading">
      <style>{`
        .loz-loading {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          background: #070b14;
        }
        .loz-loading-line {
          width: min(9rem, 40vw);
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(201, 162, 75, 0.85),
            transparent
          );
          animation: loz-loading-pulse 1.6s ease-in-out infinite;
        }
        @keyframes loz-loading-pulse {
          0%, 100% { opacity: 0.15; transform: scaleX(0.55); }
          50% { opacity: 0.9; transform: scaleX(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .loz-loading-line {
            animation: none;
            opacity: 0.5;
          }
        }
      `}</style>
      <span className="loz-loading-line" aria-hidden="true" />
    </div>
  );
}
